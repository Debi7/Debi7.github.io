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
