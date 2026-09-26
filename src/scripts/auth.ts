// The browser-side Clerk instance: one per page, loaded on first use. Rewritten on 2026-09-26 for
// the move to Clerk (CLERK.md step 4; the verdict in .specify/consilium/2026-09-25-clerk-static.md).
// The previous provider's client that lived here is gone with its name (CLERK.md section 0); the
// lessons that did not depend on it are kept below in neutral words.
//
// What this module is, and is not. It is the one place a Clerk instance is created, and the one
// piece of wiring every auth page needs (the header's flag, see auth-flag.ts). Pages never construct
// Clerk. It is not the place for page logic: each page keeps its own script next to the markup it
// binds to (CLAUDE.md, "A component owns the markup its own script binds to").
//
// Who may import it. Only the three page scripts under src/pages/auth/. Never frontmatter, which
// runs in Node at build time, and never a file the header or the layout loads: Clerk is by far the
// heaviest code on the site (package.json has the measured size), so it has to stay on the three
// pages that need it.
//
// Why the instance is created inside a function and not at module scope. A throw at module scope
// would take the rest of the page's bundle down with it; inside a function the failure reaches the
// page as a rejected promise, and the page says so in its status line.
//
// Both halves of Clerk come from installed packages: @clerk/clerk-js is the instance, @clerk/ui is
// the prebuilt components, and `ui` from @clerk/ui is handed to load() - the setup Clerk's "Component
// versioning" page documents for JavaScript (Core 3). The owner chose this on 2026-09-26 over
// fetching the UI bundle from Clerk's host at runtime, which the first version of this file did the
// same day: one install, versions pinned in package.json, no script tag built by hand. @clerk/ui
// brings React and React DOM as peer dependencies; they are used by Clerk's components only.
import { Clerk } from "@clerk/clerk-js";
// Changed 2026-09-26: the Russian strings come through ./clerk-ru, which fills the gaps ruRU
// leaves on the three auth pages (its header says which and why).
import { localization } from "./clerk-ru";
import { ui } from "@clerk/ui";
import { site } from "../config";
import { clearAuthFlag, writeAuthFlag } from "./auth-flag";

let pending: Promise<Clerk> | undefined;

// The loaded instance, shared by every caller on the page. A second call returns the same promise
// instead of constructing and loading Clerk again.
export function getClerk(): Promise<Clerk> {
  pending ??= load();
  return pending;
}

// The key widened to string. Added 2026-09-26 when the real key went in: `as const` in
// src/config.ts types the value as its own literal, so astro check rejected the comparisons with ""
// below as impossible (ts 2367). Both checks stay, for the day the key is emptied again.
const configuredKey: string = site.clerk.publishableKey;

// Every page address on this site ends with a slash (trailingSlash "always" in astro.config.mjs);
// used by the navigation hooks in load() below, which say why.
function withTrailingSlash(to: string): string {
  const url = new URL(to, location.href);
  if (
    url.origin === location.origin &&
    !url.pathname.endsWith("/") &&
    !/\.[a-z0-9]+$/i.test(url.pathname)
  ) {
    url.pathname += "/";
  }
  return url.href;
}

// The flag follows Clerk's session: written while there is one, cleared when Clerk says there is
// none (null), left alone while Clerk does not know yet (undefined). Shared by the listener and
// the navigation hooks in load(), which say why both are needed.
function syncAuthFlag(session: Clerk["session"]): void {
  if (session) writeAuthFlag(session.expireAt);
  else if (session === null) clearAuthFlag();
}

