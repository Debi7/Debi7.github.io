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
```

## Skeleton status

The build is green and every Hugo route has an Astro file. **All five menu items are ported** - Home, Categories, Posts, Tags and About - along with every page they link to except the single-post layout. Everything still unported carries a `TODO(migration §N)` comment naming the exact Hugo source, and those pages render placeholder markup. [MIGRATION-PLAN.md](MIGRATION-PLAN.md) §4.1 tracks the work per menu item and gives the step-by-step procedure for porting one.

| Done                                                                                            | Where                                                           |
| ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Plan §2: route list and compiled CSS from a clean production Hugo build                         | `reference/hugo-routes.txt`, `reference/hugo-main.css`          |
| Plan §3.1: Astro 4, `@astrojs/tailwind` 5, Tailwind 3.4, MDX, remark-math, Prettier             | `package.json`, `astro.config.mjs`, `prettier.config.mjs`       |
| Plan §3.2: Tailwind 3 config that reproduces the Tailwind 4 rendering                           | `tailwind.config.cjs`                                           |
| Plan §3.2: `main.css` complete - head plus all 1,219 theme rules, verified against the Hugo CSS | `src/styles/main.css`                                           |
| Plan §3.3: `custom.css` copied unchanged                                                        | `src/styles/custom.css`                                         |
| Plan §4: base layout (`baseof.html`) and `<head>` (root `head.html` + fonts + CDN tags)         | `src/layouts/Base.astro`, `src/components/Head.astro`           |
| Plan §4: header, menu and theme toggle, plus a hamburger below 640px that Hugo does not have    | `Header.astro`, `Menu.astro`, `ThemeToggle.astro`               |
| Plan §4: home page - full-bleed carousel (now meeting the header), title block, menu buttons    | `src/pages/index.astro`, `src/components/Carousel.astro`        |
| Plan §4: Categories page (`category.terms.html`) - accordion, counts, dates, back-link          | `src/pages/categories/index.astro`                              |
| Plan §4: Posts list (`list.html`), shared with the per-category pages                           | `src/pages/posts/index.astro`, `src/components/PostList.astro`  |
| Plan §4: Tags page and every tag page (`tag.terms.html`, `tag.html`)                            | `src/pages/tags/index.astro`, `src/pages/tags/[slug].astro`     |
| Plan §4: About page (`about/single.html`)                                                       | `src/pages/about.astro`                                         |
| Plan §4: Hugo summary, month-day dates, year grouping                                           | `src/lib/summary.ts`, `src/lib/date.ts`, `src/lib/posts.ts`     |
| Plan §4: i18n strings (`en.toml`), term title-casing and Hugo-compatible date formatting        | `src/i18n/strings.ts`, `src/lib/titleize.ts`, `src/lib/date.ts` |
| Plan §7 (partial): theme toggle behaviour, ported early so the header button works              | `src/scripts/site.js`                                           |
| Plan §4: stubs for the remaining components and layouts, each naming its Hugo source            | `src/components/*.astro`, `src/layouts/Post.astro`              |
| Plan §5.1-5.4: content collections, draft filter, `urlize`, reading time, site settings         | `src/content/config.ts`, `src/lib/*.ts`, `src/config.ts`        |
| Plan §5.2: posts and About copied with YAML front matter                                        | `src/content/posts/*.md`, `src/content/pages/about.md`          |
| Plan §5: one route file per Hugo route, all wired to the collection                             | `src/pages/**`                                                  |
| Static assets copied (`static/` -> `public/`)                                                   | `public/favicon/`, `public/images/`                             |

Not done (in plan order): reference screenshots (§2 step 3), the remaining `TODO(migration ...)` stubs in `src/` - footer, the single-post layout (its components exist but are not wired in; [ARTICLE-PAGE-FIX.md](ARTICLE-PAGE-FIX.md) gives the verified fix), social meta, callout, Disqus (§4, §6), the rest of `site.js` (§7), the rehype plugins for code blocks and footnotes (§6), pagination once the site passes ten posts (§9), the `/page/1/` alias decision (§5.5).

### The palette is pinned to the Tailwind 4 values

Tailwind 4 did not just re-encode the Tailwind 3 palette in `oklch`, it re-tuned it. Converted back to sRGB, every colour the Hugo build emits differs from the Tailwind 3 colour of the same name: by at most 3/255 for the greys, but by 17/255 for `blue-600` (the link colour) and 22/255 for `green-600`. Left alone, the port would have rendered visibly different links on every page.

`theme.extend.colors` in `tailwind.config.cjs` therefore pins the 19 colours that differ to the Hugo values. Because Tailwind 4 tree-shakes its theme, `reference/hugo-main.css` only defines the colours the site uses **today**: when a later step introduces a colour class that is not in that table, re-derive it from the reference stylesheet instead of trusting the Tailwind 3 default. With the table in place all 41 `@apply` rules in `main.css` compile to values identical to the Hugo build.

### The active menu item is not highlighted

The Hugo menu partial merges an `active font-bold` class into the current item, but it does so next to a class attribute that is already there, so the rendered link carries **two** `class` attributes:

```html
<a class="px-2 py-1 ..." aria-current="page" class="active font-bold" href="/"
  >Home</a
>
```

Browsers keep the first and drop the second, and neither `.active` nor `.ancestor` is styled anywhere in the theme - so on the live Hugo site the current menu item looks exactly like the others. `Menu.astro` therefore emits only `aria-current`, which is the part that actually has an effect. Merging the two class lists would give this port a bold item where Hugo has a normal one. If the highlight is wanted later, that is a deliberate design change, not a port fix.

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
- The theme toggle exists twice - once in the header row, once in the panel - so it moved into `ThemeToggle.astro` and lost its `id`. Nothing referenced that id: the theme's CSS hooks on `.theme-toggle` and `.theme-toggle-btn`. `site.js` binds every `[data-theme-toggle]` and keeps both in the same aria state.

### `hidden` does nothing to an inline SVG from script

`element.hidden` is defined on `HTMLElement`. An inline `<svg>` is an `SVGElement`, so `icon.hidden = true` sets an ordinary JavaScript property and the element stays visible. Measured in a headless browser: the attribute stayed absent and the computed display stayed `block`. Writing `hidden` in the markup works, because that is a content attribute; only the script assignment is inert.

The hamburger swaps its two icons through Tailwind's `hidden` class, which is what every other conditional display in that file uses. The carousel keeps the attribute, because its markup already declares the initial state that way and the goal there is the smallest possible departure from the theme's script: only the two assignments changed, into `setAttribute` / `removeAttribute`. Before that fix the theme's pause button never changed its icon - on the Hugo site as much as here.

### Trial: the scrollbar is painted in the site's colours

`src/styles/custom.css` ends with a block marked TRIAL that sets `scrollbar-color` on `html`, so the browser's scrollbar takes the page background instead of showing a grey notch beside the full-bleed carousel. **To revert, delete that block** - it is self-contained, nothing refers to it, and no build step depends on it.

A page cannot paint under a classic scrollbar; that strip is browser chrome. Colouring it is the whole of what is available. Verified by screenshot in both themes.

### `npm run build` does not catch everything

`astro dev` and `astro build` do not read `.astro` files the same way. Vite's dependency pre-scan, which only runs in dev, hunts for `script` and `style` tags with a plain text search that ignores the TypeScript frontmatter - so a literal script tag written inside a **comment** makes it parse the rest of that comment as JavaScript and the dev server fails with `Failed to scan for dependencies from entries`, while the production build stays green. `Head.astro` and `Carousel.astro` hit this; both now describe the tags in words. Run `npm run dev` as well as `npm run build` before calling a step done.

## Deployment

Not deployed yet. The first GitHub Pages attempt (the abandoned `github-pages` npm package, a branch named `gh-pages"` holding the source tree, no workflow) does not work; [DEPLOY.md](DEPLOY.md) explains why and gives the fix step by step. The public address is still to be decided, so that file is written against a `SITE_URL` placeholder with a decision record at the top.

## Layout

```
astro.config.mjs        Astro config (trailing slashes, Tailwind, MDX, Shiki themes)
tailwind.config.cjs     Tailwind 3 config tuned to match the Tailwind 4 rendering
src/config.ts           Site title, menu, social links, avatar (was hugo.toml)
src/content/            posts/ and pages/ collections, schema in config.ts
src/layouts/            Base.astro (page frame), Post.astro (single post)
src/components/         Head, Header, Menu, ThemeToggle, Carousel, Footer, Callout, Disqus
src/pages/              Routes: index, about, 404, posts/, tags/, categories/
src/lib/                getPosts / getTerms / readingTime, urlize, titleize, date
src/i18n/strings.ts     Theme UI strings, ported from the theme's en.toml
src/styles/             main.css (theme), custom.css (colour overrides, loaded last)
src/scripts/site.js     Client-side behaviour (theme toggle, copy buttons, ...)
public/                 Favicons and images, copied as-is
reference/              Hugo build artefacts used for parity checks; git-ignored by Prettier only
```
