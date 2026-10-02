// The status service of the admin panel: a Cloudflare Worker through which a metr or an admin
// gives the club's members their statuses. Added 2026-10-02 at the owner's request; the design is
// the consilium verdict .specify/consilium/2026-10-02-admin-posts.md (its roles part, amended by
// the owner's status model the same day), and ADMIN.md is the how-to.
//
// The statuses (src/config.ts, site.admin): guest - every new account, which has no status at
// all; student, expert, master - the club's ranks; metr and admin - who assign statuses and edit
// the posts; blocked - signed up, but closed out of every material of the site, and told who did
// it. A status is the key `status` of the user's Clerk public metadata. A user cannot write public
// metadata; only the Clerk Dashboard and Clerk's Backend API can, and the Backend API needs the
// instance's secret key. That key is the strongest secret of the project - it can change or delete
// every user - so it lives here, in a Worker of its own that holds nothing else secret and does
// two things with it: list users, and set the `status` of one.
//
// Plain JavaScript with no imports, deployed by pasting, like workers/video-access/worker.mjs and
// workers/content-admin/worker.mjs; the session check is the same text as theirs, and
// scripts/check-statuses.mjs fails when it is not. Run on this machine by
// scripts/statuses-dev.mjs.
//
// The rules, all decided here and never by the page:
// - Only a session whose status is metr or admin may call. The ids in ADMIN_IDS are admins whatever
//   their metadata says: they are the owner's way back in if the metadata were ever wrong.
// - Nobody changes their own status.
// - The ids in ADMIN_IDS cannot be changed from the site at all. Since that list may not be empty
//   (the Worker refuses to work without it), the site always has at least one admin it cannot
//   lose: no "last admin" can be removed, and no admin can remove all the others.
// - An admin may give any status to anyone else. A metr may change only a member who is guest,
//   student, expert, master or blocked, and only to one of those; a metr cannot touch a metr or an
//   admin, and cannot lift a block an admin set.
//   Changed later on 2026-10-02 (VERSION 2026-10-02.2), the owner's rule: guest is never given -
//   it is only what a new account starts as - so nobody may set it, an admin included (403
//   "guest"). A metr still may change a guest, but only to student, expert, master or blocked.
//   Every status but guest and blocked opens the paid lectures (workers/video-access/).
// - The target's current status is read from Clerk at the moment of the change, never taken from
//   the request.
// - The change is written with Clerk's metadata endpoint, which merges: `member` and
//   `memberUntil` (paid access, CLERK-DASHBOARD.md 7.3) and every other key stay as they were.
//   Public metadata gets `status`, `statusBy` (metr or admin - the account page tells a blocked
//   member which) and `statusAt`; private metadata, which the member's browser cannot read, gets
//   the id of who changed it and the status before, so the last change is always traceable.
// - A change reaches the member's session token within about a minute, when Clerk renews it; the
//   other services read the status from that token.
//
// The contract. src/scripts/admin-users.ts is the only client. Every action is a POST with
// Authorization: Bearer <Clerk session token> and Content-Type: application/json.
//   OPTIONS /users/<action>  CORS preflight: 204 for an Origin in ALLOWED_ORIGINS, 403 for any other.
//   (Added later on 2026-10-02: /users/list also takes "limit", 1 to 50, default 20.)
//   POST /users/list  {"query"?, "offset"?}  200 {"users": [...], "total", "you": {"id", "status",
//                                                 "assignable": [...]}}
//   POST /users/set   {"userId", "status"}   200 {"user": {...}}  (or {"user", "unchanged": true})
//     400 {"error": "invalid", "problems"}   401 {"error": "unauthenticated", "reason"}
//     403 {"error": "forbidden"}             the caller is neither metr nor admin
//     403 {"error": "self"|"protected"|"rank"}  the change breaks a rule above
//     403 {"error": "guest"}                 added later on 2026-10-02: guest is never given
//     404 {"error": "not_found"}             no such user
//     413, 415, 503 as in the content service
//     503 {"error": "not_configured"}        added later on 2026-10-02: CLERK_SECRET_KEY or ADMIN_IDS
//                                            is missing or wrong; only a metr or an admin gets this far,
//                                            so the panel can say what to set instead of "try later"
//
// The settings (Worker -> Settings -> Variables and Secrets):
//   CLERK_PUBLISHABLE_KEY  text    the same pk_... as site.clerk.publishableKey in src/config.ts
//   ALLOWED_ORIGINS        text    the site's origins, comma-separated
//   ADMIN_IDS              text    Clerk user ids (user_...) of the admins nobody can demote,
//                                  comma-separated; at least one
//   CLERK_SECRET_KEY       secret  the instance's secret key (sk_...), from the Clerk Dashboard
//   CLERK_API              text    optional, https://api.clerk.com/v1 when absent (tests use a stand-in)

