// A stand-in for the few GitHub API calls of the admin panel's content service
// (workers/content-admin/worker.mjs), working on the files of a folder instead of a repository.
// Added 2026-10-02 with the admin panel (.specify/consilium/2026-10-02-admin-posts.md).
//
// Two users: scripts/content-admin-dev.mjs points it at this working copy, so that a post saved in
// the panel on this machine lands in src/content/posts/ and `npm run dev` shows it at once - the
// same thing the live service does to the repository, minus the build; and
// scripts/check-content-admin.mjs points it at a temporary copy and counts its calls. Plain Node,
// no new dependency.
//
// What it answers, shaped as GitHub answers it (only what the Worker reads):
//   POST /graphql                                    the posts folder with every file's text
//   GET    /repos/<repo>/contents/<path>?ref=<b>     {type, encoding, content, sha}
//   PUT    /repos/<repo>/contents/<path>             create (no sha) or update (sha must match)
//   DELETE /repos/<repo>/contents/<path>             delete (sha must match)
// GitHub's answers to a wrong sha are kept: 409 when it is not the file's, 422 when a new file's
// address is taken. A sha is git's blob sha, computed the way git does, so the Worker sees the same
// values it would see on GitHub. It refuses any path outside the posts folder, as the Worker does,
// so a bug in the Worker cannot write anywhere else in this working copy either.
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

const POSTS_DIR = "src/content/posts";
const ALLOWED_PATH = /^src\/content\/posts\/[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;

/** git's blob id of the bytes: sha1 of "blob <length>\0" and the bytes. */
export function blobSha(bytes) {
  return createHash("sha1")
    .update(`blob ${bytes.length}\0`)
    .update(bytes)
    .digest("hex");
}

/**
 * @param {{ root: string, repo: string, branch: string, token: string }} options
 * root is the folder that plays the repository; token is the one the Worker must send.
 */
export function gitHubStandIn({ root, repo, branch, token }) {
  /** Every call, in order: what the checks look at. */
  const calls = [];
  const json = (status, body) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  const fileOf = (path) => join(root, ...path.split("/"));

  async function handle(request) {
    const url = new URL(request.url);
    const call = { method: request.method, path: url.pathname, wrote: false };
    calls.push(call);
    if (request.headers.get("Authorization") !== `Bearer ${token}`) {
      return json(401, { message: "Bad credentials" });
    }

    if (request.method === "POST" && url.pathname === "/graphql") {
      const { variables } = await request.json();
      const folder = join(root, ...POSTS_DIR.split("/"));
      if (
        variables?.expression !== `${branch}:${POSTS_DIR}` ||
        !existsSync(folder)
      ) {
        return json(200, { data: { repository: { object: null } } });
      }
      const entries = readdirSync(folder).map((name) => {
        const bytes = readFileSync(join(folder, name));
        return {
          name,
          type: "blob",
          object: { oid: blobSha(bytes), text: bytes.toString("utf8") },
        };
      });
      return json(200, { data: { repository: { object: { entries } } } });
    }

    const prefix = `/repos/${repo}/contents/`;
    if (!url.pathname.startsWith(prefix)) {
      return json(404, { message: "Not Found" });
    }
    const path = decodeURIComponent(url.pathname.slice(prefix.length));
    if (!ALLOWED_PATH.test(path)) {
      return json(403, { message: "The stand-in serves the posts only" });
    }
    const file = fileOf(path);
    const current = existsSync(file) ? readFileSync(file) : undefined;

    if (request.method === "GET") {
      if (url.searchParams.get("ref") !== branch || current === undefined) {
        return json(404, { message: "Not Found" });
      }
      // GitHub wraps the base64 at 60 characters; the Worker has to cope with that.
      const content = current.toString("base64").replace(/.{60}/g, "$&\n");
      return json(200, {
        type: "file",
        encoding: "base64",
        path,
        sha: blobSha(current),
        content,
      });
    }

    const body = await request.json();
    if (body?.branch !== branch) {
      return json(422, { message: "No such branch" });
    }
    const commit = createHash("sha1")
      .update(`${path}${Date.now()}${Math.random()}`)
      .digest("hex");

    if (request.method === "PUT") {
      if (current !== undefined && body.sha === undefined) {
        return json(422, {
          message: 'Invalid request.\n\n"sha" wasn\'t supplied.',
        });
      }
      if (current === undefined && body.sha !== undefined) {
        return json(404, { message: "Not Found" });
      }
      if (current !== undefined && body.sha !== blobSha(current)) {
        return json(409, { message: `${path} does not match ${body.sha}` });
      }
      const bytes = Buffer.from(body.content ?? "", "base64");
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, bytes);
      call.wrote = true;
      return json(current === undefined ? 201 : 200, {
        content: { path, sha: blobSha(bytes) },
        commit: { sha: commit },
      });
    }

    if (request.method === "DELETE") {
      if (current === undefined) return json(404, { message: "Not Found" });
      if (body.sha !== blobSha(current)) {
        return json(409, { message: `${path} does not match ${body.sha}` });
      }
      rmSync(file);
      call.wrote = true;
      return json(200, { content: null, commit: { sha: commit } });
    }

    return json(405, { message: "Method not allowed" });
  }

  return { handle, calls };
}
