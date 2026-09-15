# Article page: wiring in the new components

Written on 2026-09-15 against `main` at `e68baaa` (the `src/` tree is identical to `855d46f`, "Article page"). It
explains why the article components added in the last commits do not appear on the site, and gives a verified fix.
Nothing described here has been applied to the repository yet.

The fix keeps the components and their markup. It connects them to the post route, repairs the calls that would
break the build, and brings the output in line with the Hugo template the components were ported from.

## 1. Summary

- The post route `src/pages/posts/[slug].astro` renders `src/layouts/Post.astro`, which is still the `TODO` stub: a
  bare `<h1>` and the body. The live page `/posts/article/` shows exactly that.
- `src/components/Content.astro` was meant to be the entry point, but nothing imports it. It could not work from
  `src/components/` anyway: `getStaticPaths` only runs in `src/pages/`, and it renders `<Content />`, which is not
  defined in that file.
- So `ArticleLayout.astro`, `PostNav.astro`, `ShareWidget.astro`, `TableOfContents.astro`, `Terms.astro` and
  `DisqusLazy.astro` are never compiled. That is also why `npm run build` and the deployment stayed green.
- Wiring them in is not enough on its own. The build then fails with `t is not a function` (section 3, step 2), and
  the deployment would fail with it.
- A separate, older problem in `Footer.astro` breaks `npm run dev` and `npm run check` on `main` today (part B).

## 2. Before you start

```
git pull
npm ci
```

Node 20 is required (`.npmrc` has `engine-strict=true`). Every push to `main` deploys the site, so run the checks in
section 5 locally before pushing.

## 3. Part A: the article page

### Step 1: pass headings and previous/next posts from the route

`getPosts()` returns posts newest first. In Hugo, `.NextInSection` on an older post points to the newer one: the Hugo
build of `/posts/article/` (the older post) shows only a "Next" link, to `/posts/radiesthesia-and-energy-fields/`.
So `next` is the element before the current one in the list, and `prev` the element after it. The logic in
`Content.astro` had them the other way round.

Replace `src/pages/posts/[slug].astro` with:

```astro
---
// One route per post: /posts/<file name>/, same as Hugo.
import type { InferGetStaticPropsType } from "astro";
import Post from "../../layouts/Post.astro";
import { getPosts } from "../../lib/posts";

export async function getStaticPaths() {
  // getPosts() is newest first. Hugo's .NextInSection on an older post points to the NEWER
  // one, so "next" is the element before this one in the list and "prev" the element after.
  // Checked against the Hugo build: /posts/article/ (older) shows only "Next".
  const posts = await getPosts();
  return posts.map((post, i) => ({
    params: { slug: post.slug },
    props: { post, next: posts[i - 1] ?? null, prev: posts[i + 1] ?? null },
  }));
}

type Props = InferGetStaticPropsType<typeof getStaticPaths>;

const { post, prev, next } = Astro.props;
const { Content, headings } = await post.render();
---

<Post post={post} headings={headings} prev={prev} next={next}>
  <Content />
</Post>
```

### Step 2: render ArticleLayout inside Base

`ArticleLayout.astro` renders only the `{{ define "main" }}` part of `single.html`. Used on its own, the page would
have no `<html>`, no head, no header and no stylesheet, so it has to sit inside `Base.astro`. Replace
`src/layouts/Post.astro` (this also removes its `TODO` comment) with:

```astro
---
// Single post layout (MIGRATION-PLAN.md §4): Base.astro, the port of baseof.html, around
// ArticleLayout.astro, the port of themes/void/layouts/_default/single.html. Kept as a thin
// wrapper so that src/pages/posts/[slug].astro stays the only file that knows about routing
// and about which posts are previous and next.
import Base from "./Base.astro";
import ArticleLayout from "./ArticleLayout.astro";
import type { MarkdownHeading } from "astro";
import type { Post } from "../lib/posts";

interface Props {
  post: Post;
  headings: MarkdownHeading[];
  prev: Post | null;
  next: Post | null;
}

const { post, headings, prev, next } = Astro.props;
---

<Base title={post.data.title} description={post.data.description}>
  <ArticleLayout entry={post} headings={headings} prev={prev} next={next}>
    <slot />
  </ArticleLayout>
</Base>
```

