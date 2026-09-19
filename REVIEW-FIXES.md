# Changes made after the review of the sidebar-fix branch

Written on 2026-09-19. The branch `sidebar-fix` (commit `e210a07`: the post sidebar, pagination by year, the new posts
and the author guide) went to the reviewer on 2026-09-19. This file records what the review found and what was changed
in answer, one section per remark, so that the reviewer can see what was done and why. Each remark is resolved in a
commit of its own on the same branch. Only those changes are described here; the work under review is described in
[POST-SIDEBAR.md](POST-SIDEBAR.md), [PAGINATION.md](PAGINATION.md) and [CONTENT.md](CONTENT.md).

## 1. The page buttons were round on the tag pages and square on the Posts list

### 1.1 What the reviewer saw

On a tag page (`/tags/<tag>/`) the Previous, Next and page-number buttons at the foot of the list were pills, fully
round at the ends. On the Posts list (`/posts/`, `/posts/<year>/`) the same buttons were rectangles with slightly
rounded corners. The reviewer asked whether that was intended.

### 1.2 Where it came from

It was inherited from the theme, not decided here. The theme has two separate pagination blocks, and both were ported
with their class attributes copied verbatim, as the parity rule asks:

- `themes/void/layouts/_default/list.html`, used by the Posts list and the category pages, gives Previous and Next
  `rounded-md` plus colours for dark mode (`dark:bg-slate-900 dark:text-gray-300 dark:hover:bg-slate-800`).
- `themes/void/layouts/taxonomy/tag.html`, used by the tag pages, gives them `rounded-full` and no `dark:` classes at
  all. In dark mode those buttons therefore stayed bright white, which the reviewer's own screenshot shows.

The page numbers, which the theme does not have, copied the shape of the Previous and Next buttons next to them, so the
difference carried over to them.

Nobody had seen either block before: the Hugo site never had enough posts for pagination to render, so the two styles
existed only in the templates. The round buttons may well be the theme author's intent, since the tag chips on the
same page are `rounded-full` too; the missing dark-mode classes look like an oversight.

### 1.3 The decision

The owner chose one style for every list: rectangles with rounded corners (`rounded-md`), with the dark-mode colours,
keeping the Previous and Next buttons as they are. This is a deviation from the Hugo output, so it is recorded in
[MIGRATION-PLAN.md](MIGRATION-PLAN.md) section 9, like the other departures the owner has asked for.

The reviewer did not ask for it, but the owner also considered whether Previous and Next buttons had to be added
anywhere. They did not: every list page has them, and the article page has its own Previous and Next cards to the
neighbouring posts under the text (`PostNav.astro`, a port of the block in `single.html`). Nothing was added.

### 1.4 What changed

- `src/pages/tags/[slug]/[...page].astro` - four class attributes in the pagination block: Previous, Next, a page
  number and the current page number now carry the classes of the corresponding elements in `PostList.astro`, which
  are `list.html`'s. The SVG arrows inside Previous and Next are still `tag.html`'s (`list.html` uses text arrows).
  The theme's original class strings are listed in the comment above the block, and the notes at the top of the file
  say that the buttons are the one exception to "classes copied verbatim".
- `PAGINATION.md` section 6 - the two shapes are no longer described; a bullet records the unification.
- `MIGRATION-PLAN.md` section 9 - a new accepted deviation.
- `README.md` - the pagination row of the status table mentions the one button style.
- `CLAUDE.md` - one sentence in the pagination bullet, so that a later session does not "restore" the round buttons.
- This file.

### 1.5 Checks

- `npm run fix`, `npm run check` (0 errors, 0 warnings), `npm run build` (63 pages, no warnings) and
  `npm run check:pages` (16 tag lists, 2 category lists, 34 list pages walked, all checks passed).
- `npm run dev` started once and served a tag page.
- Measured in headless Edge on the second page of the tag with the most posts (19 posts, four pages, the first tag on
  `/tags/`) and on `/posts/2026/page/2/`, in both themes at 1280px and 390px. The computed styles are identical on the
  two pages in every combination:
  - Previous, Next and the page-number links: 6px corner radius; dark mode `rgb(18, 41, 79)` on `rgb(229, 231, 235)`
    (the panel colour `custom.css` gives `dark:bg-slate-900`); light mode white on `rgb(54, 65, 83)`.
  - The current page: 6px radius; dark mode `rgba(59, 130, 246, 0.18)` on `rgb(147, 197, 253)`; light mode
    `rgb(239, 246, 255)` on `rgb(20, 71, 230)`.
  - Below 640px the page numbers take the compact row of their own, on both pages, as before.

### 1.6 How to see it

Run `npm run dev`, open `/tags/` and choose the first tag, then go to its page 2 with Next: the buttons at the foot
now look like those on `/posts/2026/page/2/`. Switch the theme with the button in the header: the tag page's buttons
follow it instead of staying white. Narrow the window below 640px: the numbers move to a line of their own on both
pages.
