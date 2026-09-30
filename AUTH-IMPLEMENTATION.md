# Implementation log of the sign-in work

This file is the journal of the branch `clerk-auth`: what was built for sign-in, members and paid content, in which
file, why, how it was verified and what was left open, one entry per working session. It exists because the other
documents answer other questions: `CLERK.md` is the plan, `CLERK-DASHBOARD.md` the Clerk Dashboard and the
administrator's runbook, `PAID-VIDEO.md` the paid videos, `README.md` the state of the site, `CLAUDE.md` the rules
a later session follows, and the consilium verdicts in `.specify/consilium/` the record of each review. None of them
tells a reader what happened on a given day in the order it happened.

Rewritten on 2026-09-28 at the owner's order that everything about the previous sign-in provider leaves this branch:
the entries of 2026-09-25 before the move to Clerk described that provider's implementation and are gone from this
file; they remain in the git history of the branch. The first entry below is the decision to move to Clerk.

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
  request text is planned as section 5 of `CLERK.md`.
- Nothing here is committed by the assistant; the owner commits, the colleague merges. The entry says so when it
  is true, so that a reader knows the state of the branch without running git.

## 2026-09-25, late - branch `clerk-auth`: the decision to move to Clerk

### Starting point

The owner created `clerk-auth` from `main` at `09fca46` (PR #3, which carried only the first commit of the
previous auth work, the closed site). The colleague's second remark of the day was that she did not want to write the auth screens, the
password recovery and the email confirmation by hand. The owner asked for the same mechanism - sign-in, sign-up,
password recovery, the comments as they are, the members-only menu item - built on Clerk instead of the previous provider, and for
a plan a simpler model can implement.

### Decisions, in order

- A consilium reviewed "ClerkJS in the browser on the static build"; every first-round block was downgraded after
  interrogation (`.specify/consilium/2026-09-25-clerk-static.md`).
- The owner approved it: route direct-verified; `@clerk/clerk-js` 6.34.1 and `@clerk/localizations` 4.20.0 from npm,
  exact-pinned; paid videos deferred with one `publicMetadata.member` demo line on the account page.
- The owner allowed the merge of the previous auth branch into `clerk-auth`, and said that the previous provider
  must not be used on this branch under any circumstances afterwards, and that its name has to disappear from the
  code, the comments and the files about it: the Clerk work removes it completely (`CLERK.md` section 0).
- The owner added that Clerk must work locally as well as on GitHub Pages: one development instance and one
  `pk_test_` key serve `localhost` and `debi7.github.io` alike.

### Changes, file by file

- Merge of the previous auth branch (`6b374b9`, the reopened site with password recovery) into `clerk-auth`: `92b1493`,
  no conflicts.
- `.specify/consilium/2026-09-25-clerk-static.md`: the verdict.
- `CLERK.md`: new, the implementation plan - the owner's Dashboard steps, the code steps, the pitfalls and the
  verification list.
- `CLAUDE.md`: pointer to `CLERK.md` in "Read first" item 4.
- No code changed yet.

### Verification

Nothing to run: no code changed. The Clerk facts in the plan were read from Clerk's documentation and `npm view` on
2026-09-25 (versions, `engines`, the npm setup of the UI bundle, the `load()` options, `routing`, localization).

### Left for someone else

- The owner: step 0 of `CLERK.md` in the Clerk Dashboard, and the publishable key.
- The implementing session: steps 1-7 of `CLERK.md` and its verification list.
- The dashboard-access question about the previous provider, recorded in an earlier entry (removed on 2026-09-28,
  see the header), no longer matters for this branch; it still matters for `main` until the Clerk work is merged.

### Decided against, or not decided

- Decided against: `@clerk/astro` (server output only), the Account Portal as the main flow (English only, off the
  site), CDN script tags instead of npm packages.
- Not decided: the paid-video model on Clerk (VIDEO-PAGE.md 6.1 to be re-decided), the production domain.

## 2026-09-28 - branch `clerk-auth`: paid videos, and two fixes from the colleague's first sign-in

### Starting point

Clerk sign-in has worked since 2026-09-26 (`CLERK-REVIEW.md`). The colleague's commits of 2026-09-27 were merged
fast-forward (`f80f6f9`). The owner asked how paid, members-only videos should work when payment happens outside the
site and an administrator grants access by hand in the Clerk Dashboard, and whether the colleague's idea - the Clerk
React package's signed-in wrapper around the iframe, gated on `publicMetadata.hasCourse` - would do. The colleague
also reported that sign-in and the password change work, that the account card is far too tall, and that the site's
name in the forms should not be in quotes.

