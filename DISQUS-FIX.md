# Disqus comments on a post: how it works, and why it is built this way

Written on 2026-09-18. It describes the comments block as it stands now, the reason every part of it is shaped the
way it is, and how to run it and see it working. Everything quoted below is a measurement taken on this project:
`npm run check`, `npm run build`, the built pages in `dist/`, and the post page loaded in a browser.

## 1. What is in place

Three files:

- `src/components/Disqus.astro` - the component: the container, and the script that configures and loads the widget.
- `src/env.d.ts` - the declaration of the global that Disqus reads, and of the object it passes to the callback.
- `src/pages/posts/[slug].astro` - the post route, which supplies the two values that identify the comment thread.

The component in full:

```astro
---
export interface Props {
  url: string;
  identifier: string;
}

const { url, identifier } = Astro.props;
---

<div
  id="disqus_thread"
  class="mt-10 w-full"
  data-disqus-url={url}
  data-disqus-identifier={identifier}
>
</div>
```

Its script block, shown without the tag lines:

```js
const thread = document.getElementById("disqus_thread");
const url = thread?.dataset.disqusUrl;
const identifier = thread?.dataset.disqusIdentifier;

if (url && identifier) {
  window.disqus_config = function (this: DisqusPageConfig) {
    this.page.url = url;
    this.page.identifier = identifier;
  };

  const embed = document.createElement("script");
  embed.src = "https://biolocation-club.disqus.com/embed.js";
  embed.setAttribute("data-timestamp", new Date().toString());
  (document.head || document.body).appendChild(embed);
}
```

And the declarations, written once for the whole project:

```ts
interface DisqusPageConfig {
  page: { url: string; identifier: string };
}

interface Window {
  disqus_config?: (this: DisqusPageConfig) => void;
}
```

## 2. How it works, step by step

### 2.1 The route supplies the two values

```js
const postUrl = new URL(`/posts/${post.slug}/`, Astro.site).toString();
const postIdentifier = post.slug;
```

Disqus files every comment under a thread, and the thread is keyed by an identifier and a URL. Both have to be the
post's own, stable values: the identifier is the slug, the URL is the page's canonical address, built from
`Astro.site` in `astro.config.mjs` so that it is the same address whatever machine or port the page is opened from.

### 2.2 The values travel to the browser on the container

They are written onto the container as `data-disqus-url` and `data-disqus-identifier`, and the script reads them back
as `dataset.disqusUrl` and `dataset.disqusIdentifier`. The dash-to-camelCase conversion is the DOM's own.

Both reads are `string | undefined`: `getElementById` can return `null`, and an absent attribute reads as
`undefined`. That is what the `if` below is for.

### 2.3 The callback is published on `window`

`embed.js` looks for a global named `disqus_config` and calls it with its own configuration object as `this`. The
script block is compiled as a module, and a module has a scope of its own, so assigning to `window` is the only way
to hand the callback over.

The `if` does two jobs: it stops the block from doing anything on a page that has no container, and it narrows both
values from `string | undefined` to `string`, so the assignments inside need no further checks. TypeScript keeps that
narrowing inside the callback because both values are `const`.

### 2.4 `embed.js` is appended last

The widget script is created and appended only after the global exists, because `embed.js` reads it while it starts.
That order must not be rearranged.

### 2.5 What the build emits

Measured on the current build:

- The post page carries `data-disqus-url="https://debi7.github.io/posts/article/"` and
  `data-disqus-identifier="article"`.
- No Disqus JavaScript sits in the page itself: `grep -c disqus_config dist/posts/article/index.html` returns 0.
- The code lives in `dist/_astro/hoisted.nKnRmYZG.js`, 409 bytes, whose first statement imports
  `hoisted.BYbS_BGG.js` - the 2104-byte bundle every other page loads as well. The post page therefore shares the
  common script with the rest of the site and adds one small cached file, and pages without comments carry no Disqus
  code at all.
- In the bundle the types are gone and the callback is still a plain function:
  `window.disqus_config=function(){this.page.url=e,this.page.identifier=i}`.

