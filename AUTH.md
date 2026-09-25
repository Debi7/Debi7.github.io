# Sign-up and sign-in with Supabase

Written on 2026-09-25 and rewritten the same evening, after the owner approved the consilium verdict in
`.specify/consilium/2026-09-25-supabase-auth-static.md`. It records what was in the tree that morning, what was
measured, what the tree looks like now, the settings the flow depends on at Supabase, the verification results, and
the risks the owner accepted. Everything here was measured on this machine or read from the two documentation
servers (Astro 4.16, Supabase current); nothing is assumed from memory. The user-facing pages are Russian, the
language of the site; this file, like every file in the repository, is English. The day-by-day record of the
implementation, what changed when and why, is `AUTH-IMPLEMENTATION.md`; this file is the design and the contract.

## 1. What was in the tree on the morning of 2026-09-25

The colleague started the sign-in on 2026-09-24, on `main`, in three commits (`f088cdb` "Add Supabase", `fea57e8`
"Add api", `924ccfd` "Add supabase"), plus `35e8f80` "Add AuthButton" on 2026-09-25. Together they switched
`astro.config.mjs` to `output: "server"` with the `@astrojs/node` adapter, added `@supabase/supabase-js` 2.109.0
and `@supabase/ssr` 0.12.7 with an `overrides` block that forced `@supabase/ssr` to accept that `supabase-js`, and
added a server-side client (`src/lib/supabase.ts`), three `POST` endpoints under `src/pages/api/`, the pages
`signup`, `signin` and `callback` under `src/pages/auth/`, `src/pages/dashboard.astro`, and `AuthButton.astro` in the
header. They also committed `.env.local`, whose first line was a comment holding a password (section 7).

The shape followed the Astro 4 guide "Supabase & Astro" and the Supabase guide "Creating a Supabase client for
SSR": a cookie session read by the server on every request. Two facts made it unusable here, both measured that
morning:

- GitHub Pages serves files and runs no Node process. With the server output, `astro build` wrote `dist/client/`
  and `dist/server/` instead of `dist/index.html`, the Pages artifact had no page at its root, and
  `https://debi7.github.io/` answered 404 from the merge `7f36498` of 2026-09-25 00:28 while the workflow run
  reported success.
- `supabase-js` 2.55 and newer throws "Node.js 20 detected without native WebSocket support" while the client is
  constructed (Supabase changelog of 2025-08-12). This project is pinned to Node 20 for the colleague's machine, so
  every server-rendered auth page answered 500 on the dev server. Both ways out - the `ws` package as
  `realtime.transport`, or Node's `--experimental-websocket` flag, which was measured to work - became moot with
  the decision below: a client created in the browser needs neither.

A first pass that morning repaired the colleague's code so that it ran on the dev server with the Node flag: the
sign-up endpoint called `signInWithPassword()` instead of `signUp()`, the sign-up page read a field the endpoint did
not send and printed an error on every response, the sign-in form had lost its submit handler to `AuthButton.astro`
(commit `35e8f80`) where it bound to a form on another page, the header icon linked to `/login`, and no address
carried the trailing slash that `trailingSlash: "always"` requires on the dev server (404 without it, measured).
That pass is superseded by section 3; its details live in the branch history, not here.

## 2. The decision

The owner requires the site to stay on GitHub Pages, and the client has to see registration and sign-in both on the
dev server and on the live site. A consilium of five archetypes reviewed the alternative on 2026-09-25 and the owner
approved it the same day; the verdict, the remarks that survived the interrogation, what was marked weak, and the
route (direct-verified, unanimous) are in `.specify/consilium/2026-09-25-supabase-auth-static.md`.

The design in one paragraph: the build is static again; the browser talks to Supabase directly with the publishable
key, which is public by design; the session lives in the browser; and what a visitor must not receive without
signing in never sits in the pages, which are public files, but in a table behind Row Level Security that the page
fetches after sign-in. Hiding a link is presentation; the data rule is the protection. This is the mechanism
VIDEO-PAGE.md section 6.1 planned for the paid lectures, so the demo builds the road those will use.

## 3. What the tree looks like now

- `astro.config.mjs`: the `output` and `adapter` lines and the adapter import are commented out with the reason;
  output falls back to Astro's default, static. The sitemap filter also excludes every address under `/auth/`.
- `package.json`: `@astrojs/node` and `@supabase/ssr` removed with `npm uninstall`, the `overrides` block removed,
  two notes added to the `"//"` array. `@supabase/supabase-js` stays and is used in the browser only.
- `src/config.ts`: `site.supabase` holds the project URL and the publishable key, with a comment on why they are
  not secrets and must not move back into `.env`; `site.auth` holds the four addresses (all with the trailing
  slash), the localStorage key of the header's flag and the name of the demo table.
- `src/env.d.ts`: the two `PUBLIC_*` declarations are gone, with a note.
- `src/scripts/auth-flag.ts`: write, clear and read the flag `kb-auth-expires`, the only thing the header knows
  about a session. Fail-closed: missing or expired reads as signed out.
- `src/scripts/auth.ts`: `getSupabase()`, a lazy singleton of the browser client with `flowType: "implicit"`
  written out, which mirrors every `onAuthStateChange` event into the flag. It is the singleton and nothing more;
  every page keeps its own handler next to its markup. It must never be imported from frontmatter (Node 20 at
  build time, the exception above).