### Decisions, in order

- A consilium on the paid mechanism (`.specify/consilium/2026-09-28-paid-video-access.md`): a Cloudflare Worker is
  the lock; the colleague's idea is rejected by all five (the id would be in the build); one membership, no packs yet.
- The owner said to implement at once unless there were questions, and asked for a paid example to look at and a
  detailed how-to: the draft entry `paid-demo` and `PAID-VIDEO.md`.

### Changes, file by file

- `src/content/config.ts`: the `access` field; a paid entry refuses `videoId`, `videoUrl` and `thumbnail`; a public
  one needs `videoId`.
- `src/lib/video.ts`: `getVideos()` refuses a YouTube address in a paid entry's text.
- `src/layouts/VideoLayout.astro`, `src/components/PaidVideo.astro`, `src/scripts/paid-video.ts`: the stub, its
  states and the request to the service.
- `src/config.ts`: `site.videoAccess`; a note by the Clerk key that the Worker uses it too.
- `src/scripts/auth.ts`: `nextPath()` resolves the address and keeps same-origin results only (an open redirect
  found by the consilium); a note on the new dynamic caller. `src/scripts/auth-flag.ts`: the same note.
- `workers/video-access/`: the Worker and its README. `scripts/video-access-dev.mjs`, `scripts/check-video-access.mjs`,
  two npm scripts, a `package.json` note, and `.gitignore` for the local id map.
