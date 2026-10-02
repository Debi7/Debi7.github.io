// Tests the admin panel's content service (workers/content-admin/worker.mjs) without a network,
// without a Clerk instance and without GitHub. Added 2026-10-02 with the admin panel (ADMIN.md);
// `npm run check:content-admin`. The cases are the verification list of the consilium verdict
// .specify/consilium/2026-10-02-admin-posts.md.
//
// - Clerk: as in scripts/check-video-access.mjs, a key pair of its own serves as a made-up
//   instance's key list, and tokens are signed with it.
// - GitHub: scripts/github-stand-in.mjs over a temporary copy of src/content/posts/, so the real
//   posts are read and written exactly as on GitHub, and every write is counted. The copy is made
//   under the system's temporary folder and removed at the end; the working copy is not touched.
// - The real schema: src/content/post-fields.ts, compiled with the project's TypeScript and loaded
//   with its "astro/zod", and front matter parsed with gray-matter, which Astro itself uses
//   (node_modules/astro/dist/content/utils.js). Both are dependencies of Astro, not new ones. Every
//   file the Worker writes must pass that schema, which is what keeps the Worker's copy of the
//   rules from drifting into files the build would refuse.
// - Drift: the session check must be the same text as in workers/video-access/worker.mjs, and the
//   statuses that may edit the same list as site.admin.postEditors in src/config.ts.
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import matter from "gray-matter";
import worker from "../workers/content-admin/worker.mjs";
import { gitHubStandIn, blobSha } from "./github-stand-in.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const results = [];
function check(name, ok, detail = "") {
  results.push(ok);
  console.log(
    `${ok ? "ok  " : "FAIL"} ${name}${ok || detail === "" ? "" : ` - ${detail}`}`,
  );
}

// --- The real schema, loaded the way the test can under plain Node.
const fieldsSource = readFileSync(
  join(root, "src/content/post-fields.ts"),
  "utf8",
);
const compiled = ts
  .transpileModule(fieldsSource, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  })
  // The import line only: the file's header names "astro/zod" too.
  .outputText.replace(
    /from "astro\/zod"/,
    `from ${JSON.stringify(import.meta.resolve("astro/zod"))}`,
  );
const { postFields } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);
const schemaAccepts = (text) => {
  const { data } = matter(text);
  return postFields.safeParse(data).success;
};

// --- Drift with the video service and the site's config.
const sessionBlock = (text) => {
  const start = text.indexOf(`// "pk_test_<base64 of 'host$'>"`);
  const fn = text.indexOf("async function verifySession(");
  const end = text.indexOf("\n}\n", fn);
  return start === -1 || fn === -1 || end === -1
    ? undefined
    : text.slice(start, end + 3);
};
const constants = (text) =>
  ["const LEEWAY_SECONDS", "const JWKS_REFETCH_SECONDS", "let jwks ="].map(
    (start) => text.split("\n").find((line) => line.startsWith(start)),
  );
const adminSource = readFileSync(
  join(root, "workers/content-admin/worker.mjs"),
  "utf8",
);
const videoSource = readFileSync(
  join(root, "workers/video-access/worker.mjs"),
  "utf8",
);
check(
  "the session check is the same text as the video service's",
  sessionBlock(adminSource) !== undefined &&
    sessionBlock(adminSource) === sessionBlock(videoSource) &&
    JSON.stringify(constants(adminSource)) ===
      JSON.stringify(constants(videoSource)),
);
const configSource = readFileSync(join(root, "src/config.ts"), "utf8");
const configRoles = /admin:\s*\{[\s\S]*?postEditors:\s*(\[[^\]]*\])/.exec(
  configSource,
)?.[1];
const workerRoles = /const EDITORS = (\[[^\]]*\]);/.exec(adminSource)?.[1];
check(
  "the editing statuses are the same list as site.admin.postEditors",
  configRoles !== undefined &&
    workerRoles !== undefined &&
    JSON.stringify(JSON.parse(configRoles.replace(/,\s*\]/, "]"))) ===
      JSON.stringify(JSON.parse(workerRoles)),
);

// --- A temporary repository: a copy of the real posts.
const repoRoot = mkdtempSync(join(tmpdir(), "kb-content-admin-"));
cpSync(join(root, "src/content/posts"), join(repoRoot, "src/content/posts"), {
  recursive: true,
});
const postsDir = join(repoRoot, "src/content/posts");
const fileText = (slug) => readFileSync(join(postsDir, `${slug}.md`), "utf8");

