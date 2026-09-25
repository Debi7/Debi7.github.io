# Implementation log of the sign-in work

This file is the journal of the branch `supabase-auth-v1`: what was built, in which file, why, how it was verified
and what was left open, one entry per working session. It exists because the other documents answer other
questions. `AUTH.md` is the design and the contract with the Supabase dashboard, `README.md` is the state of the
site, `CLAUDE.md` is the rules a later session follows, and the consilium verdict is the record of the review.
None of them tells a reader what happened on a given day in the order it happened, and that is what a reviewer, the
colleague or the owner needs when they open the branch a week later.

## How this file is kept

- One entry per session, newest last, under a heading with the date. An entry is written before the session ends,
  not reconstructed afterwards.
- Every entry has the same six parts: the starting point, the decisions in the order they were taken, the changes
  file by file with the reason for each, the verification that was run with its result, what is left for someone
  else, and what was decided against. A part that has nothing in it says so in one line rather than disappearing.
- A change is listed here once, next to its reason; the reason is repeated in the file itself as a comment, as
  `CLAUDE.md` asks, and the two must agree. When they do not, the comment in the file is the one to trust and this
  file is the one to fix.
- The commit message and the pull request text are derived from the entry, never the other way round. The pull
  request text lives in `AUTH.md` section 9.
- Nothing here is committed by the assistant; the owner commits, the colleague merges. The entry says so when it
  is true, so that a reader knows the state of the branch without running git.

## 2026-09-25

### Starting point

`https://debi7.github.io/` answered 404. The merge `7f36498` of that morning had brought the colleague's
server-rendered sign-in of 2026-09-24 to `main`: `output: "server"`, the node adapter, `@supabase/ssr`, three
`POST` endpoints under `src/pages/api/`, four pages under `src/pages/auth/`, `src/pages/dashboard.astro`, a header
icon, and a tracked `.env.local` whose first line held a database password. GitHub Pages serves files and runs no
Node process, so the build wrote `dist/client/` and `dist/server/` and the artifact had no page at its root, while
the workflow reported success. On the dev server every auth page answered 500 besides, because `supabase-js` 2.109
throws "Node.js 20 detected without native WebSocket support" when a client is built in frontmatter on this
project's Node 20. `AUTH.md` section 1 has the measurements.

The owner's brief for the day: registration, sign-in and a first members-only demo that work locally and on
GitHub Pages, to show the client; nothing committed by the assistant under any circumstances; a branch prepared for
the colleague to merge.

### Decisions, in order

1. Stay on GitHub Pages; rebuild the sign-in in the browser on a static build (the consilium's unanimous proposal,
   approved by the owner; route direct-verified; `.specify/consilium/2026-09-25-supabase-auth-static.md`).
2. The auth pages live inside `Base.astro` with a minimal set of the theme's classes; their strings are Russian,
   the language of the site.
3. Registration stays open, with the dashboard switch to invitation-only documented for later.
4. The Disqus count script and Busuanzi stay on every page; the shared origin `debi7.github.io` and the third-party
   scripts are accepted risks (`AUTH.md` section 7).
5. The member's page keeps its name and moves under the prefix: `/auth/dashboard/`.
6. The password committed in `.env.local` is treated as being changed; the file leaves the index.
7. Evening: the password minimum is 8, set in the dashboard and mirrored by the form.
8. Evening: the site is for signed-in members. A guest sees the home page with the carousel alone, under a header
   of Home, the theme switch and the sign-in icon; every other page sends a guest to the sign-in page.
9. Evening: the menu gains the member's page as an item, English and short, `Account`, before About; a sign-in and
   a confirmed registration land there.
10. Evening: `DEPLOY.md` names the remote as it is today.
11. Later in the evening: a guest keeps the theme switch and the sign-in only, so the hamburger and the footer are
    hidden for a guest as well.
12. Later in the evening: the owner has no access to the colleague's Supabase project, so every dashboard step is
    hers first, either done by her or opened to the owner by an invitation.
13. Later in the evening: this log exists, at the owner's request, as the record of the implementation.
14. Last: `noindex` on every closed page and a sitemap with the home page alone; the browser harness moves into
    `scripts/check-auth-browser.mjs` with `npm run check:auth`.

