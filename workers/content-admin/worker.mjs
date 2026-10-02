// The content service of the admin panel: a Cloudflare Worker that adds, edits and deletes the
// site's posts for an editor who has no GitHub account. Added 2026-10-02; the design is the
// consilium verdict in .specify/consilium/2026-10-02-admin-posts.md, and ADMIN.md is the how-to.
//
// A post is a Markdown file in the repository, and the site is built from the repository, so
// saving a post means a commit on the branch GitHub Pages builds. Writing to GitHub needs a token,
// a token cannot sit in a static page, and GitHub Pages runs no code: so the token is a secret of
// this Worker, and the page sends it the post together with the editor's Clerk session token. The
// commit starts the site's build as any push does, and the post is on the site a couple of minutes
// later, found by the search and listed under its tags like a post written by hand.
//
// Plain JavaScript with no imports, deployed by pasting, for the same reasons as
// workers/video-access/worker.mjs (its header). The same file runs on this machine through
// scripts/content-admin-dev.mjs and is tested by scripts/check-content-admin.mjs. A Worker of its
// own, not a route of the video service, by the verdict: this one holds a token that can write to
// the repository, the other holds the links of the paid lectures, and neither should be exposed by
// a bug in the other.
//
// The contract. The site's src/scripts/admin-posts.ts is the only client. Every action is a POST
// with Authorization: Bearer <Clerk session token> and Content-Type: application/json.
//   OPTIONS /posts/<action>  CORS preflight: 204 for an Origin in ALLOWED_ORIGINS, 403 for any other.
//   POST /posts/list    {}                                  200 {"posts": [{slug, sha, title, ...}]}
//   POST /posts/get     {"slug"}                            200 {"post": {slug, sha, fields, body}}
//   POST /posts/save    {"slug", "sha"?, "fields", "body"}  200 {"slug", "sha", "commit", "lastmod"?}
//                       without "sha" a new post, with it an edit of the post read with that sha;
//                       an edit that changes nothing answers 200 {"slug", "sha", "unchanged": true}
//   POST /posts/delete  {"slug", "sha"}                     200 {"slug", "commit"}
//     400 {"error": "invalid", "problems": [{"field", "code"}]}  the request breaks a rule below
//     401 {"error": "unauthenticated", "reason"}  no token, or a token failing a check below
//     403 {"error": "forbidden"}                  a valid session whose status may not edit
//     404 {"error": "not_found"}                  no post with that address
//     409 {"error": "conflict"}                   the post changed since the editor opened it
//     409 {"error": "exists"}                     a new post at an address that is taken
//     413 {"error": "too_large"}                  the request is over REQUEST_LIMIT bytes
//     415 {"error": "content_type"}               not application/json
//     422 {"error": "unsupported"}                the post's front matter has a line this service
//                                                 does not edit (it says which posts in the list)
//     503 {"error": "unavailable"}                a setting is missing, or Clerk or GitHub failed
//   Any other path answers 404, any other method 405. Every answer carries
//   Cache-Control: private, no-store and Vary: Origin.
//
// The settings (Worker -> Settings -> Variables and Secrets):
//   CLERK_PUBLISHABLE_KEY  text    the same pk_... as site.clerk.publishableKey in src/config.ts
//   ALLOWED_ORIGINS        text    the site's origins, comma-separated
//   GITHUB_REPO            text    <owner>/<repository>, the repository the site is built from
//   GITHUB_BRANCH          text    the branch GitHub Pages builds, main
//   GITHUB_TOKEN           secret  a fine-grained token for that one repository, with
//                                  "Contents: read and write" and nothing else (ADMIN.md)
//   GITHUB_API             text    optional, https://api.github.com when absent; the local runner
//                                  points it at a stand-in that works on this working copy
//
// Who may: a session token whose claim `status` is one of EDITORS. The claim comes from the key `status`
// of the user's public metadata, through the session token template (CLERK-DASHBOARD.md 7.2); a
// user cannot write public metadata, only the Dashboard or the Backend API can.
//
// What a save may change, whatever the request says (the verdict's conditions):
// - one file, src/content/posts/<slug>.md, where the slug is Latin lower case, digits and hyphens,
//   not a bare number (/posts/<year>/ is a list page) and not a reserved name; nothing else in the
//   repository, so the token cannot be steered at the site's code or its build;
// - the front matter is written here from typed fields, never pasted from the request: quoted
//   strings without line breaks, lists of such strings, a boolean, a date; only the fields the
//   `posts` schema has (src/content/post-fields.ts), so `access`, `videoId` or `layout` cannot be
//   slipped in;
// - an edit rewrites only the lines of the fields the panel owns and only when their value changed,
//   and keeps every other line - comments and the fields the panel does not show - as it was; it
//   stamps `lastmod`, which the page shows as "last updated" and which tells the panel that the new
//   version is live;
// - the body may not contain raw HTML outside code, or a link to javascript:, data: or any other
//   address that is not a web page, a mail address or a path: Astro passes raw HTML through to the
//   page unchanged, and the pages share their origin with the sign-in pages;
// - a new post never replaces an existing one, an edit or a deletion of a post that changed since
//   it was read answers 409, and the branch is never forced, so nothing anybody else committed is
//   lost.