const host = "test-instance.clerk.accounts.dev";
const site = "http://localhost:4321";
const api = "https://github.test";
const env = {
  CLERK_PUBLISHABLE_KEY: "pk_test_" + btoa(host + "$"),
  ALLOWED_ORIGINS: `${site},https://debi7.github.io`,
  GITHUB_REPO: "club/site",
  GITHUB_BRANCH: "main",
  GITHUB_TOKEN: "test-token",
  GITHUB_API: api,
};
const standIn = gitHubStandIn({
  root: repoRoot,
  repo: env.GITHUB_REPO,
  branch: env.GITHUB_BRANCH,
  token: env.GITHUB_TOKEN,
});
const writes = () => standIn.calls.filter((c) => c.wrote).length;

const algorithm = {
  name: "RSASSA-PKCS1-v1_5",
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: "SHA-256",
};
const good = await crypto.subtle.generateKey(algorithm, true, [
  "sign",
  "verify",
]);
const other = await crypto.subtle.generateKey(algorithm, true, [
  "sign",
  "verify",
]);
const publicJwk = {
  ...(await crypto.subtle.exportKey("jwk", good.publicKey)),
  kid: "ins_test",
  alg: "RS256",
  use: "sig",
};

let gitHubDown = false;
globalThis.fetch = async (input, init) => {
  const request = new Request(input, init);
  if (request.url.startsWith(api)) {
    return gitHubDown
      ? new Response("down", { status: 500 })
      : standIn.handle(request);
  }
  return request.url === `https://${host}/.well-known/jwks.json`
    ? new Response(JSON.stringify({ keys: [publicJwk] }))
    : new Response("down", { status: 502 });
};

const encode = (value) =>
  Buffer.from(
    typeof value === "string" ? value : JSON.stringify(value),
  ).toString("base64url");
async function token(claims, { key = good.privateKey, header = {} } = {}) {
  const head = encode({ alg: "RS256", kid: "ins_test", typ: "JWT", ...header });
  const body = encode(claims);
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(`${head}.${body}`),
  );
  return `${head}.${body}.${Buffer.from(signature).toString("base64url")}`;
}
const now = Math.floor(Date.now() / 1000);
const base = {
  iss: `https://${host}`,
  azp: site,
  sid: "sess_test",
  sub: "user_test",
  iat: now - 5,
  nbf: now - 5,
  exp: now + 60,
  status: "metr",
};
const bearer = async (claims, options) =>
  `Bearer ${await token(claims, options)}`;
const editor = await bearer(base);

const answers = [];
async function ask({
  path = "/posts/list",
  method = "POST",
  origin = site,
  auth = editor,
  body = {},
  contentType = "application/json",
}) {
  const headers = new Headers();
  if (origin !== null) headers.set("Origin", origin);
  // null sends no Authorization header; undefined would take the editor's default above.
  if (auth !== null) headers.set("Authorization", auth);
  if (contentType !== null) headers.set("Content-Type", contentType);
  const response = await worker.fetch(
    new Request(`https://content-admin.example${path}`, {
      method,
      headers,
      body:
        method === "GET" || method === "OPTIONS"
          ? undefined
          : typeof body === "string"
            ? body
            : JSON.stringify(body),
    }),
    env,
  );
  const text = await response.text();
  // Every answer is kept for the last check: none may carry the GitHub token.
  answers.push(text);
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  return { status: response.status, headers: response.headers, text, json };
}

// --- Transport.
let answer = await ask({ method: "OPTIONS" });
check(
  "preflight from the site: 204 with its origin",
  answer.status === 204 &&
    answer.headers.get("Access-Control-Allow-Origin") === site,
);
answer = await ask({ origin: "https://evil.example" });
check("a foreign origin: 403", answer.status === 403);
answer = await ask({ method: "GET" });
check("GET: 405", answer.status === 405);
answer = await ask({ path: "/posts/other" });
check("an unknown path: 404", answer.status === 404);
answer = await ask({ path: "/video" });
check("the video service's path: 404 here", answer.status === 404);
answer = await ask({ contentType: "text/plain" });
check("not application/json: 415", answer.status === 415);
check(
  "every answer is private and names its version",
  answer.headers.get("Cache-Control") === "private, no-store" &&
    /^\d{4}-\d{2}-\d{2}\.\d+$/.test(
      answer.headers.get("X-Content-Admin-Version") ?? "",
    ),
);