- `src/pages/auth/signup.astro`, `signin.astro`, `callback.astro`, `dashboard.astro`: static pages inside
  `Base.astro`, Russian strings, the site's classes and nothing more. Sign-up calls `signUp()` with
  `emailRedirectTo` set to this origin plus `/auth/callback/`; sign-in calls `signInWithPassword()` and sends a
  visitor who already has a session to the dashboard; the callback exchanges a `token_hash` through `verifyOtp()`
  behind a button (section 4 says why the button) and also accepts the default confirmation link, whose tokens the
  client reads from the URL fragment itself; the dashboard branches on the session, shows the email, fetches one
  row of the demo table and signs out (global scope, all devices, on purpose). `/dashboard/` moved to
  `/auth/dashboard/` at the owner's request, so one sitemap rule and one allow-list covers the four.
- `src/components/AuthButton.astro`: a plain link to the sign-in page, switched to the dashboard by the flag; it
  never imports the client. The invalid `<button>` around the `<a>`, the unused props and the wrong SVG namespace
  are gone; the icon stays hidden on the home page, the colleague's choice, reason not recorded.
- Removed: `src/pages/api/signup.ts`, `signin.ts`, `signout.ts`, `src/lib/supabase.ts`,
  `src/pages/dashboard.astro`. `.env.local` is no longer tracked (`git rm --cached`); the file stays on disk and
  `.gitignore` already listed it.
- `reference/astro-routes.txt` regenerated from the build. It had been stale since 2026-09-22: besides the four
  `/auth/` routes it gained the video pages and year pages that already existed in the tree.

- The guest gate, added the same evening (section 10): `Base.astro` takes `openToGuests`; an inline block at the top
  of its head reads the flag and either marks the document `kb-member` or replaces a closed page with
  `/auth/signin/?next=...`; `custom.css` hides `.members-only` until that class exists; the home page wraps everything
  under the carousel in it, `Menu.astro` every item but Home, `Header.astro` the search icon; `signin.astro` follows
  `next`; `nextPath()` in `src/scripts/auth.ts` is the one home of the "path on this site only" rule.

No new dependency. The Supabase client is `dist/_astro/auth.<hash>.js`, 211 797 bytes minified and 55 183 gzip,
and it is imported by the hoisted bundles of exactly the four auth pages; every other page loads the shared bundle
(3 827 bytes, `site.ts` and the config object) and Alpine, as before.

## 4. The Supabase project: settings the flow depends on

All of this is dashboard work, and the dashboard is the colleague's: the Supabase project was created from her
account (commit `924ccfd`, "Add supabase", 2026-09-24), so either she does the steps below or she first invites the
owner to her organization. The invitation goes out from the organization's team settings and is valid for 24 hours
(Supabase guide "Access Control"); the role has to be Administrator, because a Developer may change content (tables,
rows, the SQL editor) but no setting, and most of the items below are settings. Read from the project's public
settings endpoint (`/auth/v1/settings`) on 2026-09-25, morning and evening alike: email sign-in enabled, sign-ups
allowed, `mailer_autoconfirm` false, so every new account waits for a confirmation mail. The demo table did not exist
in the evening: the Data API answered `PGRST205`, "Could not find the table 'public.members_demo'".

The owner has no access to the project as of the evening of 2026-09-25, so the first move is the colleague's either
way: the settings below, or the invitation.

- **Authentication > URL Configuration.** Site URL `https://debi7.github.io`. Redirect URLs: exactly
  `https://debi7.github.io/auth/callback/` and `http://localhost:4321/auth/callback/` (add
  `http://127.0.0.1:4387/auth/callback/` only while the assistant measures the mail flow on its spare port). Not
  `/**`: the site shares its origin with the colleague's other Pages projects (section 7), and a wildcard would
  let a mail deliver a session to any of their paths.
- **Authentication > Emails > Templates > Confirm signup.** Replace the link with
  `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email`. `RedirectTo` is the `emailRedirectTo` the page passed,
  always this origin plus `/auth/callback/`, so a mail from a local sign-up lands on the dev server and a mail from
  the live site lands on the live site; the callback page shows a button, and only the click exchanges the hash.
  Why a button: mail scanners that follow every link (Safe Links and their kind) load the page, and a page that
  exchanged the token on load would spend it before the visitor arrived; the Supabase guide on email templates
  names this failure. The conservative alternative from the Supabase guide "Password-based Auth" is
  `{{ .SiteURL }}/auth/callback/?token_hash={{ .TokenHash }}&type=email&next={{ .RedirectTo }}`, which always lands
  on the live site; the page accepts `next` only as a path on this site, so a local origin in it is ignored.
  Until the template is changed the default link still works: it lands on the callback with the tokens in the
  fragment and the client signs the visitor in on load, minus the scanner protection.
- **Confirm email stays on** (Authentication > Sign In / Providers > Email). The default sender allows two mails an
  hour for the whole project and is documented as best-effort: one full rehearsal more than an hour before a demo,
  and one spare account confirmed in advance. A custom SMTP server (Authentication > Emails > SMTP Settings) is the
  condition for real members.
- **Registration stays open**, the owner's decision, with the switch in view: "Allow new users to sign up" off in
  the same panel makes the project invitation-only, and the sign-up page then only ever prints Supabase's refusal.
  No code changes for that.