### Changes, file by file

Build and configuration:

- `astro.config.mjs`: the adapter import and the `output`/`adapter` lines are commented out with the reason, so
  the output is Astro's default, static; the sitemap filter also drops every address under `/auth/`.
- `package.json`, `package-lock.json`: `@astrojs/node` and `@supabase/ssr` uninstalled, the `overrides` block
  removed, two notes added to the `"//"` array. No dependency added all day.
- `src/config.ts`: `site.supabase` (the project URL and the publishable key, public by design, one home instead
  of three copies in env files and repository variables), `site.auth` (the four addresses with their trailing
  slashes, the flag key, the demo table), `dashboardPath` spelled once for `site.auth.dashboard` and the menu, and
  the menu item `Account` before About, members-only through `Menu.astro`.
- `src/env.d.ts`: the two `PUBLIC_*` declarations removed with a note; nothing reads `import.meta.env` for the
  sign-in any more.

Scripts:

- `src/scripts/auth.ts` (new): `getSupabase()`, the lazy singleton of the browser client with
  `flowType: "implicit"` written out, mirroring every `onAuthStateChange` event into the flag; `nextPath()`, the
  one home of the rule "a `next` parameter is followed only as a path on this site". Never imported from
  frontmatter, because of the Node 20 throw above.
- `src/scripts/auth-flag.ts` (new): write, clear and read the flag `kb-auth-expires`, the session's `expires_at`
  in localStorage. Fail-closed: missing or expired reads as signed out. The header and the guest gate read only
  this, never the client, which weighs 55 KB gzip against 70 KB of JavaScript on the whole site.

Pages:

- `src/pages/auth/signup.astro`, `signin.astro`, `callback.astro` rewritten as static pages; `signup.astro`
  requires 8 characters (`minlength` and the placeholder); `signin.astro` follows `next`, writes the flag itself
  before it navigates and sends a visitor who already has a session on at once; `callback.astro` exchanges a
  `token_hash` through `verifyOtp()` behind a button, accepts the default confirmation link too, and uses
  `nextPath()` in place of its own `safeNext()`.
- `src/pages/auth/dashboard.astro` (new, replaces `src/pages/dashboard.astro`): three states toggled with
  `hidden`, branches on the session, fetches one row of `members_demo` behind Row Level Security, signs out with
  the global scope.
- `src/pages/index.astro`: `openToGuests`; everything under the carousel is one `members-only` block.
- `src/pages/404.astro`: `openToGuests`, with the reason.
- The four auth pages pass `openToGuests`, each with a one-line reason.

Layout, components, styles:

- `src/layouts/Base.astro`: the prop `openToGuests` (false by default) and the guest gate, an inline block first
  in the head (`is:inline` written out, `define:vars` for the three values) that reads the flag and either adds
  `kb-member` to the document or replaces a closed page with `/auth/signin/?next=<path and query>`; `members-only`
  on the footer.
