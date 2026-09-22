# Radiesthesia Club - Astro port

Astro 4 + Tailwind 3 rewrite of the Hugo site in `../klub_biolocation`. The Hugo project stays untouched as the visual reference until this one reaches parity. The step-by-step plan is [MIGRATION-PLAN.md](MIGRATION-PLAN.md); read its "Progress" section, then §4.1, before starting a session.

## Requirements

| Tool    | Version | Notes                                                |
| ------- | ------- | ---------------------------------------------------- |
| Node.js | 20.x    | Enforced by `engines` in `package.json` and `.npmrc` |
| npm     | 10+     | Ships with Node 20                                   |

```sh
npm ci
npm run dev        # http://localhost:4321/
npm run build      # dist/
npm run check      # astro check + prettier --check .
npm run fix        # prettier --write .
npm run check:pages          # after a build: every paginated list in dist/ (PAGINATION.md)
npm run check:pages:stress   # a temporary copy with 159 generated posts, built and checked twice
```

## Skeleton status

The build is green and every Hugo route has an Astro file. **All six menu items are ported** - Home, Categories, Posts, Video, Tags and About - along with every page they link to. Five of them were ported from Hugo by 2026-09-09; Video is the colleague's addition of 2026-09-20 to 2026-09-22 and has no Hugo counterpart ([VIDEO-PAGE.md](VIDEO-PAGE.md)). The single-post layout, the last page that rendered placeholder markup, shows the article since 2026-09-17, with the table-of-contents sidebar, the previous and next links, the share links and Disqus. Two `TODO(migration §N)` comments remain in `src/`, each naming the exact Hugo source: `Callout.astro` (§6) and the rest of `site.ts` (§7). [MIGRATION-PLAN.md](MIGRATION-PLAN.md) §4.1 tracks the work per menu item and gives the step-by-step procedure for porting one. `Plan §N` in the table below names the section of MIGRATION-PLAN.md a row belongs to; the rows are in the order the work was done, grouped by topic, not sorted by section.