// Sent as X-Content-Admin-Version, so that a pasted copy that fell behind the repository shows.
const VERSION = "2026-10-02.1";
const LEEWAY_SECONDS = 5;
// A kid not in the cached key list makes the Worker fetch the list again, at most this often, so a
// stream of made-up kids cannot turn every request into a request to Clerk.
const JWKS_REFETCH_SECONDS = 60;

let jwks = { url: "", keys: new Map(), fetchedAt: 0 };

// The session check below, from frontendApiHost() to the end of verifySession(), is a copy of the
// same text in workers/video-access/worker.mjs: the Workers are pasted as single files, so they
// cannot share a module. scripts/check-content-admin.mjs fails when the two copies differ.

// "pk_test_<base64 of 'host$'>" -> "host", as Clerk's own parsePublishableKey reads it.
function frontendApiHost(publishableKey) {
  const match = /^pk_(?:test|live)_([A-Za-z0-9+/=]+)$/.exec(
    publishableKey ?? "",
  );
  if (match === null) return undefined;
  let decoded;
  try {
    decoded = atob(match[1]);
  } catch {
    return undefined;
  }
  return decoded.endsWith("$") ? decoded.slice(0, -1) : undefined;
}

function base64UrlBytes(part) {
  const binary = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function base64UrlJson(part) {
  return JSON.parse(new TextDecoder().decode(base64UrlBytes(part)));
}

function allowedOrigins(env) {
  return (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin !== "");
}

async function signingKey(host, kid, now) {
  const url = `https://${host}/.well-known/jwks.json`;
  if (jwks.url !== url) jwks = { url, keys: new Map(), fetchedAt: 0 };
  if (!jwks.keys.has(kid) && now - jwks.fetchedAt >= JWKS_REFETCH_SECONDS) {
    jwks.fetchedAt = now;
    const response = await fetch(url);
    if (!response.ok)
      throw new Error(`the key list answered ${response.status}`);
    const { keys } = await response.json();
    const map = new Map();
    for (const jwk of Array.isArray(keys) ? keys : []) {
      if (jwk?.kty === "RSA" && typeof jwk.kid === "string") {
        map.set(
          jwk.kid,
          await crypto.subtle.importKey(
            "jwk",
            jwk,
            { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
            false,
            ["verify"],
          ),
        );
      }
    }
    jwks.keys = map;
  }
  return jwks.keys.get(kid);
}

// { claims } for a valid session token, { reason } for anything else. Throws only when a setting
// is broken or Clerk cannot be reached, which is the service's fault, not the visitor's.
async function verifySession(authorization, env, now) {
  const match = /^Bearer ([\w-]+)\.([\w-]+)\.([\w-]+)$/.exec(
    authorization ?? "",
  );
  if (match === null) return { reason: "no_token" };
  const [, headerPart, payloadPart, signaturePart] = match;
  let header;
  let claims;
  try {
    header = base64UrlJson(headerPart);
    claims = base64UrlJson(payloadPart);
  } catch {
    return { reason: "malformed" };
  }
  if (header?.alg !== "RS256" || typeof header.kid !== "string") {
    return { reason: "algorithm" };
  }
  const host = frontendApiHost(env.CLERK_PUBLISHABLE_KEY);
  if (host === undefined) {
    throw new Error("CLERK_PUBLISHABLE_KEY is not a Clerk publishable key");
  }
  const key = await signingKey(host, header.kid, now);
  if (key === undefined) return { reason: "unknown_kid" };
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    base64UrlBytes(signaturePart),
    new TextEncoder().encode(`${headerPart}.${payloadPart}`),
  );
  if (!valid) return { reason: "signature" };
  if (claims?.iss !== `https://${host}`) return { reason: "issuer" };
  if (typeof claims.exp !== "number" || claims.exp + LEEWAY_SECONDS <= now) {
    return { reason: "expired" };
  }
  if (typeof claims.nbf !== "number" || claims.nbf - LEEWAY_SECONDS > now) {
    return { reason: "not_yet_valid" };
  }
  if (!allowedOrigins(env).includes(claims.azp)) return { reason: "azp" };
  if (typeof claims.sid !== "string") return { reason: "not_a_session" };
  if (claims.sts === "pending") return { reason: "pending" };
  return { claims };
}

// The end of the copied session check.

// The statuses that may add, edit and delete posts (the owner, 2026-10-02): a copy of
// site.admin.postEditors in src/config.ts, compared by scripts/check-content-admin.mjs. Exactly
// these strings in the claim `status`; anything else refuses.
const EDITORS = ["admin", "metr"];

function isEditor(claims) {
  return EDITORS.includes(claims.status);
}

const POSTS_DIR = "src/content/posts";
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// /posts/<year>/ and /posts/<year>/page/<n>/ are list pages, so a slug made of digits alone could
// take the place of one (CLAUDE.md: a post must never be named after a year); "page" is kept free
// for the same family of addresses.
const RESERVED_SLUGS = new Set(["page"]);
const LIMITS = {
  slug: 80,
  title: 200,
  description: 300,
  term: 60,
  tags: 20,
  categories: 10,
  body: 200_000,
};
// The whole request, in bytes: a body of 200,000 Cyrillic characters is about 400 KB of UTF-8.
const REQUEST_LIMIT = 512 * 1024;
// A character that would end a line of YAML or hide in one: control characters, and the two
// Unicode separators that JSON.stringify leaves as they are.
const CONTROL = /[\u0000-\u001f\u007f\u2028\u2029]/;
// The fields the panel owns, in the order a new file writes them: the order of every post so far.
const OWNED = ["title", "description", "date", "tags", "categories", "draft"];
// The address of every changed file is checked against this once more right before the commit.
const ALLOWED_PATH = /^src\/content\/posts\/[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;

function slugProblem(slug) {
  if (typeof slug !== "string" || slug === "") return "required";
  if (slug.length > LIMITS.slug) return "too_long";
  if (!SLUG.test(slug)) return "format";
  if (/^\d+$/.test(slug) || RESERVED_SLUGS.has(slug)) return "reserved";
  return undefined;
}

function lineProblem(value, limit, required) {
  if (typeof value !== "string") return "type";
  if (required && value.trim() === "") return "required";
  if (value.length > limit) return "too_long";
  if (CONTROL.test(value)) return "line_break";
  return undefined;
}

// A date and time with its offset, as the posts write it: 2026-07-13T10:00:00+03:00. The parts are
// checked one by one, because Date.parse turns 2026-02-31 into a day of March without a word.
const DATE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})([+-])(\d{2}):(\d{2})$/;