- **Passwords: minimum 8**, the owner's decision on the evening of 2026-09-25, after the Supabase password guide
  ("anything less than 8 characters is not recommended"). The setting is "Minimum password length" under
  Authentication > Sign In / Providers > Email; leaked-password protection (HaveIBeenPwned, the same guide) is a
  switch under Authentication > Attack Protection and is recommended with it. That morning the project still
  accepted 6, the service default (measured: "Password should be at least 6 characters."). The form in
  `signup.astro` enforces 8 already, in `minlength` and in the placeholder, so until the dashboard is changed the
  form is stricter than the service, which costs nothing; from now on the two numbers move together, because a
  form that allows less than the service lets the visitor read the service's refusal instead of the browser's hint.
  The sign-in page has no minimum on purpose: an account created under an older rule must still get in. "Secure
  password change" can be on: a fresh recovery session is younger than a day and passes without re-authentication.
- **The demo table**, SQL editor, once. RLS enabled, the default grants revoked first, one read policy for signed-in
  users, nothing for `anon`, nothing for writes, one shared row and no personal data. The Supabase guide "Row Level
  Security" is the source of the shape, including the explicit `to authenticated` and the null check on
  `auth.uid()`:

  ```sql
  create table public.members_demo (
    id bigint generated always as identity primary key,
    message text not null,
    created_at timestamptz not null default now()
  );
  revoke all on table public.members_demo from anon, authenticated;
  grant select on table public.members_demo to authenticated;
  alter table public.members_demo enable row level security;
  create policy "Signed-in members can read the demo row"
    on public.members_demo for select
    to authenticated
    using ((select auth.uid()) is not null);
  insert into public.members_demo (message)
    values ('Добро пожаловать в клуб! Эта запись видна только вошедшим участникам.');
  ```

  "Registered" is not "entitled": this policy lets every confirmed account read the row, which is what the demo
  claims and nothing more. Paid lectures need a second table of entitlements joined in the policy
  (`exists (select 1 from entitlements e where e.user_id = (select auth.uid()) and e.slug = ...)`), written by the
  owner alone; VIDEO-PAGE.md section 6.1 carries the amended step 9.

## 5. Verification, measured on 2026-09-25 after the change

- `npm run check` (astro check and Prettier) and `npm run build` green; `dist/index.html` exists, `dist/server/`
  does not; `npm run check:pages` green (23 posts, 18 videos, 74 list pages walked).
- Route diff against `reference/hugo-routes.txt`: the known differences plus `/auth/callback/`,
  `/auth/dashboard/`, `/auth/signin/`, `/auth/signup/`; `/dashboard/` is gone.
- The Supabase chunk is referenced by exactly the four auth pages; `/about/` loads the shared 3.8 KB bundle and
  Alpine only. `sitemap-0.xml` lists no `/auth/` address.
- `npm run dev` on port 4387 with no Node flag: the four pages answer 200 with their Russian headings;
  `/auth/signin` without the slash and the old `/dashboard/` answer 404, as they should.
- Twelve scenarios in headless Edge through the DevTools protocol against `astro preview` of the build, all
  passed: an anonymous visitor on the dashboard sees the invitation and no flag is written; a wrong password on the
  sign-in page prints Supabase's "Invalid login credentials" and the button comes back; a bogus `token_hash` shows
  the confirm button and the click prints "Email link is invalid or has expired" wrapped in the page's own line,
  no crash; the callback without parameters prints the invalid-link line; the header link is `/auth/signin/`
  signed out, `/auth/dashboard/` with a valid flag, and `/auth/signin/` again with an expired one; a flag without a
  session on the dashboard shows the invitation and is cleared by the client's first event; the home page has no
  auth link and no Supabase code. The script is in the session's scratchpad (`cdp-auth-test.mjs`), not in the
  repository; it needs a running Edge and Node's experimental WebSocket for its own protocol connection.
- Evening, after the password minimum went to 8: two more checks in the same harness, both passed (14/14 with the
  twelve above): seven characters in the password field of `/auth/signup/` leave the form invalid with
  `validity.tooShort` set, eight make it valid. The characters are typed through the protocol's `Input.insertText`,
  because a value written by a script never trips `tooShort`: the HTML constraint applies only to a value last
  changed by the user, so a check that assigns `.value` would pass for the wrong reason.
- Later the same evening, with the guest gate and the menu item (section 10): seven more checks in the same
  harness, 21/21 in all. A guest on `/about/` is on `/auth/signin/?next=%2Fabout%2F` when the page settles, and on
  `/search/?q=x` the query travels inside `next`; a guest on `/` sees the carousel, every members-only element
  (sixteen on the home page: the wrapper under the carousel, six menu items in two variants, the search icon, the
  hamburger, the footer) has computed display none, the only visible menu item is Home and the search icon is
  hidden; with a valid flag the same page shows every block, the seven menu items in order with `Account` before
  About, and the search icon; a member on `/posts/` stays there; a guest on an unknown address gets the 404 page;
  the sign-in page with `next` stays open. The gate is in all 146 pages of the build and in `404.html`;
  `openToGuests` is true in exactly six documents, the home page, the four auth pages and `404.html`.
