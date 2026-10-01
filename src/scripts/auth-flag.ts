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
// Amended 2026-09-28: a paid video's page loads Clerk too (src/scripts/paid-video.ts, through a
// dynamic import), and it writes the flag the same way, since the listener lives in auth.ts. It
// also reads the flag first, to spare a guest the Clerk load; the access service, not this value,
// decides who gets the video (PAID-VIDEO.md).
import { site } from "../config";

// Every access to localStorage is wrapped, because a private window or blocked site data makes the
// accessor throw, and a header that cannot remember a flag must still render.

// Added 2026-09-30, after the colleague asked whether the header's icon follows every sign-in and
// sign-out: the header (AuthButton.astro) listened for this event, but nothing sent it, so a change
// of the flag on an open page - the sign-out button on the account page, before Clerk navigates
// home - reached the header only on the next page load. Both writers below send it now. The
// storage event covers the other tabs; the browser sends that one to them only, never to the tab
// that wrote the value.
export const authFlagEvent = "auth-flag-change";

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
  // Added 2026-09-30: see authFlagEvent above.
  window.dispatchEvent(new Event(authFlagEvent));
}

// Added 2026-10-01 at the owner's request (AUTH.md section 12.7): the member's name and email, for
// the feedback form, which is on every page and loads no Clerk. Written wherever the flag is
// written, so a name changed on the account page follows; cleared with the flag below, on a
// sign-out or when a page that loads Clerk finds no session. An empty pair is not kept. The value
// stays in the member's own browser for as long as the session does, which shows nothing beyond
// what the session itself already gives whoever uses that browser.
export function writeAuthContact(name: string, email: string): void {
  try {
    if (name === "" && email === "") {
      localStorage.removeItem(site.auth.contactKey);
    } else {
      localStorage.setItem(
        site.auth.contactKey,
        JSON.stringify({ name, email }),
      );
    }
  } catch {
    // Storage unavailable: the form simply stays empty.
  }
}

export function clearAuthFlag(): void {
  try {
    localStorage.removeItem(site.auth.flagKey);
    // Added 2026-10-01: the member's name and email go with the flag (writeAuthContact above).
    localStorage.removeItem(site.auth.contactKey);
  } catch {
    // Nothing to clear if nothing could be stored.
  }
  // Added 2026-09-30: see authFlagEvent above.
  window.dispatchEvent(new Event(authFlagEvent));
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