// --- Who may: each wrong token 401, each status that may not edit 403, and no write from any.
const without = (key) => {
  const copy = { ...base };
  delete copy[key];
  return copy;
};
const refusedTokens = [
  ["no token", null],
  ["not a bearer token", "Basic abc"],
  ["malformed", "Bearer a.b.c"],
  ["alg HS256", await bearer(base, { header: { alg: "HS256" } })],
  ["unknown kid", await bearer(base, { header: { kid: "ins_other" } })],
  ["signed by another key", await bearer(base, { key: other.privateKey })],
  [
    "another issuer",
    await bearer({ ...base, iss: "https://evil.clerk.accounts.dev" }),
  ],
  ["expired", await bearer({ ...base, exp: now - 10 })],
  ["not yet valid", await bearer({ ...base, nbf: now + 60 })],
  [
    "another site (azp)",
    await bearer({ ...base, azp: "https://evil.example" }),
  ],
  ["no sid", await bearer(without("sid"))],
  ["pending session", await bearer({ ...base, sts: "pending" })],
];
const writesBefore = writes();
for (const [name, auth] of refusedTokens) {
  const result = await ask({ path: "/posts/save", auth, body: { slug: "x" } });
  check(`token ${name}: 401`, result.status === 401, `${result.status}`);
}
const refusedRoles = [
  ["no status", without("status")],
  [
    "a member only",
    { ...without("status"), member: true, memberUntil: "2099-12-31" },
  ],
  ["status Admin", { ...base, status: "Admin" }],
  ["status master", { ...base, status: "master" }],
  ["status guest", { ...base, status: "guest" }],
  ["status blocked", { ...base, status: "blocked" }],
  ["status true", { ...base, status: true }],
  ["status [admin]", { ...base, status: ["admin"] }],
  ["an admin role in another claim", { ...without("status"), role: "admin" }],
];
for (const [name, claims] of refusedRoles) {
  const result = await ask({
    path: "/posts/save",
    auth: await bearer(claims),
    body: { slug: "x" },
  });
  check(`${name}: 403`, result.status === 403, `${result.status}`);
}
check("no refused request wrote anything", writes() === writesBefore);
for (const status of ["admin", "metr"]) {
  const result = await ask({ auth: await bearer({ ...base, status }) });
  check(
    `status ${status}: the list answers 200`,
    result.status === 200,
    `${result.status}`,
  );
}

// --- The list.
answer = await ask({});
const listed = answer.json?.posts ?? [];
const realCount = readdirSync(postsDir).length;
check(
  `the list holds every post (${realCount})`,
  listed.length === realCount,
  `${listed.length}`,
);
check(
  "every existing post is editable",
  listed.every((p) => p.editable),
  listed
    .filter((p) => !p.editable)
    .map((p) => p.slug)
    .join(", "),
);
check(
  "the list is newest first",
  listed.every(
    (p, i) => i === 0 || Date.parse(listed[i - 1].date) >= Date.parse(p.date),
  ),
);
check(
  "each listed sha is git's blob sha of the file",
  listed.every(
    (p) => p.sha === blobSha(readFileSync(join(postsDir, `${p.slug}.md`))),
  ),
);

// --- Every existing post survives a round trip unchanged: get, then save what was got.
let roundTrips = 0;
const writesBeforeRound = writes();
for (const post of listed) {
  const got = await ask({ path: "/posts/get", body: { slug: post.slug } });
  if (got.status !== 200) continue;
  const saved = await ask({
    path: "/posts/save",
    body: {
      slug: post.slug,
      sha: got.json.post.sha,
      fields: got.json.post.fields,
      body: got.json.post.body,
    },
  });
  if (saved.status === 200 && saved.json?.unchanged === true) roundTrips++;
}
check(
  `every post reads and saves back unchanged, without a commit (${roundTrips}/${listed.length})`,
  roundTrips === listed.length && writes() === writesBeforeRound,
);