// Sent as X-Statuses-Version, so that a pasted copy that fell behind the repository shows.
// Raised to 2026-10-02.2 the same day, when guest stopped being a status anyone may give.
// Raised to 2026-10-02.3 the same day, when broken settings got an answer of their own.
// Raised to 2026-10-02.4 the same day, when the list took a page size (DEFAULT_LIMIT).
const VERSION = "2026-10-02.4";
const LEEWAY_SECONDS = 5;
// A kid not in the cached key list makes the Worker fetch the list again, at most this often, so a
// stream of made-up kids cannot turn every request into a request to Clerk.
const JWKS_REFETCH_SECONDS = 60;

let jwks = { url: "", keys: new Map(), fetchedAt: 0 };

// The session check below, from frontendApiHost() to the end of verifySession(), is a copy of the
// same text in workers/video-access/worker.mjs: the Workers are pasted as single files, so they
// cannot share a module. scripts/check-statuses.mjs fails when the two copies differ.

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

// A copy of site.admin.statuses in src/config.ts, compared by scripts/check-statuses.mjs.
const STATUSES = [
  "guest",
  "student",
  "expert",
  "master",
  "metr",
  "admin",
  "blocked",
];
// What a metr may change, and change to.
const METR_SCOPE = ["guest", "student", "expert", "master", "blocked"];
// Added later on 2026-10-02 (the header): what may be given at all, and what a metr may give.
// METR_SCOPE above stays the list of members a metr may change.
const GIVEN = STATUSES.filter((status) => status !== "guest");
const METR_GIVES = METR_SCOPE.filter((status) => status !== "guest");
const USER_ID = /^user_[A-Za-z0-9]+$/;
const PAGE_SIZE = 50;
// Added later on 2026-10-02 (VERSION 2026-10-02.4), the owner's 20 to a page: /users/list takes an
// optional `limit`, 1 to PAGE_SIZE, and answers DEFAULT_LIMIT members when it is absent; the panel
// sends site.admin.pageSize.
const DEFAULT_LIMIT = 20;
const REQUEST_LIMIT = 16 * 1024;

function adminIds(env) {
  return (env.ADMIN_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => USER_ID.test(id));
}

// A status as the site counts it: no status, or a value outside the list, is a guest.
function statusOf(metadata) {
  const value = metadata?.status;
  return STATUSES.includes(value) ? value : "guest";
}

// The caller's status: an id in ADMIN_IDS is an admin whatever the token says.
function callerStatus(claims, env) {
  return adminIds(env).includes(claims.sub) ? "admin" : statusOf(claims);
}

// Changed later on 2026-10-02: guest left both lists (the header).
function assignable(caller) {
  if (caller === "admin") return [...GIVEN];
  if (caller === "metr") return [...METR_GIVES];
  return [];
}

