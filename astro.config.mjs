import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import mdx from "@astrojs/mdx";
import remarkMath from "remark-math";
import alpinejs from "@astrojs/alpinejs";

export default defineConfig({
  // Публичный адрес деплоя на GitHub Pages (без базового пути)
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
    remarkPlugins: [remarkMath],
    // Closest match to the theme's Chroma styles "github" / "github-dark" (see MIGRATION-PLAN.md §6).
    shikiConfig: {
      themes: { light: "github-light", dark: "github-dark" },
      wrap: false,
    },
  },

  devToolbar: {
    enabled: false, // это отключает панель devToolbar-Astro
  },
});