function dateProblem(value) {
  if (typeof value !== "string") return "type";
  const m = DATE.exec(value);
  if (m === null) return "format";
  const [year, month, day, hour, minute, second, , offH, offM] = m
    .slice(1)
    .map(Number);
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (month < 1 || month > 12 || day < 1 || day > days) return "format";
  if (hour > 23 || minute > 59 || second > 59 || offH > 14 || offM > 59) {
    return "format";
  }
  return undefined;
}

// `lower`: the tags, which the schema lower-cases, so "Лоза" and "лоза" are the same tag.
function termsProblem(value, max, lower) {
  if (!Array.isArray(value)) return "type";
  if (value.length > max) return "too_many";
  for (const term of value) {
    const problem = lineProblem(term, LIMITS.term, true);
    if (problem !== undefined) return problem;
    if (term !== term.trim() || term.includes(",")) return "format";
  }
  const seen = new Set(value.map((t) => (lower ? t.toLowerCase() : t)));
  if (seen.size !== value.length) return "duplicate";
  return undefined;
}

// What the body may not hold. Code is where a tag may legitimately be written as text, and math is
// typeset by KaTeX, which escapes it: both are taken out before looking.
function bodyProblem(body) {
  if (typeof body !== "string") return "type";
  if (body.length > LIMITS.body) return "too_long";
  const prose = body
    .replace(/^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?^ {0,3}\1[`~]*[ \t]*$/gm, "")
    .replace(/(`+)[\s\S]*?\1/g, "")
    .replace(/\$\$[\s\S]*?\$\$/g, "")
    .replace(/\$[^$\n]+\$/g, "");
  // An autolink to a web page or a mail address is Markdown, not HTML.
  const text = prose.replace(/<(?:https?:\/\/|mailto:)[^\s<>]*>/gi, "");
  if (/<[A-Za-z!?/]/.test(text)) return "html";
  // Where links may go: a web page, a mail address, an anchor, a path on this site, or a relative
  // path with no scheme. HTML entities count as a scheme too (&#106;avascript: decodes to one).
  const targets = [
    ...text.matchAll(/\]\(\s*<?([^\s)>]*)/g),
    ...text.matchAll(/^ {0,3}\[[^\]\n]+\]:\s*<?([^\s>]+)/gm),
  ].map((m) => m[1]);
  for (const target of targets) {
    const safe =
      /^(?:https?:\/\/|mailto:|#|\/|\.{1,2}\/)/i.test(target) ||
      (!target.includes(":") && !target.includes("&"));
    if (!safe) return "link";
  }
  return undefined;
}

