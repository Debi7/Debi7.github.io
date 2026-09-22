// See MIGRATION-PLAN.md, section 3.2.
//
// The theme's templates use Tailwind 3 class names but the Hugo site compiles them with
// Tailwind 4, whose defaults differ. The rendered site is the v4 result, so this config
// makes Tailwind 3 emit the same values for the same class names. Every number below was
// read from the compiled Hugo stylesheet (reference/hugo-main.css).

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./src/**/*.{astro,html,md,mdx,js,ts}"],
  theme: {
    extend: {
      // Same stacks as the @theme block in themes/void/assets/css/main.css.
      // Mirrored as CSS variables in src/styles/main.css for rules that use var(--font-*).
      // Changed 2026-09-19: the three colours below were added in commit 125643b as a second
      // `colors` key of this `extend` object. A JavaScript object literal keeps only the last
      // of two equal keys, and the pinned palette further down is the last, so Tailwind never
      // saw them and no `bio-*` class existed - checked by loading this file in node, which
      // listed the five pinned colour keys and none of these. They now sit, unchanged, at the
      // top of that `colors` block; the original lines stay here for the record:
      // colors: {
      //   "bio-mint": "#f2f7f5", // Серый с легким мятным/зеленым дыханием
      //   "bio-lavender": "#f4f3f7", // Серый с тончайшим лавандовым (духовным) отливом
      //   "bio-warm": "#f7f6f3", // Очень мягкий, благородный серо-кремовый
      // },
      fontFamily: {
        bilingual: [
          '"Source Serif 4"',
          '"Noto Serif SC"',
          '"Source Han Serif SC"',
          '"Source Han Serif CN"',
          '"Songti SC"',
          "STSong",
          "ui-serif",
          "serif",
        ],
        code: [
          '"IBM Plex Mono"',
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          '"Liberation Mono"',
          '"Courier New"',
          "monospace",
        ],
        ui: [
          '"IBM Plex Sans"',
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "sans-serif",
        ],
      },

      // Tailwind 4 did not merely re-encode the v3 palette in oklch, it re-tuned it.
      // Converted to sRGB, every colour the Hugo build emits differs from the v3 value of
      // the same name - imperceptibly for the greys (<= 3/255), visibly for the blues,
      // `green-600` (22/255) and `yellow-200`. `text-blue-600` is the link colour, so the
      // drift would be obvious on every page.
      //
      // These are the 19 colours the compiled Hugo stylesheet actually defines, converted
      // from its oklch values. Tailwind 4 tree-shakes the theme, so a colour class used for
      // the first time in a later step will NOT be listed here: re-derive the table from
      // reference/hugo-main.css when new colour classes appear. See MIGRATION-PLAN.md 3.2.
      colors: {
        // Added in commit 125643b (2026-09-19) as candidate light backgrounds with a faint
        // tint - mint, lavender and warm cream on grey - and moved here from the duplicate
        // `colors` key above, see the note there. Not used by any class yet, so they are not
        // in the Hugo stylesheet and there is nothing to check them against.
        "bio-mint": "#f2f7f5",
        "bio-lavender": "#f4f3f7",
        "bio-warm": "#f7f6f3",
        blue: {
          200: "#bedbff",
          300: "#8ec5ff",
          500: "#2b7fff",
          600: "#155dfc",
          700: "#1447e6",
          800: "#193cb8",
        },
        gray: {
          300: "#d1d5dc",
          400: "#99a1af",
          500: "#6a7282",
          600: "#4a5565",
          700: "#364153",
          800: "#1e2939",
          900: "#101828",
        },
        green: { 600: "#00a63e" },
        slate: {
          600: "#45556c",
          700: "#314158",
          800: "#1d293d",
          900: "#0f172b",
        },
        yellow: { 200: "#fff085" },
      },

      // v4 renders `shadow-sm` and bare `shadow` identically (Tailwind 3's `shadow` value).
      // Keep the class names, change the values.
      boxShadow: {
        sm: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
        DEFAULT:
          "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
      },

      // v4 preflight: `border` without a colour class renders currentColor, not gray-200.
      borderColor: { DEFAULT: "currentColor" },

      // Bare `ring` and `blur` produce nothing in the current (v4) build.
      // Neutralise them here instead of editing every template.
      ringWidth: { DEFAULT: "0px" },
      blur: { DEFAULT: "0" },
    },
  },
  // Deliberately empty: @tailwindcss/typography is NOT active in the Hugo build.
  // `prose` / `not-prose` are plain hook classes styled by main.css.
  plugins: [],
};
