// Tests the status service of the admin panel (workers/statuses/worker.mjs) without a network and
// without a Clerk instance. Added 2026-10-02 with the owner's status model (ADMIN.md);
// `npm run check:statuses`.
//
// - Session tokens: signed with a key pair of this script's own, served as a made-up instance's key
//   list, as in scripts/check-video-access.mjs.
// - Clerk's Backend API: a stand-in below holding a handful of users in memory. It answers the four
//   calls the Worker makes, merges metadata the way Clerk documents for PATCH /users/{id}/metadata
//   ("a deep merge", null removes a key; clerk.com/docs/reference/backend/user/update-user-metadata),
//   and counts every write, so a refused request can be shown to have changed nothing.
// - Drift: the session check must be the same text as in workers/video-access/worker.mjs, and the
//   statuses the same list as site.admin.statuses in src/config.ts.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import worker from "../workers/statuses/worker.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const results = [];
function check(name, ok, detail = "") {
  results.push(ok);
  console.log(
    `${ok ? "ok  " : "FAIL"} ${name}${ok || detail === "" ? "" : ` - ${detail}`}`,
  );
}

// --- Drift.
const sessionBlock = (text) => {
  const start = text.indexOf(`// "pk_test_<base64 of 'host$'>"`);
  const fn = text.indexOf("async function verifySession(");
  const end = text.indexOf("\n}\n", fn);
  return start === -1 || fn === -1 || end === -1
    ? undefined
    : text.slice(start, end + 3);
};
const source = readFileSync(join(root, "workers/statuses/worker.mjs"), "utf8");
const videoSource = readFileSync(
  join(root, "workers/video-access/worker.mjs"),
  "utf8",
);
check(
  "the session check is the same text as the video service's",
  sessionBlock(source) !== undefined &&
    sessionBlock(source) === sessionBlock(videoSource),
);
const listIn = (text, pattern) => {
  const raw = pattern.exec(text)?.[1];
  return raw === undefined
    ? undefined
    : JSON.stringify(JSON.parse(raw.replace(/,\s*\]/, "]")));
};
const configSource = readFileSync(join(root, "src/config.ts"), "utf8");
const configStatuses = listIn(
  configSource,
  /admin:\s*\{[\s\S]*?statuses:\s*(\[[^\]]*\])/,
);
const workerStatuses = listIn(source, /const STATUSES = (\[[^\]]*\]);/);
check(
  "the statuses are the same list as site.admin.statuses",
  configStatuses !== undefined && configStatuses === workerStatuses,
  `${configStatuses} / ${workerStatuses}`,
);

// --- Clerk's Backend API, made up.
const secret = "sk_test_standin";
const user = (id, publicMetadata, extra = {}) => ({
  id,
  first_name: extra.first ?? "",
  last_name: extra.last ?? "",
  primary_email_address_id: `idn_${id}`,
  email_addresses: [
    { id: `idn_other_${id}`, email_address: `other-${id}@example.com` },
    { id: `idn_${id}`, email_address: `${id}@example.com` },
  ],
  public_metadata: publicMetadata,
  private_metadata: {},
  created_at: extra.created ?? 1,
});
let users;
function seed() {
  users = new Map(
    [
      user(
        "user_owner",
        { status: "admin" },
        { first: "Владелец", created: 9 },
      ),
      user("user_admin", { status: "admin" }, { created: 8 }),
      user("user_metr", { status: "metr" }, { created: 7 }),
      user("user_metrb", { status: "metr" }, { created: 6 }),
      user(
        "user_guest",
        { member: true, memberUntil: "2099-12-31" },
        { first: "Гость", last: "Тестов", created: 5 },
      ),
      user("user_student", { status: "student" }, { created: 4 }),
      user(
        "user_blockedadmin",
        { status: "blocked", statusBy: "admin" },
        { created: 3 },
      ),
      user(
        "user_blockedmetr",
        { status: "blocked", statusBy: "metr" },
        { created: 2 },
      ),
      user("user_odd", { status: "superstar" }, { created: 1 }),
    ].map((u) => [u.id, u]),
  );
}
seed();
let clerkWrites = 0;
let clerkDown = false;
const clerkApi = "https://clerk-api.test/v1";
function merge(target, patch) {
  const out = { ...target };
  for (const [key, value] of Object.entries(patch ?? {})) {
    if (value === null) delete out[key];
    else if (
      typeof value === "object" &&
      !Array.isArray(value) &&
      typeof out[key] === "object" &&
      out[key] !== null
    ) {
      out[key] = merge(out[key], value);
    } else out[key] = value;
  }
  return out;
}
const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const matches = (u, query) =>
  query === "" ||
  [
    u.id,
    u.first_name,
    u.last_name,
    ...u.email_addresses.map((e) => e.email_address),
  ]
    .join(" ")
    .toLowerCase()
    .includes(query.toLowerCase());