## 3. Why it is built this way

### 3.1 Why the script block is not `is:inline`

The first version of this component put the script in a block marked `is:inline`, and wrote the callback as:

```js
var disqus_config = function (this: DisqusConfig) {
```

`this: DisqusConfig` is TypeScript. An `is:inline` block is copied into the page exactly as written and never
compiled, so the browser read that line itself and stopped:

```
Uncaught SyntaxError: Unexpected token 'this'
```

A syntax error kills the whole block, including the lines below it that load `embed.js`, so `#disqus_thread` stayed
empty on every post.

Where it was caught matters as much as what it was:

- `npm run build` was green: 16 pages, no error. The build never parses an `is:inline` block as JavaScript, it only
  copies it.
- `npm run check` was not green. It reported the real error all along:

  ```
  src/components/Disqus.astro:21:39 - error ts(8010): Type annotations can only be used in TypeScript files.
  ```

  Re-measured on 2026-09-18 by taking the file out of git with `git show 1116d24^:src/components/Disqus.astro` and
  running `astro check` against it.

A block the browser parses verbatim cannot carry types at all. A compiled block can, so the block is an ordinary
Astro script block now: Astro compiles it, Vite bundles it, and `npm run check` type-checks it. That is why
`this: DisqusPageConfig` can be written in the code itself.

### 3.2 Why data attributes instead of `define:vars`

`define:vars` is the directive that passes frontmatter values into a script, and it only works on an `is:inline`
block. Giving it up is the price of a compiled block, and the replacement is the way Astro documents for this exact
case: put the values on an element as `data-` attributes and read them back from `dataset`. The same shape is already
used by `DisqusLazy.astro` in this project.

It is also the smaller footprint. `define:vars` inlines the values, and the whole block with them, into every page
that renders the component; data attributes leave the code in one cached bundle and put two short strings in the
HTML.

### 3.3 Why the props have no defaults

They used to have them:

```js
const { url = site.social.github, identifier = "my-post" } = Astro.props;
```

Since the identifier keys the thread, any page that rendered `<Disqus />` without props would have filed its comments
into a thread called `my-post`, shared with every other such page. Nothing would have reported it: it is not a broken
build, it is wrong data in a third party's database, and moving a thread afterwards is manual work in the Disqus
admin.

With the defaults gone the props are required, and the same mistake is caught by `npm run check`:

```
ts(2322): Type '{}' is missing the following properties from type 'Props': url, identifier
```

Measured on 2026-09-18. Note that `npm run build` still does not catch it, because the build does not type-check at
all - which is why the check belongs in the workflow before a commit and not only in the editor.

### 3.4 Why the URL comes from `Astro.site`

It used to be built from the link shown in the footer:

```js
const postUrl = `${site.social.github}/posts/${post.slug}`;
```

That produced `https://debi7.github.io//posts/article` on the built page: a double slash, and no trailing slash.
Since the URL is half of the thread key and is also what Disqus shows as the thread's address, it has to be the
page's own canonical address. `new URL("/posts/<slug>/", Astro.site)` gives exactly that, with the trailing slash the
rest of the site uses.

### 3.5 Why `this`, and why not an arrow function

`this` is not something the component sets. `embed.js` calls the callback with its own configuration object as
`this`, which is why writing into `this.page` configures the widget. `this: DisqusPageConfig` in the signature is a
TypeScript "this parameter": it only tells the checker what `this` will be, and the compiler removes it, as the
bundle in section 2.5 shows.

That also rules out an arrow function:

```js
// This breaks the widget:
window.disqus_config = () => {
  this.page.url = url;
};
```

An arrow function has no `this` of its own; it takes the one from the place where it is written, which here is the
module. `this.page` would then be undefined and Disqus would get no configuration.

## 4. What the tools catch, and what they do not

Measured on 2026-09-18, each case put into a throwaway `.astro` file and run through `astro check`:

