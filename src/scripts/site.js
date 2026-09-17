// Site-wide client script. Imported once from src/layouts/Base.astro; Astro bundles it.
//
// TODO(migration §7): copy, verbatim, the remaining inline script blocks in
//   ../klub_biolocation/themes/void/layouts/partials/head/js.html
//     (code copy buttons, footnote back-links, hash highlight, TOC active state,
//      heading anchor copy)
// and the whole of
//   ../klub_biolocation/themes/void/assets/js/main.js
// Not the theme bootstrap (localStorage -> `dark` class): that one stays inline in
// src/components/Head.astro so it runs before the stylesheets load.

// --- Theme (dark / light) ---
// Ported ahead of §7 because the header's toggle button is useless without it.
// Verbatim from the themeInit block in head/js.html, including the DOMContentLoaded
// wrapper: Astro emits this bundle as a deferred module, which still runs before
// DOMContentLoaded fires, so the timing matches Hugo's.
document.addEventListener("DOMContentLoaded", function () {
  // --- Math ---
  // Also ported ahead of §7. The CDN tag in Head.astro calls `renderMathInElement` with no
  // options, and KaTeX's DEFAULT delimiters are `$$...$$`, `\(...\)` and `\[...\]` - single
  // `$...$` is not among them. The theme enables it with this second call, so without it a
  // formula written as `$E = mc^2$` stays visible as source text. That shows up on the Posts
  // page, whose summary for article.md contains exactly that.
  renderMathInElement(document.body, {
    delimiters: [
      { left: "$$", right: "$$", display: true },
      { left: "$", right: "$", display: false },
    ],
    throwOnError: false,
  });

  (function themeInit() {
    const storageKey = "theme";
    const root = document.documentElement;
    // Two buttons, not one: the header row carries a switch at 640px and up, the responsive
    // drop-down panel carries the other one below that. Only ever one of them is displayed,
    // but both are in the document, so both are bound and both are kept in the same aria
    // state. Hugo has a single #theme-toggle; see ThemeToggle.astro for why the id is gone.
    const btns = document.querySelectorAll("[data-theme-toggle]");

    function systemPrefersDark() {
      return (
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
      );
    }

    function currentPref() {
      const v = localStorage.getItem(storageKey);
      if (v === "dark") return "dark";
      if (v === "light") return "light";
      return systemPrefersDark() ? "dark" : "light";
    }

    function apply(theme) {
      root.classList.toggle("dark", theme === "dark");
      Array.prototype.forEach.call(btns, function (btn) {
        btn.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
        btn.setAttribute(
          "aria-label",
          theme === "dark" ? "Switch to light mode" : "Switch to dark mode",
        );
      });
    }

    let theme = currentPref();
    apply(theme);

    Array.prototype.forEach.call(btns, function (btn) {
      btn.addEventListener("mousedown", function (e) {
        e.preventDefault();
      });

      btn.addEventListener("click", function () {
        theme = theme === "dark" ? "light" : "dark";
        localStorage.setItem(storageKey, theme);
        apply(theme);
        btn.blur();
      });
    });

    // Watch system preference changes when user has no explicit choice
    try {
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = function () {
        const explicit = localStorage.getItem(storageKey);
        if (!explicit) {
          theme = currentPref();
          apply(theme);
        }
      };
      media.addEventListener("change", handler);
    } catch (_) {}
  })();

  // --- Responsive menu ---
  // No counterpart in Hugo: the theme's answer below 640px is to let the header scroll
  // sideways, which hides menu items behind a scrollbar. Added 2026-09-09 at the owner's
  // request. Markup is in Header.astro; this only drives it.
  //
  // The panel's visibility is the `hidden` attribute, not a class, so that the `sm:hidden`
  // utility on the same element stays authoritative above 640px: whatever state the panel was
  // left in, widening the window hides it. The media query below keeps aria-expanded honest
  // when that happens, since CSS cannot update an attribute.
  (function menuInit() {
    const btn = document.getElementById("menu-toggle");
    const panel = document.getElementById("site-menu");
    if (!btn || !panel) return;

    const iconOpen = btn.querySelector('[data-menu-icon="open"]');
    const iconClose = btn.querySelector('[data-menu-icon="close"]');

    function setOpen(open) {
      panel.hidden = !open;
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      btn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      // A class, not the `hidden` property: these are SVG elements, and `hidden` is defined
      // on HTMLElement only, so assigning to it would silently do nothing. Verified in a
      // headless browser before this was written.
      if (iconOpen) iconOpen.classList.toggle("hidden", open);
      if (iconClose) iconClose.classList.toggle("hidden", !open);
    }

    function isOpen() {
      return btn.getAttribute("aria-expanded") === "true";
    }

    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      setOpen(!isOpen());
    });

    // A tap anywhere else closes the panel. The listener sits on the document, so clicks
    // inside the header have to be excluded explicitly - otherwise opening it would
    // immediately close it again.
    document.addEventListener("click", function (e) {
      if (!isOpen()) return;
      if (panel.contains(e.target)) return;
      if (btn.contains(e.target)) return;
      setOpen(false);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && isOpen()) {
        setOpen(false);
        btn.focus();
      }
    });

    try {
      const wide = window.matchMedia("(min-width: 640px)");
      const sync = function () {
        if (wide.matches && isOpen()) setOpen(false);
      };
      wide.addEventListener("change", sync);
    } catch (_) {}
  })();
});