let lastListQuery;
async function clerkStandIn(request) {
  if (clerkDown) return json(500, { errors: [] });
  if (request.headers.get("Authorization") !== `Bearer ${secret}`) {
    return json(401, { errors: [{ code: "authentication_invalid" }] });
  }
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/v1/, "");
  const query = url.searchParams.get("query") ?? "";
  if (request.method === "GET" && path === "/users") {
    lastListQuery = Object.fromEntries(url.searchParams);
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const limit = Number(url.searchParams.get("limit") ?? 10);
    const list = [...users.values()]
      .filter((u) => matches(u, query))
      .sort((a, b) => b.created_at - a.created_at)
      .slice(offset, offset + limit);
    return json(200, list);
  }
  if (request.method === "GET" && path === "/users/count") {
    return json(200, {
      object: "total_count",
      total_count: [...users.values()].filter((u) => matches(u, query)).length,
    });
  }
  const one = /^\/users\/(user_\w+)(\/metadata)?$/.exec(path);
  const found = one === null ? undefined : users.get(one[1]);
  if (one === null) return json(404, { errors: [] });
  if (found === undefined)
    return json(404, { errors: [{ code: "resource_not_found" }] });
  if (request.method === "GET" && one[2] === undefined) return json(200, found);
  if (request.method === "PATCH" && one[2] === "/metadata") {
    const body = await request.json();
    clerkWrites++;
    found.public_metadata = merge(found.public_metadata, body.public_metadata);
    found.private_metadata = merge(
      found.private_metadata,
      body.private_metadata,
    );
    return json(200, found);
  }
  return json(405, { errors: [] });
}

// --- Session tokens.
const host = "test-instance.clerk.accounts.dev";
const site = "http://localhost:4321";
const env = {
  CLERK_PUBLISHABLE_KEY: "pk_test_" + btoa(host + "$"),
  ALLOWED_ORIGINS: `${site},https://debi7.github.io`,
  ADMIN_IDS: "user_owner",
  CLERK_SECRET_KEY: secret,
  CLERK_API: clerkApi,
};
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
globalThis.fetch = async (input, init) => {
  const request = new Request(input, init);
  if (request.url.startsWith(clerkApi)) return clerkStandIn(request);
  return request.url === `https://${host}/.well-known/jwks.json`
    ? new Response(JSON.stringify({ keys: [publicJwk] }))
    : new Response("down", { status: 502 });
};
const encode = (value) =>
  Buffer.from(
    typeof value === "string" ? value : JSON.stringify(value),
  ).toString("base64url");
async function token(claims, { key = good.privateKey } = {}) {
  const head = encode({ alg: "RS256", kid: "ins_test", typ: "JWT" });
  const body = encode(claims);
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(`${head}.${body}`),
  );
  return `${head}.${body}.${Buffer.from(signature).toString("base64url")}`;
}
const now = Math.floor(Date.now() / 1000);
const as = async (sub, status, extra = {}) => {
  const claims = {
    iss: `https://${host}`,
    azp: site,
    sid: "sess_test",
    sub,
    iat: now - 5,
    nbf: now - 5,
    exp: now + 60,
    ...extra,
  };
  if (status !== undefined) claims.status = status;
  return `Bearer ${await token(claims, extra.key === undefined ? {} : { key: extra.key })}`;
};