- TypeScript syntax in an `is:inline` block: **caught**, `ts(8010) Type annotations can only be used in TypeScript
files`.
- A type error in a compiled script block, such as `const n: number = "not a number"`: **caught**, `ts(2322)`.
- `window.disqus_config = function (this: DisqusPageConfig) {...}` in a compiled block: **accepted**, no diagnostic.
  This is the measurement the current implementation rests on.
- `<Disqus />` with no props: **caught**, `ts(2322)`, as quoted in 3.3. With the old defaults it was not caught at
  all.

Two conclusions follow:

1. `npm run build` never type-checks and caught none of these. `npm run check` is the tool that does.
2. Not even the checker sees a wrong thread key, because a wrong key is valid code. That one is found only by loading
   the page and looking at what the widget asked for - see section 7.

## 5. Where it stays dangerous

Typing removes a class of mistakes. It does not remove these.

**The thread key is data in somebody else's database.** Disqus files comments under `t_i` (the identifier) and `t_u`
(the url). If either changes, the comments do not vanish, but they stop appearing under the post, and putting them
back is manual work in the Disqus admin. The key changes if a post slug is renamed, if the component is called with
different values, or if `site` in `astro.config.mjs` changes. Treat the identifier as permanent once a post is
published.

**The type declaration is an assertion, not a verification.** Disqus ships no type definitions with `embed.js`. The
shape in `src/env.d.ts` is our description of their contract, taken from their documentation. If Disqus changes it,
the project stays green and the widget breaks in the browser. TypeScript guarantees that our code agrees with itself,
nothing more.

**`window.disqus_config` is a global name.** A second widget on the same page, or any other script writing that name,
would silently overwrite the configuration. The component is currently the only writer, and that is worth keeping.

**`embed.js` is a third-party script with full access to the page.** That is what a comments widget is; it is listed
here so the choice stays visible.

## 6. Rules for this kind of code

- Treat an `is:inline` block as source code for the browser, not for the project. Nothing that needs checking belongs
  in it, and everything in it, comments included, reaches the visitor.
- Never accept "the build is green" as evidence about such a block. Run `npm run check` and read what it says.
- Prefer a `data-` attribute plus a compiled script block as soon as the code is more than a couple of lines.
- For this component the acceptance test is the thread key, because that is the part that cannot be undone: the
  widget frame must carry `t_i=<slug>` and `t_u=<canonical url>`.

## 7. Running it locally, and what you should see

```
npm run dev
```

Open `http://localhost:4321/posts/article/` and scroll to the bottom of the article. Below the horizontal rule the
Disqus block appears; the first load takes a few seconds, because the widget is fetched from Disqus.

What a working page looks like:

- The widget renders where the container is: the reaction bar, the comment count, an empty comment box, the sign-in
  options and the Disqus footer. Its interface language comes from the Disqus site settings, not from this project.
- The browser console has no red errors.
- In the console, `typeof window.disqus_config` is `"function"` and `typeof window.DISQUS` is `"object"`.
- In the Elements panel the container `#disqus_thread` holds the Disqus frames, and the widget frame's `src` contains
  `t_i=article` and `t_u=https://debi7.github.io/posts/article/`. Those two are the thread key: the identifier is the
  slug, and the URL is the canonical address, not the localhost address the page was opened from.

Measured on 2026-09-18 against the dev server and against the built site, both in headless Edge: no console errors or
warnings, `window.disqus_config` a function, `window.DISQUS` an object, one `embed.js` script tag, the widget frame
`dsq-app` sized 672x649 inside the container, the thread key as quoted above, and the widget itself drawn in a
screenshot of the page.

One measurement artefact worth knowing, so that nobody reads it as a defect: a headless screenshot taken with
`--virtual-time-budget` shows the Disqus notice "Disqus seems to be taking longer than usual". The virtual clock is
what causes it. The same page captured in real time renders the widget completely.

The full set of checks, all green on the same day:

- `npm run fix` - nothing to reformat.
- `npm run check` - 0 errors, 0 warnings.
- `npm run build` - 16 pages.
- `npm run dev` - starts clean and serves the post page.