// undefined when the caller may give `wanted` to a user who is `current` and was set by `by`;
// otherwise the reason it may not.
function refusal(caller, target, current, by, wanted, env, callerId) {
  if (target === callerId) return "self";
  if (adminIds(env).includes(target)) return "protected";
  // Added later on 2026-10-02: guest is never given, by anyone (the header).
  if (wanted === "guest") return "guest";
  if (caller === "admin") return undefined;
  if (!METR_SCOPE.includes(current) || !METR_GIVES.includes(wanted)) {
    return "rank";
  }
  if (current === "blocked" && by === "admin") return "rank";
  return undefined;
}

function clerkApi(env) {
  if (
    typeof env.CLERK_SECRET_KEY !== "string" ||
    !/^sk_(?:test|live)_\w+$/.test(env.CLERK_SECRET_KEY)
  ) {
    throw new Error("CLERK_SECRET_KEY is missing or not a secret key");
  }
  if (adminIds(env).length === 0) {
    throw new Error("ADMIN_IDS holds no Clerk user id");
  }
  const base = (env.CLERK_API || "https://api.clerk.com/v1").replace(
    /\/+$/,
    "",
  );
  return (method, path, body) =>
    fetch(`${base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${env.CLERK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
}

// What the panel shows of a user: no more than it needs.
function shownUser(user, env, callerId) {
  const primary = Array.isArray(user?.email_addresses)
    ? (user.email_addresses.find(
        (e) => e?.id === user.primary_email_address_id,
      ) ?? user.email_addresses[0])
    : undefined;
  const name = [user?.first_name, user?.last_name]
    .filter((part) => typeof part === "string" && part !== "")
    .join(" ");
  return {
    id: user.id,
    name,
    email:
      typeof primary?.email_address === "string" ? primary.email_address : "",
    status: statusOf(user.public_metadata),
    statusBy:
      user.public_metadata?.statusBy === "admin" ||
      user.public_metadata?.statusBy === "metr"
        ? user.public_metadata.statusBy
        : "",
    createdAt: typeof user.created_at === "number" ? user.created_at : 0,
    protected: adminIds(env).includes(user.id),
    self: user.id === callerId,
  };
}

function reply(status, body, origin, extra = {}) {
  const headers = new Headers({
    "Cache-Control": "private, no-store",
    Vary: "Origin",
    "X-Statuses-Version": VERSION,
    ...extra,
  });
  if (origin !== undefined) headers.set("Access-Control-Allow-Origin", origin);
  if (body !== null) headers.set("Content-Type", "application/json");
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers,
  });
}

const actions = {
  async "/users/list"(input, { env, clerk, claims, caller, cors }) {
    const problems = [];
    const query = input.query ?? "";
    const offset = input.offset ?? 0;
    // Added later on 2026-10-02: the page size (DEFAULT_LIMIT's note).
    const limit = input.limit ?? DEFAULT_LIMIT;
    if (typeof query !== "string" || query.length > 100) {
      problems.push({ field: "query", code: "format" });
    }
    if (!Number.isInteger(offset) || offset < 0 || offset > 100_000) {
      problems.push({ field: "offset", code: "format" });
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > PAGE_SIZE) {
      problems.push({ field: "limit", code: "format" });
    }
    if (problems.length > 0) {
      return reply(400, { error: "invalid", problems }, cors);
    }
    const search = new URLSearchParams({
      // Changed later on 2026-10-02: the asked limit, no longer always PAGE_SIZE.
      limit: String(limit),
      offset: String(offset),
      order_by: "-created_at",
    });
    const count = new URLSearchParams();
    if (query.trim() !== "") {
      search.set("query", query.trim());
      count.set("query", query.trim());
    }
    const [list, total] = await Promise.all([
      clerk("GET", `/users?${search}`),
      clerk("GET", `/users/count?${count}`),
    ]);
    if (!list.ok || !total.ok) {
      throw new Error(`Clerk answered ${list.status} / ${total.status}`);
    }
    const users = await list.json();
    const { total_count: totalCount } = await total.json();
    return reply(
      200,
      {
        users: (Array.isArray(users) ? users : []).map((user) =>
          shownUser(user, env, claims.sub),
        ),
        total: typeof totalCount === "number" ? totalCount : 0,
        you: { id: claims.sub, status: caller, assignable: assignable(caller) },
      },
      cors,
    );
  },

  async "/users/set"(input, { env, clerk, claims, caller, cors, now }) {
    const problems = [];
    if (typeof input.userId !== "string" || !USER_ID.test(input.userId)) {
      problems.push({ field: "userId", code: "format" });
    }
    if (!STATUSES.includes(input.status)) {
      problems.push({ field: "status", code: "format" });
    }
    for (const key of Object.keys(input)) {
      if (key !== "userId" && key !== "status") {
        problems.push({ field: key, code: "unknown" });
      }
    }
    if (problems.length > 0) {
      return reply(400, { error: "invalid", problems }, cors);
    }
    // Refused before Clerk is asked: a change of one's own or of a protected admin's status.
    const early = refusal(
      caller,
      input.userId,
      "",
      "",
      input.status,
      env,
      claims.sub,
    );
    // "guest" added later on 2026-10-02: it needs no look at the target either.
    if (early === "self" || early === "protected" || early === "guest") {
      return reply(403, { error: early }, cors);
    }
    const found = await clerk("GET", `/users/${input.userId}`);
    if (found.status === 404) return reply(404, { error: "not_found" }, cors);
    if (!found.ok) throw new Error(`Clerk answered ${found.status}`);
    const user = await found.json();
    const current = statusOf(user.public_metadata);
    const reason = refusal(
      caller,
      input.userId,
      current,
      user.public_metadata?.statusBy,
      input.status,
      env,
      claims.sub,
    );
    if (reason !== undefined) return reply(403, { error: reason }, cors);
    if (current === input.status) {
      return reply(
        200,
        { user: shownUser(user, env, claims.sub), unchanged: true },
        cors,
      );
    }
    const changed = await clerk("PATCH", `/users/${input.userId}/metadata`, {
      public_metadata: {
        status: input.status,
        statusBy: caller,
        statusAt: new Date(now * 1000).toISOString(),
      },
      private_metadata: {
        statusChangedBy: claims.sub,
        statusBefore: current,
      },
    });
    if (!changed.ok) throw new Error(`Clerk answered ${changed.status}`);
    console.log(
      `statuses: ${claims.sub} (${caller}) set ${input.userId} from ${current} to ${input.status}`,
    );
    return reply(
      200,
      { user: shownUser(await changed.json(), env, claims.sub) },
      cors,
    );
  },
};

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    const cors =
      origin !== null && allowedOrigins(env).includes(origin)
        ? origin
        : undefined;
    // As in the other two services: a browser on another site is refused before any work.
    if (origin !== null && cors === undefined)
      return reply(403, { error: "origin" });

    const path = new URL(request.url).pathname;
    const action = Object.hasOwn(actions, path) ? actions[path] : undefined;
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
      const caller = callerStatus(session.claims, env);
      if (caller !== "admin" && caller !== "metr") {
        return reply(403, { error: "forbidden" }, cors);
      }
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
        return reply(
          400,
          { error: "invalid", problems: [{ field: "", code: "json" }] },
          cors,
        );
      }
      // Added later on 2026-10-02 (the contract): the settings are checked here, after the caller
      // proved to be a metr or an admin, and a broken one is said as such. The message in the log
      // names the setting, never its value.
      let clerk;
      try {
        clerk = clerkApi(env);
      } catch (error) {
        console.error(
          "statuses:",
          error instanceof Error ? error.message : error,
        );
        return reply(503, { error: "not_configured" }, cors);
      }
      return await action(input, {
        env,
        clerk,
        claims: session.claims,
        caller,
        cors,
        now,
      });
    } catch (error) {
      // The message names a setting or a status, never a key.
      console.error(
        "statuses:",
        error instanceof Error ? error.message : error,
      );
      return reply(503, { error: "unavailable" }, cors);
    }
  },
};
