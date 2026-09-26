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
import { ruRU } from "@clerk/localizations";
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

async function load(): Promise<Clerk> {
  const key = site.clerk.publishableKey;
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
    localization: ruRU,
    signInUrl: site.auth.signIn,
    signUpUrl: site.auth.signUp,
    afterSignOutUrl: "/",
  });

  // Mirror the session's expiry into the header's flag on every change Clerk reports, and clear it
  // when there is no session. The listener is called immediately with the current state
  // (ListenerOptions.skipInitialEmit is off by default), so any auth page refreshes the flag on
  // load. The flag is presentation: Clerk decides who is signed in.
  clerk.addListener(({ session }) => {
    if (session) writeAuthFlag(session.expireAt);
    else clearAuthFlag();
  });
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
    site.clerk.publishableKey === ""
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