// --- Validation: each case is refused with the field and the code it should name.
const valid = {
  title: "Проверка панели",
  description: "Описание",
  date: "2026-10-01T12:00:00+03:00",
  tags: ["Биолокация", "проверка"],
  categories: ["education"],
  draft: false,
};
const saveCase = (overrides = {}, fields = {}, body = "Текст.") => ({
  slug: "admin-check",
  fields: { ...valid, ...fields },
  body,
  ...overrides,
});
const lineSeparator = String.fromCharCode(0x2028);
const invalidCases = [
  ["empty slug", saveCase({ slug: "" }), "slug", "required"],
  ["slug ../evil", saveCase({ slug: "../evil" }), "slug", "format"],
  ["slug with a capital", saveCase({ slug: "Bad" }), "slug", "format"],
  ["slug a--b", saveCase({ slug: "a--b" }), "slug", "format"],
  ["slug with a slash", saveCase({ slug: "a/b" }), "slug", "format"],
  ["slug with a dot", saveCase({ slug: "a.b" }), "slug", "format"],
  ["slug with a backslash", saveCase({ slug: "a\\b" }), "slug", "format"],
  ["slug with an encoded slash", saveCase({ slug: "a%2fb" }), "slug", "format"],
  ["slug ending with a hyphen", saveCase({ slug: "a-" }), "slug", "format"],
  ["slug in Cyrillic", saveCase({ slug: "пост" }), "slug", "format"],
  ["slug a bare year", saveCase({ slug: "2025" }), "slug", "reserved"],
  ["slug page", saveCase({ slug: "page" }), "slug", "reserved"],
  ["slug too long", saveCase({ slug: "a".repeat(81) }), "slug", "too_long"],
  ["empty title", saveCase({}, { title: " " }), "title", "required"],
  [
    "title with a line break",
    saveCase({}, { title: "a\n---\naccess: paid" }),
    "title",
    "line_break",
  ],
  [
    "title with a line separator",
    saveCase({}, { title: `a${lineSeparator}b` }),
    "title",
    "line_break",
  ],
  [
    "title too long",
    saveCase({}, { title: "a".repeat(201) }),
    "title",
    "too_long",
  ],
  ["title a number", saveCase({}, { title: 5 }), "title", "type"],
  [
    "description with a line break",
    saveCase({}, { description: "a\nb" }),
    "description",
    "line_break",
  ],
  [
    "date 31 February",
    saveCase({}, { date: "2026-02-31T10:00:00+03:00" }),
    "date",
    "format",
  ],
  [
    "date without an offset",
    saveCase({}, { date: "2026-10-01T10:00:00" }),
    "date",
    "format",
  ],
  [
    "date with a space",
    saveCase({}, { date: "2026-10-01 10:00:00+03:00" }),
    "date",
    "format",
  ],
  [
    "date 25 o'clock",
    saveCase({}, { date: "2026-10-01T25:00:00+03:00" }),
    "date",
    "format",
  ],
  ["tags not a list", saveCase({}, { tags: "a, b" }), "tags", "type"],
  [
    "21 tags",
    saveCase({}, { tags: Array.from({ length: 21 }, (_, i) => `t${i}`) }),
    "tags",
    "too_many",
  ],
  ["a tag with a comma", saveCase({}, { tags: ["a,b"] }), "tags", "format"],
  [
    "a tag with spaces around",
    saveCase({}, { tags: [" a"] }),
    "tags",
    "format",
  ],
  [
    "the same tag twice in two cases",
    saveCase({}, { tags: ["Лоза", "лоза"] }),
    "tags",
    "duplicate",
  ],
  ["an empty tag", saveCase({}, { tags: [""] }), "tags", "required"],
  ["draft as text", saveCase({}, { draft: "true" }), "draft", "type"],
  [
    "a field outside the schema",
    saveCase({}, { access: "paid" }),
    "access",
    "unknown",
  ],
  ["layout slipped in", saveCase({}, { layout: "x" }), "layout", "unknown"],
  [
    "an unknown request key",
    saveCase({ path: ".github/workflows/x.yml" }),
    "path",
    "unknown",
  ],
  ["a sha that is not one", saveCase({ sha: "abc" }), "sha", "format"],
  [
    "a script tag",
    saveCase({}, {}, "<script>alert(1)</script>"),
    "body",
    "html",
  ],
  [
    "an img with onerror",
    saveCase({}, {}, "Текст <img src=x onerror=alert(1)>"),
    "body",
    "html",
  ],
  [
    "an iframe",
    saveCase({}, {}, "<iframe src=https://evil.example></iframe>"),
    "body",
    "html",
  ],
  ["an HTML comment", saveCase({}, {}, "<!-- x -->"), "body", "html"],
  [
    "a members-only block",
    saveCase({}, {}, "<div data-members-only>\n\nx\n\n</div>"),
    "body",
    "html",
  ],
  ["a closing tag", saveCase({}, {}, "x </p>"), "body", "html"],
  [
    "a javascript: link",
    saveCase({}, {}, "[x](javascript:alert(1))"),
    "body",
    "link",
  ],
  [
    "a JAVASCRIPT: link with spaces",
    saveCase({}, {}, "[x](  JAVASCRIPT:alert(1))"),
    "body",
    "link",
  ],
  [
    "a link through an entity",
    saveCase({}, {}, "[x](&#106;avascript:alert(1))"),
    "body",
    "link",
  ],
  ["a data: link", saveCase({}, {}, "[x](data:text/html,hi)"), "body", "link"],
  ["a vbscript: image", saveCase({}, {}, "![x](vbscript:x)"), "body", "link"],
  [
    "a javascript: reference",
    saveCase({}, {}, "[x][r]\n\n[r]: javascript:alert(1)"),
    "body",
    "link",
  ],
  [
    "a javascript: autolink",
    saveCase({}, {}, "<javascript:alert(1)>"),
    "body",
    "html",
  ],
  [
    "a body too long",
    saveCase({}, {}, "a".repeat(200_001)),
    "body",
    "too_long",
  ],
];
const writesBeforeInvalid = writes();
for (const [name, request, field, code] of invalidCases) {
  const result = await ask({ path: "/posts/save", body: request });
  const named = result.json?.problems?.some(
    (p) => p.field === field && p.code === code,
  );
  check(
    `refused: ${name}`,
    result.status === 400 && named === true,
    `${result.status} ${result.text}`,
  );
}
check("no refused save wrote anything", writes() === writesBeforeInvalid);
answer = await ask({ path: "/posts/save", body: "{not json" });
check("a body that is not JSON: 400", answer.status === 400);
answer = await ask({ path: "/posts/save", body: [1] });
check("a JSON list instead of an object: 400", answer.status === 400);
answer = await ask({
  path: "/posts/save",
  body: { slug: "x", fields: valid, body: "x".repeat(600_000) },
});
check(
  "a request over the size limit: 413",
  answer.status === 413,
  `${answer.status}`,
);