async function load(): Promise<Clerk> {
  const key = configuredKey;
  // Until the Clerk application exists the key is empty (src/config.ts says why); the pages then
  // show their "not set up" line, and this message tells whoever looks at the console the cause.
  if (key === "") {
    throw new Error(
      "Clerk: site.clerk.publishableKey is empty - see CLERK.md section 1",
    );
  }

  const clerk = new Clerk(key);
  await clerk.load({
    ui,
    localization,
    signInUrl: site.auth.signIn,
    signUpUrl: site.auth.signUp,
    afterSignOutUrl: "/",
    // Added 2026-09-26 after the owner's first sign-up ended on a 404. Clerk's navigation drops
    // the trailing slash from the address it is given: forceRedirectUrl "/auth/account/" arrived
    // as "/auth/account" (reproduced in headless Edge on astro preview, after the email code). The
    // dev and preview servers answer 404 to that under trailingSlash "always" (CLAUDE.md, the
    // trailingSlash entry); GitHub Pages happens to redirect it, which is why only local testing
    // showed the fault. routerPush and routerReplace are Clerk's documented way to take over its
    // navigation (both or neither, per its types); they put the slash back on any page address
    // of this site before leaving. A path with a file extension or another origin is left as is.
    //
    // The same two hooks also bring the header's flag up to date before the page is left. Added
    // 2026-09-26 when the first real runs showed the listener below arriving too late on both
    // ends: after a sign-in Clerk navigated before the flag was written, so the next page showed
    // a guest's header; after a sign-out it navigated before the null session was reported, so
    // the flag outlived the session. Clerk calls these hooks for exactly those navigations.
    routerPush: (to: string) => {
      syncAuthFlag(clerk.session);
      location.assign(withTrailingSlash(to));
    },
    routerReplace: (to: string) => {
      syncAuthFlag(clerk.session);
      location.replace(withTrailingSlash(to));
    },
    // Added 2026-09-26, the owner's request to match the site: the card fills the page's column
    // (max-w-md on the forms, max-w-3xl on the account page) instead of Clerk's fixed width, and
    // takes the shape of the site's cards - rounded-lg and Tailwind 4's shadow-sm, which is what
    // the ported theme renders. Style objects rather than a class in a stylesheet: Clerk merges
    // them into its own generated styles, which a class of equal specificity would lose to. The
    // colours, font and sizes are CSS variables in src/styles/clerk.css.
    appearance: {
      elements: {
        rootBox: { width: "100%" },
        cardBox: {
          width: "100%",
          maxWidth: "100%",
          borderRadius: "0.5rem",
          boxShadow:
            "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
        },
      },
    },
  });

  // Mirror the session's expiry into the header's flag on every change Clerk reports, and clear it
  // when there is no session. The listener is called immediately with the current state
  // (ListenerOptions.skipInitialEmit is off by default), so any auth page refreshes the flag on
  // load. The flag is presentation: Clerk decides who is signed in.
  // Changed 2026-09-26 after the first real sign-in left no flag: Clerk types the session as
  // SignedInSessionResource | null | undefined, where null means signed out and undefined means
  // not known yet. Clearing on anything falsy wiped the flag right after a sign-in wrote it, so
  // the header and the menu never saw the member. Only null clears it now.
  clerk.addListener(({ session }) => syncAuthFlag(session));
  return clerk;
}

// What a page says when Clerk could not be loaded. Added 2026-09-26 (CLERK.md step 5): the three
// pages share it so that the wording is written once. A missing key is a setup gap, not something
// a visitor can fix by reloading, so it gets its own line; every other failure (Clerk's servers
// blocked or unreachable, no network, a bad key) gets the reload advice. The cause always goes to
// the console for whoever is testing. The page must never stay on "Загрузка..." (CLERK.md, pitfalls).
export function showLoadFailure(
  status: HTMLElement | null,
  error: unknown,
): void {
  console.error(error);
  if (status === null) return;
  status.textContent =
    configuredKey === ""
      ? "Вход на сайт ещё не подключён."
      : "Не удалось загрузить форму. Обновите страницу.";
  status.classList.add("text-red-600");
}

// Where a page sends the visitor next. Added the evening of 2026-09-25, when the guest gate in
// Base.astro began to hand the sign-in page the address a guest asked for, as `next`; the callback
// page had the same rule for its mail template since the morning, and this is its one home now.
// Only a path on this site is followed: a full URL or a protocol-relative one (//host) would turn
// either page into an open redirect, and anything else falls back to the dashboard.
// (Changed 2026-09-26, CLERK.md step 4: the fallback is the account page, which replaced the
// dashboard; the callback page is gone, and the sign-in page is the one caller left.)
export function nextPath(raw: string | null): string {
  return raw !== null && raw.startsWith("/") && !raw.startsWith("//")
    ? raw
    : site.auth.account;
}
