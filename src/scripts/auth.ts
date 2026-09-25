// The browser-side Supabase client: one per page, created on first use. Added 2026-09-25, when the
// sign-in moved from the server to the browser (AUTH.md section 5; the consilium verdict of the same
// day in .specify/consilium/2026-09-25-supabase-auth-static.md). It replaces src/lib/supabase.ts,
// which built a server client from request cookies and could only run on a Node host - and GitHub
// Pages, where this site lives, runs no Node process.
//
// What this module is, and is not. It is the singleton and the one piece of wiring every auth page
// needs (the header's flag, see auth-flag.ts). It is not the place for form handlers: each page
// keeps its own handler in its own script block, next to the markup it binds to, the way the Disqus
// component and the search page do (CLAUDE.md, "A component owns the markup its own script binds
// to"). A module that grew every page's handler would be the "universal plug" the owner refused.
//
// Why the client is created inside a function and not at module scope. Two reasons. First, this
// module must never run in frontmatter: frontmatter executes in Node 20 at build time, and
// supabase-js 2.109 throws "Node.js 20 detected without native WebSocket support" while the client
// is constructed - measured on 2026-09-25, when every server-rendered auth page answered 500 (AUTH.md
// section 2). A page script is bundled for the browser, where WebSocket exists, so nothing here
// needs the ws package or a Node flag. Second, a throw at module scope would take the rest of the
// page's hoisted bundle down with it; inside a function the failure stays with the handler that
// called it.
//
// Why the URL and the key come from src/config.ts and not from import.meta.env. They are public by
// design - the publishable key carries the anon role and every read goes through Row Level
// Security - and the site has exactly one Supabase project for the dev server, the owner's machine
// and the deployed site, so one home in config.ts beats three copies of the same value in .env
// files and repository variables. The consilium settled this on 2026-09-25; config.ts says the same
// next to the values.
//
// Why flowType is written out although it is the default. It is the default for client-only
// JavaScript today, and it is the right one here: the email confirmation goes through a token_hash
// and verifyOtp() on /auth/callback/, which needs no code verifier and therefore works when the
// mail is opened on another device, where PKCE would fail. Another Supabase SDK has already flipped
// its default to PKCE; writing the choice down keeps a library update from changing the flow
// silently.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { site } from "../config";
import { clearAuthFlag, writeAuthFlag } from "./auth-flag";

let client: SupabaseClient | undefined;

export function getSupabase(): SupabaseClient {
  if (client === undefined) {
    client = createClient(site.supabase.url, site.supabase.publishableKey, {
      auth: { flowType: "implicit" },
    });
    // Every event the library reports carries the current session or null: INITIAL_SESSION when
    // the page loads (the stored session, if any), SIGNED_IN, TOKEN_REFRESHED, USER_UPDATED, and
    // SIGNED_OUT with null. Mirroring expires_at into the header's flag on each of them, and
    // clearing it when there is no session, is all the header ever needs.
    client.auth.onAuthStateChange((_event, session) => {
      if (session !== null && session.expires_at !== undefined) {
        writeAuthFlag(session.expires_at);
      } else {
        clearAuthFlag();
      }
    });
  }
  return client;
}

// Where a page sends the visitor next. Added the evening of 2026-09-25, when the guest gate in
// Base.astro began to hand the sign-in page the address a guest asked for, as `next`; the callback
// page had the same rule for its mail template since the morning, and this is its one home now.
// Only a path on this site is followed: a full URL or a protocol-relative one (//host) would turn
// either page into an open redirect, and anything else falls back to the dashboard.
export function nextPath(raw: string | null): string {
  return raw !== null && raw.startsWith("/") && !raw.startsWith("//")
    ? raw
    : site.auth.dashboard;
}