Then delete `src/components/Content.astro`. Its job is now done by the route.

### Step 3: fix the `t` calls

This is the error that breaks the build as soon as the components are wired in:

```
t is not a function
```

`t` in `src/i18n/strings.ts` is an object, not a function; the finished pages read it as `t.back_to_home`. Every
`t("key")` has to become `t.key`:

```astro
{t("pagination_previous")}
```

becomes

```astro
{t.pagination_previous}
```

This affects `PostNav.astro`, `ShareWidget.astro` and `TableOfContents.astro`. In `ArticleLayout.astro` the import is
commented out and the strings are written as literals, so the page would print the raw key: `{"reading_time"}`
renders the text `reading_time`. The full files in steps 4 to 8 already contain the fix.

### Step 4: ArticleLayout.astro

Differences from the Hugo template found by comparing the built page with `../klub_biolocation/public/posts/article/`:

- `datetime` was `2026-09-04T09:00:00.000Z`; Hugo prints `2026-09-04T12:00:00+03:00`. Fixed with a new
  `formatDateTime()` in `src/lib/date.ts` (step 9).
- The reading time was `1 min read`; Hugo prints `0 min read`. Hugo does not clamp the value, and
  `readingTime()` in `src/lib/posts.ts` already ports its formula, so use it instead of `Math.max(1, ...)`.
- The category link had a trailing slash. Hugo prints `/categories/blog` without one (string concatenation, the same
  quirk as the tag links on the list pages).
- The share widget was wrapped in an extra `div` (step 6).
- The Disqus block was rendered. `hugo.toml` sets no Disqus shortname, so Hugo leaves the `theme-card` div empty and
  loads no script. `DisqusLazy.astro` requested `YOUR_SHORTNAME.disqus.com` instead. Delete
  `src/components/DisqusLazy.astro`. The planned home for Disqus is the existing stub `src/components/Disqus.astro`,
  and only once a shortname exists.
- The `style` attribute had a typo: `--tw-prose-code-bg: # #f3f4f6`.
- Props are now typed, which removes the `any` errors reported by `astro check`.

Replace `src/layouts/ArticleLayout.astro` with:

```astro
---
// Port of ../klub_biolocation/themes/void/layouts/_default/single.html (MIGRATION-PLAN.md §4),
// the {{ define "main" }} block. Base.astro supplies baseof.html around it and Post.astro wires
// the two together. Class attributes are copied verbatim: they are the visual contract.
//
// Go template -> Astro:
//   first 1 .Params.categories, urlize  -> data.categories[0], encodeSlug(urlize(...))
//   .Title                              -> data.title
//   $shareTitle, $shareText             -> shareTitle, shareText below
//   .Permalink                          -> new URL(Astro.url.pathname, Astro.site)
//   .Date | time.Format, .Date.Format   -> formatDateTime(), formatIsoDate() in src/lib/date.ts
//   math.Round (div (countwords .Content) 200.0) -> readingTime(body) in src/lib/posts.ts
//   .TableOfContents                    -> TableOfContents.astro, tocHtml() in src/lib/toc.ts
//   .Content                            -> the default slot
//   .Lastmod (GitInfo is off)           -> data.lastmod ?? data.date
//   partial "terms.html" (tags)         -> Terms.astro
//   .PrevInSection, .NextInSection      -> prev, next, computed in src/pages/posts/[slug].astro
//   i18n "key"                          -> t.key from src/i18n/strings.ts
//   partial "disqus_lazy.html"          -> nothing. hugo.toml sets no Disqus shortname, so Hugo
//                                          leaves the theme-card div empty; keep the empty div.
//
// Decisions that look like mistakes but match Hugo:
// - The category link has no trailing slash (/categories/blog). Hugo concatenates the string,
//   exactly as for the tag links on the list pages. Do not add the slash.
// - The reading time can be 0 ("0 min read"). Hugo does not clamp it.
// - shareText is cut with slice(0, 120). Hugo's truncate also avoids splitting a word and adds an
//   ellipsis; the result is identical for every current post, all shorter than 120 characters.
//
// Verified 2026-09-15 against the Hugo output of /posts/article/ and
// /posts/radiesthesia-and-energy-fields/: the structure of main is identical except for the
// Markdown body (plan §6: math, callout shortcode, typographic entities) and, on posts with
// headings, Hugo's heading anchor links (plan §7).
import ShareWidget from "../components/ShareWidget.astro";
import TableOfContents from "../components/TableOfContents.astro";
import PostNav from "../components/PostNav.astro";
import Terms from "../components/Terms.astro";
import { site } from "../config";
import { t } from "../i18n/strings";
import { formatDateTime, formatIsoDate } from "../lib/date";
import { readingTime, type Post } from "../lib/posts";
import { encodeSlug, urlize } from "../lib/urlize";
import type { MarkdownHeading } from "astro";

interface Props {
  entry: Post;
  headings: MarkdownHeading[];
  prev: Post | null;
  next: Post | null;
}

const { entry, headings, prev, next } = Astro.props;
const { data, body } = entry;

const dateMachine = formatDateTime(data.date);
const dateHuman = formatIsoDate(data.date);
const readingMinutes = readingTime(body);
const updatedHuman = formatIsoDate(data.lastmod ?? data.date);

// Hugo: share_title, else .Title; share_description, else .Description, else .Summary, else
// site.Title; then plainify, collapse whitespace, truncate to 120.
const shareTitle = data.share_title ?? data.title;
const shareText = (
  data.share_description ??
  data.description ??
  data.summary ??
  site.title
)
  .replace(/<[^>]*>/g, "")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, 120);
---

<article
  class="mx-auto max-w-4xl overflow-hidden rounded-lg bg-white shadow-md"
>
  <header class="relative border-b border-gray-100">
    <div class="article-inner py-8">
      {
        data.categories.length > 0 && (
          <div class="mb-3 flex">
            <a
              href={`/categories/${encodeSlug(urlize(data.categories[0]))}`}
              class="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs text-blue-600 transition-colors hover:bg-blue-100"
            >
              {data.categories[0]}
            </a>
          </div>
        )
      }

      <h1 class="relative mb-4 text-3xl font-bold text-gray-900 sm:text-4xl">
        {data.title}
      </h1>

      <div
        class="relative flex flex-wrap items-center gap-4 text-sm text-gray-500"
      >
        <time datetime={dateMachine} class="flex items-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="mr-1.5 h-4 w-4 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            ></path>
          </svg>
          {dateHuman}
        </time>

        <span class="flex items-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="mr-1.5 h-4 w-4 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          {readingMinutes}
          {t.reading_time}
        </span>

        <span
          id="busuanzi_container_page_pv"
          class="inline-flex items-center whitespace-nowrap"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="mr-1.5 inline-block h-4 w-4 flex-shrink-0 text-gray-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
            ></path>
          </svg>
          <span class="whitespace-nowrap">
            {t.page_views}
            <span id="busuanzi_value_page_pv"></span>
          </span>
        </span>

        <ShareWidget
          url={new URL(Astro.url.pathname, Astro.site).toString()}
          title={shareTitle}
          text={shareText}
        />
      </div>
    </div>
  </header>

  {headings.length > 0 && <TableOfContents headings={headings} />}

  <div
    class="article-inner article-prose prose prose-sm sm:prose lg:prose-lg max-w-none py-7"
  >
    <slot />
  </div>

  <div class="article-inner flex items-center pb-2 text-sm text-gray-500">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class="mr-1.5 h-4 w-4 text-gray-400"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
      ></path>
    </svg>
    {t.last_updated}
    {updatedHuman}
  </div>

  <footer class="border-t border-gray-100 bg-gray-50 py-6">
    <div class="article-inner">
      <Terms tags={data.tags} />

      <PostNav prev={prev} next={next} />

      <div class="mt-6 flex justify-center">
        <a
          href="/"
          class="inline-flex items-center text-gray-600 transition-colors hover:text-blue-600"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="mr-2 h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
          </svg>
          {t.back_to_home}
        </a>
      </div>
    </div>
  </footer>
</article>

<div
  class="theme-card mx-auto mt-8 max-w-4xl overflow-hidden rounded-lg bg-white shadow-md"
  style="--tw-prose-body: #374151; --tw-prose-headings: #111827; --tw-prose-links: #2563eb; --tw-prose-links-hover: #1d4ed8; --tw-prose-code-bg: #f3f4f6; color: #374151;"
>
</div>
```

