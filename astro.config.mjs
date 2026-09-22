import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import mdx from "@astrojs/mdx";
import remarkMath from "remark-math";
// Added 2026-09-22: rehype-katex typesets the math nodes remark-math produces. See the note in
// the markdown block below for why the site moved to build-time rendering.
import rehypeKatex from "rehype-katex";
import alpinejs from "@astrojs/alpinejs";

export default defineConfig({
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
  integrations: [tailwind({ applyBaseStyles: false }), mdx(), alpinejs()],

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
});