// [{field, code}] for every rule a save breaks; empty when it breaks none.
function saveProblems(input) {
  const problems = [];
  const add = (field, code) => {
    if (code !== undefined) problems.push({ field, code });
  };
  const known = new Set(["slug", "sha", "fields", "body"]);
  for (const key of Object.keys(input)) {
    if (!known.has(key)) add(key, "unknown");
  }
  add("slug", slugProblem(input.slug));
  if (input.sha !== undefined && !/^[0-9a-f]{40}$/.test(input.sha)) {
    add("sha", "format");
  }
  const fields = input.fields;
  if (typeof fields !== "object" || fields === null || Array.isArray(fields)) {
    add("fields", "type");
  } else {
    for (const key of Object.keys(fields)) {
      if (!OWNED.includes(key)) add(key, "unknown");
    }
    add("title", lineProblem(fields.title, LIMITS.title, true));
    add(
      "description",
      lineProblem(fields.description, LIMITS.description, false),
    );
    add("date", dateProblem(fields.date));
    add("tags", termsProblem(fields.tags, LIMITS.tags, true));
    add(
      "categories",
      termsProblem(fields.categories, LIMITS.categories, false),
    );
    if (typeof fields.draft !== "boolean") add("draft", "type");
  }
  add("body", bodyProblem(input.body));
  return problems;
}

// One value of front matter as YAML: JSON's double-quoted strings and arrays are YAML too, and
// the strings here hold no line breaks (CONTROL above). Lists are spaced as the posts write them.
function yamlValue(value) {
  if (Array.isArray(value)) return `[${value.map(yamlValue).join(", ")}]`;
  return JSON.stringify(value);
}