- Later still, after the owner asked that a guest keep the theme switch and the sign-in only: two more checks at a
  400px viewport through the protocol's device metrics override, 23/23 in all. A guest on `/` has the hamburger
  and the footer at computed display none and the sign-in icon shown; with a valid flag both are back. At 1280px
  the footer is checked the same way in the earlier guest and member checks.
- Not measured, because it needs the dashboard settings of section 4 and a real mailbox: the confirmation mail
  itself, a sign-in with a confirmed account, the demo row on the dashboard, and sign-out. These are the owner's
  local test (section 8) and, after the merge, the live pass.

## 6. What "access to certain links" means on this host

Every file of a static site is public, including every page under `/auth/`: a visitor who is not signed in can open
`/auth/dashboard/` and will see the page - as an invitation to sign in. What they do not get is the payload: the row
the page fetches, tomorrow the identifier of a paid lecture, is asked for with the visitor's own session and
answered only when the table's policy says so. A link hidden in a menu is a courtesy to the visitor, not a barrier.
For a lecture on YouTube there is a second limit, recorded in VIDEO-PAGE.md section 6: whoever receives the
identifier can pass it on, because YouTube plays it for anyone; a host with signed, expiring addresses is the answer
when that matters, and the mechanism here stays the same.

Extended the same evening, the owner's decision: the whole site is for signed-in members, and a guest is shown the
home page with the carousel alone. Section 10 has the gate and what it can and cannot do. The paragraph above is
unchanged, because the gate does not change it: the HTML is still public, only unseen.

## 7. Accepted risks and follow-ups

- **A password was committed.** `.env.local` was tracked (commit `924ccfd`) and its first line held a password. The
  owner said on 2026-09-25 it will be changed; git history is public, so the change is the only fix. The file is
  untracked now; delete that line from the local copy, and check the project's API keys and user list for
  anything unfamiliar. The reset itself is a dashboard action inside the colleague's project (Project Settings >
  Database, "Reset database password"), so it is hers, or the owner's with the Administrator role of section 4; the
  pull request text in section 9 asks her for it.
- **Shared origin.** `debi7.github.io` also serves ten other Pages projects of the colleague, and a browser's
  localStorage is per origin, so a script on any of them could read this site's session. Measured on 2026-09-25:
  none of them loads third-party code today, so no path exists without an attacker already controlling one of
  those repositories. Accepted by the owner for now; a custom domain for the club is the durable answer.
- **Third-party scripts.** Busuanzi and the Disqus count script run on every page next to the session, and Disqus
  `embed.js` on article pages after a click. The owner keeps both; accepted for a demo with test accounts. The
  condition for real members is one deliberately chosen analytics vendor and nothing else on the page.
- **Open registration with the default sender.** Two mails an hour and no CAPTCHA mean a hostile visitor can
  exhaust the quota and a real member then waits. Custom SMTP before real members; CAPTCHA or invitation-only are
  the levers if abuse appears.
- **Password reset, other mail types, `noindex` on the auth pages, the entitlements table, the cheaper client
  (`auth-js` plus `postgrest-js` directly, 28 KB gzip, two transitive packages to declare):** each a small separate
  step, none needed for the demo.
- **The closed pages were indexable** (resolved late on 2026-09-25: `noindex` and a home-only sitemap). The gate of
  section 10 runs in the browser, so a search engine that runs no
  scripts indexes every page as before, and the sitemap still lists them. Whether a members-only site should carry
  `noindex` on its closed pages and drop them from the sitemap is the owner's decision, asked on 2026-09-25 and not
  yet taken; it is a one-line change in `Base.astro` and one filter in `astro.config.mjs` when it comes.
- **`text-red-600`** for the error line is the first red in the tree; Hugo never printed an error, so there is no
  Tailwind 4 reference value to pin it to (README, "The palette is pinned").

## 8. How to test

Four levels, from "nothing set up" to the live site. The first two need no mailbox, which is what a showing in front
of the client can rely on.

### 8.1 Right now, with nothing done in the dashboard

`npm run dev`, then in a browser, signed out (a private window is the surest way):

1. `http://localhost:4321/`: the carousel, under a header of the site name, Home, the theme switch and the sign-in
   icon. Nothing below the carousel, no other menu items, no search icon. That is the guest's whole site since the
   evening of 2026-09-25 (section 10).
2. `http://localhost:4321/posts/`, or any other address: the browser is on
   `http://localhost:4321/auth/signin/?next=%2Fposts%2F` before the page is painted. Same for `/search/`.
3. `http://localhost:4321/auth/signin/` with any address and any password: Supabase answers "Invalid login
   credentials" under the form and the button comes back. That is the service talking, not the page.
4. `http://localhost:4321/auth/dashboard/` without a session: the invitation to sign in or register, nothing else.
5. `http://localhost:4321/auth/callback/` without parameters: the invalid-link line. With a made-up
   `?token_hash=x&type=email`: the confirm button, and the click prints the service's refusal.