// --- What the body may hold.
const acceptedBodies = [
  ["a tag inside inline code", "Тег `<b>` пишется так."],
  [
    "a tag inside fenced code",
    "```html\n<div>\n  <script>x</script>\n</div>\n```",
  ],
  ["a tag inside a tilde fence", "~~~\n<iframe>\n~~~"],
  ["a comparison in math", "Формула $a<b$ и $$x<y$$."],
  ["a web autolink", "<https://example.com/a?b=1>"],
  ["a mail autolink", "<mailto:club@example.com>"],
  [
    "links of every allowed kind",
    "[a](https://e.com) [b](http://e.com) [c](/posts/x/) [d](#top) [e](mailto:a@b.c) [f](./x) [g](../y) [h](relative/path)",
  ],
  ["a less-than sign in prose", "3 < 5 и 5 > 3"],
];
for (const [name, body] of acceptedBodies) {
  const result = await ask({
    path: "/posts/save",
    body: saveCase(
      {
        slug: `body-${roundTrips}-${name.length}-${acceptedBodies.indexOf(acceptedBodies.find((b) => b[0] === name))}`,
      },
      { draft: true },
      body,
    ),
  });
  check(
    `accepted: ${name}`,
    result.status === 200,
    `${result.status} ${result.text}`,
  );
}

// --- Create.
answer = await ask({
  path: "/posts/save",
  body: saveCase({}, {}, "Первый абзац.\r\n\r\n## Раздел\r\nТекст"),
});
const created = existsSync(join(postsDir, "admin-check.md"))
  ? fileText("admin-check")
  : "";