### Step 5: PostNav.astro

Only the `t` calls and the typed props change; the markup already matched Hugo. Replace
`src/components/PostNav.astro` with:

```astro
---
// Previous/next navigation from themes/void/layouts/_default/single.html (MIGRATION-PLAN.md §4).
// Class attributes are copied verbatim.
//
// Go template -> Astro:
//   $prev := .PrevInSection, $next := .NextInSection -> prev, next props, computed in
//                                                       src/pages/posts/[slug].astro
//   $prev.RelPermalink, $prev.Title                   -> /posts/<slug>/, prev.data.title
//   i18n "pagination_previous" | default "Previous"   -> t.pagination_previous (the key exists,
//                                                       so the default is never used)
import { t } from "../i18n/strings";
import type { Post } from "../lib/posts";

interface Props {
  prev: Post | null;
  next: Post | null;
}

const { prev, next } = Astro.props;
---

{
  (prev || next) && (
    <nav class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
      {prev && (
        <a
          href={`/posts/${prev.slug}/`}
          class="group block rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-blue-300 hover:bg-blue-50/30"
        >
          <div class="mb-1 flex items-center text-xs text-gray-500">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="mr-1.5 h-4 w-4 text-gray-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M15 19l-7-7 7-7"
              />
            </svg>
            {t.pagination_previous}
          </div>
          <div class="line-clamp-2 text-sm font-medium text-gray-900 group-hover:text-blue-700">
            {prev.data.title}
          </div>
        </a>
      )}

      {next && (
        <a
          href={`/posts/${next.slug}/`}
          class="group block rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-blue-300 hover:bg-blue-50/30 sm:col-start-2 sm:text-right"
        >
          <div class="mb-1 flex items-center text-xs text-gray-500 sm:justify-end">
            <span class="mr-0 sm:order-1 sm:ml-1">{t.pagination_next}</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="ml-1.5 h-4 w-4 text-gray-400 sm:order-2 sm:ml-1 sm:mr-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </div>
          <div class="line-clamp-2 text-sm font-medium text-gray-900 group-hover:text-blue-700">
            {next.data.title}
          </div>
        </a>
      )}
    </nav>
  )
}
```

### Step 6: ShareWidget.astro

Hugo puts the `data-share-*` attributes and a bare `data-share-widget` attribute on the `div.sm:ml-auto` itself.
The component had its own `div.share-widget` inside that `div`. The theme script (`assets/js/main.js`, plan §7)
finds the widget with `document.querySelectorAll("[data-share-widget]")`, so the extra wrapper would stop the button
from ever working. Until §7 is ported the button renders and does nothing, which is expected. Replace
`src/components/ShareWidget.astro` with:

```astro
---
// Share block from ../klub_biolocation/themes/void/layouts/_default/single.html
// (MIGRATION-PLAN.md §4). Class attributes are copied verbatim.
//
// The data attributes sit on the div.sm:ml-auto itself, exactly as in Hugo, and there is no
// extra wrapper element: the theme script (assets/js/main.js, still to be ported in plan §7)
// finds the widget with document.querySelectorAll("[data-share-widget]"). Until that script is
// ported the button renders but does nothing, which is expected.
//
// Go template -> Astro:
//   .Permalink, $shareTitle, $shareText         -> url, title, text props from ArticleLayout
//   i18n "share" | default "Share" (and others)  -> t.share, t.share_copied, ... (all keys exist)
import { t } from "../i18n/strings";

interface Props {
  url: string;
  title: string;
  text: string;
}

const { url, title, text } = Astro.props;
---

<div
  class="sm:ml-auto"
  data-share-widget
  data-share-url={url}
  data-share-title={title}
  data-share-text={text}
  data-share-label-default={t.share}
  data-share-label-success={t.share_copied}
  data-share-copy-summary-success={t.share_copy_summary_success}
  data-share-copy-failed={t.share_copy_failed}
>
  <button
    type="button"
    class="share-trigger inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm transition-colors"
    data-share-copy-summary
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M8.59 13.51l6.83 3.98M15.41 6.51L8.59 10.49"></path>
      <circle cx="18" cy="5" r="3"></circle>
      <circle cx="6" cy="12" r="3"></circle>
      <circle cx="18" cy="19" r="3"></circle>
    </svg>
    <span data-share-label>{t.share}</span>
  </button>
</div>
```

