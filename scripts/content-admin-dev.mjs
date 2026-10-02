// Runs the admin panel's content service (workers/content-admin/worker.mjs) on this machine, at
// http://127.0.0.1:8789, for `npm run dev`. Added 2026-10-02 with the admin panel (ADMIN.md).
//
// Like scripts/video-access-dev.mjs: a small node:http adapter, no wrangler, no new dependency.
// The settings it gets:
// - CLERK_PUBLISHABLE_KEY: read from src/config.ts, so the local service trusts exactly the Clerk
//   instance the local site signs in with; a session token from it is checked in full, status
//   included, so the panel needs the same Clerk setup on this machine as on the live site.
// - ALLOWED_ORIGINS: the dev server's ports 4321, 4387 and 4388, as localhost and as 127.0.0.1.
// - GITHUB_*: no GitHub at all. GITHUB_API points at an address this process answers itself, with
//   scripts/github-stand-in.mjs working on THIS working copy: a post saved, edited or deleted in
//   the panel changes src/content/posts/ here, exactly as the live service changes the
//   repository, and `npm run dev` shows the result at once. `git status` lists those changes, and
//   git undoes them like any other edit; nothing outside src/content/posts/ is ever touched.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import worker from "../workers/content-admin/worker.mjs";
import { gitHubStandIn } from "./github-stand-in.mjs";

const port = 8789;
const root = fileURLToPath(new URL("..", import.meta.url));
const config = readFileSync(
  new URL("../src/config.ts", import.meta.url),
  "utf8",
);
const publishableKey = /publishableKey:\s*"([^"]*)"/.exec(config)?.[1] ?? "";
const origins = [4321, 4387, 4388].flatMap((p) => [
  `http://localhost:${p}`,
  `http://127.0.0.1:${p}`,
]);
// A made-up address that never reaches the network: the fetch below answers it.
const standInApi = "http://github.stand-in.invalid";
const env = {
  CLERK_PUBLISHABLE_KEY: publishableKey,
  ALLOWED_ORIGINS: origins.join(","),
  GITHUB_REPO: "local/working-copy",
  GITHUB_BRANCH: "main",
  GITHUB_TOKEN: "local-stand-in",
  GITHUB_API: standInApi,
};
const standIn = gitHubStandIn({
  root,
  repo: env.GITHUB_REPO,
  branch: env.GITHUB_BRANCH,
  token: env.GITHUB_TOKEN,
});

// The Worker's calls to the stand-in are answered here; everything else (Clerk's key list) goes
// out as usual.
const networkFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const request = new Request(input, init);
  return request.url.startsWith(standInApi)
    ? standIn.handle(request)
    : networkFetch(request);
};

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
  const response = await worker.fetch(request, env);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
  console.log(req.method, req.url, response.status);
}).listen(port, "127.0.0.1", () => {
  console.log(`content-admin on http://127.0.0.1:${port}/posts/...`);
  console.log(
    "Saves change src/content/posts/ in this working copy (git status shows them).",
  );
});
