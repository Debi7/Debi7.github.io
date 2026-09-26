// The address of the member's page, spelled once: site.auth.dashboard below is the scripts' home
// for it, and since the evening of 2026-09-25 the menu has an item that opens it (the owner's
// word). A literal in both places would be the second spelling of one setting (CLAUDE.md, "One
// site-wide setting has one home"); the object cannot read its own field while it is being built,
// hence the constant.
// Renamed 2026-09-26 with the move to Clerk (CLERK.md step 2): the member's page is /auth/account/
// now, where Clerk's profile component is mounted, and the constant is accountPath to match. The
// note above still applies; read "site.auth.account" for "site.auth.dashboard".
const accountPath = "/auth/account/";

export const site = {
  title: "Radiesthesia Club",
  language: "ru",
  social: {
    github: "https://debi7.github.io/",
    email: "your.email@example.com",
    telegram: "@name",
  },

  avatar: "/images/avatar.png",
  carousel: { interval: 3000 },

  // Added 2026-09-18: the Disqus site the comments belong to. It used to be written into
  // src/components/Disqus.astro, which meant the one site-wide setting lived inside a component.
  // It is here so that a second place needing comments reads the same value instead of repeating
  // the string. Changing it moves every thread on the site to another Disqus account, so it is not
  // a per-page choice; the per-page values are the url and the identifier the component takes as
  // props. See DISQUS-FIX.md.
  disqus: { shortname: "biolocation-club" },

  // Added 2026-09-19, asked for by the owner: how many posts one page of a list shows - on
  // /posts/, /tags/<tag>/ and /categories/<category>/. Hugo's default is 10; the owner chose 5.
  // Lowering it is also the quickest way to see several pages with only a few posts. See
  // PAGINATION.md.
  //
  // everyNumberUpTo - added later on 2026-09-19, the owner's rule for the page numbers between
  // Previous and Next: a list with at most this many pages shows every page number; a longer one
  // shows only the first, the current and the last page, with an ellipsis between them. See
  // pageNumbers() in src/lib/posts.ts.
  //
  // everyYearUpTo - the same day, for the year switcher above the Posts list, which the owner
  // asked to keep separate from the page numbers: up to this many years every year is shown;
  // beyond it the newest, the oldest and the year being shown with its neighbours. See
  // yearSwitcher() in src/lib/posts.ts. scripts/check-pagination.mjs reads all three values.
  // Added 2026-09-22 with the Section filter on /search/. The search index labels every entry
  // with the section it belongs to, and the search page prints one checkbox per label; both read
  // this, so the two cannot drift apart and a translated menu is one edit rather than two. The
  // words match the menu items below on purpose - a visitor filtering by "Video" is thinking of
  // the menu item of that name.
  searchSections: { posts: "Posts", video: "Video" },

  // Added 2026-09-22 after the reviewer asked for it: how many characters have to be typed before
  // /search/ looks anything up. One or two letters match almost every entry on the site, so the
  // page used to redraw the whole list on the first keystroke and show a result count that meant
  // nothing. Below this length the text is ignored - the filters on the left still work, and the
  // status line says what is missing. Both the script and the wording of that line read this, so
  // the number is written once.
  search: { minQuery: 3 },

  // Added 2026-09-22 with the tag cloud under the carousel (src/components/TagCloud.astro): the
  // tags that cloud leaves out. These three are leftovers from the skeleton's test posts and say
  // nothing to a reader. "video" is deliberately not among them - the owner keeps it in the cloud
  // for now and may replace it with something else later. A name here is matched against the
  // front-matter name, which the schema lower-cases, not against the title-cased label, and it
  // hides a tag from the cloud alone: its page, the Tags page and the search filters are
  // untouched.
  tagCloud: { hidden: ["hugo", "void", "draft"] },

  // Added 2026-09-22 at the owner's request, with the tag cloud: the word a tag or a category is
  // SHOWN by, where that should differ from the word the front matter writes. Empty on purpose -
  // every term reads well title-cased today - and it is here for the day one does not.
  //
  //   termLabels: { "маятник": "Маятник и рамки", "video": "Лекции" },
  //
  // The key is the front-matter name in lower case (the schema lower-cases every tag; write a
  // category key in lower case too, the lookup does the same to it). The value is printed as it
  // stands, so it decides its own capitals.
  //
  // This renames nothing else. The address stays /tags/<the front-matter name>/, the filters on
  // /search/ keep matching on that name, and an entry still declares the tag by that name in its
  // front matter - which is what makes this safe to change at any time: no link anywhere breaks.
  // To change the address as well, rename the tag in the front matter of every entry that carries
  // it; CONTENT.md, "Renaming a tag", has both procedures side by side.
  termLabels: {},

  // Added 2026-09-26 with the move to Clerk (CLERK.md step 2; the verdict in
  // .specify/consilium/2026-09-25-clerk-static.md). It replaces the previous provider's block,
  // which the owner ordered out of this branch together with its name (CLERK.md section 0).
  //
  // The publishable key of the Clerk application. It is PUBLIC BY DESIGN and belongs here, not in
  // an .env file: it only names the Clerk instance, and it ends up in the visitor's JavaScript
  // whichever way it is supplied. One key serves every place the site runs - the dev server on any
  // port, astro preview and GitHub Pages - because it is the development instance's pk_test_ key,
  // which accepts localhost and a host-provided domain such as debi7.github.io. Nothing in the code
  // branches on the host. The secret key (sk_...) is never needed by a static site and must never
  // appear here or anywhere in the repository.
  //
  // Empty until the Clerk application exists: the owner or the colleague creates it in the Clerk
  // Dashboard and pastes the key here (CLERK.md section 1; CLERK-DASHBOARD.md section 7.1). While it
  // is empty the site builds and every page but the three auth pages works as before; those three
  // say that the form could not be loaded, and src/scripts/auth.ts logs why.
  clerk: {
    publishableKey: "",
  },

  // Changed 2026-09-26 with the move to Clerk (CLERK.md step 2): the pages are three - sign-in,
  // sign-up and the account page. callback, forgot and reset went, because Clerk confirms an email
  // address and resets a password by a code typed into its own form, so no mail lands on the site;
  // dashboard became account; demoTable went with the service it named. The reasons below about
  // one home and the trailing slash still hold.
  // The addresses of the sign-in pages and the two names the scripts share. One home for the
  // addresses because six files used to spell them out, and because every one of them has to end
  // with a slash: under trailingSlash "always" the dev server answers 404 to /auth/signin without
  // it (measured 2026-09-25). The dashboard sits under /auth/ at the owner's request, so that one
  // sitemap rule and one redirect allow-list entry cover the four. flagKey is the localStorage key
  // the auth pages write and the header reads (src/scripts/auth-flag.ts); demoTable is the table
  // behind Row Level Security that the member's page reads (AUTH.md section 8 has its DDL).
  auth: {
    signIn: "/auth/signin/",
    signUp: "/auth/signup/",
    account: accountPath,
    flagKey: "kb-auth-expires",
  },

  pagination: { pageSize: 5, everyNumberUpTo: 5, everyYearUpTo: 5 },

  menu: [
    { name: "Home", url: "/" },
    { name: "Posts", url: "/posts/" },
    { name: "Video", url: "/video/" },
    { name: "Categories", url: "/categories/" },
    { name: "Tags", url: "/tags/" },
    // Added the evening of 2026-09-25 at the owner's word: the member's page as a menu item, which
    // is where a visitor lands after a sign-in or a confirmed registration. English and short, like
    // the other names (the owner corrected a first Russian spelling the same evening: the menu keeps
    // one language, the page it opens keeps its Russian title). Before About, where the owner put it;
    // the Hugo items keep their order among themselves. Menu.astro marks every item but Home
    // members-only (AUTH.md section 10), so a guest never sees it.
    // Changed 2026-09-26 (CLERK.md step 2): the item keeps its name and place and opens
    // /auth/account/, the page that replaced the dashboard.
    { name: "Account", url: accountPath },
    { name: "About", url: "/about/" },
  ],
} as const;
