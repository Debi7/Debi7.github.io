// The one thing the header knows about a visitor's session. Added 2026-09-25 with the
// browser-side sign-in (AUTH.md section 5; the consilium verdict of the same day in
// .specify/consilium/2026-09-25-supabase-auth-static.md).
//
// The header is on every page, and the Supabase client weighs 55 KB gzip against 70 KB of
// JavaScript on the whole site today, so the header must not import it. Instead the auth pages -
// the only ones that load the client, through src/scripts/auth.ts - write the session's expiry here
// on every change the client reports, and the header reads this value alone. Nothing here depends
// on how the client stores its own session: that key and its shape are the library's business, and
// the day they change, only the library notices.
//
// Fail-closed by design. A missing or expired value reads as "not signed in", so the header may
// show the signed-out icon to a signed-in visitor for a while (until the next auth page corrects
// it), but never the other way round. The flag is presentation: whether a visitor may read
// something is decided by Row Level Security at the service, never by this value.
import { site } from "../config";

// Every access to localStorage is wrapped, because a private window or blocked site data makes the
// accessor throw, and a header that cannot remember a flag must still render.

// Stored as the session's expires_at, unix seconds, exactly as the library reports it.
export function writeAuthFlag(expiresAt: number): void {
  try {
    localStorage.setItem(site.auth.flagKey, String(expiresAt));
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
