# Disqus behind the "show comments" button: review of 14ebd4c and a8e3472

Written on 2026-09-18, in answer to the report that after the button was added the comments block appears and hides
on click, but the comments themselves do not load.

Short version:

- The button and the lazy loading work. Measured locally and on the live site, the widget loads in full after a
  click, with the right thread key and no console errors.
- The comments do not show because there are none. Every thread that could belong to these posts holds 0 comments.
- Separately, the component went back to `any` in two places. Section 5 proposes a one-line change that restores the
  types without touching the button, the `hidden` toggle or the lazy loading.

Everything below is a measurement, not an estimate.

## 1. What was tested

The component as it stands after the two commits: the container starts with the `hidden` class, the button with
`id="toggle-disqus-btn"` in `src/pages/posts/[slug].astro` toggles it, and `loadDisqus()` configures and appends
`embed.js` on the first click only.

Two places, both in headless Edge, clicking the button and then waiting 25 seconds in real time:

- a local build of the current `main`, served with `astro preview`;
- the live page, `https://debi7.github.io/posts/article/`, which already carries the button.

## 2. What happened after the click

The same in both places:

- The container lost `hidden` and became visible, and the button switched to its "hide comments" label.
- `window.disqus_config` was a function, `window.DISQUS` an object, and exactly one `embed.js` was on the page, so
  the click loaded the widget once.
- The widget frame `dsq-app` was 672 x 649 pixels inside the container. A widget that had failed to load would not
  have sized its frame.
- The frame carried `f=biolocation-club`, `t_i=article` and `t_u=https://debi7.github.io/posts/article/`: the right
  Disqus site, the slug as the identifier, and the canonical address.
- No console errors or warnings.
- One request failed: `https://links.services.disqus.com/api/ping`. That is a Disqus link and ad tracker, not part
  of the comments, and it fails the same way without the button.

What the widget showed: the reaction bar, a comment count of 0, an empty comment box with the sign-in options, a
"be the first to comment" line, and the DISQUS logo in its footer.

## 3. Why no comments appear

There are no comments to load. Disqus publishes comment counts through a public endpoint,
`https://biolocation-club.disqus.com/count-data.js`, which was queried for every key that could hold a thread for
these posts:

- identifier `article`: thread exists, 0 comments;
- identifier `radiesthesia-and-energy-fields`: thread exists, 0 comments;
- `https://debi7.github.io/posts/article/`: thread exists, 0 comments;
- `http://localhost:4321/posts/article/` and `http://localhost:4387/posts/article/`: threads exist, left over from
  local testing, 0 comments each;
- `https://debi7.github.io//posts/article`, the double-slash address an early version produced: no thread at all.

So nothing is stranded under an old key either. An empty widget with the DISQUS logo at the bottom is what a thread
with no comments looks like.

## 4. If only the spinning logo appears

If what you see is only the round Disqus "D" logo, with no comment box under it, and after a while the line "Disqus
seems to be taking longer than usual", then the frame is not loading in your browser. That is a browser matter, not
the code: ad blockers and tracking protection commonly block the Disqus frames.

To check:

- open the post in a private window with extensions off, or in another browser;
- or open DevTools, go to the Network tab, filter by `disqus`, click the button, and look for requests marked as
  blocked or failed other than the `api/ping` one above.

## 5. Proposal: restore the types

The callback is published with a cast and an `any` for `this`. The project rules do not allow `any`, and neither is
needed: `src/env.d.ts` still declares `DisqusPageConfig` and `Window.disqus_config` from the earlier typing work,
and the two commits did not touch that file.

Only one line changes. The button, the `hidden` toggle, `disqusLoaded` and the lazy loading stay as they are.

Before:

```ts
function loadDisqus() {
  if (disqusLoaded || !url || !identifier || !shortname) return;
  disqusLoaded = true;

  (window as any).disqus_config = function (this: any) {
    this.page.url = url;
    this.page.identifier = identifier;
  };

  const embed = document.createElement("script");
  embed.src = `https://${shortname}.disqus.com/embed.js`;
  embed.setAttribute("data-timestamp", new Date().toString());
  (document.head || document.body).appendChild(embed);
}
```

After:

```ts
function loadDisqus() {
  if (disqusLoaded || !url || !identifier || !shortname) return;
  disqusLoaded = true;

  // Typed by the Window and DisqusPageConfig declarations in src/env.d.ts, so no cast is needed.
  window.disqus_config = function (this: DisqusPageConfig) {
    this.page.url = url;
    this.page.identifier = identifier;
  };

  const embed = document.createElement("script");
  embed.src = `https://${shortname}.disqus.com/embed.js`;
  embed.setAttribute("data-timestamp", new Date().toString());
  (document.head || document.body).appendChild(embed);
}
```

Why it holds:

- The declaration in `src/env.d.ts` types both the assignment to `window` and the `this` inside the callback.
- The early return at the top of `loadDisqus()` already narrows `url`, `identifier` and `shortname` from
  `string | undefined` to `string`. They are `const`, so TypeScript keeps that narrowing inside the callback and no
  `!` is needed.
- Nothing changes at run time. Types are erased when the block is compiled, so `(window as any).disqus_config = ...`
  and `window.disqus_config = ...` produce the same JavaScript.
- The callback stays a `function`, not an arrow function: `embed.js` calls it with its own configuration object as
  `this`, and an arrow function would take `this` from the module instead.

Verified by applying the change to a temporary copy of the component and running `astro check`: 0 errors, 0
warnings. The copy was deleted afterwards; the component itself is unchanged until the change is agreed.

## 6. Proposal: test with a real comment

The only test that proves comments load end to end is to post one:

1. Open a post, click the button, and write a comment while signed in to Disqus.
2. Reload the page.
3. Open the same post again, click the button, and check that the comment is there.

It is best done by someone signed in to a Disqus account. The review was read-only and did not post: a guest comment
needs a name and an email to post under, Disqus often holds guest comments for moderation, so one might not appear
after a reload even though everything works, and the comment would be public on the live site.

## 7. Proposal: update DISQUS-FIX.md afterwards

`DISQUS-FIX.md` describes the version that loaded the widget with the page. Once section 5 is applied, it should be
updated to the button and the lazy loading, so that it describes the code as it is.

## 8. How to check after the change

```
npm run check
npm run build
npm run dev
```

Open `http://localhost:4321/posts/article/`, click the button under the article, and wait a few seconds. The widget
should appear with its comment box, the console should have no red errors, and the widget frame's `src` should
contain `t_i=article` and `t_u=https://debi7.github.io/posts/article/`.
