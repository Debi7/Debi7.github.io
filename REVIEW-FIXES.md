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

## 2. One component for the page buttons, the owner's rule for many pages, and the year switcher on its own

Not a remark from the review. The owner asked for this on 2026-09-19 while the review was open, after section 1 had
shown that the block existed twice, once per theme template.

### 2.1 What the owner asked for

- The page numbers between Previous and Next: a list of up to five pages shows every number; a longer one shows only
  the first, the current and the last page, with an ellipsis between them that is not a link. Only the first and the
  last page are links there; the current page is not a link. Previous is absent on the first page and Next on the last,
  as before.
- The texts of the Previous and Next buttons stay translatable.
- One component for the block, so that any list added later gets the same buttons.
- The year switcher separate from it, as a component of its own with its own behaviour.

### 2.2 What changed

- `src/components/Pagination.astro` - new. Previous, the numbers and Next, rendered for the Posts list and the
  category pages by `PostList.astro` and for the tag pages by `pages/tags/[slug]/[...page].astro`, which both lost
  their own copy of the block; each passes the addresses of the neighbouring pages, the numbers and its own top margin
  (`mt-12` from `list.html`, `mt-10` from `tag.html`). The container and the buttons are `list.html`'s; the arrows are
  the SVG chevrons of `tag.html`, the owner's choice over `list.html`'s text arrows, because they match the Previous
  and Next cards under an article and a text arrow depends on the font. The button texts come from
  `src/i18n/strings.ts`, as before. The theme's original `tag.html` classes are listed in the component's comment.
- `src/lib/posts.ts` - `pageNumbers()` implements the rule; the threshold is `pagination.everyNumberUpTo` in
  `src/config.ts`, 5. The second set of numbers for screens below 640px (`numbersCompact`) is gone: five entries fit at
  390px, so one set does.
- `src/components/YearSwitcher.astro` - new. The year buttons moved out of `PostList.astro`, with a rule of their own,
  `yearSwitcher()` in `posts.ts` with `pagination.everyYearUpTo` (5): up to five years every year is shown; with more,
  the newest, the oldest and the year being shown with the year either side of it, and an ellipsis for the years
  hidden: `2026 ... 2023 2022 2021 ... 2015`. Keeping the neighbours is a decision made here, not asked for: a reader
  browsing by year moves to the year next door far more often than to the first page of a list. It is one line to
  change.
- `scripts/check-pagination.mjs` - checks both rules exactly: the entries found on every list page against the entries
  expected, for the numbers and for the year switcher.
- `PAGINATION.md` sections 4, 6, 7, 9 and 10, `MIGRATION-PLAN.md` section 9 (chevrons on the Posts list, where
  `list.html` has text arrows), `README.md` and `CLAUDE.md`.

### 2.3 Checks

- `npm run fix`, `npm run check` (0 errors, 0 warnings), `npm run build` (63 pages, no warnings) and
  `npm run check:pages` (all checks passed).
- `npm run check:pages:stress`: the copy with 159 generated posts spans 8 years, so both rules are exercised there -
  the year switcher with an ellipsis, and lists of up to 100 pages. 132 list pages with 5 posts to a page and 591 with
  1, all checks passed.
- The site itself has 3 years and at most 4 pages a list, so the ellipsis does not appear on it yet. To see it, the
  copy described under "How to see it" was built.

### 2.4 How to see it

On the site: `npm run dev`, then `/posts/2024/`, `/posts/2024/page/2/` and the tag pages - the buttons and numbers as
before, the arrows now chevrons on every list. For the ellipsis, on a copy of the project: set `pageSize` to 1 in
`src/config.ts` and add five posts dated 2019 to 2023, then `npm run build` and `npm run check:pages`; `/posts/2024/`
then has nine pages and the year switcher eight years.