check(
  "a new post: 200 with its sha and commit",
  answer.status === 200 &&
    answer.json?.sha === blobSha(Buffer.from(created)) &&
    /^[0-9a-f]{40}$/.test(answer.json?.commit ?? ""),
  answer.text,
);
check(
  "a new post is written as the posts are",
  created ===
    '---\ntitle: "Проверка панели"\ndescription: "Описание"\ndate: "2026-10-01T12:00:00+03:00"\ntags: ["биолокация", "проверка"]\ncategories: ["education"]\ndraft: false\n---\n\nПервый абзац.\n\n## Раздел\nТекст\n',
  JSON.stringify(created),
);
check("a new post passes the real schema", schemaAccepts(created));
answer = await ask({ path: "/posts/save", body: saveCase() });
check(
  "a second post at the same address: 409 exists",
  answer.status === 409 && answer.json?.error === "exists",
  answer.text,
);
const tricky = 'Он сказал: "да" # не комментарий --- [x] {y} \\ конец';
answer = await ask({
  path: "/posts/save",
  body: saveCase({ slug: "admin-tricky" }, { title: tricky, description: "" }),
});
const trickyText = existsSync(join(postsDir, "admin-tricky.md"))
  ? fileText("admin-tricky")
  : "";
check(
  "a title with quotes, a colon, # and --- comes back the same through YAML",
  answer.status === 200 &&
    matter(trickyText).data.title === tricky &&
    schemaAccepts(trickyText),
  trickyText.split("\n").slice(0, 3).join(" | "),
);
check(
  "an empty description is left out of a new file",
  !/^description:/m.test(trickyText),
);

// --- Edit.
const article = fileText("article");
answer = await ask({ path: "/posts/get", body: { slug: "article" } });
const got = answer.json?.post;
check(
  "get: a post with comments and a bare date",
  answer.status === 200 &&
    got?.fields?.title === "Hello!" &&
    got?.fields?.date === "2026-09-04T12:00:00+03:00",
);
answer = await ask({
  path: "/posts/save",
  body: {
    slug: "article",
    sha: got.sha,
    fields: { ...got.fields, title: "Hello again" },
    body: got.body,
  },
});
const edited = fileText("article");
const before = article.split("\n");
const after = edited.split("\n");
const lastmodLine = after.find((l) => l.startsWith("lastmod:")) ?? "";
check(
  "an edit answers 200 with the lastmod it stamped",
  answer.status === 200 && lastmodLine === `lastmod: "${answer.json?.lastmod}"`,
  answer.text,
);
check(
  "an edit changes the title line, adds lastmod after the date, and keeps every other line",
  after.length === before.length + 1 &&
    after.indexOf(lastmodLine) ===
      after.findIndex((l) => l.startsWith("date:")) + 1 &&
    before.every((line) =>
      line.startsWith("title:")
        ? after.includes('title: "Hello again"')
        : after.includes(line),
    ),
);
check(
  "the comments of the edited post are all still there",
  before.filter((l) => l.startsWith("#")).every((l) => after.includes(l)),
);
check("the edited post passes the real schema", schemaAccepts(edited));
check(
  "the stamped lastmod is in the post's own offset",
  /\+03:00"$/.test(lastmodLine),
);
answer = await ask({
  path: "/posts/save",
  body: {
    slug: "article",
    sha: got.sha,
    fields: { ...got.fields, title: "Stale" },
    body: got.body,
  },
});
check(
  "an edit from a stale sha: 409 conflict, nothing written",
  answer.status === 409 &&
    answer.json?.error === "conflict" &&
    fileText("article") === edited,
);
answer = await ask({
  path: "/posts/save",
  body: { slug: "no-such-post", sha: "0".repeat(40), fields: valid, body: "x" },
});
check("an edit of a post that does not exist: 404", answer.status === 404);
const draft = fileText("draft");
answer = await ask({ path: "/posts/get", body: { slug: "draft" } });
const draftPost = answer.json?.post;
answer = await ask({
  path: "/posts/save",
  body: {
    slug: "draft",
    sha: draftPost.sha,
    fields: { ...draftPost.fields, description: "Новое описание" },
    body: draftPost.body,
  },
});
const draftAfter = fileText("draft");
check(
  "a field the file lacked is added, and the defaults it leaves out stay out",
  answer.status === 200 &&
    draftAfter.includes('description: "Новое описание"') &&
    !/^categories:/m.test(draftAfter) &&
    draft
      .split("\n")
      .filter((l) => l.startsWith("#"))
      .every((l) => draftAfter.includes(l)),
);
answer = await ask({ path: "/posts/get", body: { slug: "missing-post" } });
check("get of a post that does not exist: 404", answer.status === 404);
answer = await ask({ path: "/posts/get", body: { slug: "../x" } });
check("get with a bad slug: 400", answer.status === 400);