// The front matter of an existing post, line by line. Every post so far writes one line per key -
// a quoted string, a [list], true or false, or a bare date - and comments; anything else marks the
// post as not editable here, rather than guessing at YAML this file does not read.
function parsePost(text) {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  if (match === null) return undefined;
  const lines = match[1].split("\n");
  const values = {};
  let supported = true;
  for (const line of lines) {
    if (/^\s*(?:#.*)?$/.test(line)) continue;
    const m = /^([A-Za-z_]\w*):[ \t]*(.*?)[ \t]*$/.exec(line);
    const value = m === null ? undefined : scalar(m[2]);
    if (m === null || value === undefined || Object.hasOwn(values, m[1])) {
      supported = false;
      continue;
    }
    values[m[1]] = value;
  }
  // The posts leave one blank line between the front matter and the text; the panel shows the
  // text without it and a save puts it back.
  const body = match[2].startsWith("\n") ? match[2].slice(1) : match[2];
  return { lines, values, body, supported };
}

function scalar(raw) {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw.startsWith('"') || raw.startsWith("[")) {
    try {
      return JSON.parse(raw);
    } catch {
      return undefined;
    }
  }
  // A bare value: only the dates two posts write without quotes.
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:[+-]\d{2}:\d{2}|Z)$/.test(raw)
    ? raw
    : undefined;
}

// What the panel shows of a post's fields, with the schema's defaults for what is absent.
function shownFields(values) {
  const list = (v) =>
    Array.isArray(v) && v.every((x) => typeof x === "string") ? v : [];
  return {
    title: typeof values.title === "string" ? values.title : "",
    description:
      typeof values.description === "string" ? values.description : "",
    date: typeof values.date === "string" ? values.date : "",
    tags: list(values.tags).map((t) => t.toLowerCase()),
    categories: list(values.categories),
    draft: values.draft === true,
  };
}

function sameValue(key, old, wanted) {
  if (key === "date") return Date.parse(old) === Date.parse(wanted);
  if (key === "tags" && Array.isArray(old)) {
    return (
      JSON.stringify(old.map((t) => String(t).toLowerCase())) ===
      JSON.stringify(wanted)
    );
  }
  return JSON.stringify(old) === JSON.stringify(wanted);
}

// The schema's defaults: a field the file leaves out and the editor leaves empty stays out.
function isDefault(key, value) {
  return (
    (key === "description" && value === "") ||
    ((key === "tags" || key === "categories") && value.length === 0) ||
    (key === "draft" && value === false)
  );
}

// "now" in the offset of the post's own date, the way the posts write a date.
function stamp(nowSeconds, date) {
  const m = /([+-])(\d{2}):(\d{2})$/.exec(date);
  const minutes =
    m === null ? 0 : (m[1] === "-" ? -1 : 1) * (+m[2] * 60 + +m[3]);
  const shifted = new Date((nowSeconds + minutes * 60) * 1000).toISOString();
  return `${shifted.slice(0, 19)}${m === null ? "Z" : m[0]}`;
}

// A whole file: the front matter lines, the blank line every post has after them, and the text
// with LF line endings and a final line break, as the posts in the repository are written.
function postText(lines, body) {
  const text = body.replace(/\r\n?/g, "\n");
  return `---\n${lines.join("\n")}\n---\n\n${text.endsWith("\n") ? text : `${text}\n`}`;
}

function newLines(fields) {
  return OWNED.filter(
    (key) => key !== "description" || fields.description !== "",
  ).map((key) => `${key}: ${yamlValue(fields[key])}`);
}

// An edit: only the lines of owned fields whose value changed are rewritten, and a field the file
// lacks is added at the end of the front matter; every other line stays as it was.
function editedLines(parsed, fields) {
  const lines = [...parsed.lines];
  for (const key of OWNED) {
    const index = lines.findIndex((line) => line.startsWith(`${key}:`));
    if (index !== -1) {
      if (!sameValue(key, parsed.values[key], fields[key])) {
        lines[index] = `${key}: ${yamlValue(fields[key])}`;
      }
    } else if (!isDefault(key, fields[key])) {
      lines.push(`${key}: ${yamlValue(fields[key])}`);
    }
  }
  return lines;
}

