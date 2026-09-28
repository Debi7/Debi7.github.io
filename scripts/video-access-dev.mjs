// Runs the access service for paid videos (workers/video-access/worker.mjs) on this machine, at
// http://127.0.0.1:8787, for `npm run dev`. Added 2026-09-28 with paid videos (PAID-VIDEO.md).
//
// The Worker is plain JavaScript on web APIs that Node 20 has too, so a small node:http adapter is
// enough; no wrangler and no new dependency. The settings it gets:
// - CLERK_PUBLISHABLE_KEY: read from src/config.ts, so the local service trusts exactly the Clerk
//   instance the local site signs in with.
// - ALLOWED_ORIGINS: the dev server on its default port 4321, the spare port 4387 and the preview
//   port 4388 of check:auth (CLAUDE.md, Workflow), each as localhost and as 127.0.0.1, which are
//   different origins to a browser.
// - VIDEOS: workers/video-access/videos.local.json, read on every request so an edit needs no
//   restart. The file is ignored by git: it maps slugs to real video ids, which never enter the
//   repository. Without it every paid video answers "not connected yet".
import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import worker from "../workers/video-access/worker.mjs";

const port = 8787;
const config = readFileSync(
  new URL("../src/config.ts", import.meta.url),
  "utf8",
);
const publishableKey = /publishableKey:\s*"([^"]*)"/.exec(config)?.[1] ?? "";
const videosFile = new URL(
  "../workers/video-access/videos.local.json",
  import.meta.url,
);
const origins = [4321, 4387, 4388].flatMap((p) => [
  `http://localhost:${p}`,
  `http://127.0.0.1:${p}`,
]);

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
    VIDEOS: existsSync(videosFile) ? readFileSync(videosFile, "utf8") : "{}",
  };
  const response = await worker.fetch(request, env);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
  console.log(req.method, req.url, response.status);
}).listen(port, "127.0.0.1", () => {
  console.log(`video-access on http://127.0.0.1:${port}/video`);
  console.log(
    existsSync(videosFile)
      ? `VIDEOS from ${videosFile.pathname}`
      : "No workers/video-access/videos.local.json: every paid video is 'not connected yet' (PAID-VIDEO.md).",
  );
});