// --- A post this service does not edit: a block list in its front matter.
writeFileSync(
  join(postsDir, "block-list.md"),
  '---\ntitle: "Блок"\ndate: "2026-01-01T10:00:00+03:00"\ntags:\n  - a\n---\n\nТекст\n',
);
answer = await ask({});
check(
  "the list marks a post it cannot edit",
  answer.json?.posts?.find((p) => p.slug === "block-list")?.editable === false,
);
answer = await ask({ path: "/posts/get", body: { slug: "block-list" } });
check("get of that post: 422 unsupported", answer.status === 422);
const blockSha = blobSha(readFileSync(join(postsDir, "block-list.md")));
answer = await ask({
  path: "/posts/save",
  body: { slug: "block-list", sha: blockSha, fields: valid, body: "x" },
});
check(
  "save of that post: 422, nothing written",
  answer.status === 422 && fileText("block-list").includes("  - a"),
);

// --- Delete.
const victim = blobSha(readFileSync(join(postsDir, "admin-tricky.md")));
answer = await ask({
  path: "/posts/delete",
  body: { slug: "admin-tricky", sha: "1".repeat(40) },
});
check(
  "a delete from a stale sha: 409, the file stays",
  answer.status === 409 && existsSync(join(postsDir, "admin-tricky.md")),
);
answer = await ask({
  path: "/posts/delete",
  body: { slug: "admin-tricky", sha: victim },
});
check(
  "a delete: 200, the file is gone",
  answer.status === 200 && !existsSync(join(postsDir, "admin-tricky.md")),
);
answer = await ask({
  path: "/posts/delete",
  body: { slug: "admin-tricky", sha: victim },
});
check("deleting it again: 409", answer.status === 409);
answer = await ask({
  path: "/posts/delete",
  body: { slug: "../../package", sha: victim },
});
check("a delete with a bad slug: 400", answer.status === 400);

// --- Only the posts folder was ever written.
check(
  "every write went to src/content/posts/<slug>.md",
  standIn.calls
    .filter((c) => c.wrote)
    .every((c) =>
      /^\/repos\/club\/site\/contents\/src\/content\/posts\/[a-z0-9-]+\.md$/.test(
        c.path,
      ),
    ),
);
const direct = await standIn.handle(
  new Request(`${api}/repos/club/site/contents/package.json`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}` },
    body: JSON.stringify({ message: "x", content: "", branch: "main" }),
  }),
);
check(
  "the stand-in itself refuses a path outside the posts",
  direct.status === 403,
);

// --- A broken setting or GitHub down: 503, and the token never in an answer.
gitHubDown = true;
answer = await ask({});
check("GitHub down: 503", answer.status === 503);
gitHubDown = false;
for (const [name, key, value] of [
  ["no GITHUB_TOKEN", "GITHUB_TOKEN", ""],
  ["GITHUB_REPO malformed", "GITHUB_REPO", "nope"],
  ["no GITHUB_BRANCH", "GITHUB_BRANCH", ""],
]) {
  const saved = env[key];
  env[key] = value;
  answer = await ask({});
  check(`${name}: 503`, answer.status === 503);
  env[key] = saved;
}
check(
  "no answer ever carried the GitHub token",
  answers.every((text) => !text.includes(env.GITHUB_TOKEN)),
);

// --- Time of a read of one post with warm caches: wall time on this machine, an upper bound of
// the CPU time the 10 ms limit of the free plan is about.
const times = [];
for (let i = 0; i < 100; i++) {
  const start = performance.now();
  await ask({ path: "/posts/get", body: { slug: "water-dowsing" } });
  times.push(performance.now() - start);
}
times.sort((a, b) => a - b);
console.log(
  `timing over 100 reads: p50 ${times[50].toFixed(2)} ms, p99 ${times[98].toFixed(2)} ms`,
);

rmSync(repoRoot, { recursive: true, force: true });
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed === 0 ? 0 : 1);