// lastmod replaced where the file has it, or put right after the date.
function withLastmod(lines, value) {
  const copy = [...lines];
  const line = `lastmod: ${yamlValue(value)}`;
  const index = copy.findIndex((l) => l.startsWith("lastmod:"));
  if (index !== -1) {
    copy[index] = line;
  } else {
    const date = copy.findIndex((l) => l.startsWith("date:"));
    copy.splice(date === -1 ? copy.length : date + 1, 0, line);
  }
  return copy;
}

function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function fromBase64(base64) {
  const binary = atob(base64.replace(/\s/g, ""));
  return new TextDecoder().decode(
    Uint8Array.from(binary, (c) => c.charCodeAt(0)),
  );
}

// Every call to GitHub goes through here. Throws when a setting is missing, so the handler answers
// 503; the message names the setting, never the token.
function gitHub(env) {
  const repo = env.GITHUB_REPO ?? "";
  const branch = env.GITHUB_BRANCH ?? "";
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    throw new Error("GITHUB_REPO is not <owner>/<repository>");
  }
  if (!/^[\w.-]+(?:\/[\w.-]+)*$/.test(branch)) {
    throw new Error("GITHUB_BRANCH is missing");
  }
  if (typeof env.GITHUB_TOKEN !== "string" || env.GITHUB_TOKEN === "") {
    throw new Error("GITHUB_TOKEN is missing");
  }
  const api = (env.GITHUB_API || "https://api.github.com").replace(/\/+$/, "");
  const call = (method, path, body) =>
    fetch(`${api}${path}`, {
      method,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        "Content-Type": "application/json",
        "User-Agent": "klub-content-admin",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
  return { repo, branch, call };
}

const LIST_QUERY = `query ($owner: String!, $name: String!, $expression: String!) {
  repository(owner: $owner, name: $name) {
    object(expression: $expression) {
      ... on Tree { entries { name type object { ... on Blob { oid text } } } }
    }
  }
}`;

// Every post with its text in one request (GitHub's GraphQL API), instead of one request per post:
// a Worker on the free plan may make 50 requests per visit.
async function listPosts(github) {
  const [owner, name] = github.repo.split("/");
  const response = await github.call("POST", "/graphql", {
    query: LIST_QUERY,
    variables: { owner, name, expression: `${github.branch}:${POSTS_DIR}` },
  });
  if (!response.ok) throw new Error(`GitHub answered ${response.status}`);
  const answer = await response.json();
  if (Array.isArray(answer?.errors) && answer.errors.length > 0) {
    throw new Error("GitHub's GraphQL API answered with errors");
  }
  const entries = answer?.data?.repository?.object?.entries ?? [];
  const posts = [];
  for (const entry of entries) {
    const slug = entry?.name?.endsWith(".md")
      ? entry.name.slice(0, -3)
      : undefined;
    if (entry?.type !== "blob" || slug === undefined) continue;
    const text = entry.object?.text;
    const parsed = typeof text === "string" ? parsePost(text) : undefined;
    posts.push({
      slug,
      sha: entry.object?.oid ?? "",
      ...shownFields(parsed?.values ?? {}),
      editable:
        parsed !== undefined &&
        parsed.supported &&
        slugProblem(slug) === undefined,
    });
  }
  return posts.sort(
    (a, b) =>
      (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0) ||
      a.slug.localeCompare(b.slug),
  );
}

// { sha, text } of a post on the branch, or undefined when there is none.
async function readPost(github, slug) {
  const response = await github.call(
    "GET",
    `/repos/${github.repo}/contents/${POSTS_DIR}/${slug}.md?ref=${encodeURIComponent(github.branch)}`,
  );
  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error(`GitHub answered ${response.status}`);
  const file = await response.json();
  if (file?.encoding !== "base64" || typeof file.sha !== "string") {
    throw new Error("GitHub sent a file this service cannot read");
  }
  return { sha: file.sha, text: fromBase64(file.content ?? "") };
}

// The one place a change reaches the repository: today a commit on the branch the site is built
// from, through GitHub's contents API, which takes one file per commit. When the hosting changes
// (the owner's word of 2026-10-02), this function is what changes. `file.text` null deletes.
// Answers "done", "conflict" (the file is not what `file.sha` says), or "exists" (a new file at a
// taken address); anything else throws.
async function publish(github, file, message) {
  if (!ALLOWED_PATH.test(file.path)) {
    throw new Error("a change outside the posts folder was refused");
  }
  const address = `/repos/${github.repo}/contents/${file.path}`;
  const response =
    file.text === null
      ? await github.call("DELETE", address, {
          message,
          sha: file.sha,
          branch: github.branch,
        })
      : await github.call("PUT", address, {
          message,
          content: toBase64(file.text),
          branch: github.branch,
          ...(file.sha === undefined ? {} : { sha: file.sha }),
        });
  if (response.ok) {
    const answer = await response.json();
    return {
      outcome: "done",
      sha: answer?.content?.sha ?? "",
      commit: answer?.commit?.sha ?? "",
    };
  }
  // GitHub answers 409 to a sha that is no longer the file's, and 422 to a new file whose address
  // is taken ("sha wasn't supplied") or to a deletion with a wrong sha.
  if (response.status === 409) return { outcome: "conflict" };
  if (response.status === 422) {
    return { outcome: file.sha === undefined ? "exists" : "conflict" };
  }
  if (response.status === 404 && file.sha !== undefined) {
    return { outcome: "conflict" };
  }
  throw new Error(`GitHub answered ${response.status}`);
}

function reply(status, body, origin, extra = {}) {
  const headers = new Headers({
    "Cache-Control": "private, no-store",
    Vary: "Origin",
    "X-Content-Admin-Version": VERSION,
    ...extra,
  });
  if (origin !== undefined) headers.set("Access-Control-Allow-Origin", origin);
  if (body !== null) headers.set("Content-Type", "application/json");
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers,
  });
}

