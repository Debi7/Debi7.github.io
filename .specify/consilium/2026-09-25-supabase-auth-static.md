---
consilium: 2026-09-25
topic: Registration, sign-in and gated content with Supabase on the static GitHub Pages build
slug: supabase-auth-static
verdict: approved-with-conditions
route: direct-verified
archetypes:
  nitpicker: ok
  security: ok
  performance: ok
  best-practices: ok
  pragmatist: ok
---

# Registration, sign-in and gated content with Supabase on the static GitHub Pages build

Convened on 2026-09-25 at the owner's request, after the colleague's server-side sign-in of 2026-09-24 had put the
site into a mode GitHub Pages cannot serve (the live site answered 404 from the merge of 2026-09-25). Five
archetypes reviewed the proposal independently, the interrogator cross-examined each of them, and the owner
approved the agreed proposal below the same day. AUTH.md holds the measurements this verdict rests on.

## Agreed proposal

Members of the club can create an account with an email address and a password, confirm the address through a
link in a mail, sign in, see a personal page with their address, one piece of content that only signed-in members
receive, and sign out. Visitors who are not signed in see the same page as an invitation to sign in. The site
stays where it is, on GitHub Pages, and keeps its look; the sign-in pages are new pages in the site's frame with
its minimal styling, written in Russian like the rest of the site. Registration is open to anyone with a mailbox
for now, and the project must keep the option of closing it later, when membership becomes paid.

Why this way: the site is served as files, so nothing on it can run at request time. What a visitor must not
receive without signing in therefore never sits in the pages themselves; it lives at the service and is fetched by
the visitor's browser after sign-in, under the service's own access rules. Hiding a link is presentation; the data
rule is the protection. This is the mechanism VIDEO-PAGE.md section 6.1 already planned for paid lectures, so the
demo builds the road the paid videos will drive on.

## Scope and limits

- In scope: static build restored (the live site comes back); browser-side Supabase client in one module, loaded
  by the auth pages only; the pages `/auth/signup/`, `/auth/signin/`, `/auth/callback/`, `/auth/dashboard/` inside
  `Base.astro` with their own scripts; the header button reading a small flag instead of the SDK; one demo table
  behind Row Level Security with one shared row; sitemap filter for the auth pages; the two public Supabase values
  in `src/config.ts`; `.env.local` taken out of tracking; documentation (AUTH.md, README.md, CLAUDE.md,
  VIDEO-PAGE.md 6.1) and this verdict.
- Out of scope, deliberately: paid videos and the entitlements table; password reset; custom SMTP; CAPTCHA;
  `noindex` on the auth pages; removing Busuanzi or the Disqus count script (the owner keeps both); a custom domain;
  any new dependency.
- Constraints that stand: Node 20 and Astro 4; npm; `trailingSlash: "always"`; the assistant never commits; the
  colleague merges through a pull request; every change carries an English comment; the colleague's addresses and
  files are kept, with one rename the owner asked for (`/dashboard/` to `/auth/dashboard/`).

## Remarks that survived

- [confirmed] Static build plus browser-side auth is the only design compatible with GitHub Pages and with the
  project's own contracts (`dist/` layout for `check:pages`, route parity); the static switch goes first and is
  verified with a request to the live site, not with the workflow's green mark (all five; pragmatist).
- [confirmed] The Supabase SDK weighs 55 KB gzip against 70 KB of JavaScript on the whole site today and starts a
  refresh timer every 30 seconds, so it loads on the auth pages only; the header button reads a flag that the auth
  pages write through `onAuthStateChange`, and never imports the SDK (performance, nitpicker, best-practices;
  pragmatist conceded).
- [confirmed] The client is created lazily inside handlers and never in frontmatter: frontmatter runs in Node 20
  at build time, where `supabase-js` 2.109 throws for want of a WebSocket implementation (pragmatist, nitpicker).
- [confirmed] Email confirmation uses the `token_hash` template and `verifyOtp` behind a button on
  `/auth/callback/`: mail scanners that follow links cannot burn the token, the flow works across devices, and no
  token travels in the address (security; best-practices withdrew "drop the callback page"). The page also accepts
  the default confirmation link, so a template not yet changed still signs the visitor in.
- [confirmed] The Supabase URL and the publishable key are public by design and live in `src/config.ts`, the one
  home of site-wide settings, with a comment saying why they are not secrets; no build variables in GitHub Actions
  (pragmatist; best-practices conceded, there is one Supabase project for every environment).
- [confirmed] The colleague's addresses stay; the dashboard is the members-only demo (email, sign-out, one row);
  the addresses themselves live in `src/config.ts` (best-practices, nitpicker, pragmatist).
- [confirmed] The demo table holds no personal data, has RLS enabled, the default grants revoked, and one `select`
  policy for `authenticated`; nothing for `anon`, nothing for writes. "Registered" is not "entitled": paid videos
  need an entitlements table joined in the policy, and VIDEO-PAGE.md 6.1 step 9 is corrected to say that RLS is
  the server code it asked for, a function being needed only for signed addresses (security, nitpicker,
  best-practices).