- `src/content/video/paid-demo.md`: the draft example.
- `src/scripts/clerk-ru.ts`: the application name without quotes in 15 strings.
- `src/pages/auth/account.astro`: the profile card's height is `auto` instead of Clerk's 44rem.
- `src/pages/auth/signin.astro`, reported by the owner after the first run: a sign-in from a paid video landed on the
  video without the header flag (Clerk's setActive() navigates before it sets the session), so the video showed the
  guest box. The redirect now comes back through the sign-in page, which writes the flag and replaces the address
  with `next`. `src/scripts/auth.ts`: a correction under the router-hook note. `check:auth` 19/19 afterwards.
- Documents: `PAID-VIDEO.md` (new), `VIDEO-PAGE.md` 6.1, `CLERK-DASHBOARD.md` 5, 7.2 and 7.3, `README.md`.
- Later the same day, at the owner's requests:
  - `src/scripts/account-devices.ts` (new) and `src/pages/auth/account.astro`: the account card's signed-in devices
    moved to a page of their own, "Устройства", five to a page with a pager that looks like the site's lists; Clerk's
    own unpaged list under Безопасность is hidden (`profileSection__activeDevices`). Clerk's documented
    `customPages`, `user.getSessions()` and `session.revoke()` only.
  - `src/layouts/VideoLayout.astro` and `workers/video-access/worker.mjs` (VERSION 2026-09-28.2): both players on
    `youtube-nocookie.com` with `rel=0`. YouTube allows no more: the title, the channel, the logo and "More videos"
    always show, and hiding a player link is against its Developer Policies (III.I.4, III.I.6). A paid host without
    YouTube's links was declined (Bunny Stream costs money; Cloudflare R2 set aside for now).
  - The previous sign-in provider removed from every document of the branch: its consilium verdict deleted; `AUTH.md`
    cut down to sections 10 and 11 (code comments cite them); this log cut to the branch's own entries; `CLAUDE.md`,
    `README.md`, `MIGRATION-PLAN.md`, `VIDEO-PAGE.md`, `CLERK.md`, `CLERK-REVIEW.md` updated; two code comments that
    named its access rules reworded (`src/config.ts`, `Base.astro`).
  - `PAID-VIDEO.md`: the Clerk Dashboard steps click by click, and "More than one paid video".
  - Comments on a paid video: `Disqus.astro` takes `locked`; the button starts hidden and shows when
    `src/scripts/paid-video.ts` dispatches `site.videoAccess.grantedEvent` after the player is in place. The owner's
    option A of two (the other: comments of the site's own behind the Worker).
  - `Disqus.astro`: the noscript text is in a paragraph; the compiler had emitted the block empty with the text after
    it, so every post and video page showed "Please enable JavaScript...". `ArticleLayout.astro`: "Last updated on"
    and the date are one expression, so the flex row keeps the space.
  - `src/scripts/account-devices.ts`: the pager is hidden by the class `hidden`, not the attribute, which `flex` beat
    (a single page showed "Назад 1 Далее").
  - Verified in the browser: guest on a paid video sees no comments and no noscript line; public video and post keep
    the button; a member gets the player and then the button, which opens the thread; a 403 keeps it hidden; the
    devices pager is hidden with two devices; `check:auth` as under Verification.
  - Verified: the devices page with a real second session (revoked from the first, then signed out) and with twelve
    sessions served by an intercepted answer (pages of 5, 5 and 2; Назад, Далее and the numbers); `check:auth` and
    `check:video-access` as listed under Verification.
  - `npm run dev:all` (`scripts/dev-all.mjs`, plain Node): the access service and the dev server in one terminal,
    at the owner's request. At the owner's second request the same hour, stopping is guaranteed: Ctrl+C gives the two
    five seconds and then kills what is left with its whole process tree (`taskkill /T /F` on Windows, the process
    group elsewhere); a second Ctrl+C kills at once; when one child ends by itself the other is stopped. The first
    version swallowed Ctrl+C and waited for the children, so a hung child would have hung the terminal. Verified on a
    test copy with the children swapped (the stop code unchanged): the service crashing under a running Astro, a child
    ignoring every signal, one Ctrl+C with both children hanging (killed at five seconds, esbuild included) and a
    second Ctrl+C (killed at once); no descendant survived any of them. A real console Ctrl+C could not be sent from
    this harness, so the children's own reaction to it is left to the owner's terminal.
  - The "Показать комментарии" button has the frame of the previous/next cards under an article,
    `rounded-lg border border-gray-200`; measured in both themes against `PostNav.astro`: 1 px, 8 px radius, the same
    colour.
  - `CLOUDFLARE.md`, at the owner's request: why the access service would run on Cloudflare Workers, what to register
    and how (account, two-factor sign-in, members and roles, the `workers.dev` name, the Worker, its three settings),
    the costs, the alternatives compared on the club's criteria with their prices, the downsides, and the proposed
    automatic deployment. Every price and term was read on the vendors' pages on 2026-09-28; the pages are listed in
    its section 12. Measured the same day: the Clerk instance's Frontend API host answers from Cloudflare
    (`Server: cloudflare`, Cloudflare addresses), GitHub Pages from Fastly, the player from Google.
  - Found while writing it: YouTube's Developer Policies (last updated 2026-09-14) say "API Clients must not charge
    users to watch content in an embedded YouTube player"; checked on the live page. Added as the first condition
    in `PAID-VIDEO.md` section 8; `CLOUDFLARE.md` 2.3 quotes it and lists the ways out.
  - `PAID-VIDEO.md` section 4 said to edit `VIDEOS` by adding a line; a Cloudflare secret is never shown again after
    saving, so the field opens empty. Corrected: a master copy of the list in the club's password manager, pasted
    whole each time.
  - A second paid example at the owner's request, `src/content/video/paid-demo-2.md`, published (not a draft: the
    owner asked for it in the Video list like every lecture; the first example stays a draft). Its id
    is only in the ignored `videos.local.json`, where a public Blender Foundation film (`aqz-KE-bpKQ`, embedding
    checked through YouTube's oEmbed) stands in until the owner uploads the real lecture as Unlisted. Browser check on
    the dev server: the list shows it; a guest gets the sign-in box, no id anywhere in the page and no comments; the
    demo account gets the player with that id on youtube-nocookie.com and then the comments button; signed out at
    the end. The build has 147 pages, one more: the lecture is in the list, its page, the video feed, the search index
    and the sitemap, with the stub and no id - `aqz-KE-bpKQ` appears nowhere in `dist/`. `reference/astro-routes.txt`
    gained `/video/paid-demo-2/`; `check:pages` passed.
  - `X [ERROR] The build was canceled` at the top of every `npm run build`, asked about by the owner: `astro build`
    starts with the content sync, whose temporary Vite server began pre-bundling the Clerk list of `optimizeDeps`
    and was closed about two seconds later, cutting esbuild off. The list moved from `vite` into a small inline
    integration in `astro.config.mjs` that adds it for `astro dev` only (the `command` of `astro:config:setup`).
    Checked: no such line in two builds, 147 pages, `[types]` about 0.9 s instead of 2 s; `astro dev` still
    pre-bundles `@clerk/clerk-js`, `@clerk/ui`, `@clerk/localizations` and React. Side effect: the first `astro dev`
    after a build bundles them again, a few seconds once.
  - The colleague's report that the menu does not scroll between 640px and 708px. Measured in headless Edge: at
    those widths every item fits (392px of 404px for a guest, 470px of 480px with Account), so there was nothing to
    scroll; with three extra items the menu pushed the logo and the icons out of the header instead, because the
    scrolling div, the nav and the header's right-hand group are flex items with `min-width: auto`, and the variant
    `min-[640px]:max-[708px]:scrollbar-none` produced no CSS. Now `min-w-0` on the three and a plain `scrollbar-none`;
    the title gives way first (`sm:shrink-[100]`), so the header at 390px to 1280px is unchanged (screenshots at
    680px identical) and the overfull menu scrolls (527px of 620px) with every icon on screen.
  - Block 2 under a paid lecture (the colleague's proposal; option A, hidden, not locked): `<div data-members-only>`
    in the entry, hidden by a global rule in `VideoLayout.astro` and shown on `site.videoAccess.grantedEvent`;
    `publicBody()` and `membersOnlyHeadings()` keep it out of the card, the feed, the search index and the table of
    contents; `getVideos()` refuses a block in a public entry or a malformed one (both proved on temporary entries,
    then removed). `paid-demo-2` has one with a sample diagram. Browser check, 10 of 10: a guest sees the sign-in
    box, no block 2 (its picture is still downloaded - hidden, not locked), no block 2 heading in the contents, and
    the comments; the demo account sees the player, block 2 with the diagram, and the comments.
  - Who sees what on a paid lecture, the owner's decision the same night: a guest gets block 1 and the sign-in box;
    a signed-in visitor without access also the comments, so that they can be instructed before paying; a member also
    the player and block 2. `paid-video.ts` confirms the session first and sends `site.videoAccess.signedInEvent`,
    which `Disqus.astro` now waits for instead of `grantedEvent`; `grantedEvent` shows block 2. The check for an
    empty service address moved behind the session check: it used to show "unavailable" to guests as well. Browser
    check, 9 of 9, on the dev server with the service (guest; the demo account; the same with a 403 from the service)
    and on the production build with no service address (guest: the sign-in box, no longer "unavailable"; signed
    in: "unavailable" with the comments); block 1 everywhere, block 2 only for the member.
  - The colleague's screenshot of the sign-in card in the light theme with its foot (the "no account?" line and the
    Clerk badge) dark navy. Clerk paints that strip with `--clerk-color-muted` and, when it is unset, works the
    colour out in the browser from the background and the neutral colour (relative colour syntax and `color-mix()`,
    `CardFooter` and `common.mutedBackground` in `@clerk/ui`). Not reproduced: in Edge 155 the strip is `#f3f3f3`
    in light and `#172740` in dark and follows the theme switch both ways; the navy on the screenshot is the dark
    value, so a browser that keeps a stale result is the likely cause (the colleague's is Opera; not confirmed).
    `clerk.css` now sets the variable to those two plain colours. Checked: the strip reads them and follows the
    switch; screenshots before and after differ by at most 2/255 per channel (rounding). The same variable colours
    the account page's side menu and Clerk's drop-down lists.
  - Not about sign-in, but made on this branch the same night: the colleague's proposal for the header and the
    home carousel, settled by the owner. The sign-in icon got `-mr-2` (right gap 26px against the logo's 24px, was
    34px; kept by the owner after a look). On a touch screen the carousel's arrows are hidden, a finger held on
    the photo pauses it, the long-press image menu is off, and the pause button is 24px below 640px; the hover
    pause listens to a mouse only. A device with a mouse keeps the arrows on hover at every width (for a few
    minutes they were hidden below 1024px too; the owner asked to keep the mouse as it was). Details and the
    checks: `MIGRATION-PLAN.md` section 9 and the README section on the carousel. Browser check 20 of 21 in
    headless Edge; the one miss was the harness - `Input.synthesizeTapGesture` sends no click in headless mode -
    and a real touch sequence on the pause button does pause it; arrows at 600px to 1280px with a mouse and at
    390px to 1180px with touch, 8 of 8.
  - The colleague's report that "Написать в поддержку" on Clerk's help card does nothing. Walked to the card in
    headless Edge with the demo account and recorded the path; the button's click requests
    `mailto:support@supreme-ladybug-7080.accounts.dev`, an address Clerk makes up when no `supportEmail` is set.
    Documented in `AUTH.md` section 12 with the colleague's proposal to open `ContactModal.astro` instead and how to
    wire it; no code changed.
  - Also not about sign-in: the home page's tag cloud, after the colleague's review. The globe can be dragged in any
    direction with a finger or a held mouse button, keeps spinning after a release, and stops under a finger held
    still; a tap opens a word, a drag does not. On the narrowest phones it shrinks as a whole instead of running
    past the screen edge, and it is measured again once the web fonts arrive. Checked in headless Edge: nothing
    past the edge from 280px to 600px with the globe turned several times (the sampler catches a 57px overshoot
    when the words are enlarged on purpose), drags follow the finger in four directions, the page does not scroll,
    a tap and a click open the word. Details in `src/scripts/tag-cloud.ts` and the README section on the cloud.
  - 2026-09-29, not about sign-in either: hover effects on touch screens (the colleague's request). A PostCSS plugin
    in the new `postcss.config.cjs` gives every `:hover` rule an `:active` twin, and `site.ts` attaches an empty
    passive `touchstart` handler to the body, without which iOS Safari ignores `:active` (MDN compatibility data).
    Checked on the build: 86 `:hover` rules, all with twins, no Tailwind class name changed; `check` clean.
  - 2026-09-30, the same subject: the colleague saw no lift on a search result on a phone. A tap is shorter than most
    of the hover animations (0.15 to 0.3 s), so the plugin now also writes `transition-duration: 0s` for each
    `:active` twin under `@media (hover: none)`: instant under the finger, the usual fade after it. An audit of the
    build found every hover selector twinned and nothing hover-only left but deliberate cases (README). Checked in
    headless Edge: a pressed search result under touch emulation, 0s and the lifted shadow; with a mouse, 0.3s.
  - 2026-09-30, the header menu again: the colleague asked whether her sideways scroll works, since nothing moved in
    DevTools. With today's items the row fits from 640px (392px and 470px at 706px), so there is nothing to scroll.
    With three extra items it scrolled at 700px but spilled over the icons at 760px and 1100px, outside the
    640-708px band. Now `overflow-x-auto` wherever the bar shows, the line under it only while the row overflows
    (a ResizeObserver in `Menu.astro`), and the line on the nav so that it does not scroll away. Measured again:
    no line and nothing moves with today's items; with the extra items the row scrolls at 700px, 760px and 1100px,
    the line matches the row and stays put after a scroll to the end. README, under the hamburger section.
  - 2026-09-30, `astro check` failed after the colleague's commit e019697 (the Yandex Metrika counter in
    `Base.astro`): "Cannot find name 'ym'" twice. `ym` is declared in `src/env.d.ts`, as a possibly undefined
    global like the earlier worked example there. Noted, not changed: the block that sends a hit on
    `astro:page-load` never runs, because that event comes from `<ViewTransitions />`, which the site does not use
    (Astro 4 docs, "View Transitions", lifecycle events); the counter's own init already counts every page load.
  - 2026-09-30, a Tailwind 3.4 audit at the owner's request (3.4.19 installed), done by a read-only agent against the
    Tailwind docs and checked against the code before anything changed. Applied: theme() colours in `search.css` and
    `TocSidebar.astro`; the light-mode hover of the white controls in `custom.css`; `darkMode: "selector"`; the
    `scrollbar-none` utility as a config plugin and three redundant menu classes out; keyboard focus rings on the
    hamburger and the category toggles; font stacks via theme() in `main.css`; the feedback heading in the site's
    serif; comment corrections in the config and `ScrollToTop.astro`. The audit was wrong about one thing: the theme
    toggle already had a focus ring from `main.css`, so it was left alone. `darkMode` checked by diffing the computed
    colours of 4712 elements on ten pages in dark mode at 1280px and 390px: identical but for the tag cloud words,
    whose opacity is the sphere's animation. Not applied, on purpose: `future.hoverOnlyWhenSupported` (it would hide
    every `hover:` and its `:active` twin from phones), the old class names copied from Hugo. README, "Tailwind 3.4
    audit". Found on the way, not fixed: the back-to-top button is invisible but catches taps at the bottom right until
    the page has been scrolled down and back, because `pointer-events-none` is added only then.
  - 2026-09-30, the owner's sign-in page failed on localhost:4321 with "504 (Outdated Optimize Dep)" on the three
    Clerk bundles. Cause: a dev server started here on a spare port shares `node_modules/.vite` with the owner's,
    began re-optimising the dependencies (Clerk takes over 15 s) and was stopped half-way, leaving no `deps` folder
    while the owner's server kept the old hash. The owner restarts with `npm run dev:clean`. So that it cannot happen
    again, `astro.config.mjs` has a small integration that moves the cache to `KB_VITE_CACHE_DIR` when that is set,
    and CLAUDE.md asks every spare server to set it; checked: such a server left `node_modules/.vite` untouched.
  - 2026-09-30, the back-to-top button that the audit entry above found: it starts `pointer-events-none` and
    `invisible` now, and the script toggles `invisible` with the other classes, so before the first scroll it can be
    neither tapped nor reached with Tab. Checked on the built site at 390px: hidden and out of reach on load, visible,
    tappable and focusable after a scroll down, hidden and out of reach again back at the top.
  - 2026-09-30, the header menu once more, the owner choosing the colleague's original idea (option B): in a band
    from 640px to 793px inclusive (hers was 640-708px) the line under the menu shows all the time, and while the items fit a finger drag pulls the row
    up to 15px (tanh resistance) and it springs back on release; finger only, reduced motion respected, the click
    after a drag dropped, `touch-action: pan-y` only while the spring is on. Checked on the built site under touch
    emulation: at 700px and 780px a 120px drag moved the row 14.5px and it came back, the page stayed, a vertical move left it
    alone; at 794px no line and no movement; the line starts under the row at 640px to 793px, for a guest and a member.
  - 2026-09-30, paid lectures from Yandex Disk, the owner's decision; the first is `lecture-part-3` (first in the
    Video list, dated 2026-09-29, placeholder texts, block 2). A `VIDEOS` value may be `{"yandexDisk": "<link>"}`;
    the Worker asks Yandex Disk's public API after the membership check and answers a short-lived `videoUrl`
    (VERSION 2026-09-30.1); the page plays it in a video element from `template[data-paid-file]`, only on
    `site.videoAccess.fileHosts`. The link is in the ignored `videos.local.json` only. Checked: the API, the file
    (MP4 with the index at the start, byte ranges), playback and a seek in headless Edge, `check:video-access` 41/41,
    the build (first on `/video/`, in the search without block 2, the link in no file of `dist/`). Not checked end to
    end with the demo member: the owner's running service had the old code. Limits in `PAID-VIDEO.md` section 10.
  - 2026-09-30, `METRIKA.md` for the colleague's review (the owner's request): answers on the Yandex Metrika counter's
    name and code settings, checked against Yandex's help, and proposals for the site that are not built yet.
  - 2026-09-30, the header's sign-in icon, the colleague's question: on a slow CPU (x6) a member's page was painted
    15-130 ms before the icon switched, and Back after a sign-out restored a page from the back-forward cache still
    marked `kb-member`. The icons now follow that class through CSS, an inline block sets the account address at once,
    and `AuthButton.astro` re-applies class, address and label on `auth-flag-change` (now sent by `auth-flag.ts`),
    `storage` and `pageshow`. Checked: first frame right at CPU x6 on three pages, a guest's header after Back, the
    same-tab event, `check:auth` 19/19. Then, at the owner's request, the icon holds clicks after the first until the
    page changes (5 s at most, free again after Back, new-tab clicks untouched); on a slowed network three quick clicks
    made one request to `/auth/signin/`.
  - 2026-09-30, "504 (Outdated Optimize Dep)" again on the owner's sign-in page: `npm run check` at 23:12 (astro sync
    starts a Vite of its own) rewrote `node_modules/.vite/deps` under the owner's server, started at 22:59. Every
    command but `astro dev` now uses `node_modules/.vite-tools` (integration `separate-vite-cache`); checked: `check`
    and `build` left `node_modules/.vite` untouched. New `npm run dev:all:clean` for the owner, and the cure in README.

### Verification

`npm run check` and `npm run build` green, `check:pages` passed, `check:video-access` 35/35, `check:auth` 18/19
(unchanged; the demo line waits for the demo user's metadata). A browser probe on the dev server with the local Worker
and the real Clerk instance passed the paid states, the refused player addresses and the redirect cases; the account
card measured 326 px on the profile section at 1280 px wide (704 before). The details are in the verdict.

### Left for someone else

- The owner, Clerk Dashboard: the Customize session token claims and the demo user's metadata (`PAID-VIDEO.md`
  section 3, step 6); then `check:auth` should give 19/19 and the example should play locally.
- The owner: the Cloudflare account and the Worker (`PAID-VIDEO.md` section 5.2), then `site.videoAccess.endpoint`.
- Before real sales: `PAID-VIDEO.md` section 8.