### Step 7: Terms.astro

The component did not follow `partials/terms.html`: no "Tags:" label, no tag icon, different colours and sizes, a
`#` prefix, lower-case names, and `px-2.55`, which is not a Tailwind class. Hugo prints the title-cased name
(`Hugo`, not `#hugo`) and a percent-encoded link with a trailing slash. Replace `src/components/Terms.astro` with:

```astro
---
// Port of ../klub_biolocation/themes/void/layouts/partials/terms.html (MIGRATION-PLAN.md §4),
// called from single.html with taxonomy "tags". Class attributes are copied verbatim.
//
// Go template -> Astro:
//   with $page.GetTerms "tags"      -> tags.length > 0 (the tag list from the front matter)
//   (index . 0).Parent.LinkTitle    -> "Tags", the taxonomy title Hugo prints; hard-coded
//   .RelPermalink                   -> /tags/<encodeSlug(urlize(tag))>/, percent-encoded like Hugo
//   .LinkTitle                      -> titleize(tag), e.g. "hugo" -> "Hugo"
//   i18n "tag_icon_title"           -> t.tag_icon_title
//
// Every chip repeats id="tagIconTitle". That duplicate id is in the Hugo output too; keep it.
import { t } from "../i18n/strings";
import { titleize } from "../lib/titleize";
import { encodeSlug, urlize } from "../lib/urlize";

interface Props {
  tags: string[];
}

const { tags } = Astro.props;
---

{
  tags.length > 0 && (
    <div class="tags-container">
      <div class="mb-2 font-medium text-gray-700 dark:text-gray-300">Tags:</div>
      <div class="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <a
            href={`/tags/${encodeSlug(urlize(tag))}/`}
            class="tag-chip inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-700 transition-colors hover:bg-blue-100 dark:bg-slate-800 dark:text-blue-300 dark:hover:bg-slate-700"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="mr-1.5 h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-labelledby="tagIconTitle"
              role="img"
            >
              <title id="tagIconTitle">{t.tag_icon_title}</title>
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
              />
            </svg>
            {titleize(tag)}
          </a>
        ))}
      </div>
    </div>
  )
}
```

### Step 8: TableOfContents.astro and a new src/lib/toc.ts

The component built a flat list of h2 and h3 with its own classes. Hugo prints `.TableOfContents` with the settings in
`hugo.toml` (`startLevel = 1`, `endLevel = 6`, unordered) inside `div.prose`, and nests every heading by level.
Because the posts start at h2, Hugo wraps the whole list in one empty top-level `<li>`. The Alpine.js toggle itself
is fine: `Head.astro` already loads Alpine from the CDN and `main.css` already has the `x-cloak` rule.

The show/hide condition moves into `ArticleLayout.astro` (step 4 already contains it). Inside a JSX expression
Prettier cannot parse Alpine's `@click` attribute, which is why `prettier --check` failed on this file.

Create `src/lib/toc.ts`:

```ts
import type { MarkdownHeading } from "astro";

// Rebuilds Hugo's .TableOfContents for this site's settings in ../klub_biolocation/hugo.toml:
// [markup.tableOfContents] startLevel = 1, endLevel = 6, ordered = false. Used by
// src/components/TableOfContents.astro (MIGRATION-PLAN.md §6, "TOC").
//
// Hugo nests every heading by its level counted from startLevel, and a level that has no
// heading of its own still gets a list item. Posts start at h2, so the whole list sits inside
// one empty top-level item: <ul><li><ul><li>First</li>...</ul></li></ul>. That wrapper is Hugo
// behaviour, verified on 2026-09-15 against Hugo's output for a post with h2, h3, h2 headings;
// do not "clean it up".
//
// Hugo takes the link text from the rendered heading HTML, Astro gives plain text. The two only
// differ for headings with inline markup such as code spans.
const startLevel = 1;
const endLevel = 6;

type TocNode = { heading?: MarkdownHeading; children: TocNode[] };

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderList(nodes: TocNode[]): string {
  if (nodes.length === 0) return "";
  const items = nodes.map((node) => {
    const link = node.heading
      ? `<a href="#${escapeHtml(node.heading.slug)}">${escapeHtml(node.heading.text)}</a>`
      : "";
    return `<li>${link}${renderList(node.children)}</li>`;
  });
  return `<ul>${items.join("")}</ul>`;
}

/** Hugo's TOC nav element as HTML, or an empty string when the post has no headings. */
export function tocHtml(headings: MarkdownHeading[]): string {
  const root: TocNode = { children: [] };
  for (const heading of headings) {
    if (heading.depth < startLevel || heading.depth > endLevel) continue;
    let parent = root;
    for (let level = startLevel; level < heading.depth; level++) {
      if (parent.children.length === 0) parent.children.push({ children: [] });
      parent = parent.children[parent.children.length - 1];
    }
    parent.children.push({ heading, children: [] });
  }
  const list = renderList(root.children);
  return list ? `<nav id="TableOfContents">${list}</nav>` : "";
}
```

Replace `src/components/TableOfContents.astro` with:

```astro
---
// Port of the collapsible table of contents in
// ../klub_biolocation/themes/void/layouts/_default/single.html (MIGRATION-PLAN.md §4 and §6).
// The markup is copied verbatim; .TableOfContents itself is rebuilt by tocHtml() in
// src/lib/toc.ts. The open/close toggle is Alpine.js, which Head.astro already loads from the
// CDN exactly as the theme does, and main.css already carries the x-cloak rule.
//
// Go template -> Astro:
//   .TableOfContents, then the replaceRE sanitising  -> tocHtml(headings). Hugo strips on*,
//                                                      style and class attributes and external
//                                                      hrefs; tocHtml() never emits any of them.
//   if gt (len ($tocSanitized | plainify)) 0         -> headings.length > 0, checked in
//                                                      ArticleLayout.astro. The condition lives
//                                                      in the parent because Prettier cannot
//                                                      parse Alpine's @click attribute inside a
//                                                      JSX expression.
//   i18n "table_of_contents"                         -> t.table_of_contents
import type { MarkdownHeading } from "astro";
import { t } from "../i18n/strings";
import { tocHtml } from "../lib/toc";

interface Props {
  headings: MarkdownHeading[];
}

const { headings } = Astro.props;
const toc = tocHtml(headings);
---

<div class="article-inner pt-6" x-data="{ open: false }">
  <button
    class="flex w-full items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-200 dark:hover:bg-slate-700"
    @click="open = !open"
    aria-controls="toc-content"
    :aria-expanded="open.toString()"
  >
    <span>{t.table_of_contents}</span>
    <svg
      x-show="!open"
      xmlns="http://www.w3.org/2000/svg"
      class="h-4 w-4"
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fill-rule="evenodd"
        d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"
        clip-rule="evenodd"></path>
    </svg>
    <svg
      x-show="open"
      xmlns="http://www.w3.org/2000/svg"
      class="h-4 w-4"
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fill-rule="evenodd"
        d="M5 9a1 1 0 000 2h10a1 1 0 100-2H5z"
        clip-rule="evenodd"></path>
    </svg>
  </button>
  <div
    id="toc-content"
    x-cloak
    x-show="open"
    x-transition
    class="mt-3 rounded-md border border-gray-100 bg-white p-4 text-sm leading-relaxed"
  >
    <div class="prose prose-sm max-w-none" set:html={toc} />
  </div>
</div>
```

### Step 9: add formatDateTime() to src/lib/date.ts

Append at the end of `src/lib/date.ts`. It reuses the `+03:00` front-matter offset that the file already documents:

```ts
// Hugo layout "2006-01-02T15:04:05-07:00", used for the datetime attribute of a post date.
export function formatDateTime(date: Date): string {
  const d = shifted(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  const offset = Math.abs(FRONT_MATTER_OFFSET_MINUTES);
  const sign = FRONT_MATTER_OFFSET_MINUTES < 0 ? "-" : "+";
  const time = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
  return `${formatIsoDate(date)}T${time}${sign}${pad(Math.floor(offset / 60))}:${pad(offset % 60)}`;
}
```

