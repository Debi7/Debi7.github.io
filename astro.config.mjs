import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import mdx from "@astrojs/mdx";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import alpinejs from "@astrojs/alpinejs";
import sitemap from "@astrojs/sitemap";
// Disabled 2026-09-25, together with the output and adapter lines below; the reason is there.
// import node from "@astrojs/node";

export default defineConfig({
  // Disabled 2026-09-25. The colleague switched the project to
  // on-demand rendering on 2026-09-24 for the previous provider's sign-in, but the site is hosted on GitHub
  // Pages, which serves files and runs no Node process: the build then wrote dist/client/ and
  // dist/server/ instead of dist/index.html, the Pages artifact had no page at its root, and the
  // live site answered 404 from the merge of 2026-09-25 while the workflow reported success. With
  // the lines below commented out, output falls back to Astro's default, "static", which is what
  // the workflow uploads and what every check script expects of dist/. The sign-in runs in the
  // browser now (src/scripts/auth.ts), so nothing needs a server. Her lines are kept as written,
  // with her note, so the history reads in place; @astrojs/node itself left package.json the same
  // day.
  // (Reworded 2026-09-26 for the move to Clerk: the note named the previous auth provider and its
  // verdict file, which CLERK.md section 0 orders out of this branch. The lesson stands, and Clerk
  // keeps it: the sign-in runs in the browser, @clerk/astro is not used because it needs server
  // output, and the Clerk verdict in .specify/consilium/2026-09-25-clerk-static.md says so.)
  // output: "server", // Переводит проект в режим SSR
  // adapter: node({
  //   mode: "standalone",
  // }),

  // Публичный адрес деплоя на GitHub Pages (без базового пути)
  // (English, added 2026-09-22 next to the original note: the public GitHub Pages address, with no
  // base path. DEPLOY.md section 2 holds the placeholders and says a project site would need
  // `base` set here, which would break every root-relative link in the source.)
  site: "https://debi7.github.io/",

  // Hugo emits /path/index.html for every page; keep the same URLs.
  trailingSlash: "always",
  build: { format: "directory" },

  // applyBaseStyles: false - the Tailwind base layer is imported by src/styles/main.css so
  // that the order (base, theme rules, custom.css) stays under our control.
  // sitemap() goes last; the order of integrations does not matter here, and putting it at the end
  // keeps the three that affect how pages are built together at the front.
  integrations: [
    tailwind({ applyBaseStyles: false }),
    mdx(),
    alpinejs(),
    sitemap({
      // Extended 2026-09-25: the four pages under /auth/ (sign-up, sign-in, the mail callback and
      // the member's page) are for a visitor with a reason to be there, not for a search engine;
      // a crawler that indexed the callback would only ever see "the link is invalid".
      // Changed 2026-09-25, late evening, the owner's decision (AUTH.md section 10): the site is closed
      // to guests, so the sitemap lists the home page alone - the one page a guest may see and a search
      // engine may index. The filter it replaces:
      //   filter: (page) => !/\/page\/\d+\/$/.test(page) && !/\/auth\//.test(page),
      // Reopened on 2026-09-25 after the colleague's review (AUTH.md section 11): the site is open again, so the filter
      // it replaced is back.
      // Checked 2026-09-26 with the move to Clerk (CLERK.md step 6): the pages under /auth/ are
      // three now - sign-in, sign-up and the account page - and the rule keeps all three out.
      filter: (page) => !/\/page\/\d+\/$/.test(page) && !/\/auth\//.test(page),
    }),
    // Added 2026-09-28: the Clerk pre-bundling list, for `astro dev` only. It stood under `vite` at
    // the end of this file; the note there says why it moved.
    {
      name: "clerk-prebundle-dev-only",
      hooks: {
        "astro:config:setup": ({ command, updateConfig }) => {
          if (command !== "dev") return;
          updateConfig({
            vite: {
              optimizeDeps: {
                include: [
                  "@clerk/clerk-js",
                  "@clerk/ui",
                  "@clerk/localizations",
                  "react",
                  "react-dom",
                ],
              },
            },
          });
        },
      },
    },
    // Added 2026-09-30, after a dev server on a spare port broke the owner's. Every `astro dev` keeps
    // Vite's pre-bundled dependencies in node_modules/.vite, so two servers of this project share
    // one cache: the second one re-optimised it, was stopped half-way, and left no deps folder
    // behind, while the owner's server on 4321 still handed out the old hash - the sign-in page then
    // failed with "504 (Outdated Optimize Dep)" on the three Clerk bundles. With KB_VITE_CACHE_DIR
    // set, a server keeps its cache there instead; unset, nothing changes. CLAUDE.md, "Workflow",
    // asks every server started beside the owner's to set it.
    {
      name: "separate-vite-cache",
      hooks: {
        "astro:config:setup": ({ updateConfig }) => {
          const cacheDir = process.env.KB_VITE_CACHE_DIR;
          if (cacheDir) updateConfig({ vite: { cacheDir } });
        },
      },
    },
  ],

  markdown: {
    // remark-math only keeps $...$ / $$...$$ intact in Markdown. Rendering stays client-side
    // (KaTeX auto-render from CDN, as in the Hugo theme). Do not add rehype-katex.
    //
    // Superseded 2026-09-22, by the owner's decision. The note above describes behaviour
    // remark-math does not have: it does not keep the dollars, it consumes them. Measured in a
    // headless browser on a post with an inline and a display formula - `$E = mc^2$` reached the
    // page as `<code class="language-math math-inline">E = mc^2</code>`, with the dollars gone,
    // and KaTeX's auto-render scans text nodes for dollars, so it found nothing and typeset
    // nothing. Every formula on the site rendered as source text inside a code element, and had
    // done since the day remark-math was added.
    //
    // Both halves of the pair are configured now: remark-math parses the math out of the
    // Markdown, rehype-katex turns those nodes into KaTeX markup while the page is built. That
    // choice, over the other repair (drop remark-math and let the dollars through to the
    // client-side auto-render, which is what Hugo does), was made for three reasons: the page
    // arrives typeset instead of flashing its source until a CDN answers, the CDN is no longer a
    // dependency of the page rendering correctly, and no visitor-side JavaScript runs for it at
    // all. The stylesheet that KaTeX's markup needs is imported in src/layouts/Base.astro from
    // the npm package, so nothing about the math is fetched from a third-party host any more.
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeKatex],
    // Closest match to the theme's Chroma styles "github" / "github-dark" (see MIGRATION-PLAN.md §6).
    shikiConfig: {
      themes: { light: "github-light", dark: "github-dark" },
      wrap: false,
    },
  },

  devToolbar: {
    // (English, added 2026-09-22 next to the note on the line below: this switches off Astro's dev
    // toolbar, the overlay that would otherwise sit at the bottom of every page of `npm run dev`.)
    enabled: false, // это отключает панель devToolbar-Astro
  },

  // Added 2026-09-26 at the owner's request, after the sign-up form rendered nothing on a dev server
  // that had been running since before @clerk/ui was installed: the browser asked for Clerk's SignUp
  // chunk from node_modules/.vite/deps, Vite answered "504 (Outdated Optimize Dep)" because it had
  // just discovered the package and re-bundled its dependencies mid-session, and the dynamic import
  // failed. Listing the Clerk packages and React here makes Vite pre-bundle them when the dev server
  // starts instead of on the first visit to an auth page. It affects `astro dev` only; `astro build`
  // does not use the dependency optimizer. If the error still appears after a package change,
  // `npm run dev:clean` empties the cache (package.json says how).
  //
  // Corrected 2026-09-28, at the owner's request after "X [ERROR] The build was canceled" showed at
  // the top of every `npm run build`: the sentence above about `astro build` is wrong. The build
  // starts with the content sync, which runs a temporary Vite dev server
  // (syncContentCollections in node_modules/astro/dist/core/sync/index.js), and that server began
  // pre-bundling this list; the sync closed it about two seconds later, esbuild's bundling was cut
  // off, and esbuild printed that error. The built site was never affected. The list therefore left
  // `vite` for the integration "clerk-prebundle-dev-only" in `integrations` above, which adds it
  // through `updateConfig` only when the hook's `command` is "dev" (astro:config:setup, Astro 4
  // Integration API; 4.16 passes "dev", "build", "preview" or "sync").
  // Checked the same night: the build prints no such line, still builds every page, and its
  // `[types]` step fell from about 2 s to under 1 s; `astro dev` still pre-bundles the five
  // packages. One side effect, accepted: the sync's server now finishes, and writes Astro's own
  // three small dependencies into node_modules/.vite/deps, so the first `astro dev` after a build
  // bundles the list again, a few seconds once. Before, the cut-off run left that folder alone.
});
