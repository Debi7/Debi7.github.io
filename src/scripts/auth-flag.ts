// The one thing the header knows about a visitor's session. Added 2026-09-25 with the
// browser-side sign-in.
// (Comments rewritten 2026-09-26 for the move to Clerk, CLERK.md step 4: they named the previous
// provider, which CLERK.md section 0 orders out of this branch. The design is unchanged.)
//
// The header is on every page, and Clerk weighs about 720 KB gzip with React (measured 2026-09-26, see package.json) against
// about 70 KB of JavaScript on the whole rest of the site, so the header must not import it.
// Instead the auth pages - the only ones that load Clerk, through src/scripts/auth.ts - write the
// session's expiry here on every change Clerk reports, and the header reads this value alone.
// Nothing here depends on how Clerk stores its own session: that is the library's business, and
// the day it changes, only the library notices.
//
// Fail-closed by design. A missing or expired value reads as "not signed in", so the header may
// show the signed-out icon to a signed-in visitor for a while (until the next auth page corrects
// it), but never the other way round. The flag is presentation: Clerk decides who is signed in,
// and whatever protects paid content later decides what a visitor may read, never this value.
import { site } from "../config";

// Every access to localStorage is wrapped, because a private window or blocked site data makes the
// accessor throw, and a header that cannot remember a flag must still render.

// Stored as the session's expiry in unix seconds.
// (Changed 2026-09-26, CLERK.md step 4: Clerk reports the expiry as a Date - session.expireAt - so
// the conversion to seconds happens here. The stored shape stays unix seconds, which is why the
// inline copy of readAuthFlag() in Base.astro needs no change.)
export function writeAuthFlag(expiresAt: Date): void {
  try {
    localStorage.setItem(
      site.auth.flagKey,
      String(Math.floor(expiresAt.getTime() / 1000)),
    );
  } catch {
    // Storage unavailable: the header shows signed out, which is the safe side.
  }
}

export function clearAuthFlag(): void {
  try {
    localStorage.removeItem(site.auth.flagKey);
  } catch {
    // Nothing to clear if nothing could be stored.
  }
}

// True while the last session the auth pages saw is still within its lifetime.
// Repeated inline at the top of the head in Base.astro since the evening of 2026-09-25, where the
// guest gate has to run before paint and cannot import; change the two together.
export function readAuthFlag(): boolean {
  try {
    const raw = localStorage.getItem(site.auth.flagKey);
    if (raw === null) return false;
    const expiresAt = Number(raw);
    return Number.isFinite(expiresAt) && expiresAt * 1000 > Date.now();
  } catch {
    return false;
  }
}
