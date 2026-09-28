# Who sees what: the guest gate of 2026-09-25 and its reopening

Rewritten on 2026-09-28 at the owner's order that everything about the previous sign-in provider leaves the branch
`clerk-auth`. Sections 1 to 9 of this file described that provider - its setup, its settings, its tests and its pull
request - and are gone; they remain in the git history. Sign-in is Clerk now: the plan is `CLERK.md`, the Clerk
Dashboard and the administrator's runbook are `CLERK-DASHBOARD.md`, paid videos are `PAID-VIDEO.md`, and the session
log is `AUTH-IMPLEMENTATION.md`.

The two sections below stay, under their old numbers, because comments in the code point at them ("AUTH.md section
10", "section 11") and because they do not depend on the provider: they record how the site was closed to guests on
the evening of 2026-09-25 and opened again the same night, and why the few pieces that remain are the way they are.

## 10. The guest gate, added the evening of 2026-09-25

The owner's decision that evening: the site is for signed-in members. A guest was to see the home page with the
carousel and nothing else, under a header of the site name, Home, the theme switch and the sign-in icon; every other
page was closed and sent the guest to the sign-in page. Section 11 says what is left of it.

### 10.1 What a static host allows

GitHub Pages serves files. Nothing on it can refuse a request, so "closed" can only mean "not shown": the browser
decides, before it paints, whether the visitor is signed in, and shows the page or leaves it. The HTML of every page
is still a `curl` away, a visitor with JavaScript off sees every page, a search engine that runs no scripts indexes
every page, and a flag written by hand into the browser's storage opens everything, which is nothing more than what
`curl` shows. None of that is a fault of the implementation; it is the host. What a guest must never get has to be
answered by something that runs on a server; for paid videos that is the access service of `PAID-VIDEO.md`. The gate
is a door, not a lock, and the client should hear it in those words.

### 10.2 How it worked

- `Base.astro` took `openToGuests`, false by default, so a page that said nothing was closed.
- The first thing in every page's head is an inline block that reads the flag `kb-auth-expires`: the same lines as
  `readAuthFlag()` in `src/scripts/auth-flag.ts`, repeated because an inline block cannot import, so the two are
  changed together. A valid flag adds the class `kb-member` to the document. While the gate existed, no flag on a
  closed page meant `location.replace()` to `/auth/signin/?next=<path and query>`.
- `custom.css`: `html:not(.kb-member) .members-only { display: none !important }`.
- The sign-in page reads `next` and follows it after a sign-in and, for a visitor who already has a session, at
  once. The rule "a path on this site, never another origin" is `nextPath()` in `src/scripts/auth.ts` and nowhere
  else (tightened on 2026-09-28, when the paid-video consilium found two addresses a browser reads as another host).
- The menu got the item `Account`, the member's page, before About, at the owner's word the same evening
  (`src/config.ts`). English and short, as the owner asked; the page it opens keeps its Russian title. It carries
  `members-only`, so a guest never sees it. The header icon leads to the same page for a member and to the sign-in
  page for a guest.
- Why inline and first in the head, not a bundled module: a bundled script runs after the document is parsed, and a
  guest would see a closed page for a frame before it went away. The same reasoning put the theme bootstrap in
  `Head.astro` where it is.
- Why the flag and not the sign-in library: the block is on every page, and the library is by far the heaviest code
  on the site (the measurement is in `package.json`). The flag is fail-closed, and the pages that load the library
  correct it.

### 10.3 What it changed for a visitor, while it stood

A guest saw the home page's carousel and a header without the other menu items, the search, the hamburger and the
footer; every other address opened the sign-in page. A member saw the site as before, plus `Account`. Closed pages
carried `noindex` and the sitemap listed the home page alone. All of this was removed the same night (section 11).

### 10.4 Verified

On the build of that evening: the inline block was in every page of `dist/` and in `404.html`, and `openToGuests`
was true on exactly the pages meant to be open. The browser checks of that day belonged to a harness that has since
been rewritten for Clerk (`scripts/check-auth-browser.mjs`).

### 10.5 Not done, on purpose

- No word next to the sign-in icon: the owner confirmed on 2026-09-25 that the label and the tooltip are enough. The
  icon carries its label for assistive technology; a caption beside it is a design change for the owner to call.

## 11. Reopened after the colleague's review, 2026-09-25

The colleague reviewed the closed site the same night and asked for it back as it was: closing everything leaves a
visitor nothing to look at, and they leave. Only the material that belongs to the paid course is to be closed. The
owner agreed. Section 10 is kept as the record of what was built and removed.

### 11.1 The model the colleague set out

- **A guest** sees everything: the home page, the posts, the videos, the tags, the categories, the search, and the
  comments under posts and videos, which they can read. A guest cannot see a paid video.
- **A signed-in member** can also write comments and ask questions (through Disqus, see 11.5). Paid content stays
  closed.
- **A member who has paid** sees the paid content as well. Built on 2026-09-28: `PAID-VIDEO.md`.

### 11.2 What changed in the tree

- The redirect in the inline block at the top of `Base.astro` is gone, and the `openToGuests` prop with it; the
  block only marks the document `kb-member` while the flag is valid.
- `members-only` stays on one element: the `Account` item of the menu, in both variants of `Menu.astro`.
- `noindex` is gone, and the sitemap filter is back to what it was (every page except the `/page/<n>/` aliases and
  `/auth/`).
- Kept from the gate work, because they are useful on their own: the `Account` item, the sign-in icon on the home
  page, the `next` parameter of the sign-in page and `nextPath()`.
- Every existing comment about the gate stays in its file, with a line under it saying it was reopened.

### 11.3 Comments and paid content

Comments are Disqus, a third-party frame: anyone who opens it can read, and who may write is decided by Disqus, not by
this site. The ways to get "read for all, write after sign-in" that were weighed: turning off guest commenting in the
Disqus admin (writing then needs a Disqus login inside the frame, not the club's account); Disqus single sign-on (a
paid Disqus feature that needs a signature computed on a server); or comments of the site's own, which is real work -
a form, the list, moderation, a server-side store - and would leave the existing threads behind in Disqus.

Paid content is built: `PAID-VIDEO.md` and the consilium verdict of 2026-09-28.

### 11.4 Password recovery

Clerk's sign-in form has its own recovery ("Забыли пароль?", a code by email, a new password), so the site has no
recovery pages of its own; the three `/auth/` pages are sign-in, sign-up and the account page (`CLERK.md`).

### 11.5 Comments: Disqus stays, decided the same day

The owner first chose comments of the site's own, then decided against it the same day: Disqus stays exactly as it is
and is not to be touched for now. Reading stays open to everyone. To write, a visitor signs in to Disqus inside the
comment frame (or registers there), which is Disqus's own account, not the club's. If guests can still post without
any account, that is a switch in the Disqus admin (guest commenting) on the colleague's Disqus account, not code; the
exact name of the setting was not checked.