### Colours: nothing to pin

The components use `blue-50`, `blue-100`, `gray-50`, `gray-100` and `gray-200`, which `tailwind.config.cjs` does not
pin. That is correct: converted from `reference/hugo-main.css`, their Tailwind 4 values are identical to the
Tailwind 3 defaults (`#eff6ff`, `#dbeafe`, `#f9fafb`, `#f3f4f6`, `#e5e7eb`). The other colours they use are already
pinned. See README, "The palette is pinned to the Tailwind 4 values".

## 4. Part B: the footer script tag (breaks npm run dev and npm run check today)

`src/components/Footer.astro` contains a malformed element: the `>` closes the opening tag before `src`, so the URL
ends up as the element's text. It is the cause of three failures on `main` right now:

- `npm run dev` logs `Failed to scan for dependencies from entries ... Unexpected end of file`, pointing at
  `Footer.astro`. This is the pitfall described in `CLAUDE.md`: Vite's pre-scan reads script tags as plain text.
- `prettier --check` stops with `SyntaxError` in `Footer.astro`, so `npm run check` fails.
- `astro check` reports `Expression expected` at `Footer.astro:125`.

The element is not needed. In Hugo the counter script is loaded once, from `head.html` (`footer.html` even says so
in a comment), and `Head.astro` already ports that. Make three edits:

1. Delete the whole malformed element near the end of the file, from the line with the opening tag and `async` down to
   the line with the closing tag.
2. Delete the unused constant `busuanziScript` in the frontmatter together with the comment line above it. It holds
   the same tag inside a template literal, which is exactly what the Vite pre-scan trips over.
3. Fix the theme link: `https://github.com/Dauaucloud/hugo-theme-void` must be
   `https://github.com/Daucloud/hugo-theme-void`, as in `footer.html`.

Then run `npx prettier --write src/components/Footer.astro`. Verified: afterwards `npm run dev` starts without the
scan error, and `astro check` no longer reports anything in `Footer.astro`.

The footer as a whole is still plan step 5 (`partials/footer.html` -> `Footer.astro`). When porting it, compare the
rest against `footer.html` too; for example, the "Total visits" span is not in the Hugo footer.

## 5. Verification

Run, in this order:

```
npm run fix
npm run build
npm run check
npx astro dev --port 4387
```

Expected results, all measured on a copy of `main` with parts A and B applied:

- `npm run fix` formats the touched files; the code above is already in Prettier's style.
- `npm run build` is green and builds the same 15 routes as before. Route parity with
  `reference/hugo-routes.txt` differs only by the nine Hugo-only `/page/1/` aliases.
- `npm run check`: Prettier is clean. `astro check` still reports 11 errors, all in files outside this fix:
  3 in `SEO.astro`, 1 in `SocialMeta.astro`, 7 in `Base.astro`. See section 7.
- The dev server starts without `Failed to scan for dependencies`, and `/`, `/posts/article/` and
  `/posts/radiesthesia-and-energy-fields/` answer 200. Stop it by process id afterwards, not by closing the `npx`
  window (see `CLAUDE.md`, "Workflow").

Then look at `http://localhost:4387/posts/article/` in the browser, in both themes:

- Category chip, title, date, "0 min read", "Page Views", Share button.
- Body, then "Last updated on 2026-09-04".
- "Tags:" with blue chips `Hugo` and `Void`, then a "Next" card to the other post, then "Back to Home".
- An empty white card below the article: that is the Disqus card, empty in Hugo too.

Markup parity, as described in `CLAUDE.md`: compare the `<main>` region of `dist/posts/article/index.html` with
`../klub_biolocation/public/posts/article/index.html` (read only; do not rebuild Hugo). Remaining differences that
are expected:

- The Markdown body: `$E = mc^2$`, the `callout` shortcode shown as raw text, and typographic entities. That is the
  Markdown pipeline, plan §6.
- On posts with headings, Hugo adds a `heading-anchor` link inside every heading. Plan §7 (client-side JavaScript)
  covers the anchors.
