/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

// Added 2026-09-17: the global that Disqus reads. embed.js looks for window.disqus_config and
// calls it with its own configuration object as `this`, so the callback in
// src/components/Disqus.astro has to be published on window and needs a type for that `this`.
// Without this declaration a type checker reports
// "Property 'disqus_config' does not exist on type 'Window'" on the assignment.
//
// Amended 2026-09-18, when that component stopped using is:inline: the script block there is now
// compiled as a module, and a module has a scope of its own, so assigning to window is the only
// way to hand the callback to embed.js. Declaring a third party's global in a .d.ts file is the
// mechanism TypeScript provides for that; it is not a workaround for the rewrite.
//
// What it does not do is verify anything. Disqus ships no type definitions with embed.js, so the
// shape below is our own description of their contract, taken from their documentation. If Disqus
// ever changes it, this file stays green and the widget breaks in the browser.
interface DisqusPageConfig {
  page: { url: string; identifier: string };
}

interface Window {
  disqus_config?: (this: DisqusPageConfig) => void;
}

// Added 2026-09-22, when src/scripts/site.js became site.ts and came under astro check. KaTeX's
// auto-render extension publishes renderMathInElement as a global; it is loaded from a CDN tag in
// src/components/Head.astro, so nothing in the module graph declares it and TypeScript would
// otherwise report "Cannot find name 'renderMathInElement'".
//
// Declared as possibly undefined on purpose, rather than as a plain function. The CDN may fail to
// answer, and then the global is simply not there - that is not a hypothetical, it is what any
// blocked or slow third-party host does. Typing it as `| undefined` makes the compiler insist on
// the guard in site.ts instead of leaving it to a reviewer to remember why it is there.
//
// The options type is our own description of KaTeX 0.16.9's documented contract, like
// DisqusPageConfig above: auto-render ships no type definitions with the CDN build, so nothing
// here is verified against the real thing.
// Removed later the same day, together with the call it was written for: the math is typeset at
// build time by rehype-katex now, KaTeX is no longer loaded in the browser, and a declaration for a
// global that nothing can reference is worse than none - it would tell the next reader that the
// CDN tags are still there. The reasoning for the move is in astro.config.mjs. The note above is
// kept as the worked example of how a third party's global is declared here, should another one
// ever arrive: name it, type it from the vendor's documentation, and mark it `| undefined` when it
// comes from a tag that can fail to load.