| Done                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Where                                                                                                          |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Plan §2: route list and compiled CSS from a clean production Hugo build                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `reference/hugo-routes.txt`, `reference/hugo-main.css`                                                         |
| Plan §3.1: Astro 4, `@astrojs/tailwind` 5, Tailwind 3.4, MDX, remark-math, Prettier                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `package.json`, `astro.config.mjs`, `prettier.config.mjs`                                                      |
| Plan §3.2: Tailwind 3 config that reproduces the Tailwind 4 rendering                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `tailwind.config.cjs`                                                                                          |
| Plan §3.2: `main.css` complete - head plus all 1,219 theme rules, verified against the Hugo CSS                                                                                                                                                                                                                                                                                                                                                                                                                                               | `src/styles/main.css`                                                                                          |
| Plan §3.3: `custom.css` copied unchanged                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `src/styles/custom.css`                                                                                        |
| Plan §4: base layout (`baseof.html`) and `<head>` (root `head.html` + fonts + CDN tags)                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `src/layouts/Base.astro`, `src/components/Head.astro`                                                          |
| Plan §4: header, menu and theme toggle, plus a hamburger below 640px that Hugo does not have                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `Header.astro`, `Menu.astro`, `ThemeToggle.astro`                                                              |
| Plan §4: home page - full-bleed carousel (now meeting the header), title block, menu buttons                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `src/pages/index.astro`, `src/components/Carousel.astro`                                                       |
| Plan §4: Categories page (`category.terms.html`) - accordion, counts, dates, back-link                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `src/pages/categories/index.astro`                                                                             |
| Plan §4: Posts list (`list.html`), shared with the per-category pages and, since 2026-09-22, the Video list                                                                                                                                                                                                                                                                                                                                                                                                                                   | `src/pages/posts/[...page].astro`, `CardList.astro`                                                            |
| Plan §4: Tags page and every tag page (`tag.terms.html`, `tag.html`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `src/pages/tags/index.astro`, `tags/[slug]/[...page].astro`                                                    |
| Plan §9: every list split by year, 5 posts a page, through one component - [PAGINATION.md](PAGINATION.md); one button style on every list since the review - [REVIEW-FIXES.md](REVIEW-FIXES.md)                                                                                                                                                                                                                                                                                                                                               | `src/lib/lists.ts`, `ListByYear.astro`, `Pagination.astro`, `YearSwitcher.astro`, the `[...page].astro` routes |
| Plan §4: About page (`about/single.html`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `src/pages/about.astro`                                                                                        |
| Plan §4: Hugo summary, month-day dates, year grouping                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `src/lib/summary.ts`, `src/lib/date.ts`, `src/lib/posts.ts`                                                    |
| Plan §4: i18n strings (`en.toml`), term title-casing and Hugo-compatible date formatting                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `src/i18n/strings.ts`, `src/lib/titleize.ts`, `src/lib/date.ts`                                                |
| Plan §7 (partial): theme toggle behaviour, ported early so the header button works                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `src/scripts/site.ts`                                                                                          |
| Plan §4: stubs for the remaining components and layouts, each naming its Hugo source                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `src/components/*.astro`, `src/layouts/Post.astro`                                                             |
| Plan §5.1-5.4: content collections, draft filter, `urlize`, reading time, site settings                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `src/content/config.ts`, `src/lib/*.ts`, `src/config.ts`                                                       |
| Plan §5.2: posts and About copied with YAML front matter                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `src/content/posts/*.md`, `src/content/pages/about.md`                                                         |
| Content: headings in the ported posts, 21 new posts, templates - [CONTENT.md](CONTENT.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `src/content/posts/*.md`, `templates/`                                                                         |
| Plan §5: one route file per Hugo route, all wired to the collection                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `src/pages/**`                                                                                                 |
| Static assets copied (`static/` -> `public/`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `public/favicon/`, `public/images/`                                                                            |
| Video section: collection, list by year, a page per video, apart from the posts - [VIDEO-PAGE.md](VIDEO-PAGE.md)                                                                                                                                                                                                                                                                                                                                                                                                                              | `src/content/video/`, `src/lib/video.ts`, `VideoLayout.astro`, `src/pages/video/`                              |
| Not done (in plan order): reference screenshots (§2 step 3), the two `TODO(migration ...)` stubs in `src/` - `Callout.astro` (§6) and the rest of `site.ts` (§7) - the rehype plugins for code blocks and footnotes (§6), the `/page/1/` alias decision (§5.5). The footer, the head meta (`SEO.astro`) and Disqus are the colleague's own components, not ports; the footer's theme link typo is still open. The single-post layout left this list on 2026-09-17 and [ARTICLE-PAGE-FIX.md](ARTICLE-PAGE-FIX.md) section 0 says what is open. |

### The palette is pinned to the Tailwind 4 values

Tailwind 4 did not just re-encode the Tailwind 3 palette in `oklch`, it re-tuned it. Converted back to sRGB, every colour the Hugo build emits differs from the Tailwind 3 colour of the same name: by at most 3/255 for the greys, but by 17/255 for `blue-600` (the link colour) and 22/255 for `green-600`. Left alone, the port would have rendered visibly different links on every page.

`theme.extend.colors` in `tailwind.config.cjs` therefore pins the 19 colours that differ to the Hugo values. Because Tailwind 4 tree-shakes its theme, `reference/hugo-main.css` only defines the colours the site uses **today**: when a later step introduces a colour class that is not in that table, re-derive it from the reference stylesheet instead of trusting the Tailwind 3 default. With the table in place all 41 `@apply` rules in `main.css` compile to values identical to the Hugo build.

Two additions since (commit `125643b`, 2026-09-19). The light palette in `custom.css` is no longer the theme's: the page is `#f5f5f4` (Tailwind `stone-100`) and the panels `#fafaf9` (`stone-50`) instead of `gray-50` and white; dark mode is unchanged, and plan §9 records the departure. And `theme.extend.colors` holds three candidate light tints, `bio-mint`, `bio-lavender` and `bio-warm`, that no class uses yet; they were added as a second `colors` key, which JavaScript resolves to the last one, so they had no effect until they were moved into the pinned block. The original lines are kept as a comment there.

### The active menu item is highlighted

The Hugo menu partial merges an `active font-bold` class into the current item, but it does so next to a class attribute that is already there, so the rendered link carries **two** `class` attributes:

```html
<a class="px-2 py-1 ..." aria-current="page" class="active font-bold" href="/"
  >Home</a
>
```

Browsers keep the first and drop the second, and neither `.active` nor `.ancestor` is styled anywhere in the theme - so on the live Hugo site the current menu item looks exactly like the others, and until 2026-09-19 `Menu.astro` emitted only `aria-current` to render the same. That evening the owner asked for the highlight, so the classes are merged into the one attribute now: the current page's entry is bold (`active font-bold`), and the entry of the section the page belongs to is semibold (`ancestor font-semibold`) - what the theme's author wrote and never saw. The weight alone was too subtle to notice, so both also take the colours of the year switcher's highlighted button: `bg-blue-50 text-blue-700`, and `bg-slate-700 text-blue-300` in dark mode. The section match is wider than Hugo's: Posts covers the year pages and the articles, Tags every tag page and Categories every category page, where Hugo marked nothing; Home matches only the home page. The hamburger panel gets the same. Recorded as a design departure in plan §9.

### Links to tags and categories end with a slash

Hugo prints the tag chips on the cards, the "All Tags" link on a tag page and the category label above an article without a trailing slash (`/tags/hugo`, `/tags`, `/categories/blog`), and the port kept that for parity. Since 2026-09-19 they end with a slash: `astro.config.mjs` sets `trailingSlash: "always"`, and under it Astro's dev and preview servers answer the slash-less address with 404, which the owner ran into. GitHub Pages redirects such an address, so the live site had only paid a redirect for every click. The addresses of the pages are unchanged; `REVIEW-FIXES.md` section 5 has the details.

### The page content is its own stacking context

`main` in `Base.astro` carries `isolate` since 2026-09-19 evening. The reviewer found that hovering a social icon in the footer made the text of every tag chip flicker: the icon's hover scales it with a 200 ms transition, Chromium composites the animation and, not knowing where the element will end up, re-rasterises everything painted after it - and the chips (`z-20`) and the year numbers in the badges (`z-10`) were painted after the footer, because a positive `z-index` with no stacking context between it and the root lifts the element out of the page's paint order. With `main` as a stacking context they are painted where they stand. Nothing visible changes; the Hugo site has the same flicker. `REVIEW-FIXES.md` section 8 has the measurements.

### The card indent is gone on phones

The theme's list templates indent the post cards under the year badge by 2rem (`ml-8`), a timeline look. With the 48px of side gap a phone already has, the first card stood 80px from the left edge and 48px from the right, which the reviewer read as "shifted right". Since 2026-09-19 evening the class is `sm:ml-8` in `PostList.astro` and in the tag route: below 640px the cards span the column, 48px on both sides; from 640px up nothing changes. Every menu item and its sub-pages were checked at 390px and 360px for anything else off-centre; nothing is. `REVIEW-FIXES.md` section 9 has the measurements and how to look at the site at a phone width.

### Posts and videos stay apart

Since 2026-09-22 evening, the owner's rule: the two kinds of entry share code only on plain data. `src/lib/lists.ts` holds what every list shares - the published filter and order, the pages, the split by year, the year switcher's rule - and the two shapes the shared components render, a `Card` of a list and a `NavLink` of an article page. `src/lib/posts.ts` and `src/lib/video.ts` know their own collection and build those shapes from it; `CardList.astro`, `PostNav.astro` and `ArticleLayout.astro` (the article frame, on plain props, with a `media` slot) know no collection, and `Post.astro` and `VideoLayout.astro` map one entry onto the frame. No `Post | Video` and no check of an entry's collection exists in the tree; a third kind of entry would be one collection, one `lib/` file and one layout wrapper. `VIDEO-PAGE.md` section 4 has the reasoning and the checks.

### The comment widget owns its button, and the client script is TypeScript

A pass of Astro best practice on 2026-09-22, at the owner's request. Nothing a visitor sees changed; the built pages carry the same markup as before it. What changed:

- `Disqus.astro` renders the reveal button it binds to. Both article routes used to write that button out themselves - the same markup and the same label in two files - while the script inside the component looked it up by id, which made the component's contract something only a grep enforced. A route now renders one tag.
- The Disqus thread URL comes from `postUrl()` and `videoUrl()` in `src/lib/`, not from a path assembled in the route. A thread is keyed by that URL, so two definitions of an address are two ways to orphan every comment on the site.
- The comment-count script in `Base.astro` reads the shortname from `src/config.ts`, where the component already read it, and is requested over `https` rather than the protocol-relative `//`.
- `(window as any)` is gone from `Disqus.astro`. The type it was asserting away has been in `src/env.d.ts` since 2026-09-17.
- `src/components/DisqusLazy.astro` is deleted. It was wired nowhere, never published `disqus_config`, and still carried a `YOUR_SHORTNAME` placeholder, so anyone who used it would have loaded a stranger's thread; `DISQUS-FIX.md` section 9 used to warn about it instead.
- `src/scripts/site.js` is `src/scripts/site.ts`. As a `.js` file it was shipped to every visitor without `astro check` ever looking at it. The annotations it needed are documented in place; the emitted bundle is the same code.

### An article page now says it is an article

Fixed 2026-09-22, and it had been wrong since the head meta was written. `Base.astro` accepts `isArticle`, `isVideo`, `publishDate`, `updatedDate`, `tags` and `params`, turns them into the `PageLike` that `SEO.astro` reads, and `SEO.astro` uses them to choose `og:type` and to emit the dated meta. `ArticleLayout.astro` passed the title and the description and nothing else, and no other file passed them either - so every post and every video went out as `og:type="website"` with not one `article:*` tag, while `share_title` and `share_description` from the front matter reached the share buttons and stopped there. The code was all written; nothing connected it.

The frame passes those props now, from values it already held. A post is `og:type="article"` with `article:published_time`, `article:modified_time` and one `article:tag` per tag; a video is `og:type="video.other"` with `video:release_date` and `video:tag`, because Open Graph defines `article:*` only for the article type and a page should not describe itself with properties its type does not have. Lists and the home page stay `website`. Checked in the built HTML, not in the source.

That also put the last `astro check` warning to rest: `isVideo` had been accepted by `Base.astro` and never read.

### Math is typeset at build time

Until 2026-09-22 it was not typeset at all, and nobody had noticed because no page uses math yet. `Head.astro` loaded KaTeX from a CDN and `site.ts` called `renderMathInElement`, but `remark-math` had already consumed the dollars while the page was built: `$E = mc^2$` reached the browser as `<code class="language-math math-inline">E = mc^2</code>`, and KaTeX's auto-render scans text nodes for dollars, so it found nothing. Measured on a temporary post with an inline and a display formula - zero `.katex` nodes in the DOM, while `typeof renderMathInElement` was `function`, which put the fault in the Markdown pipeline rather than in the CDN or the call.

The owner chose the build-time repair. `rehype-katex` is configured next to `remark-math` in `astro.config.mjs`: remark-math parses the math out of the Markdown, rehype-katex turns it into KaTeX markup while the page is built, and `src/layouts/ArticleLayout.astro` imports `katex/dist/katex.min.css` from the npm package. The three KaTeX CDN tags in `Head.astro` and the client-side call in `site.ts` are gone with it. Verified the same way: `<span class="katex">` in the built HTML with no browser involved, and the KaTeX fonts hashed into `dist/_astro/`.

What that buys over the other repair (dropping `remark-math` so the dollars reach the client-side renderer, which is what Hugo does): the page arrives typeset instead of flashing its source, nothing about a formula depends on a third-party host answering, and no visitor-side JavaScript runs for maths at all. The stylesheet is imported in the article frame rather than in `Base.astro`, because a formula can only appear in an article body - a list shows summaries, which are truncated plain text - and Astro bundles CSS per page.

`rehype-katex@7` is the one dependency this added (25 KB; it brings `katex` itself, 2.8 MB in `node_modules`, most of it the fonts, of which only the faces a page actually uses are ever downloaded).

### The carousel runs under the header, and Hugo's does not

This is the one place where the port shows something different from Hugo on purpose, so do not "fix" it back.

`Base.astro` pushes the page content down by `pt-24` (6rem) because the header is `fixed`. The header is shorter than 6rem, so a band of page background used to show between the header and the top of the carousel. The carousel now begins at the top of the document - `margin-top: -6rem` cancels that offset exactly - and the header simply paints over its top 6rem. The same 6rem is added back to the carousel's height, so it still takes up its original space in the flow and the title block below it does not move; the strip the visitor can see grows by however tall the gap was.

It is written this way rather than as a measured offset because the header's height depends on the viewport, and the requirement was that the carousel meet the header at any screen size. With the carousel starting at zero there is no gap to measure and nothing to keep in sync. Trimming `pt-24` instead was rejected: that value is verbatim theme markup and every page uses it.

The practical consequence is that `/` can no longer be diffed against the Hugo screenshot as a whole. Everything below the carousel still matches; the reference image for the home page has to be retaken from the Astro build.

### The menu collapses into a hamburger below 640px

Hugo has no responsive menu. Its header is one horizontal row at every width, and below 640px the wrapper's `overflow-x-auto` lets that row scroll sideways - so on a phone some menu items sit behind a scrollbar. This port replaces that: under 640px the row and the theme toggle give way to a hamburger, and a panel drops down under the header carrying the five links plus the toggle.

One consequence needed a second fix. Hugo grows the menu at 640px, and between 640px and 767px the grown row no longer fits next to the title and the theme toggle - the toggle was cut off, and since the header is `fixed` there was nothing to scroll to. Those size bumps moved from `sm:` to `md:`, so the row stays compact until 768px. The hamburger threshold stayed at 640px, which is what the owner wanted.

At 768px and above nothing changed. The hamburger and the panel are both `sm:hidden`, so they are `display:none` at desktop widths, and `/about/`, `/tags/` and `/categories/` are byte-identical to the Hugo screenshots at 1280px after the change.

The About page's avatar doubles as a logo at the same breakpoint, so the narrow header reads as branding rather than as a bare line of text. It sits inside the existing home link, at 32px and round, and disappears above 640px with everything else that is not Hugo's.

Under 400px the wordmark itself gives way to its initials - "RC" - because the logo plus the full name no longer fit and `truncate` was rendering "Radiesthes...". The initials are derived from `site.title`, so renaming the site cannot leave a stale monogram behind, and the link carries `aria-label`, so the accessible name stays the full title at every width.

Three things fell out of it that are worth knowing before touching this code:

- The panel cannot live inside the `max-w-4xl` wrapper. That wrapper carries `overflow-x-auto`, and `overflow-x: auto` forces `overflow-y` to compute to `auto` as well, so anything hanging below the header would be clipped. The panel is therefore the wrapper's sibling, which is why `Header.astro` now emits the wrapper that used to sit in `Base.astro`.
- The logo is `inline-block` inside the link, not a flex child. Making the anchor a flex container would change how the link lays out at **every** width, and the desktop header has to stay byte-identical to Hugo.
- The theme toggle exists twice - once in the header row, once in the panel - so it moved into `ThemeToggle.astro` and lost its `id`. Nothing referenced that id: the theme's CSS hooks on `.theme-toggle` and `.theme-toggle-btn`. `site.ts` binds every `[data-theme-toggle]` and keeps both in the same aria state.

### `hidden` does nothing to an inline SVG from script

`element.hidden` is defined on `HTMLElement`. An inline `<svg>` is an `SVGElement`, so `icon.hidden = true` sets an ordinary JavaScript property and the element stays visible. Measured in a headless browser: the attribute stayed absent and the computed display stayed `block`. Writing `hidden` in the markup works, because that is a content attribute; only the script assignment is inert.

The hamburger swaps its two icons through Tailwind's `hidden` class, which is what every other conditional display in that file uses. The carousel keeps the attribute, because its markup already declares the initial state that way and the goal there is the smallest possible departure from the theme's script: only the two assignments changed, into `setAttribute` / `removeAttribute`. Before that fix the theme's pause button never changed its icon - on the Hugo site as much as here.

### Trial: the scrollbar is painted in the site's colours

`src/styles/custom.css` ends with a block marked TRIAL that sets `scrollbar-color` on `html`, so the browser's scrollbar takes the page background instead of showing a grey notch beside the full-bleed carousel. **To revert, delete that block** - it is self-contained, nothing refers to it, and no build step depends on it.

A page cannot paint under a classic scrollbar; that strip is browser chrome. Colouring it is the whole of what is available. Verified by screenshot in both themes.

### `npm run build` does not catch everything

`astro dev` and `astro build` do not read `.astro` files the same way. Vite's dependency pre-scan, which only runs in dev, hunts for `script` and `style` tags with a plain text search that ignores the TypeScript frontmatter - so a literal script tag written inside a **comment** makes it parse the rest of that comment as JavaScript and the dev server fails with `Failed to scan for dependencies from entries`, while the production build stays green. `Head.astro` and `Carousel.astro` hit this; both now describe the tags in words. Run `npm run dev` as well as `npm run build` before calling a step done.

### `@astrojs/alpinejs` is pinned to 0.4.9

Alpine.js comes from npm through the official `@astrojs/alpinejs` integration: `alpinejs()` in `astro.config.mjs`, with the `alpinejs` and `@types/alpinejs` packages next to it. The integration is pinned to exactly `0.4.9`, without a caret, on purpose. Do not upgrade it while the project is on Astro 4. `package.json` carries a short note to the same effect under its `"//"` key, because JSON has no comments.

**What broke.** Version 1.0.0 was installed first, and every page of `npm run dev` failed with `__vite_ssr_import_0__.createComponent is not a function`; the browser showed a page titled `TypeError`. `npm run build` stayed green, so only the dev server showed it.

**Why.** The integration adds a small Vite plugin that serves one virtual module, `virtual:@astrojs/alpinejs/entrypoint`. In 1.0.0 that plugin says "only for this module" through Vite hook filters (`resolveId` and `load` written as objects with a `filter`). Vite 5.4, the version Astro 4 ships, does not know hook filters and silently ignores them. The plugin therefore answered for every module in the project and replaced each one with its one-line stub, `export const setup = () => {}` - Astro's own runtime included, which is where `createComponent` should have come from. Version 0.4.9 checks the module id inside the hook itself; that is the only difference between the code of the two versions.

**Which version goes with which Astro.**

- `@astrojs/alpinejs` 0.4.9: Astro 4. Verified here.
- `@astrojs/alpinejs` 1.0.0: Astro 7. Its own development dependencies are Astro 7.0.0 and Vite 8. It was not tried on Astro 5 or 6, so do not assume it works there.
- The Alpine library itself does not depend on this choice: `alpinejs` 3.17.3 is the latest version and works with both.

**What moving to 1.x would take.** Read from the npm registry on 2026-09-17, not tried. The hard constraints in `CLAUDE.md` (Node 20, Astro 4, Tailwind 3.4) rule this out for now; the list is here so that the cost is known when that decision comes up.

- Node 22.12 or newer. Astro 7, `@astrojs/mdx` 8 and `prettier-plugin-astro` 1.0 all require it. That means changing `engines` in `package.json` (`.npmrc` enforces it with `engine-strict=true`), `node-version` in `.github/workflows/deploy.yml`, and `@types/node` from 20 to 22.
- `astro` from 4.16 to 7.x (latest 7.3.3, with Vite 8). Three major versions: the code has to go through the upgrade guides for Astro 5, 6 and 7 one by one.
- `@astrojs/mdx` from 3.1 to 8.x (latest 8.0.1). It requires `astro` ^7.2.6 and two new peer packages, `@astrojs/markdown-remark` and `@astrojs/markdown-satteri`.
- `@astrojs/tailwind` has no version for Astro 7: its latest, 6.0.2, supports Astro 3 to 5 and Tailwind 3 only. The supported route on Astro 7 is `@tailwindcss/vite`, which is Tailwind 4 and would undo the Tailwind 3 palette work described above. Keeping Tailwind 3 through a plain PostCSS config instead of the integration may be possible; not tried.
- `prettier-plugin-astro` from 0.14 to 1.0.
- `@astrojs/check` 0.9.10 is the latest; whether it supports Astro 7 was not checked.
- `@astrojs/alpinejs` to 1.0.0, `alpinejs` and `@types/alpinejs` unchanged.

**Measured on 2026-09-17:** with 1.0.0, `/` returned 500; with the integration removed from the config, 200; with 0.4.9, `npm run dev` answers 200 on `/`, `/posts/article/` and `/tags/` with no errors, `npm run build` builds 16 pages, and `astro check` reports 0 errors.

**Alpine is loaded once.** Until 2026-09-17 `Head.astro` also carried the CDN tag for Alpine, so every page loaded two copies and `alpine:init` fired twice (the toggle still worked). The tag was removed; a comment in `Head.astro` marks the spot. Measured afterwards in headless Edge on `/posts/article/`, with a temporary heading added so that the table of contents renders: `Alpine.version` is 3.17.3, the npm package; `alpine:init` fires once; the table of contents opens on the first click and closes on the second; the console shows no errors. The owner saw the same in a browser. No post has headings yet, so no page renders an Alpine element today. (Changed 2026-09-19: every post has headings now, so every post page renders the collapsible table of contents, an Alpine element; see [POST-SIDEBAR.md](POST-SIDEBAR.md).)

## Deployment

Not deployed yet. The first GitHub Pages attempt (the abandoned `github-pages` npm package, a branch named `gh-pages"` holding the source tree, no workflow) does not work; [DEPLOY.md](DEPLOY.md) explains why and gives the fix step by step. The public address is still to be decided, so that file is written against a `SITE_URL` placeholder with a decision record at the top.

## Layout

```
astro.config.mjs        Astro config (trailing slashes, Tailwind, MDX, Shiki themes)
tailwind.config.cjs     Tailwind 3 config tuned to match the Tailwind 4 rendering
src/config.ts           Site title, menu, social links, avatar, Disqus shortname, posts per page (was hugo.toml)
src/content/            posts/, video/ and pages/ collections, schema in config.ts
src/layouts/            Base.astro (page frame), ArticleLayout.astro (article frame, table-of-contents sidebar, media slot), Post.astro and VideoLayout.astro (a post, a video, mapped onto it)
src/components/         Head, Header, Menu, ThemeToggle, Carousel, Footer, Callout, Disqus, CardList (the cards of every list, was PostList), ListByYear, Pagination, YearSwitcher
src/pages/              Routes: index, about, 404, posts/, video/, tags/, categories/
src/lib/                lists (the order of every list, pages, years, the Card and NavLink shapes), posts (getPosts, getTerms, postCard, readingTime), video (getVideos, videoCard), urlize, titleize, date
src/i18n/strings.ts     Theme UI strings, ported from the theme's en.toml
src/styles/             main.css (theme), custom.css (colour overrides, loaded last)
src/scripts/site.ts     Client-side behaviour (theme toggle, responsive menu, ...)
public/                 Favicons and images, copied as-is
templates/              Templates for new posts: post.md (the rules for front matter and headings) and one per existing post; the steps are in CONTENT.md
scripts/                check-pagination.mjs, the check behind npm run check:pages (no dependencies)
reference/              Hugo build artefacts used for parity checks; git-ignored by Prettier only
```