- `src/components/AuthButton.astro`: a plain link to the sign-in page, switched to the dashboard by the flag; the
  invalid `button` around the link, the unused props and the wrong SVG namespace are gone; shown on the home page
  now (the colleague's check removed, her note kept).
- `src/components/Menu.astro`: `members-only` on every item but Home, in both variants.
- `src/components/Header.astro`: `members-only` on the search icon and on the hamburger button.
- `src/styles/custom.css`: `html:not(.kb-member) .members-only { display: none !important }`, with the reasons.

Removed (explained in the commit message, as `CLAUDE.md` allows for a pure deletion): `src/lib/supabase.ts`,
`src/pages/api/signup.ts`, `signin.ts`, `signout.ts`, `src/pages/dashboard.astro`. `.env.local` untracked with
`git rm --cached`; the file stays on disk and was already in `.gitignore`.

Reference and documentation:

- `reference/astro-routes.txt` regenerated; it had been stale since 2026-09-22.
- `AUTH.md` rewritten in ten sections: the state found, the decision, the tree, the dashboard contract (Site URL,
  the exact redirect allow-list, the mail template, the password rule, the SQL of the demo table, who owns the
  dashboard), the verification, what "access to certain links" means on this host, the accepted risks, how to
  test at four levels including a demo account with made-up credentials, the pull request text, and the guest
  gate.
- `README.md`: the sign-in subsection and the deployment paragraph. `CLAUDE.md`: the read-first item, the route
  parity sentence, the auth rules, the menu order note. `MIGRATION-PLAN.md` section 9: the closed site and the
  menu item as accepted departures from Hugo. `VIDEO-PAGE.md` section 6.1 step 9: entitlements and RLS in place of
  the serverless function. `DEPLOY.md`: the remote is `Debi7.github.io.git`.
- `.specify/consilium/2026-09-25-supabase-auth-static.md` (new): the verdict, with an amendment for the gate.
- This file.

Outside the repository: the consilium briefings under the assistant's skill directory were actualised, and the
browser harness `cdp-auth-test.mjs` (headless Edge through the DevTools protocol against `astro preview`) lives in
the session's scratch directory, not in the tree.

### Verification

Run after the last change of the day, all on the working tree of the branch:

- `npm run fix`, `npm run check`: 0 errors, 0 warnings, 2 hints, both pre-existing deprecation notes in files this
  work did not touch; Prettier clean.
- `npm run build`: 147 pages, `dist/index.html` present, no `dist/server/`; the Supabase chunk
  `dist/_astro/auth.<hash>.js` is 211 797 bytes, 55 KB gzip, and is imported by the hoisted bundles of exactly the
  four auth pages; the guest gate is in all 146 `index.html` files and in `404.html`; `openToGuests` is `true` in
  six documents and no more.
- `npm run check:pages`: 23 posts, 18 videos, 74 list pages, all checks passed. The route diff against
  `reference/astro-routes.txt` is empty; against `reference/hugo-routes.txt` it shows the known differences plus
  the four `/auth/` routes.
- `npm run dev` on port 4387 without any Node flag: `/`, `/posts/`, the four auth pages answer 200,
  `/nothing-here/` 404, each with the gate in its head and the right `openToGuests`.
- Twenty-three browser checks, all passed: the anonymous dashboard; a wrong password and the button coming back; a
  bogus and a missing `token_hash`; the header link in three states of the flag; a flag without a session cleared
  by the client; the home page with the auth link and no Supabase chunk; `/about/` for a member without the
  chunk; seven and eight characters in the sign-up form; a guest on `/about/` and on `/search/?q=x` landing on the
  sign-in page with `next`; a guest on `/` with the carousel, sixteen hidden members-only elements, Home alone in
  the menu and no search icon; a member on `/` with everything and the menu Home, Posts, Video, Categories, Tags,
  Account, About; a member staying on `/posts/`; a guest getting the 404 page; the sign-in page with `next` staying
  open; at a 400px viewport, the hamburger and the footer hidden for a guest with the sign-in icon shown, and both
  back for a member.
- Read from the Supabase project with the publishable key: email sign-in on, sign-ups allowed, confirmation
  required; the table `members_demo` does not exist yet (`PGRST205`).
- Branch state at the end: `supabase-auth-v1` at `7f36498`, `0 0` against `origin/main`, every change uncommitted,
  nothing pushed.

Not measured, because it needs the dashboard settings and an account: the confirmation mail, a sign-in with a
confirmed account returning to `next`, the demo row, sign-out. `AUTH.md` section 8 is the walk-through for that.

### Left for someone else

- The Supabase dashboard is the colleague's (commit `924ccfd`): Site URL, the exact redirect allow-list, the
  "Confirm signup" template, the password minimum of 8, the SQL of `members_demo`, the reset of the committed
  database password, and, for a showing, the demo account of `AUTH.md` section 8.2. The owner has no access to that
  project as of this evening, so the first move is hers: either the steps, or an invitation of the owner as
  Administrator (`AUTH.md` section 4).
- The owner: delete the password line from the local `.env.local`; commit on `supabase-auth-v1` with the message
  handed over in chat; `git fetch origin` and a left count of 0 against `origin/main` before the push; the push;
  the pull request with the text of `AUTH.md` section 9.
- After the merge: `curl -I https://debi7.github.io/` answers 200, then one live pass of `AUTH.md` section 8.

### Decided against, or not decided

- Moving hosts for server-side rendering, PKCE for the mail confirmation, exchanging the token on page load, the
  client in the header, a wildcard in the redirect allow-list, `Confirm email` off: all refused in the consilium,
  with the reasons in the verdict.
- A second convocation for the guest gate: not held; the gate adds no dependency, no page and no server-side
  claim, and the verdict carries a dated amendment instead.
- A caption beside the sign-in icon: not added. The owner is content with the icon's label and tooltip as they are
  ("Войти на сайт", "Личный кабинет" for a member). Nothing is left open from the day.

## 2026-09-25, after the colleague's review

### Starting point

The branch was committed as `8865366` with the site closed to guests (the entry above). The colleague reviewed it and
asked for the site back as it was: a guest must see everything, comments included, and only the paid course material
is to be closed. The owner asked for the change, with the Astro and Supabase documentation servers used for it.

### Decisions, in order

1. The site is open to everyone again; the redirect and `openToGuests` go.
2. The `Account` menu item stays members-only; the sign-in icon on the home page, `next` and `nextPath()` stay.
3. `noindex` and the home-only sitemap go with the gate.
4. Writing comments for members only and the paid content wait for a decision (`AUTH.md` section 11.3).
5. Password recovery is built here after all (the colleague did not want this kind of work, and on a static host with
   Supabase there is no one else to do it): `/auth/forgot/` and `/auth/reset/`.

### Changes, file by file

- `src/layouts/Base.astro`: the prop and the redirect removed; the inline block only adds `kb-member`; the footer
  lost `members-only`; the `noindex` line removed.
- `src/pages/index.astro`: the `members-only` wrapper removed. `404.astro` and the four auth pages: `openToGuests`
  removed from the layout tag.
- `src/components/Menu.astro`: `members-only` on the `Account` item alone. `Header.astro`: off the search icon and
  the hamburger.
- `astro.config.mjs`: the sitemap filter of before the gate. `src/styles/custom.css`: a note that the rule now hides
  the `Account` item only.
- `scripts/check-auth-browser.mjs`: the gate checks replaced by checks of the open site, plus five recovery checks.
- `src/pages/auth/forgot.astro`, `src/pages/auth/reset.astro` (new): password recovery (`AUTH.md` section 11.4).
  `src/config.ts`: `site.auth.forgot` and `site.auth.reset`. `signin.astro`: "Забыли пароль?". `dashboard.astro`:
  "Сменить пароль". `callback.astro`: a note that the recovery mail goes to its own page. `reference/astro-routes.txt`:
  the two new routes.
- `AUTH.md` section 11, `README.md`, `CLAUDE.md`, `MIGRATION-PLAN.md` section 9, the consilium verdict: the reopening
  recorded. Every comment about the gate stays in its file with a line under it.

### Verification

`npm run check` 0 errors, Prettier clean; `npm run build` static, no `dist/server/`; `npm run check:pages` green; the
route list unchanged; no page carries `noindex`; the sitemap has 117 addresses and none under `/auth/`; two
`members-only` elements on the home page, the two `Account` items; `npm run check:auth` 27/27 with the five recovery
checks; the route list gained `/auth/forgot/` and `/auth/reset/`, and the sitemap still lists nothing under `/auth/`.

### Left for someone else

- Only if guests can post without an account: the guest-commenting switch in the Disqus admin, on the colleague's
  Disqus account (`AUTH.md` section 11.5).
- TODO, open: access to the Supabase project (an Administrator invitation, a transfer of the project to the owner,
  or a project of the owner's own). The owner is settling it; ask him about it at the next session before any
  dashboard work.
- The paid content, built with the first paid lecture.
- Everything the entry above lists for the dashboard, the commit and the pull request still stands.

### Decided against, or not decided

- Decided against: the closed site, at the colleague's request.
- Decided the same day: comments stay on Disqus, untouched; writing needs a Disqus account (`AUTH.md` section 11.5).
  Comments of our own in Supabase were chosen and dropped within the hour.
- Not decided: which lecture is the first paid one.