- [confirmed] Pages branch on the session, not on the data: a policy that matches no rows answers an empty array
  with status 200, not an error (pragmatist, best-practices).
- [confirmed] The redirect allow-list names the exact callback addresses, not `/**` (security).
- [confirmed] Keep "Confirm email" on for the demo: one full rehearsal more than an hour before it and one
  pre-confirmed spare account, because the default sender allows two mails an hour (nitpicker, security;
  pragmatist conceded).
- [confirmed] The sitemap filter excludes the auth pages; the list of acceptable route differences in CLAUDE.md is
  extended; the dashboard contract, the table DDL and the verification list are written into AUTH.md (nitpicker,
  best-practices).
- [confirmed] The rewritten pages lose the server-side frontmatter and its comments; the deletion is explained in
  the commit message, as CLAUDE.md allows for pure deletions, and the trailing-slash fact moves into the new
  comments (nitpicker).

## Marked by the interrogator

- [weak] Security's "blocks the public showing" over the shared origin `debi7.github.io`, where ten other Pages
  projects of the colleague live: no path from the shared origin to a token was shown without an attacker already
  controlling one of those repositories. Owner's decision: accepted risk, recorded here; a custom domain goes to
  the backlog.
- [weak] Performance's `storageKey` option as "documented": it exists in the types only. Replaced by a flag of our
  own written from `onAuthStateChange`, which depends on nothing internal.
- [weak] Nitpicker's route `speckit`: no `.specify/` exists in the project and no second consumer was named; the
  archetype conceded on the condition that the dashboard contract, the DDL and a measured verification list go
  into AUTH.md.
- [weak] Pragmatist's "accept the SDK on every page for the demo" (the fix is about fifteen lines) and "switch
  Confirm email off" (loses the confirmation step the client should see). Both withdrawn.
- [weak] Best-practices' "drop `/auth/callback/`" (email prefetching burns implicit-flow links) and "keep the key
  in env" (no second consumer). Both withdrawn.
- [contradicts security] Third-party scripts (Busuanzi, Disqus `count.js`) can read the session on every page.
  Owner's decision: both stay; the risk is recorded in AUTH.md as accepted for a demo with test accounts; the
  condition for real members is a deliberate choice of one analytics vendor.
- [contradicts security] Open registration versus invitation only. Owner's decision: open for now, with the
  switch documented so it can be closed when membership becomes paid.

## Deliberately not done

- Moving to a host with server rendering: it would keep the colleague's design but leave GitHub Pages, add an
  account and an adapter, and buy no protection that RLS does not already give.
- The cheaper client (`auth-js` plus `postgrest-js` directly, 28 KB gzip): it would need two transitive packages
  declared as dependencies; proposed for later, not built.
- PKCE for the confirmation mail: the code verifier lives in the browser where the sign-up started, so a mail
  opened on a phone would fail; `token_hash` needs no verifier.
- `noindex` on the auth pages, password reset, custom SMTP, CAPTCHA, the entitlements table: each is a small
  separate step and none is needed for the demo.

## Execution route

- Board's recommendation: direct-verified, unanimous after the interrogation. The design is already specified in
  AUTH.md and this verdict, the files are named, and every risk reduces to a check that can be run.
- Owner's decision: confirmed direct-verified on 2026-09-25.
- Verification list:
  - `npm run fix`, `npm run check`, `npm run build` green; `dist/index.html` exists and `dist/server/` does not.
  - `npm run check:pages` green; the route diff against `reference/hugo-routes.txt` shows only the known
    differences plus the four `/auth/` routes.
  - The JavaScript chunk that contains the Supabase client is referenced by exactly the auth pages in `dist/`.
  - `npm run dev` on a spare port without any Node flag: the four auth pages answer 200.
  - `sitemap-0.xml` lists no `/auth/` address.
  - Headless browser: an anonymous visitor on `/auth/dashboard/` sees the invitation; a wrong password on
    `/auth/signin/` shows Supabase's message; a broken `token_hash` on `/auth/callback/` shows a message, not a
    crash; with a confirmed test account the dashboard shows the email and the demo row and sign-out brings the
    invitation back; the header button changes with the flag.
  - After the colleague's merge: `curl -I https://debi7.github.io/` answers 200, and one live pass of the flow.

## Amendment of the same evening

The owner extended the scope after the verdict was implemented: the site is for signed-in members, a guest sees the
home page with the carousel alone, and every other page sends a guest to the sign-in page. Built the same evening
without a second convocation, because it adds no dependency, no new page and no server-side claim: an inline block
in `Base.astro` reads the flag the board already approved and either marks the document or leaves for
`/auth/signin/?next=...`; `custom.css` hides what a guest must not see on the open pages. The board's finding that
every file of a static site is public is unchanged and opens AUTH.md section 10; the gate is presentation, and Row
Level Security remains the only lock. Not decided by the owner: `noindex` and the sitemap for the closed pages.

## Second amendment, after the colleague's review

The closed site of the first amendment was taken back the same day at the colleague's request: a guest reads
every page and the comments; only the paid course material is to be closed, through the entitlements mechanism
this verdict already names. AUTH.md section 11 has the change and the open choices.
