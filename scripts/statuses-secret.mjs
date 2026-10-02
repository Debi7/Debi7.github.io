// The Clerk secret key of the local status service, kept encrypted on this disk. Added 2026-10-02 at
// the owner's request ("make these keys inaccessible"): scripts/statuses-key.mjs writes the file,
// scripts/statuses-dev.mjs reads it, and ADMIN.md section 4.2 is the how-to.
//
// The encryption is Windows' Data Protection API (DPAPI), reached through PowerShell 5.1, which is
// part of every Windows 10 and 11: ConvertFrom-SecureString without a key of its own encrypts with a
// key Windows keeps for the signed-in account, and ConvertTo-SecureString decrypts it again for that
// account only. So workers/statuses/clerk-secret.local.dpapi is useless anywhere else: on another
// computer, under another Windows account, in a backup, an archive of the folder, a message, a
// screenshot, or a commit made by mistake. What it cannot stop is a program running as this same
// Windows account, which can decrypt it exactly as the service does; no file on a machine that has
// to use the key can stop that.
//
// The key never travels on a command line, which other programs may list: PowerShell gets its
// script base64-encoded (-EncodedCommand, so no quoting can break it) and the file's path through an
// environment variable of its own process, and it prints the key to a pipe that only this process
// reads. On a system other than Windows there is no DPAPI; the service then takes the key from the
// environment variable CLERK_SECRET_KEY (ADMIN.md 4.2).
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const secretFile = fileURLToPath(
  new URL("../workers/statuses/clerk-secret.local.dpapi", import.meta.url),
);
// The shape the status Worker accepts (workers/statuses/worker.mjs, clerkApi()).
export const secretKeyPattern = /^sk_(?:test|live)_\w+$/;

/** A PowerShell script as -EncodedCommand wants it: UTF-16LE, base64. */
export function encodeCommand(script) {
  return Buffer.from(script, "utf16le").toString("base64");
}

const decrypt = [
  "$ErrorActionPreference = 'Stop'",
  // Added the same day: without it PowerShell writes its module-loading progress to stderr as
  // CLIXML, which buried the real error line.
  "$ProgressPreference = 'SilentlyContinue'",
  // Changed the same day: the work is in a try whose catch prints the error's own message and
  // exits 2. A script run with -EncodedCommand writes its errors to stderr as CLIXML, an XML
  // envelope whose first line is only "#< CLIXML" - measured on this machine.
  "try { $secure = (Get-Content -Raw -LiteralPath $env:KB_SECRET_FILE).Trim() | ConvertTo-SecureString; $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure); try { [Console]::Out.Write([Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) } } catch { [Console]::Out.Write($_.Exception.Message); exit 2 }",
].join("; ");

/**
 * The key in `file`, decrypted. Throws when it cannot be, with PowerShell's first line of error -
 * which names the file or DPAPI, never the key.
 */
export function readSecret(file = secretFile) {
  const result = spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-EncodedCommand",
      encodeCommand(decrypt),
    ],
    {
      env: { ...process.env, KB_SECRET_FILE: file },
      encoding: "utf8",
      windowsHide: true,
      timeout: 30000,
    },
  );
  if (result.error !== undefined) throw result.error;
  // Added the same day (the script's note): exit 2 carries the reason on stdout - a missing file,
  // or DPAPI's "Key not valid for use in specified state" under another account; never the key.
  if (result.status === 2) {
    throw new Error(
      `PowerShell could not decrypt ${file}: ${result.stdout.trim()}`,
    );
  }
  if (result.status !== 0) {
    const first = (result.stderr ?? "").trim().split(/\r?\n/)[0] ?? "";
    throw new Error(`PowerShell could not decrypt ${file}: ${first}`);
  }
  return result.stdout.trim();
}
