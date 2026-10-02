// Runs the admin panel's status service (workers/statuses/worker.mjs) on this machine, at
// http://127.0.0.1:8790, for `npm run dev`. Added 2026-10-02 with the owner's status model
// (ADMIN.md).
//
// Like scripts/video-access-dev.mjs: a small node:http adapter, no wrangler, no new dependency.
// The settings it gets:
// - CLERK_PUBLISHABLE_KEY: read from src/config.ts, the instance the local site signs in with.
// - ALLOWED_ORIGINS: the dev server's ports 4321, 4387 and 4388, as localhost and as 127.0.0.1.
// - CLERK_SECRET_KEY and ADMIN_IDS: from workers/statuses/settings.local.json, read on every request
//   so an edit needs no restart. The file is ignored by git, because the secret key controls every
//   user of the instance and must never enter the repository (ADMIN.md says what to put in it).
//   Without it the service answers 503 and the panel says it is not connected. This runner talks to
//   the real Clerk instance: a status set here is set for that user everywhere.
//   Changed later on 2026-10-02 at the owner's request ("make these keys inaccessible"): the secret
//   key is no longer read from settings.local.json, which keeps ADMIN_IDS only. It comes from
//   workers/statuses/clerk-secret.local.dpapi, encrypted for this Windows account by
//   `npm run statuses:key` (scripts/statuses-secret.mjs says how), or, when set, from the
//   environment variable CLERK_SECRET_KEY, the way on a system without DPAPI. A key still left in
//   settings.local.json is ignored, with a warning to delete it. The decrypted key lives only in
//   this process; it is decrypted again only when the file changes.
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import worker from "../workers/statuses/worker.mjs";
import { readSecret, secretFile } from "./statuses-secret.mjs";

const port = 8790;
const config = readFileSync(
  new URL("../src/config.ts", import.meta.url),
  "utf8",
);
const publishableKey = /publishableKey:\s*"([^"]*)"/.exec(config)?.[1] ?? "";
const settingsFile = new URL(
  "../workers/statuses/settings.local.json",
  import.meta.url,
);
const origins = [4321, 4387, 4388].flatMap((p) => [
  `http://localhost:${p}`,
  `http://127.0.0.1:${p}`,
]);

// { CLERK_SECRET_KEY, ADMIN_IDS } from the local file, or nothing when it is missing or broken.
// Changed later on 2026-10-02 (the header): ADMIN_IDS only, plus the secret key from secretKey().
let warnedAboutPlainKey = false;
function localSettings() {
  const settings = { CLERK_SECRET_KEY: secretKey() };
  if (!existsSync(settingsFile)) return settings;
  try {
    const { CLERK_SECRET_KEY, ADMIN_IDS } = JSON.parse(
      readFileSync(settingsFile, "utf8"),
    );
    if (CLERK_SECRET_KEY !== undefined && !warnedAboutPlainKey) {
      warnedAboutPlainKey = true;
      console.error(
        'statuses: settings.local.json still holds "CLERK_SECRET_KEY" in plain text, and it is not used. Run `npm run statuses:key`, then delete that line (ADMIN.md 4.2).',
      );
    }
    return { ...settings, ADMIN_IDS };
  } catch {
    console.error("statuses: settings.local.json is not valid JSON");
    return settings;
  }
}

// Added later on 2026-10-02 (the header): the secret key, from the environment or the encrypted
// file, decrypted once per change of the file; undefined when there is none or it cannot be read,
// which the Worker answers with 503 "not_configured".
let decrypted = { stamp: -1, key: undefined };
function secretKey() {
  if (process.env.CLERK_SECRET_KEY) return process.env.CLERK_SECRET_KEY;
  if (process.platform !== "win32" || !existsSync(secretFile)) return undefined;
  const stamp = statSync(secretFile).mtimeMs;
  if (stamp !== decrypted.stamp) {
    let key;
    try {
      key = readSecret();
    } catch (error) {
      console.error(
        "statuses:",
        error instanceof Error ? error.message : error,
      );
    }
    decrypted = { stamp, key };
  }
  return decrypted.key;
}

createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const request = new Request(`http://127.0.0.1:${port}${req.url}`, {
    method: req.method,
    headers: Object.entries(req.headers).flatMap(([name, value]) =>
      value === undefined ? [] : [[name, String(value)]],
    ),
    body: hasBody && chunks.length > 0 ? Buffer.concat(chunks) : undefined,
  });
  const env = {
    CLERK_PUBLISHABLE_KEY: publishableKey,
    ALLOWED_ORIGINS: origins.join(","),
    ...localSettings(),
  };
  const response = await worker.fetch(request, env);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
  console.log(req.method, req.url, response.status);
}).listen(port, "127.0.0.1", () => {
  console.log(`statuses on http://127.0.0.1:${port}/users/...`);
  console.log(
    existsSync(settingsFile)
      ? "Settings from workers/statuses/settings.local.json."
      : "No workers/statuses/settings.local.json: the status service answers 503 (ADMIN.md).",
  );
  // Added later on 2026-10-02: where the secret key comes from, read once at start so a broken
  // file shows here rather than at the first click. Never the key itself.
  console.log(
    process.env.CLERK_SECRET_KEY
      ? "Clerk secret key: from the environment variable CLERK_SECRET_KEY."
      : secretKey() !== undefined
        ? "Clerk secret key: from the encrypted file (npm run statuses:key)."
        : "No Clerk secret key: run `npm run statuses:key` (ADMIN.md 4.2); until then the service answers 503.",
  );
});
