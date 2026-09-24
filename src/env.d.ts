/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface DisqusPageConfig {
  page: { url: string; identifier: string };
}

interface Window {
  disqus_config?: (this: DisqusPageConfig) => void;
}

interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL: string;
  readonly PUBLIC_SUPABASE_PUBLISHABLE_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
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
