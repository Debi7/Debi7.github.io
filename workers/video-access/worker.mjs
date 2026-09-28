// The access service for paid videos: a Cloudflare Worker, and the one piece of this project that
// runs on a server. Added 2026-09-28; the design is the consilium verdict in
// .specify/consilium/2026-09-28-paid-video-access.md, and PAID-VIDEO.md is the how-to.
//
// GitHub Pages serves files and runs no code, so the check "may this visitor watch this video" and
// the map from a paid entry's slug to its real video id cannot live in the site. They live here. The
// repository holds this code and no id of a paid video: the ids are a secret of the Worker.
//
// Plain JavaScript with no imports, on purpose: it is deployed by pasting this file into the
// Worker's editor in the Cloudflare Dashboard (workers/video-access/README.md), so there is no
// wrangler, no @cloudflare/workers-types and no new dependency, and nothing here depends on the
// Node version of this project. The same file runs on this machine through
// scripts/video-access-dev.mjs and is tested by scripts/check-video-access.mjs; Node 20 has the
// same fetch, Request, Response, atob and WebCrypto as the Workers runtime.
//
// The contract. The site's src/scripts/paid-video.ts is the only client.
//   OPTIONS /video  CORS preflight: 204 for an Origin in ALLOWED_ORIGINS, 403 for any other.
//   POST /video     header Authorization: Bearer <Clerk session token>, body {"slug": "<slug>"}
//     200 {"embedUrl": "https://www.youtube-nocookie.com/embed/<id>?rel=0"}  a member, a known slug
//     400 {"error": "bad_request"}                  the body is not {"slug": "<text>"}
//     401 {"error": "unauthenticated", "reason"}    no token, or a token failing a check below
//     403 {"error": "forbidden"}                    a valid session that grants no access
//     404 {"error": "not_connected"}                a member asked for a slug VIDEOS lacks
//     503 {"error": "unavailable"}                  a setting is missing or broken, or Clerk's
//                                                   key list could not be fetched
//   Any other path answers 404, any other method 405. Every answer carries
//   Cache-Control: private, no-store (an answer is for one visitor) and Vary: Origin.
//
// The settings (Worker -> Settings -> Variables and Secrets):
//   CLERK_PUBLISHABLE_KEY  text    the same pk_... as site.clerk.publishableKey in src/config.ts
//   ALLOWED_ORIGINS        text    the site's origins, comma-separated
//   VIDEOS                 secret  {"<slug>": "<YouTube id>", ...}
//
// The token checks follow Clerk's "Manual JWT verification" (Core 3). The signing key is looked up
// by the token's kid in the instance's key list (JWKS), and the instance is the one named by
// CLERK_PUBLISHABLE_KEY - never the token's own iss, or a token from anybody's Clerk instance would
// bring its own key. Then: RS256 only, the signature, exp and nbf with 5 seconds for clock skew,
// iss equal to the instance, azp one of ALLOWED_ORIGINS, a sid (session tokens carry one, tokens
// from a JWT template do not), and sts not "pending".
//
// The access rule is CLERK-DASHBOARD.md section 7.3: the claim member is exactly true, and the claim
// memberUntil is a real date YYYY-MM-DD that is today or later in UTC. The two claims come from
// the user's public metadata through the session token template of CLERK-DASHBOARD.md 7.2. Anything
// else - "true" in quotes, a missing field, 31.12.2026 - refuses: an administrator's typo must
// close access, never open it.

// Sent as X-Video-Access-Version, so that a pasted copy that fell behind the repository shows.
// Raised to 2026-09-28.2 the same day, when the player address moved to youtube-nocookie.com.
const VERSION = "2026-09-28.2";
const LEEWAY_SECONDS = 5;
// A kid not in the cached key list makes the Worker fetch the list again, at most this often, so a
// stream of made-up kids cannot turn every request into a request to Clerk.
const JWKS_REFETCH_SECONDS = 60;

let jwks = { url: "", keys: new Map(), fetchedAt: 0 };
let videos = { raw: undefined, map: {} };

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

function isMember(claims, now) {
  if (claims.member !== true) return false;
  const until = claims.memberUntil;
  if (typeof until !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(until))
    return false;
  // A date that does not exist (2026-02-31) comes back from Date.UTC as another day and refuses.
  const [year, month, day] = until.split("-").map(Number);
  if (
    new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) !==
    until
  ) {
    return false;
  }
  // The last day is included: access ends at midnight UTC after it.
  return new Date(now * 1000).toISOString().slice(0, 10) <= until;
}

function videoIds(raw) {
  if (videos.raw !== raw) videos = { raw, map: JSON.parse(raw ?? "{}") };
  return videos.map;
}

function reply(status, body, origin, extra = {}) {
  const headers = new Headers({
    "Cache-Control": "private, no-store",
    Vary: "Origin",
    "X-Video-Access-Version": VERSION,
    ...extra,
  });
  if (origin !== undefined) headers.set("Access-Control-Allow-Origin", origin);
  if (body !== null) headers.set("Content-Type", "application/json");
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers,
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    const cors =
      origin !== null && allowedOrigins(env).includes(origin)
        ? origin
        : undefined;
    // A browser on another site. CORS alone would let it send the request and only hide the
    // answer; refusing here keeps its requests from doing any work. A request without Origin
    // (curl, a server) goes on: the token's azp still has to name one of the site's origins.
    if (origin !== null && cors === undefined)
      return reply(403, { error: "origin" });

    if (new URL(request.url).pathname !== "/video") {
      return reply(404, { error: "not_found" }, cors);
    }
    if (request.method === "OPTIONS") {
      // One address for every video, so one preflight serves them all for two hours (the
      // performance reviewer: the preflight cache is per URL, and without Max-Age it lasts 5 s).
      return reply(204, null, cors, {
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
        "Access-Control-Max-Age": "7200",
      });
    }
    if (request.method !== "POST") {
      return reply(405, { error: "method" }, cors, { Allow: "POST, OPTIONS" });
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
      if (!isMember(session.claims, now))
        return reply(403, { error: "forbidden" }, cors);

      let slug;
      try {
        ({ slug } = await request.json());
      } catch {
        slug = undefined;
      }
      if (typeof slug !== "string" || slug === "" || slug.length > 200) {
        return reply(400, { error: "bad_request" }, cors);
      }
      const ids = videoIds(env.VIDEOS);
      // Object.hasOwn, so that "__proto__" or "constructor" is not found on the prototype.
      const id = Object.hasOwn(ids, slug) ? ids[slug] : undefined;
      if (id === undefined) return reply(404, { error: "not_connected" }, cors);
      if (typeof id !== "string" || !/^[\w-]+$/.test(id)) {
        throw new Error(`VIDEOS holds no usable id for ${slug}`);
      }
      // Changed 2026-09-28 (VERSION 2026-09-28.2): the same address as the public player in
      // src/layouts/VideoLayout.astro, whose note says why - the privacy-enhanced host and
      // rel=0, which is as far as YouTube lets a site go in keeping visitors on it.
      return reply(
        200,
        { embedUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0` },
        cors,
      );
    } catch (error) {
      // The message names a setting or Clerk's status, never the token.
      console.error(
        "video-access:",
        error instanceof Error ? error.message : error,
      );
      return reply(503, { error: "unavailable" }, cors);
    }
  },
};
