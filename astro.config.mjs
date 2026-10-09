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
  site: "https://debi7.github.io/",

  trailingSlash: "always",
  build: { format: "directory" },

  integrations: [
    tailwind({ applyBaseStyles: false }),
    mdx(),
    alpinejs(),
    sitemap({
      filter: (page) =>
        !/\/page\/\d+\/$/.test(page) &&
        !/\/auth\//.test(page) &&
        !/\/admin\//.test(page),
    }),

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
    {
      name: "separate-vite-cache",
      hooks: {
        "astro:config:setup": ({ command, updateConfig }) => {
          const cacheDir =
            process.env.KB_VITE_CACHE_DIR ??
            (command === "dev" ? undefined : "node_modules/.vite-tools");
          if (cacheDir) updateConfig({ vite: { cacheDir } });
        },
      },
    },
  ],

  markdown: {
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeKatex],
    // Closest match to the theme's Chroma styles "github" / "github-dark" (see MIGRATION-PLAN.md §6).
    shikiConfig: {
      themes: { light: "github-light", dark: "github-dark" },
      wrap: false,
    },
  },

  devToolbar: {
    enabled: false, // это отключает панель devToolbar-Astro
  },

  i18n: {
    defaultLocale: "en",
    locales: ["ru", "en"],
    routing: {
      prefixDefaultLocale: true,
      redirectToDefaultLocale: false,
    },
  },
});
