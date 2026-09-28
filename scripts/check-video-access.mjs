// Tests the access service for paid videos (workers/video-access/worker.mjs) without a network and
// without a Clerk instance. Added 2026-09-28 with paid videos (PAID-VIDEO.md); `npm run
// check:video-access`.
//
// It makes its own RS256 key pair, serves the public half as the key list of a made-up Clerk
// instance (fetch is replaced for that one address), signs session tokens with it, and sends the
// Worker every case the consilium verdict of 2026-09-28 lists: each way a token can be wrong must
// answer 401, each way the access record can be wrong must answer 403, and only a member with a
// known slug gets a player address. The last lines time the check itself.
import worker from "../workers/video-access/worker.mjs";

const host = "test-instance.clerk.accounts.dev";
const site = "http://localhost:4321";
const env = {
  CLERK_PUBLISHABLE_KEY: "pk_test_" + btoa(host + "$"),
  ALLOWED_ORIGINS: `${site},https://debi7.github.io`,
  VIDEOS: JSON.stringify({ "paid-demo": "M7lc1UVf-VE" }),
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

// Every fetch the Worker makes lands here; nothing leaves the machine. Only the made-up instance
// has a key list, and only while jwksAvailable is true.
let jwksAvailable = true;
globalThis.fetch = async (url) =>
  String(url) === `https://${host}/.well-known/jwks.json` && jwksAvailable
    ? new Response(JSON.stringify({ keys: [publicJwk] }))
    : new Response("down", { status: 502 });

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
const day = (offset) =>
  new Date((now + offset * 86400) * 1000).toISOString().slice(0, 10);
const base = {
  iss: `https://${host}`,
  azp: site,
  sid: "sess_test",
  sub: "user_test",
  iat: now - 5,
  nbf: now - 5,
  exp: now + 60,
  member: true,
  memberUntil: day(30),
};
const without = (key) => {
  const copy = { ...base };
  delete copy[key];
  return copy;
};

async function ask({
  method = "POST",
  path = "/video",
  origin = site,
  auth,
  body,
}) {
  const headers = new Headers();
  if (origin !== null) headers.set("Origin", origin);
  if (auth !== undefined) headers.set("Authorization", auth);
  if (body !== undefined) headers.set("Content-Type", "application/json");
  const response = await worker.fetch(
    new Request(`https://video-access.example${path}`, {
      method,
      headers,
      body:
        body === undefined
          ? undefined
          : typeof body === "string"
            ? body
            : JSON.stringify(body),
    }),
    env,
  );
  const text = await response.text();
  return { status: response.status, headers: response.headers, text };
}

const bearer = async (claims, options) =>
  `Bearer ${await token(claims, options)}`;
const slug = { slug: "paid-demo" };

const results = [];
async function expect(name, request, status, extra = () => true) {
  const answer = await ask(request);
  const ok = answer.status === status && extra(answer);
  results.push(ok);
  console.log(
    `${ok ? "PASS" : "FAIL"} ${name}  [${answer.status} ${answer.text}]`,
  );
}

// CORS and routing.
await expect(
  "preflight from the site",
  { method: "OPTIONS" },
  204,
  (a) =>
    a.headers.get("Access-Control-Allow-Origin") === site &&
    a.headers.get("Access-Control-Max-Age") === "7200" &&
    /Authorization/.test(a.headers.get("Access-Control-Allow-Headers") ?? ""),
);
await expect(
  "preflight from another site",
  { method: "OPTIONS", origin: "https://evil.example" },
  403,
  (a) => a.headers.get("Access-Control-Allow-Origin") === null,
);
await expect(
  "GET is not allowed",
  { method: "GET", auth: await bearer(base) },
  405,
);
await expect(
  "another path",
  { path: "/other", auth: await bearer(base), body: slug },
  404,
);

// Every way a token can be wrong: 401.
await expect("no token", { body: slug }, 401, (a) =>
  a.text.includes("no_token"),
);
await expect("not a JWT", { auth: "Bearer abc", body: slug }, 401);
await expect(
  "alg none",
  {
    auth: `Bearer ${encode({ alg: "none", kid: "ins_test" })}.${encode(base)}.`,
    body: slug,
  },
  401,
);
await expect(
  "alg HS256 in the header",
  { auth: await bearer(base, { header: { alg: "HS256" } }), body: slug },
  401,
  (a) => a.text.includes("algorithm"),
);
await expect(
  "unknown kid",
  { auth: await bearer(base, { header: { kid: "ins_other" } }), body: slug },
  401,
  (a) => a.text.includes("unknown_kid"),
);
await expect(
  "signed with another key",
  { auth: await bearer(base, { key: other.privateKey }), body: slug },
  401,
  (a) => a.text.includes("signature"),
);
await expect(
  "another instance as iss",
  {
    auth: await bearer({ ...base, iss: "https://evil.clerk.accounts.dev" }),
    body: slug,
  },
  401,
  (a) => a.text.includes("issuer"),
);
await expect(
  "expired",
  { auth: await bearer({ ...base, exp: now - 10 }), body: slug },
  401,
  (a) => a.text.includes("expired"),
);
await expect(
  "not valid yet",
  { auth: await bearer({ ...base, nbf: now + 60 }), body: slug },
  401,
);
await expect(
  "azp of another site",
  { auth: await bearer({ ...base, azp: "https://evil.example" }), body: slug },
  401,
  (a) => a.text.includes("azp"),
);
await expect("no azp", { auth: await bearer(without("azp")), body: slug }, 401);
await expect(
  "no sid (a JWT-template token)",
  { auth: await bearer(without("sid")), body: slug },
  401,
  (a) => a.text.includes("not_a_session"),
);
await expect(
  "pending session",
  { auth: await bearer({ ...base, sts: "pending" }), body: slug },
  401,
);

// Every way the access record can be wrong: 403.
await expect(
  "member false",
  { auth: await bearer({ ...base, member: false }), body: slug },
  403,
);
await expect(
  'member "true" in quotes',
  { auth: await bearer({ ...base, member: "true" }), body: slug },
  403,
);
await expect(
  "member null",
  { auth: await bearer({ ...base, member: null }), body: slug },
  403,
);
await expect(
  "no member claim",
  { auth: await bearer(without("member")), body: slug },
  403,
);
await expect(
  "no memberUntil",
  { auth: await bearer(without("memberUntil")), body: slug },
  403,
);
await expect(
  "memberUntil yesterday",
  { auth: await bearer({ ...base, memberUntil: day(-1) }), body: slug },
  403,
);
await expect(
  "memberUntil 31.12.2099",
  { auth: await bearer({ ...base, memberUntil: "31.12.2099" }), body: slug },
  403,
);
await expect(
  "memberUntil 2099-02-31",
  { auth: await bearer({ ...base, memberUntil: "2099-02-31" }), body: slug },
  403,
);

// A member.
await expect(
  "member, last day is today",
  { auth: await bearer({ ...base, memberUntil: day(0) }), body: slug },
  200,
);
await expect(
  "member, known slug",
  { auth: await bearer(base), body: slug },
  200,
  (a) =>
    // The address the Worker builds since 2026-09-28.2 (its note says why).
    JSON.parse(a.text).embedUrl ===
      "https://www.youtube-nocookie.com/embed/M7lc1UVf-VE?rel=0" &&
    a.headers.get("Access-Control-Allow-Origin") === site &&
    a.headers.get("Cache-Control") === "private, no-store" &&
    a.headers.get("Vary") === "Origin",
);
await expect(
  "member, request without Origin (curl)",
  { origin: null, auth: await bearer(base), body: slug },
  200,
  (a) => a.headers.get("Access-Control-Allow-Origin") === null,
);
await expect(
  "member, unknown slug",
  { auth: await bearer(base), body: { slug: "video-1" } },
  404,
);
await expect(
  "member, slug __proto__",
  { auth: await bearer(base), body: { slug: "__proto__" } },
  404,
);
await expect(
  "member, body not JSON",
  { auth: await bearer(base), body: "slug=paid-demo" },
  400,
);
await expect(
  "member, slug not text",
  { auth: await bearer(base), body: { slug: 5 } },
  400,
);

// A broken setting or an unreachable Clerk: 503, never an open door.
const videosBefore = env.VIDEOS;
env.VIDEOS = "{not json";
await expect(
  "VIDEOS is not JSON",
  { auth: await bearer(base), body: slug },
  503,
);
env.VIDEOS = videosBefore;
const keyBefore = env.CLERK_PUBLISHABLE_KEY;
// Another instance, so the Worker's cached key list does not answer for it.
env.CLERK_PUBLISHABLE_KEY =
  "pk_test_" + btoa("down-instance.clerk.accounts.dev$");
jwksAvailable = false;
await expect(
  "key list unreachable",
  { auth: await bearer(base), body: slug },
  503,
);
env.CLERK_PUBLISHABLE_KEY = "";
await expect(
  "CLERK_PUBLISHABLE_KEY empty",
  { auth: await bearer(base), body: slug },
  503,
);
env.CLERK_PUBLISHABLE_KEY = keyBefore;
jwksAvailable = true;

// Time of one full check with warm caches, the figure the 10 ms CPU limit of the free plan is
// about. Wall time on this machine, so an upper bound of the CPU time.
const member = await bearer(base);
const times = [];
for (let i = 0; i < 200; i++) {
  const start = performance.now();
  await ask({ auth: member, body: slug });
  times.push(performance.now() - start);
}
times.sort((a, b) => a - b);
console.log(
  `timing over 200 requests: p50 ${times[100].toFixed(2)} ms, p99 ${times[198].toFixed(2)} ms`,
);

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed === 0 ? 0 : 1);