const invalid = (problems, cors) =>
  reply(400, { error: "invalid", problems }, cors);

const actions = {
  async "/posts/list"(_input, { github, cors }) {
    return reply(200, { posts: await listPosts(github) }, cors);
  },

  async "/posts/get"(input, { github, cors }) {
    const problem = slugProblem(input.slug);
    if (problem !== undefined) {
      return invalid([{ field: "slug", code: problem }], cors);
    }
    const file = await readPost(github, input.slug);
    if (file === undefined) return reply(404, { error: "not_found" }, cors);
    const parsed = parsePost(file.text);
    if (parsed === undefined || !parsed.supported) {
      return reply(422, { error: "unsupported" }, cors);
    }
    return reply(
      200,
      {
        post: {
          slug: input.slug,
          sha: file.sha,
          fields: shownFields(parsed.values),
          body: parsed.body,
        },
      },
      cors,
    );
  },

  async "/posts/save"(input, { github, claims, now, cors }) {
    const problems = saveProblems(input);
    if (problems.length > 0) return invalid(problems, cors);
    const fields = {
      ...input.fields,
      tags: input.fields.tags.map((t) => t.toLowerCase()),
    };
    const path = `${POSTS_DIR}/${input.slug}.md`;
    const by = `through the admin panel (${claims.sub})`;

    if (input.sha === undefined) {
      const result = await publish(
        github,
        { path, text: postText(newLines(fields), input.body), sha: undefined },
        `Add the post ${input.slug} ${by}`,
      );
      if (result.outcome === "exists") {
        return reply(409, { error: "exists" }, cors);
      }
      return reply(
        200,
        { slug: input.slug, sha: result.sha, commit: result.commit },
        cors,
      );
    }

    const current = await readPost(github, input.slug);
    if (current === undefined) return reply(404, { error: "not_found" }, cors);
    if (current.sha !== input.sha) {
      return reply(409, { error: "conflict" }, cors);
    }
    const parsed = parsePost(current.text);
    if (parsed === undefined || !parsed.supported) {
      return reply(422, { error: "unsupported" }, cors);
    }
    const lines = editedLines(parsed, fields);
    // Nothing changed: no commit, and so no build of the whole site for nothing.
    if (postText(lines, input.body) === current.text) {
      return reply(
        200,
        { slug: input.slug, sha: current.sha, unchanged: true },
        cors,
      );
    }
    const lastmod = stamp(now, fields.date);
    const result = await publish(
      github,
      {
        path,
        text: postText(withLastmod(lines, lastmod), input.body),
        sha: current.sha,
      },
      `Edit the post ${input.slug} ${by}`,
    );
    if (result.outcome !== "done") {
      return reply(409, { error: "conflict" }, cors);
    }
    return reply(
      200,
      { slug: input.slug, sha: result.sha, commit: result.commit, lastmod },
      cors,
    );
  },

  async "/posts/delete"(input, { github, claims, cors }) {
    const problems = [];
    const slug = slugProblem(input.slug);
    if (slug !== undefined) problems.push({ field: "slug", code: slug });
    if (typeof input.sha !== "string" || !/^[0-9a-f]{40}$/.test(input.sha)) {
      problems.push({ field: "sha", code: "format" });
    }
    if (problems.length > 0) return invalid(problems, cors);
    const result = await publish(
      github,
      { path: `${POSTS_DIR}/${input.slug}.md`, text: null, sha: input.sha },
      `Delete the post ${input.slug} through the admin panel (${claims.sub})`,
    );
    if (result.outcome !== "done") {
      return reply(409, { error: "conflict" }, cors);
    }
    return reply(200, { slug: input.slug, commit: result.commit }, cors);
  },
};

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    const cors =
      origin !== null && allowedOrigins(env).includes(origin)
        ? origin
        : undefined;
    // As in the video service: a browser on another site is refused before any work; a request
    // without Origin goes on, and the token's azp still has to name one of the site's origins.
    if (origin !== null && cors === undefined)
      return reply(403, { error: "origin" });

    const action = Object.hasOwn(actions, new URL(request.url).pathname)
      ? actions[new URL(request.url).pathname]
      : undefined;
    if (action === undefined) return reply(404, { error: "not_found" }, cors);
    if (request.method === "OPTIONS") {
      return reply(204, null, cors, {
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
        "Access-Control-Max-Age": "7200",
      });
    }
    if (request.method !== "POST") {
      return reply(405, { error: "method" }, cors, { Allow: "POST, OPTIONS" });
    }
    // The cheap refusals first, before any key is fetched or any body read.
    if (
      !(request.headers.get("Content-Type") ?? "").startsWith(
        "application/json",
      )
    ) {
      return reply(415, { error: "content_type" }, cors);
    }
    if (Number(request.headers.get("Content-Length") ?? 0) > REQUEST_LIMIT) {
      return reply(413, { error: "too_large" }, cors);
    }

    const now = Math.floor(Date.now() / 1000);
    try {
      const session = await verifySession(
        request.headers.get("Authorization"),
        env,
        now,
      );
      if (session.claims === undefined) {
        return reply(
          401,
          { error: "unauthenticated", reason: session.reason },
          cors,
        );
      }
      if (!isEditor(session.claims)) {
        return reply(403, { error: "forbidden" }, cors);
      }
      // Read only now, so that a request without an editing status makes the Worker read nothing.
      const raw = new Uint8Array(await request.arrayBuffer());
      if (raw.length > REQUEST_LIMIT) {
        return reply(413, { error: "too_large" }, cors);
      }
      let input;
      try {
        input = JSON.parse(new TextDecoder().decode(raw));
      } catch {
        input = undefined;
      }
      if (typeof input !== "object" || input === null || Array.isArray(input)) {
        return invalid([{ field: "", code: "json" }], cors);
      }
      return await action(input, {
        github: gitHub(env),
        claims: session.claims,
        now,
        cors,
      });
    } catch (error) {
      // The message names a setting or a status, never a token.
      console.error(
        "content-admin:",
        error instanceof Error ? error.message : error,
      );
      return reply(503, { error: "unavailable" }, cors);
    }
  },
};