const answers = [];
async function ask({ path = "/users/list", auth, body = {}, origin = site }) {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (origin !== null) headers.set("Origin", origin);
  if (auth !== null && auth !== undefined) headers.set("Authorization", auth);
  const response = await worker.fetch(
    new Request(`https://statuses.example${path}`, {
      method: "POST",
      headers,
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    env,
  );
  const text = await response.text();
  answers.push(text);
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = undefined;
  }
  return { status: response.status, json: parsed, headers: response.headers };
}

const admin = await as("user_admin", "admin");
const metr = await as("user_metr", "metr");
const owner = await as("user_owner", "admin");

// --- Who may call.
let answer = await ask({ auth: null });
check("no token: 401", answer.status === 401);
answer = await ask({
  auth: await as("user_admin", "admin", { exp: now - 10 }),
});
check("an expired token: 401", answer.status === 401);
answer = await ask({
  auth: await as("user_admin", "admin", { key: other.privateKey }),
});
check("a token signed by another key: 401", answer.status === 401);
answer = await ask({
  auth: await as("user_admin", "admin", { azp: "https://evil.example" }),
});
check("a token for another site: 401", answer.status === 401);
answer = await ask({ auth: admin, origin: "https://evil.example" });
check("a foreign origin: 403", answer.status === 403);
for (const status of [
  undefined,
  "guest",
  "student",
  "expert",
  "master",
  "blocked",
  "Admin",
  "superstar",
]) {
  answer = await ask({ auth: await as("user_student", status) });
  check(
    `status ${status ?? "(none)"}: 403`,
    answer.status === 403 && answer.json?.error === "forbidden",
  );
}
answer = await ask({ auth: await as("user_owner", undefined) });
check(
  "an id in ADMIN_IDS without a status claim is an admin",
  answer.status === 200 && answer.json?.you?.status === "admin",
);

// --- The list.
answer = await ask({ auth: admin });
const listed = answer.json?.users ?? [];
check(
  "the list: 200 with every user and the total",
  answer.status === 200 &&
    listed.length === users.size &&
    answer.json?.total === users.size,
);
// Changed later on 2026-10-02 (VERSION 2026-10-02.4): 20 to a page when no limit is asked for.
check(
  "newest first, 20 to a page by default",
  lastListQuery?.order_by === "-created_at" && lastListQuery?.limit === "20",
);
const guest = listed.find((u) => u.id === "user_guest");
check(
  "a user shows name, primary email and status",
  guest?.name === "Гость Тестов" &&
    guest?.email === "user_guest@example.com" &&
    guest?.status === "guest",
);
check(
  "an unknown status value counts as guest",
  listed.find((u) => u.id === "user_odd")?.status === "guest",
);
check(
  "the protected admin and the caller are marked",
  listed.find((u) => u.id === "user_owner")?.protected === true &&
    listed.find((u) => u.id === "user_admin")?.self === true,
);
check(
  "nothing from private metadata is listed",
  !JSON.stringify(listed).includes("private"),
);
// Changed later on 2026-10-02, the owner's rule: guest is never given (workers/statuses/worker.mjs,
// VERSION 2026-10-02.2), so it is in neither list.
check(
  "an admin may assign every status but guest",
  JSON.stringify(answer.json?.you?.assignable) ===
    JSON.stringify(["student", "expert", "master", "metr", "admin", "blocked"]),
);
answer = await ask({ auth: metr });
check(
  "a metr may assign student to master and blocked",
  JSON.stringify(answer.json?.you?.assignable) ===
    JSON.stringify(["student", "expert", "master", "blocked"]),
);
answer = await ask({ auth: admin, body: { query: "Гость", offset: 0 } });
check(
  "a search passes the query on",
  answer.status === 200 &&
    answer.json?.users?.length === 1 &&
    lastListQuery?.query === "Гость",
);
answer = await ask({ auth: admin, body: { offset: -1 } });
check("a negative offset: 400", answer.status === 400);
answer = await ask({ auth: admin, body: { query: 5 } });
check("a query that is not text: 400", answer.status === 400);
// Added later on 2026-10-02: the page size the panel sends, and its bounds.
answer = await ask({ auth: admin, body: { offset: 2, limit: 3 } });
check(
  "a limit and an offset are passed on: the third to fifth newest",
  answer.status === 200 &&
    lastListQuery?.limit === "3" &&
    lastListQuery?.offset === "2" &&
    answer.json?.users?.length === 3 &&
    answer.json?.users?.[0]?.id === "user_metr",
);
for (const limit of [0, 51, 2.5, "20"]) {
  answer = await ask({ auth: admin, body: { limit } });
  check(`a limit of ${JSON.stringify(limit)}: 400`, answer.status === 400);
}

// --- Setting a status: each rule.
const set = (auth, userId, status) =>
  ask({ path: "/users/set", auth, body: { userId, status } });
const refusedCases = [
  [
    "an admin changing their own status",
    admin,
    "user_admin",
    "student",
    "self",
  ],
  ["a metr changing their own status", metr, "user_metr", "master", "self"],
  [
    "an admin changing a protected admin",
    admin,
    "user_owner",
    "student",
    "protected",
  ],
  [
    "a metr changing a protected admin",
    metr,
    "user_owner",
    "blocked",
    "protected",
  ],
  ["a metr making a member a metr", metr, "user_student", "metr", "rank"],
  ["a metr making a member an admin", metr, "user_guest", "admin", "rank"],
  ["a metr changing another metr", metr, "user_metrb", "student", "rank"],
  ["a metr blocking an admin", metr, "user_admin", "blocked", "rank"],
  [
    "a metr lifting an admin's block",
    metr,
    "user_blockedadmin",
    "student",
    "rank",
  ],
  // Added later on 2026-10-02: guest is never given, by an admin either.
  [
    "an admin making a student a guest",
    admin,
    "user_student",
    "guest",
    "guest",
  ],
  ["a metr making a student a guest", metr, "user_student", "guest", "guest"],
  [
    "an admin lifting a block to guest",
    admin,
    "user_blockedmetr",
    "guest",
    "guest",
  ],
];
for (const [name, auth, target, status, error] of refusedCases) {
  const before = clerkWrites;
  answer = await set(auth, target, status);
  check(
    `refused: ${name}`,
    answer.status === 403 &&
      answer.json?.error === error &&
      clerkWrites === before,
    `${answer.status} ${answer.json?.error}`,
  );
}
const invalidCases = [
  ["a user id that is not one", { userId: "../users", status: "student" }],
  ["a status outside the list", { userId: "user_guest", status: "superstar" }],
  [
    "an extra key",
    { userId: "user_guest", status: "student", statusBy: "admin" },
  ],
];
for (const [name, body] of invalidCases) {
  answer = await ask({ path: "/users/set", auth: admin, body });
  check(`refused: ${name} (400)`, answer.status === 400);
}
answer = await set(admin, "user_nobody", "student");
check("an unknown user: 404", answer.status === 404);

const allowedCases = [
  ["a metr makes a guest a student", metr, "user_guest", "student", "metr"],
  ["a metr blocks a student", metr, "user_student", "blocked", "metr"],
  ["a metr lifts a metr's block", metr, "user_blockedmetr", "expert", "metr"],
  ["an admin makes a member a metr", admin, "user_guest", "metr", "admin"],
  ["an admin makes a metr an admin", admin, "user_metrb", "admin", "admin"],
  [
    "an admin lifts an admin's block",
    admin,
    "user_blockedadmin",
    "master",
    "admin",
  ],
  [
    "an admin demotes another (unprotected) admin",
    owner,
    "user_admin",
    "student",
    "admin",
  ],
];
for (const [name, auth, target, status, by] of allowedCases) {
  answer = await set(auth, target, status);
  const stored = users.get(target)?.public_metadata;
  check(
    `allowed: ${name}`,
    answer.status === 200 &&
      answer.json?.user?.status === status &&
      stored?.status === status &&
      stored?.statusBy === by,
    `${answer.status} ${JSON.stringify(answer.json)}`,
  );
}
const changedGuest = users.get("user_guest");
check(
  "paid access survives a status change (the merge keeps member and memberUntil)",
  changedGuest.public_metadata.member === true &&
    changedGuest.public_metadata.memberUntil === "2099-12-31",
);
check(
  "private metadata records who changed it and the status before",
  changedGuest.private_metadata.statusChangedBy === "user_admin" &&
    changedGuest.private_metadata.statusBefore === "student",
);
check(
  "statusAt is a time",
  !Number.isNaN(Date.parse(changedGuest.public_metadata.statusAt)),
);
let before = clerkWrites;
answer = await set(admin, "user_guest", "metr");
check(
  "the same status again: 200 unchanged, no write",
  answer.status === 200 &&
    answer.json?.unchanged === true &&
    clerkWrites === before,
);
// A demoted admin is refused at once on the next token, whatever their old token said: the service
// reads the claim, and the test's next token carries the new status.
answer = await ask({ auth: await as("user_admin", "student") });
check("the demoted admin's next session: 403", answer.status === 403);

// --- Broken settings and Clerk down: 503, and the secret key never in an answer.
for (const [name, key, value] of [
  ["no CLERK_SECRET_KEY", "CLERK_SECRET_KEY", ""],
  ["a publishable key in CLERK_SECRET_KEY", "CLERK_SECRET_KEY", "pk_test_abc"],
  ["ADMIN_IDS empty", "ADMIN_IDS", ""],
  ["ADMIN_IDS without a user id", "ADMIN_IDS", "owner"],
]) {
  const saved = env[key];
  env[key] = value;
  answer = await ask({ auth: metr });
  // Changed later on 2026-10-02 (VERSION 2026-10-02.3): a broken setting is "not_configured".
  check(
    `${name}: 503 not_configured`,
    answer.status === 503 && answer.json?.error === "not_configured",
  );
  env[key] = saved;
}
// Added later on 2026-10-02: a guest is refused before the settings are looked at, so "not
// configured" tells nobody but a metr or an admin anything about the service.
env.CLERK_SECRET_KEY = "";
answer = await ask({ auth: await as("user_student", "student") });
check(
  "broken settings, a student asking: 403, not 503",
  answer.status === 403 && answer.json?.error === "forbidden",
);
env.CLERK_SECRET_KEY = secret;
clerkDown = true;
answer = await ask({ auth: admin });
// Changed later on 2026-10-02: Clerk down stays "unavailable", apart from a broken setting.
check(
  "Clerk down: 503 unavailable",
  answer.status === 503 && answer.json?.error === "unavailable",
);
clerkDown = false;
check(
  "no answer carried the secret key",
  answers.every((text) => !text.includes(secret)),
);
check(
  "every answer is private and names its version",
  answer.headers.get("Cache-Control") === "private, no-store" &&
    /^\d{4}-\d{2}-\d{2}\.\d+$/.test(
      answer.headers.get("X-Statuses-Version") ?? "",
    ),
);

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed === 0 ? 0 : 1);
