// Saves the Clerk secret key of the local status service encrypted, for this Windows account only.
// Added 2026-10-02 at the owner's request ("make these keys inaccessible"); `npm run statuses:key`,
// ADMIN.md 4.2. scripts/statuses-secret.mjs says how the encryption works and what it protects
// against.
//
// Where the key comes from:
// - workers/statuses/settings.local.json, when it still holds CLERK_SECRET_KEY (the first way of
//   ADMIN.md, before the encryption): that value is encrypted, and the script then says to delete
//   the line. It never edits that file itself.
// - Otherwise a prompt in PowerShell (Read-Host -AsSecureString) that shows each character typed or
//   pasted as an asterisk and keeps it in no history.
//
// Safety:
// - An encrypted file that is already there is replaced only with --replace
//   (`npm run statuses:key -- --replace`), so running the command twice by mistake changes nothing.
// - The new file is written beside the old one first (clerk-secret.local.dpapi.new), read back, and
//   checked to be a secret key; only then does it take the old one's place. When anything fails,
//   the half-written new file is removed and the old one is left as it was.
// - The key is never printed, not even in part: the message names only its kind (test or live)
//   and its length.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, renameSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  encodeCommand,
  readSecret,
  secretFile,
  secretKeyPattern,
} from "./statuses-secret.mjs";

const settingsFile = fileURLToPath(
  new URL("../workers/statuses/settings.local.json", import.meta.url),
);
const shown = "workers/statuses/clerk-secret.local.dpapi";

if (process.platform !== "win32") {
  console.error(
    "This command uses Windows' DPAPI. On this system, set CLERK_SECRET_KEY in the environment of `npm run statuses:dev` instead (ADMIN.md 4.2).",
  );
  process.exit(1);
}
if (existsSync(secretFile) && !process.argv.includes("--replace")) {
  console.error(
    `The key is already saved (${shown}). To save another one: npm run statuses:key -- --replace`,
  );
  process.exit(1);
}

let fromSettings;
if (existsSync(settingsFile)) {
  try {
    const value = JSON.parse(
      readFileSync(settingsFile, "utf8"),
    ).CLERK_SECRET_KEY;
    if (typeof value === "string" && value.trim() !== "") {
      fromSettings = value.trim();
    }
  } catch {
    console.error(
      "workers/statuses/settings.local.json is not valid JSON; the key will be asked for instead.",
    );
  }
}

const temp = `${secretFile}.new`;
const save = [
  "$ErrorActionPreference = 'Stop'",
  // As in statuses-secret.mjs: no module-loading progress in the terminal.
  "$ProgressPreference = 'SilentlyContinue'",
  // The error's own message in plain text, not CLIXML (statuses-secret.mjs, the decrypt script).
  "try { if ($env:KB_CLERK_SECRET) { $secure = ConvertTo-SecureString $env:KB_CLERK_SECRET -AsPlainText -Force } else { $secure = Read-Host 'Clerk secret key (sk_test_...), shown as asterisks' -AsSecureString }; ConvertFrom-SecureString $secure | Set-Content -Encoding ascii -LiteralPath $env:KB_SECRET_FILE } catch { [Console]::Error.WriteLine($_.Exception.Message); exit 2 }",
].join("; ");
const env = { ...process.env, KB_SECRET_FILE: temp };
if (fromSettings !== undefined) {
  env.KB_CLERK_SECRET = fromSettings;
  console.log("Taking the key from workers/statuses/settings.local.json.");
}

const failed = (message) => {
  rmSync(temp, { force: true });
  console.error(`${message} Nothing was saved.`);
  process.exit(1);
};

const result = spawnSync(
  "powershell.exe",
  ["-NoProfile", "-EncodedCommand", encodeCommand(save)],
  { env, stdio: "inherit" },
);
if (result.error !== undefined) failed(result.error.message);
if (result.status !== 0) failed("PowerShell stopped with an error.");

let key;
try {
  key = readSecret(temp);
} catch (error) {
  failed(error instanceof Error ? error.message : String(error));
}
if (!secretKeyPattern.test(key)) {
  failed(
    "That is not a Clerk secret key: it starts with sk_test_ or sk_live_ (Clerk Dashboard -> API keys -> Secret keys).",
  );
}
renameSync(temp, secretFile);
console.log(
  `Saved, encrypted for this Windows account: ${shown} (${key.startsWith("sk_live_") ? "a live" : "a test"} key, ${key.length} characters).`,
);
if (fromSettings !== undefined) {
  console.log(
    'Now open workers/statuses/settings.local.json and delete the line with "CLERK_SECRET_KEY" (keep "ADMIN_IDS"). The service no longer reads the key from there.',
  );
}
