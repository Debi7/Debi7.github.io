# Changes on the branch visual-fixtures, 31.10.2026 to 06.11.2026

This file describes five changes that were made on the branch `visual-fixtures` between 31 October and
6 November 2026. For each change it says what was wrong or what was asked for, why it happened, what was changed and
in which files, how to check the result, and how to undo it where undoing is likely to be wanted.

A branch is a separate line of work in git. The live site is built only from the branch `main`, so none of these
changes reaches the live site until the colleague merges `visual-fixtures` into `main`, that is, until she copies
the changes of this branch into `main`. Until then the changes can be seen on the owner's computer with
`npm run dev`, at <http://localhost:4321/>.

The five changes, in the order they were made:

1. [The count beside a category name](#1-the-count-beside-a-category-name) stays next to the name when the name wraps.
2. [The tag cloud is switched off](#2-the-tag-cloud-is-switched-off) on the home page.
3. [The local services moved below port 8000](#3-the-local-services-moved-below-port-8000).
4. [The admin panel and tags over several lines](#4-the-admin-panel-and-tags-over-several-lines): the panel can
   edit such posts again.
5. [Two buttons on the home page and the open lectures](#5-two-buttons-on-the-home-page-and-the-open-lectures):
   the buttons show on phones, and the second leads to a new page of open lectures.

Each section ends with the commit that holds the change. A commit is one saved step in git; its short code, such as
`586efc4`, can be looked up with `git show 586efc4`.

## 1. The count beside a category name

### What was wrong

The page `/categories/` lists the categories of the site. Each category is a row with its name, a small green badge
that shows how many entries it holds, and an arrow on the right that opens the row. The colleague noticed on a phone
that the name "Обучающие Видео" no longer fits on one line and wraps onto two. When that happened, the badge with the
number did not stay next to the name. It moved to the right edge of the row and touched the arrow.

### Why it happened

The name and the badge sit side by side in a row that the browser lays out with CSS flexbox. Flexbox is the part of
CSS that places items in a line and shares the free space between them. When the text of an item wraps onto two
lines, the browser makes that item as wide as all the space it was given, not as wide as its longest line. The name
therefore took the whole width of the row, and the badge could only stand after it, at the right edge. CSS has no
setting that makes a wrapped block exactly as wide as its longest line, so no change of style on the badge could
fix this. That is also the answer to the colleague's question about which class to change: the cause is not in the
badge's class `category-count-badge` but in the way the row measures the name.

### What was changed

A short script now measures the lines of every category name that wraps and gives the name the width of its longest
line. After that the badge stands 8 pixels to the right of the text and is centred between the two lines, which is
what the owner asked for. A name that fits on one line is not touched, so the page on a computer looks exactly as
before. The script runs before the page is first drawn, again when the web fonts have arrived, and again whenever the
width of the window changes.

Two smaller changes protect the arrow. The row now keeps a gap of 8 pixels between the text and the arrow (the class
`gap-2`), and the arrow can no longer be squeezed narrower than its own size (the class `shrink-0`). Before this, on a
very narrow screen, the arrow could be squeezed to zero width and disappear.

A first version put the badge into the line of text, right after the last word, and needed no script. It was dropped
because measurements showed that it moved the badge 2.2 pixels lower on every row, also on rows whose name fits on one
line.

When `main` was merged into the branch on 31 October, git reported a conflict in the same place: the colleague had
added the class `ml-0.5` to the arrow on `main`. At the owner's word that class was not kept, because `gap-2` already
keeps the badge away from the arrow and the two extra pixels would make the row too wide on a 320-pixel screen.

### Where

- `src/pages/categories/index.astro`: the class `category-title` on the name, the classes `gap-2` and `shrink-0`,
  and the function `fitTitles()` in the script at the bottom of the file.
- `README.md`, section "A wrapped category name keeps its count beside it".

### How to check

Open `/categories/` and make the window narrow, for example with the phone mode of the browser's developer tools at
360 or 375 pixels. "Обучающие Видео" wraps onto two lines, and its badge stands right after the text, centred between
the lines, with free space before the arrow. It was also measured in headless Edge, which is the Edge browser run
by a script without a window: at a width of 1280 pixels every name, badge and arrow is exactly where it was before.

Commit `586efc4`; the merge with the decision about `ml-0.5` is `e97534b`.

## 2. The tag cloud is switched off

### What was asked for

The client no longer wants the cloud of tags under the site's name on the home page. On phones the cloud was a turning
globe of words; on a computer it was already hidden since September.

### What was wrong with the first way of hiding it

The colleague first hid the cloud by giving it the class `hidden` (commit `a8c0b26` on `main`). That made the cloud
invisible, but it left two things behind. The page still carried the cloud's 17 links. And the script that turns the
globe still ran on phones, because the script decides whether to start by the width of the screen alone and does not
look at whether the cloud can be seen. So on every phone the script recalculated the position of 17 invisible words
many times a second. A visitor could not see this, but it kept the phone's processor busy and used battery for nothing.

### What was changed

The class `hidden` was taken back, and instead the home page no longer includes the cloud at all: the line
`<TagCloud />` and the line that imports it are turned into comments in `src/pages/index.astro`. A page that does not
include the component carries neither its links nor its script. The component itself, `src/components/TagCloud.astro`,
and its script, `src/scripts/tag-cloud.ts`, are kept unchanged.

### Where

- `src/pages/index.astro`: the two lines in comments, with the reason next to them.
- `src/components/TagCloud.astro`: the class is `block` again, as before `a8c0b26`.
- `README.md` (section "The tag cloud under the carousel"), `CONTENT.md` (section "The tag cloud on the home page")
  and `ADMIN-GITHUB-PAGES.md` (the checks after saving a post) now say that the cloud is off.

### How to undo

To bring the cloud back, remove the comment marks from the two lines in `src/pages/index.astro`: the import at the
top and `<TagCloud />` below the title. Nothing else needs to change.

### How to check

Open the home page on a narrow window: there is no cloud under the site's name. The built page `dist/index.html`
contains no element and no code of the cloud.

Commit `f97bd81`.

## 3. The local services moved below port 8000

### What was asked for

The command `npm run dev:all` starts the site together with three small services that the site needs on the owner's
computer: the service that hands out paid videos, the service that saves posts from the admin panel, and the service
that changes the statuses of members. A port is the number that tells programs on one computer apart when they listen
for connections, the way a flat number tells apart the flats of one house. The three services listened on ports 8787,
8789 and 8790, and the owner asked for numbers below 8000.

### What was changed

The services now listen on 7787 (paid videos), 7789 (posts) and 7790 (statuses); only the first digit changed, so the
old and the new numbers are easy to match. Before the move it was checked that no program on the computer uses these
ports and that Windows does not reserve them. The site itself stays on 4321. Ports just above 4321 were avoided on
purpose: when 4321 is busy, Astro moves the site to 4322, 4323 and so on by itself, and a service there would collide
with it.

Only the owner's computer is affected. The live site does not use these ports.

### Where

- `scripts/video-access-dev.mjs`, `scripts/content-admin-dev.mjs`, `scripts/statuses-dev.mjs`: the port of each
  service.
- `scripts/dev-all.mjs`: the ports it reports and the hint it prints when a port is taken.
- `src/config.ts`: the three addresses at which the site calls the services.
- `package.json`: a new line in its list of notes. The older lines keep the old numbers, by the project's rule that
  existing comments are not rewritten.
- `ADMIN.md`, `PAID-VIDEO.md`, `README.md` and the three `workers/*/README.md`: the new numbers.

### What to do once

A `npm run dev:all` that was started before the change still runs on the old ports. Stop it with Ctrl+C and start it
again.

Commit `0770187`.

## 4. The admin panel and tags over several lines

### What was wrong

While the ports were being checked, the test of the admin panel (`npm run check:content-admin`) showed that the panel
could not edit 10 of the 24 posts: it marked them as not editable. These were the posts whose tags the colleague had
changed on 31 October.

### Why it happened

The top of every post file is a block of fields called the front matter: the title, the date, the tags and so on, one
field per line. When a list of tags is long, the code formatter Prettier writes it over several lines: the word
`tags:` alone, then an opening bracket, one tag per line, and a closing bracket, with a comma after the last tag. The
panel read the front matter strictly one line per field, so it could not read such a list. When the panel cannot read
a post, it refuses to edit it rather than risk spoiling it, and that is what happened here.

### What was changed

The function that reads a post in the panel's service now joins the indented lines that follow a field to that field,
and removes the comma before the closing bracket. That comma is allowed in the YAML format of the front matter but not
in JSON, the format the panel uses to read a list. A post that is opened and saved without changes is written back
exactly as it was, byte for byte. When the tags of such a post are changed in the panel, the panel writes the new
list on one line, as it writes every list.

### Where

- `workers/content-admin/worker.mjs`, the function `parsePost()` and the function `scalar()` below it.
- `scripts/check-content-admin.mjs`: a new test that changes the tags of such a post on a temporary copy of the posts
  and checks that only the tags changed.
- `ADMIN.md` and `README.md`: a note about it.

### How to check

Run `npm run check:content-admin`. It passes 130 of 130 checks: every post can be edited again, all 24 posts survive
a save without changes, and the new test passes. The panel on the owner's computer picks the change up after
`npm run dev:all` is restarted.

Commit `36511a4`.

## 5. Two buttons on the home page and the open lectures

### What was asked for

The client asked, through the colleague, for two buttons on the home page on phones, in the place where the tag cloud
stood: "Войти", which does the same as the sign-in icon in the header, and "Открытые лекции", which leads to a page
with the open lectures.

### How the site tells an open lecture from a paid one

The colleague asked whether open lectures are marked by tags. They are not. Every lecture file has a field `access`,
which is either `public` or `paid`; a lecture that does not set it is `public`. Paid lectures can be watched only by
members who are signed in. On 6 November 18 of the 20 published lectures were open.

### What was changed

On a screen narrower than 640 pixels the home page now shows two buttons under the site's name. On a wider screen they
are hidden, because there the row of menu links further down the page does the same job; 640 pixels is the width at
which the header's menu turns into the three-line button.

- The first button looks like the other filled buttons of the site, for example the one in the feedback form. For a
  guest it says "Войти" and leads to the sign-in page. For a member who is already signed in it says
  "Личный кабинет" and leads to the account page, exactly as the icon in the header changes. The switch uses the mark
  that the site puts on the page for a signed-in member before the page is first drawn, so the right button is there
  at once and no extra script is needed.
- The second button has the same shape with a blue outline and a play sign, and says "Открытые лекции". It leads to
  the new page `/video/open/`.

The page `/video/open/` is the "Видео" list with the paid lectures left out. It has the same cards, the same row of
years and the same numbered pages, because it is built by the same code. A new lecture appears on it by itself unless
it is paid.

### Where

- `src/pages/index.astro`: the two buttons, with the reasons in a comment above them.
- `src/pages/video/open/[...page].astro`: the new page. The name in brackets means that one file builds the page and
  all its year and page addresses.
- `src/lib/video.ts`: the address `openLecturesUrl` and the function `isOpenLecture()`. The address is kept in one
  place, so the page and the button cannot point at different addresses. For the same reason no lecture file may be
  named `open`: its page would have the same address.
- `scripts/check-pagination.mjs`: `npm run check:pages` now checks the new list too.
- `README.md` (section "Two buttons on the home page on phones, and the open lectures") and `CONTENT.md` (section
  "Where a new video appears by itself").

### How to check

Open the home page on a narrow window: under the site's name there are the two buttons. "Открытые лекции" opens the
list, which shows no paid lecture. After signing in, the first button says "Личный кабинет". Checked in headless Edge
at a width of 390 pixels in the light and the dark theme; the signed-in state was not photographed and rests on the
same mark as the header's icon.

Commit `18c1428`.