6. `http://localhost:4321/nothing-here/`: the 404 page, open to a guest on purpose.
7. `http://localhost:4321/auth/signup/` with a real mailbox and a password of 8 or more characters: the page says a
   mail was sent, and it is, with the project's default template. Its link confirms the account at Supabase and
   then redirects to the project's Site URL, wherever the colleague left it (the service default is
   `http://localhost:3000`; an address that is not on the allow-list is sent to the Site URL, per the Redirect URLs
   guide), so the tab that opens may show nothing useful. The account is confirmed all the same: from then on
   `/auth/signin/` with those credentials lands on the dashboard with the email, the home page shows the tag cloud
   and the menu row under the carousel, the header has every item and the search icon, the icon reads "Личный
   кабинет", and "Выйти" ends the session and closes the site again. Under "Материалы для участников" the dashboard
   prints "Сервис недоступен. Попробуйте позже." with `PGRST205` in the console for as long as the table of section
   4 does not exist; that line is the expected sight until then, not a fault.

Two mails an hour is the default sender's limit for the whole project; a second registration inside the hour may
never receive its mail.

### 8.2 A demo account with made-up credentials, no mailbox

For the client, and for a rehearsal that must not depend on a mail arriving. In the dashboard (the colleague's, or
the owner's with the Administrator role, section 4): Authentication > Users > Add user > Create new user. The same
menu offers "Send invitation", which needs the mail; "Create new user" does not. Address `demo@example.com`
(`example.com` is reserved, nothing can be delivered there, and with the checkbox below nothing is sent), a password
of the owner's choice with at least 8 characters, and the checkbox "Auto Confirm User" on. Neither the address nor
the password goes into the repository or into this file. From then on `/auth/signin/` with those two values behaves
exactly as a confirmed member does: the dashboard with the email, the demo row once the table exists, sign-out, the
header icon. Delete the account in the same panel after the showing, or keep it as the spare account section 4 asks
for. The API equivalent, for the record, is the admin `createUser` call with `email_confirm: true`; it needs the
secret key and therefore never runs from this site.

### 8.3 The full pass, once section 4 is done

1. `npm run dev`, then `http://localhost:4321/auth/signup/`. Register with a real mailbox; the page says a mail was
   sent. Open the mail: with the recommended template the link opens `http://localhost:4321/auth/callback/` with a
   button, and the click lands on `/auth/dashboard/` with the email and the demo row.
2. Sign out there; the dashboard shows the invitation; `/auth/signin/` with the same credentials brings the row
   back. The header icon on any page but the home page points at the dashboard while signed in.
3. Anything Supabase refuses is printed under the form in its own words.

### 8.4 What to look at while testing

- Browser DevTools > Application > Local Storage, the site's origin: `sb-hhpjfgjajmrlnnsbqnor-auth-token` is the
  session the Supabase client keeps (access and refresh token; it is what a signed-in browser holds and what
  sign-out removes), and `kb-auth-expires` is the header's flag, a Unix time in seconds. Delete the first and reload
  the dashboard: the invitation comes back and the second is cleared. The flag never decides anything.
- DevTools > Network, filter `auth.`: the Supabase chunk (`auth.<hash>.js`, 55 KB gzip) is requested on the four
  `/auth/` pages and on no other page; `/about/` loads the shared bundle and Alpine only.
- `npm run build`, then `npm run preview`, and the same addresses on `http://localhost:4321/`: this serves the files
  of `dist/` the way GitHub Pages will, so it is the closest local rehearsal of the live site. The dev server
  differs from it in one thing, the trailing-slash rule described in CLAUDE.md.
- The gate itself, without an account: in DevTools > Application > Local Storage set `kb-auth-expires` to a Unix
  time in the future (`Math.floor(Date.now() / 1000) + 3600` in the console gives one), reload, and the closed pages
  open and the home page is complete. That is the whole strength of the gate, and the point of section 10: the
  frame is a courtesy, the data is behind the session. Delete the key and the site closes again.
- `astro check` says nothing about any of this. The pages branch at run time on what the service answers, so a
  wrong dashboard setting shows up only in a browser; that is why this section exists.

### 8.5 The live site, after the merge

After the colleague merges `supabase-auth-v1`: `curl -I https://debi7.github.io/` must answer 200 (the workflow's
green mark said nothing while the site was down), then 8.1 and 8.3 on `https://debi7.github.io/auth/signin/` and
its neighbours. The demo account of 8.2 works there unchanged, because the account lives at Supabase, not on the
host.

## 9. The pull request

The owner pushes the branch (`git push -u origin supabase-auth-v1`; nothing here is pushed by the assistant,
CLAUDE.md) and opens the pull request against `main` on `github.com/Debi7/Debi7.github.io`; the colleague reviews
and merges, and the merge is what publishes the site. Before the push: `git fetch origin`, then
`git rev-list --left-right --count origin/main...supabase-auth-v1` with 0 on the left, so that nothing of hers is
overwritten. The text below was prepared on 2026-09-25 for that pull request, in the repository's English; copy it
as it stands. It is kept here because it is the record of what the branch claimed when it was handed over.

Title:

    Return the build to static and move the sign-in into the browser

Description:

```markdown
## Why

`https://debi7.github.io/` has answered 404 since the merge of 2026-09-25 (`7f36498`). The sign-in of 2026-09-24
switched the project to `output: "server"` with the node adapter, so `astro build` writes `dist/client/` and
`dist/server/`, and the Pages artifact has no page at its root. GitHub Pages serves files and runs no Node process:
no endpoint, cookie session or server redirect can run there, and the workflow's green mark only says that the
upload succeeded. A second fault sat behind the first: `supabase-js` 2.55 and newer throws "Node.js 20 detected
without native WebSocket support" when a client is built in frontmatter, which is a build-time crash on this
project's Node 20.

## What

- The build is static again: the `output` and `adapter` lines in `astro.config.mjs` are commented out with the
  reason, `@astrojs/node` and `@supabase/ssr` are uninstalled, the `overrides` block is gone.
- The Supabase client is created in the browser only, in `src/scripts/auth.ts`, lazily, and imported by the
  scripts of the four `/auth/` pages and nothing else. The header reads a small flag those pages write
  (`src/scripts/auth-flag.ts`), so every other page keeps the JavaScript it had.
- `/auth/signup/`, `/auth/signin/`, `/auth/callback/` and `/auth/dashboard/` are static pages inside
  `Base.astro`, in Russian like the site. Sign-up, sign-in and sign-out call Supabase directly; the mail
  confirmation goes through a `token_hash` behind a button on the callback page, so a mail scanner cannot spend
  the link; the dashboard is the members-only demo: it fetches one row that Row Level Security answers to a
  signed-in user only. `/dashboard/` moved under `/auth/`.
- The site is for signed-in members (the owner's decision the same evening): a guest sees the home page with the
  carousel only and a header of Home, the theme switch and the sign-in icon; every other page sends a guest to the
  sign-in page, which returns them after the sign-in. The gate is an inline block in `Base.astro` that reads the
  same flag as the header, so no page loads anything new; it is presentation on a static host, and `AUTH.md`
  section 10 says in plain words what it is not. The menu gains `Account`, the member's page, before About, for
  members only.
- The project URL and the publishable key live in `src/config.ts`. They are public by design (the browser has
  them anyway) and Row Level Security is what protects the data. `.env.local` is no longer tracked.
- Removed: the three endpoints under `src/pages/api/`, `src/lib/supabase.ts`, `src/pages/dashboard.astro`.
- The sitemap skips `/auth/`; `reference/astro-routes.txt` is regenerated (it had been stale since 2026-09-22).
- Docs: `AUTH.md` (the design, the dashboard settings the flow depends on, the SQL of the demo table, the
  measurements, the accepted risks, how to test), `README.md`, `CLAUDE.md`, `VIDEO-PAGE.md` section 6.1, and the
  review record in `.specify/consilium/2026-09-25-supabase-auth-static.md`.

## What needs doing in the Supabase dashboard

The project is in your account and I have no access to it, so these are yours, or mine once you invite me as
Administrator. `AUTH.md` section 4 has each one with its reason: the Site URL and an exact redirect allow-list,
the "Confirm signup" mail template, the minimum password length (8, which the form already enforces), the SQL of
the table `members_demo`,
and a reset of the database password that was committed in `.env.local` on 2026-09-24, because the repository is
public. Until the settings are done the pages work, but the link in the confirmation mail lands on the project's
Site URL and the dashboard prints "service unavailable" in place of the row. Section 8.2 describes a demo account
that needs no mailbox.

## Verified

`npm run check`, `npm run build` and `npm run check:pages` green; `dist/index.html` exists and `dist/server/` does
not; the route diff shows only the known differences plus the four `/auth/` routes; the Supabase chunk is
referenced by exactly the four auth pages; `npm run dev` without any Node flag answers 200 on all four; twenty-three
checks in headless Edge against `astro preview` passed (anonymous dashboard, wrong password, bogus and missing
token, the header flag in three states, the home page, the password minimum, the guest gate on open and closed
pages, the 404 page, the menu, the hamburger and the footer of a guest and of a member). Not measured, because it
needs the dashboard settings and a mailbox: the confirmation mail, a sign-in with a confirmed account, the demo row
and
sign-out. That is the local test in `AUTH.md` section 8 and the live pass after this merge.

After the merge, `curl -I https://debi7.github.io/` must answer 200; the workflow's mark is not the check.
```

## 10. The guest gate, added the evening of 2026-09-25

The owner's decision after the rest of this document was written: the site is for signed-in members. A guest sees
the home page with the carousel and nothing else, under a header of the site name, Home, the theme switch and the
sign-in icon; every other page is closed and sends the guest to the sign-in page. Sections 1 to 9 stand as written;
this section says what was added on top and what it does not do.

### 10.1 What a static host allows

GitHub Pages serves files. Nothing on it can refuse a request, so "closed" can only mean "not shown": the browser
decides, before it paints, whether the visitor is a member, and shows the page or leaves it. The HTML of every page
is still a `curl` away, a visitor with JavaScript off sees every page, a search engine that runs no scripts indexes
every page, and a flag written by hand into the browser's storage opens everything, which is nothing more than what
`curl` shows. None of that is a fault of the implementation; it is the host. What a guest can never get is the data
the pages fetch with a session, today the demo row and tomorrow the paid lectures, because Row Level Security
answers those at Supabase. The gate is a door, the policies are the lock, and the client should hear it in those
words.

### 10.2 How it works

- `Base.astro` takes `openToGuests`, false by default, so a page that says nothing is closed. The home page, the
  four `/auth/` pages and the 404 page set it.
- The first thing in every page's head is an inline block (`define:vars`, which implies `is:inline` in Astro 4,
  "Template directives reference") that reads the flag `kb-auth-expires`: the same five lines as `readAuthFlag()`
  in `src/scripts/auth-flag.ts`, repeated because an inline block cannot import, so the two are changed together. A
  valid flag adds the class `kb-member` to the document. No flag on a closed page: `location.replace()` to
  `/auth/signin/?next=<path and query>`. No flag on an open page: nothing happens, and the class stays absent.
- `custom.css`: `html:not(.kb-member) .members-only { display: none !important }`. Marked members-only: everything
  under the carousel on the home page (one wrapper), every menu item but Home in both variants of `Menu.astro`, the
  search icon and the hamburger button in `Header.astro`, and the footer in `Base.astro` (the last two later the
  same evening, when the owner said a guest keeps the theme switch and the sign-in only). The sign-in icon shows on
  the home page now; the colleague's check that hid it there is gone, and her note in `AuthButton.astro` stays.
- `signin.astro` reads `next`, follows it after a sign-in and, for a visitor who already has a session, at once. The
  rule "a path on this site, never an origin" is `nextPath()` in `src/scripts/auth.ts`, which the callback page uses
  too (it had the same function of its own since the morning). The sign-in page also writes the flag itself before
  it navigates, so that the gate on the next page cannot run ahead of the client's own event.
- The menu has a seventh item, `Account`, the member's page, before About, added at the owner's word the same
  evening (`src/config.ts`, where the address is spelled once for the menu and for `site.auth.dashboard`). English
  and short, as the owner asked; the page it opens keeps its Russian title. It carries members-only like every
  item but Home, so a guest never sees it, and it is where a visitor lands after a sign-in or a confirmed
  registration, because `next` defaults to the dashboard. The header icon leads there too for a member; the two
  are one address, and the icon is the way in for a guest.
- Why inline and first in the head, not a bundled module: a bundled script runs after the document is parsed, and a
  guest would see the closed page for a frame before it went away. The same reasoning put the theme bootstrap in
  `Head.astro` where it is.
- Why the flag and not the client: the gate is on every page, and the client is 55 KB gzip against 70 KB of
  JavaScript on the whole site (section 2). The flag is fail-closed and the client corrects it on every auth page.
  A member whose flag expired while the session did not is sent to the sign-in page, where the client refreshes the
  session, the flag is rewritten and `next` takes them back: a form seen for a moment at most.

### 10.3 What it changes for a visitor

A guest: the home page shows the carousel; the header shows the site name, Home (from 640px up, where the bar
exists), the theme switch and the sign-in icon, with no hamburger, no search and no footer; every other address
opens the sign-in page. A member: the site is what it was, plus `Account` in the menu before About,
and the header icon leads to the dashboard as well. Signing out on the dashboard closes the site again. The RSS
feeds, the sitemap and the search index are files and stay public; whether the closed pages should also carry
`noindex` and leave the sitemap is the owner's decision and was not taken on 2026-09-25 (section 7).

### 10.4 Verified

Measured on the build of the evening of 2026-09-25, after `npm run check` and `npm run build` came back green and
`npm run check:pages` and the route diff unchanged:

- The inline gate is in all 146 pages of `dist/` and in `404.html`; `openToGuests` is `true` in the home page, the
  four auth pages and `404.html`, and nowhere else.
- Nine browser checks in the harness of section 5 (23/23 with the earlier ones), listed there.
- `npm run dev` on a spare port: `/`, `/posts/` and `/auth/signin/` answer 200 and `/nothing-here/` 404, each with
  the gate in its head and the right value of `openToGuests`; the server does not redirect, the browser does, which
  is the point of section 10.1.
- Not measured, for want of an account: a sign-in that returns to `next`, and the flag written by the sign-in page
  before it navigates. Both are on the path of section 8.2's demo account; the code is the one the callback page
  already exercises for `next`.

### 10.5 Not done, on purpose

- (`noindex` and the sitemap stood here until late the same evening: the owner decided, and every closed page
  now carries `noindex` and the sitemap lists the home page alone. The RSS feeds stay as they are.)
- (The hamburger and the footer stood on this list until later the same evening, when the owner said a guest keeps
  the theme switch and the sign-in only; both carry members-only now, see 10.2.)
- No word next to the sign-in icon (the owner confirmed late on 2026-09-25 that the label and the tooltip are enough);
  the icon carries its label for assistive technology, and a caption beside it
  is a design change for the owner to call.

## 11. Reopened after the colleague's review, 2026-09-25

The colleague reviewed the closed site the same day and asked for it back as it was: closing everything leaves a
visitor nothing to look at, and they leave. Only the part of the material that belongs to the paid course is to be
closed. The owner agreed and asked for the change. Section 10 is kept as the record of what was built and removed.

### 11.1 The model the colleague set out

- **A guest** sees everything the site showed before the gate: the home page, the posts, the videos, the tags, the
  categories, the search, and the comments under posts and videos, which they can read. A guest cannot write a
  comment and cannot see a paid video.
- **A signed-in member** can also write comments and ask questions. Paid content stays closed.
- **A signed-in member who bought the course** sees the paid content as well.

### 11.2 What changed in the tree

- The redirect in the inline block at the top of `Base.astro` is gone, and so is the `openToGuests` prop with it;
  the block now only marks the document `kb-member` while the flag is valid.
- `members-only` stays on one element: the `Account` item of the menu, in both variants of `Menu.astro`. The home
  page wrapper, the other menu items, the search icon, the hamburger and the footer are for everyone again.
- `noindex` is gone, and the sitemap filter is back to what it was before the gate (every page except the
  `/page/<n>/` aliases and `/auth/`).
- Kept from the gate work, because they are useful on their own: the `Account` item, the sign-in icon on the home
  page, the `next` parameter on the sign-in page and `nextPath()`.
- Every existing comment about the gate stays in its file, with a line under it saying it was reopened.

Verified: `npm run check` 0 errors; `npm run build` static; `npm run check:pages` green; the route list unchanged;
no page carries `noindex`; the sitemap lists 117 addresses and none under `/auth/`; `npm run check:auth` 22/22,
including a guest staying on `/about/`, `/search/?q=x` and `/posts/`, a guest's home page with every menu item but
`Account`, the search icon and the footer, a member's menu with `Account` before About, and the hamburger and the
footer for a guest at 400px.

### 11.3 Not built yet: writing comments and the paid content

Both need a decision and both need the colleague's hands, because the Supabase project and the Disqus account are
hers.

Comments. The comments are Disqus, a third-party frame: anyone who opens it can read, and who may write is decided
by Disqus, not by this site. There are three ways to get "read for all, write after sign-in":

1. Disqus settings, no code: in the Disqus admin, turn off guest commenting. Reading stays open to everyone; writing
   then needs a Disqus (or Google, Facebook, X) login inside the frame, not the club's account. Cheapest, but the
   "sign-in" is Disqus's, not ours.
2. Disqus SSO: Disqus accepts the site's own users, so a signed-in member writes as themselves. It is a paid Disqus
   feature and needs a signature computed with a secret on a server, which GitHub Pages does not have (a small
   function on another host would be needed).
3. Our own comments in Supabase in place of Disqus. A `comments` table with RLS: `select` for `anon` and
   `authenticated` (everyone reads), `insert` for `authenticated` with `user_id = auth.uid()` (only members write,
   and only as themselves). This is the shape the Supabase guide "Row Level Security" gives for a public-read table
   (its `announcements` example grants `select` to `anon, authenticated` and nothing else), plus an insert policy.
   It is real work: a form, the list, moderation, and the existing Disqus threads stay behind in Disqus.

Paid content. The mechanism is the one section 6 and VIDEO-PAGE.md section 6.1 describe: the id of a paid video lives
in a Supabase table, not in the page, and an RLS policy answers the row only when an `entitlements` table has a row
for that member and that course; the owner (or a payment hook later) writes `entitlements`. The page shows the
course's title and description to everyone and fetches the player id with the member's session. No paid video
exists in the content yet, so there is nothing to close today; the first paid lecture is where this is built.

### 11.4 Password recovery, added the same day

The colleague's other remark: with Supabase, the sign-in screens, password recovery and the email confirmation are
the site's own work, which she did not want to take on. There is no way around it on this host, because Supabase
ships the service and not the pages. The owner asked for the missing piece to be built here. Sign-up, sign-in and the
email confirmation already existed, so the only piece missing was password recovery:

- `/auth/forgot/`: the member enters the address and `resetPasswordForEmail()` sends the mail, with `redirectTo` set
  to this origin plus `/auth/reset/`. The page gives the same answer whether or not the address has an account, so a
  stranger cannot use it to find out which addresses are registered. "Забыли пароль?" on the sign-in page leads here.
- `/auth/reset/`: the mail lands here. A `token_hash` of type `recovery` is exchanged by `verifyOtp()` only on the
  visitor's click, for the same scanner reason as the callback page. The default link, with tokens in the fragment,
  is caught through the `PASSWORD_RECOVERY` event. A member who is already signed in gets the form at once, so
  "Сменить пароль" on the dashboard uses the same page. The form asks twice, requires 8 characters and calls
  `updateUser({ password })`, then goes to the dashboard.
- Source: the Supabase guide "Password-based Auth", section "Resetting a password", and the JavaScript reference for
  `resetPasswordForEmail`, `verifyOtp` and `updateUser`, read through the Supabase documentation server on
  2026-09-25.

In the dashboard (the colleague's):

- Redirect URLs, in addition to section 4: `https://debi7.github.io/auth/reset/` and
  `http://localhost:4321/auth/reset/`.
- Authentication > Emails > Templates > Reset Password: the link
  `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery`. Until then the default link works through the
  fragment, with no protection against mail scanners.
- The default sender's limit of two mails an hour covers reset mails too.

Verified: `npm run check:auth` checks that the sign-in page links to `/auth/forgot/` and that the forgot page has its
form. It also checks that `/auth/reset/` without a link shows the invalid-link line and no form, that a bogus
recovery hash prints the service's refusal after the click and no form, and that a hash of another type is refused.
The forgot form is not submitted in the harness, to spare the mail limit. A real reset needs an account and a
mailbox: section 8.

### 11.5 Comments: Disqus stays, decided the same day

The owner first chose option 3 of section 11.3, comments of our own in Supabase, then decided against it the same
day: Disqus stays exactly as it is and is not to be touched for now. Reading stays open to everyone. To write, a
visitor signs in to Disqus inside the comment frame (or registers there), which is Disqus's own account, not the
club's. Nothing in the tree changed for this. If guests can still post without any account, that is a switch in the
Disqus admin (guest commenting) on the colleague's Disqus account, not code; the exact name of the setting was not
checked, because Disqus is not in either documentation server.