- Whitespace inside the `style` attribute of the Disqus card, removed by Hugo's minifier.
- The Share button does nothing until `assets/js/main.js` is ported (plan §7).

## 6. Bookkeeping, then commit

`CLAUDE.md` asks for these when a `TODO` is done:

- `README.md`, "Skeleton status": add a row for the single-post layout (`single.html`, `partials/terms.html`) pointing
  at `src/layouts/Post.astro`, `src/layouts/ArticleLayout.astro` and the components; remove "the single-post layout"
  from the "Not done" sentence, together with the pointer to this file.
- `MIGRATION-PLAN.md`, "Progress": the row `§4 single.html -> Post.astro` moves from `Stub` to `Done`, with the note
  that the body waits on the §6 Markdown pipeline. Update the sentence below the table that says session 3 waits on
  `Post.astro`.
- `CLAUDE.md`, "Next steps": item 4 (`Post.astro`) is done apart from §6.
- Delete this file once the fix is merged, or keep it and mark it as applied at the top.

Commit messages in English, without the file list (git records it). Suggested split, so that each commit builds on
its own:

1. `Fix the footer script tag that breaks the dev server` (part B).
2. `Wire the article components into the post page` (part A and the bookkeeping).

Then `git push`, watch the "Deploy to GitHub Pages" run in the Actions tab, and open
`https://debi7.github.io/posts/article/`.

## 7. Other problems found in the same review (not fixed by this guide)

These are not needed for the article page, but `npm run check` stays red until they are fixed. The notes below are
based on reading the code and the Hugo output; they have not been built and verified like parts A and B.

### 7.1 The head is rendered three times

`Base.astro` renders `SEO.astro`, which renders `SocialMeta.astro` again, and `Head.astro` renders `SocialMeta.astro`
as well. The built `/posts/article/` therefore has two `<title>` elements (the first one empty), three
`og:title`, three `description` tags, and values that differ from Hugo:

- `og:site_name` is `Klub biolocation`. Hugo prints `Radiesthesia Club`, the `site.title` in `src/config.ts`.
  `Base.astro` defines a second local `site` object with the wrong title, which is also why `astro check` reports
  `Import declaration conflicts with local declaration of 'site'`.
- `og:locale` is `ru_RU`. Hugo prints `en_US` (`social_meta.html` only switches for `zh`).
- `og:image` points at `/images/default-share.png`, which does not exist. `hugo.toml` has no default share image, so
  Hugo falls back to the avatar: `/images/avatar.png`.
- `<meta name="robots">` is not in the Hugo output.
- For posts, Hugo prints `og:type` `article` plus `article:published_time`, `article:modified_time` and one
  `article:tag` per tag.

Suggested direction: port `partials/social_meta.html` verbatim into `SocialMeta.astro` (it is the plan §4 stub, and
`Head.astro` already renders it in the right place, after `<title>`), reusing helpers from `src/lib/seo.ts` where
they match. Then remove `<SEO>`, the local `site` and `page` objects and the extra `<meta charset>` from `Base.astro`,
and delete `SEO.astro`. That removes all 11 remaining `astro check` errors.

### 7.2 Smaller points

- `src/config.ts` gained `telegram: "@name"`, which the footer renders as `href="@name"`. The social values are still
  the placeholders from `hugo.toml`.
- `Base.astro` passes `content`, `isArticle`, `publishDate`, `updatedDate`, `tags` and `params`, which its `Props`
  do not declare. They disappear with 7.1.

### 7.3 Project conventions that apply to all of this

From `CLAUDE.md`, briefly:

- Code comments, docs and commit messages in English. Several new files have comments in another language.
- Every ported file opens with a comment naming its Hugo source and the plan section, then the Go template to Astro
  mapping, then the decisions that look like mistakes. The files in part A follow that shape.
- Copy class attributes verbatim from the Hugo template; do not restyle ported markup.
- Use `encodeSlug()` on any slug segment of a hand-built link (non-ASCII tags).
- Never write a literal script or style tag inside a comment or string in an `.astro` file (part B is that bug).
- Before calling a step done: `npm run fix`, `npm run check`, `npm run build`, and `npm run dev` once.
