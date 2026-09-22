# The Video section

The Video menu item, its list and the video pages were added by the colleague on `main` between 2026-09-20 and
2026-09-22 (commits `3379541` to `a3c194c`). This file records what that work consists of, what was fixed on the
branch `VideoPage-V1` on 2026-09-22 and why, and what was noticed on the way and left alone. It is the place to look
before touching the section again.

## 1. What exists

- A content collection `video` in `src/content/config.ts`, with the fields of a post plus `videoId`, `videoUrl`,
  `thumbnail`, `duration`, `heroImage` and `videoPlatform`. Eight entries live in `src/content/video/`: one dated
  2026-09-19 and seven numbered ones, four in 2026, two in 2025 and two in 2024. `templates/video.md` is the
  author's template.
- `src/lib/video.ts`: `getVideo()`, `groupByYear()`, `paginateList()`, `pageNumbers()`, `yearLinks()` and
  `getTerms()` for videos. It is a copy of the helpers in `src/lib/posts.ts` with the collection and the field
  names changed, not a shared module.
- `src/components/VideoList.astro`: the list of cards by year, a copy of `PostList.astro` with the link target
  changed to `/video/<slug>/`.
- Two routes: `src/pages/video/[...video].astro` builds `/video/`, `/video/<year>/` and `/video/<year>/page/<n>/`,
  and `src/pages/video/[slug].astro` builds a page per video through `Post.astro`, whose props accept
  `Post | Video` since `d018ecf`, with a YouTube player above the body and the Disqus block below it.
- The menu entry `Video` between Posts and Tags in `src/config.ts`, and the string `list_watch_video` in
  `src/i18n/strings.ts`.

## 2. Fixed on 2026-09-22, branch `VideoPage-V1`

Reported by the owner from the live site, where `/video/` showed only the two videos of 2024 and `/video/2024/`
answered 404; a video page showed a grey frame reading "server not found" in place of the player.

- **The year pages did not exist and the list showed the oldest year.** The route is `[...video].astro`, so its
  rest parameter is named `video`, but `getStaticPaths()` returned `params: { page: ... }`, copied from the Posts
  route. Astro ignores a param the route does not declare, so every entry mapped to `/video/`; the last one
  written was the oldest year, and that is what the page showed. The three keys read `video` now. Built: `/video/`
  shows 2026 with four videos, `/video/2026/` the same, `/video/2025/` two and `/video/2024/` two.
- **The player asked for a non-existent host.** The `iframe` address read `youtube.com{post.data.videoId}`: no
  `/embed/` path, no `$` before the brace and a variable that does not exist in the file, so the browser tried to
  resolve that text as a host name. It is `https://www.youtube.com/embed/${videoItem.data.videoId}` now, the
  address of YouTube's embeddable player. The video ids in the sample entries are placeholders, so the player still
  shows YouTube's own "video unavailable" until real ids are filled in.
- **`astro check` reported four errors.** `ArticleLayout.astro` reads `lastmod`, `summary`, `share_title` and
  `share_description` from `data`, and since `Post.astro` accepts a video the type of `data` is the union of the two
  schemas, which lacked them on the video side. The four fields were added to the video schema as optional, with the
  same meaning as for a post; no entry has to set them.
- `tsconfig.json` was reformatted by `npm run fix`; `main` had left it unformatted, which made `npm run check`
  fail on the Prettier half.

Checks: `npm run fix`, `npm run check` 0 errors, `npm run build` 75 pages, `npm run check:pages` all passed,
`npm run dev` started once and served `/video/`, `/video/2024/` and a video page. Every `/video/...` route in
`dist/` was listed and the card links of each list page counted.

## 3. Noticed on the way, not done

- `VideoList.astro` and `src/lib/video.ts` duplicate `PostList.astro` and `src/lib/posts.ts`. Every fix the
  review of `sidebar-fix` brought to the Posts list is missing here: the tag chips link to `/tags/<tag>` without
  the trailing slash (a 404 on the dev server), `(tag: any)`, the `ml-8` indent that pushes the cards right on a
  phone, and the page buttons of the old shape. The `getCollection` import and the unused `video` constant at the
  top of `[...video].astro` are dead code. Once `sidebar-fix` is merged into `main`, the right move is one list
  component and one set of helpers with the collection as a parameter, rather than fixing the copy line by line.
- A video page shows "0 min read": `readingTime()` counts the words of the body, and the sample bodies are one
  sentence. The `duration` field exists and is not shown anywhere.
- `videoUrl` and `videoPlatform` are stored and not used; the player is YouTube regardless of `videoPlatform`.
- `sidebar-fix` is not merged into `main` yet, and `main` has moved: `PostList.astro`, `Post.astro` and
  `src/styles/custom.css` (the dark palette is `#071429` / `#11213b` on `main` since `d85e0df`) are changed on
  both sides, so the merge will conflict there. The colleague merges; this note is so that nobody is surprised.
- `README.md` and `CLAUDE.md` on `main` predate the `sidebar-fix` documentation (menu highlight, pagination
  rules, the git section); they will be reconciled by that merge, not here.

## 4. Next step, agreed with the owner on 2026-09-22: a VideoLayout over a neutral ArticleLayout

Not done here. Written down so that it is seen before `sidebar-fix` is merged into `main` and before the video page
grows further.

- **Why.** `Post.astro` accepts `Post | Video`, and `ArticleLayout.astro` reads fields of the posts schema from
  `data`; the four optional fields added to the video schema in section 2 exist only to satisfy that. A video page
  also shows "0 min read" where the entry has a `duration`, and the comment in `[slug].astro` plans a paywall
  placeholder in place of the player, so the two pages will keep diverging.
- **What.** `ArticleLayout.astro` becomes the neutral page frame: it takes plain props - title, date, an optional
  updated date, description, categories, tags, the share fields and the items of the meta line under the title -
  plus a named slot `media` above the body, and stops reading any collection's `data`. `Post.astro` stays the post
  wrapper: it maps a post to those props and supplies the reading time. A new `VideoLayout.astro` maps a video the
  same way, supplies `duration` in place of the reading time and puts the player - later the paywall placeholder -
  into the `media` slot. `Post | Video` and the four schema fields then go away.
- **Not a copy.** A `VideoLayout` that copies `ArticleLayout` would be the third duplicate after
  `VideoList.astro` and `src/lib/video.ts`, and every fix to the header, the table of contents or the
  previous/next navigation would have to be made twice. The duplicated list already misses every fix that
  `sidebar-fix` brought to `PostList.astro` (section 3).
- **In the same step:** one list component and one set of helpers for both collections, with the collection as a
  parameter, replacing `VideoList.astro` and `src/lib/video.ts`.
- **When.** After `sidebar-fix` is merged into `main`, because that merge already conflicts in `Post.astro` and
  `PostList.astro`; on a branch from `main`; agreed with the colleague first, since she is working on the video
  section.

## 5. How to check it

`npm run dev`, then `/video/`, `/video/2024/` and any video page. Or `npm run build` and list `dist/video/`: the
list pages are `/video/`, `/video/2024/`, `/video/2025/`, `/video/2026/`, and there is one folder per entry.
