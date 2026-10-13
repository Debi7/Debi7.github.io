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
    email: " ",
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
  // Filled 2026-09-26: the development instance the colleague created in the Clerk Dashboard
  // (Frontend API host infinite-sole-9367.clerk.accounts.dev), copied from its API keys page by
  // the owner. Clerk's docs say a publishable key needs no rotation even when it is public.
  // Changed later on 2026-09-26 by the owner: the key now points at another development instance,
  // supreme-ladybug-7080.clerk.accounts.dev, chosen on purpose. The demo sign-in of check:auth
  // passes against it as it did against the first one.
  // Added 2026-09-28: the access service for paid videos (workers/video-access/) is configured
  // with this same key and derives from it the Clerk instance whose tokens it accepts. When the
  // key changes, change the service's CLERK_PUBLISHABLE_KEY too, or every member gets "video
  // unavailable" (workers/video-access/README.md).
  clerk: {
    publishableKey:
      "pk_test_c3VwcmVtZS1sYWR5YnVnLTcwODAuY2xlcmsuYWNjb3VudHMuZGV2JA",
  },

  // Added 2026-09-28 (paid videos; .specify/consilium/2026-09-28-paid-video-access.md): the
  // access service that gives a member the player address of a paid video. GitHub Pages runs no
  // code, so it is a Cloudflare Worker, workers/video-access/. `endpoint` is its address, empty
  // until the owner creates the Worker (its README says how); while it is empty a paid page says
  // the video is unavailable. `devEndpoint` is the same code run on this machine by
  // `npm run video-access:dev`, which `npm run dev` asks instead: import.meta.env.DEV picks one at
  // build time, so a bundle carries one address. `playerHosts` are the only hosts a player
  // address may point to; the page refuses anything else the service returns, so a broken or
  // taken-over service cannot put another page, or a script address, into the player frame.
  // grantedEvent added 2026-09-28, the owner's choice for comments on a paid video (hide the block
  // until the access service has answered 200): src/scripts/paid-video.ts dispatches this event on
  // the document once the player is in place, and Disqus.astro shows its button when it hears it.
  // The name is spelled here once, so the two scripts cannot drift apart.
  // Changed later on 2026-09-28, the owner's decision: grantedEvent now shows the members-only
  // block (block 2, lib/video.ts; the listener is in VideoLayout.astro), and the comments show on
  // signedInEvent instead, which paid-video.ts sends as soon as it has confirmed a session - so a
  // signed-in visitor without access sees them too and can be instructed there, and a guest does
  // not.
  videoAccess: {
    endpoint: "",
    devEndpoint: "http://127.0.0.1:8787",
    playerHosts: ["www.youtube.com", "www.youtube-nocookie.com"],
    // Added 2026-09-30, with lectures on Yandex Disk: the only hosts a video file's address may
    // point to - the service answers such a slug with {"videoUrl"}, a direct address of the file
    // that the page plays in a video element instead of a frame. The address redirects on to
    // Yandex's storage hosts; the check is on the address the service gives, as for playerHosts.
    fileHosts: ["downloader.disk.yandex.ru"],
    grantedEvent: "paid-video:granted",
    signedInEvent: "paid-video:signed-in",
  },

  // Added 2026-10-02 with the admin panel (.specify/consilium/2026-10-02-admin-posts.md, ADMIN.md):
  // the content service that adds, edits and deletes posts for an editor who has no GitHub account,
  // workers/content-admin/. As with videoAccess, `endpoint` is the deployed Worker, empty until the
  // owner creates it, and `devEndpoint` is the same code run on this machine by
  // `npm run content-admin:dev` (and by `npm run dev:all`); import.meta.env.DEV picks one at build
  // time. `postsPage` is the panel's address, with its slash (trailingSlash "always").
  //
  // The statuses, the owner's model of 2026-10-02: every member has exactly one, kept as the key
  // `status` of the user's Clerk public metadata and carried into the session token as the claim
  // `status` (CLERK-DASHBOARD.md 7.2). A new account has none, which counts as "guest"; a metr or an
  // admin assigns the others, and nobody changes their own. "blocked" is a guest who may open no
  // material of the site, and is told who closed it. `statusNames` are what the site shows.
  // `postEditors` may add, edit and delete posts; the content Worker carries a copy of that list,
  // which scripts/check-content-admin.mjs compares with this one.
  // Added later on 2026-10-02: the status service, workers/statuses/, which /admin/users/ asks, with
  // its two addresses on the same pattern; it is a Worker of its own because it holds the Clerk
  // secret key (its header says why).
  admin: {
    endpoint: "",
    devEndpoint: "http://127.0.0.1:8789",
    postsPage: "/admin/posts/",
    statusesEndpoint: "",
    statusesDevEndpoint: "http://127.0.0.1:8790",
    usersPage: "/admin/users/",
    statuses: [
      "guest",
      "student",
      "expert",
      "master",
      "metr",
      "admin",
      "blocked",
    ],
    statusNames: {
      guest: "гость",
      student: "студент",
      expert: "эксперт",
      master: "мастер",
      metr: "метр",
      admin: "администратор",
      blocked: "заблокирован",
    },
    postEditors: ["admin", "metr"],
    // Added later on 2026-10-02, the owner's rule: any status a metr or an admin gives - every one
    // but guest and blocked - opens the paid lectures. workers/video-access/worker.mjs carries a
    // copy (VIEWERS), which scripts/check-video-access.mjs compares with this one. The paid access
    // of CLERK-DASHBOARD.md 7.3 (member, memberUntil) still opens them too; blocked closes both.
    lectureViewers: ["student", "expert", "master", "metr", "admin"],
    // Added later on 2026-10-02, the owner's number: the panel's lists show 20 posts or members to
    // a page (AdminPager.astro). The status service is asked for that many at a time and accepts
    // at most 50 (workers/statuses/worker.mjs).
    pageSize: 20,
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
  // the auth pages write and the header reads (src/scripts/auth-flag.ts).
  // (Changed 2026-09-28: a clause about demoTable, the previous provider's demo table, stood here and
  // left with that provider, at the owner's order.)
  auth: {
    signIn: "/auth/signin/",
    signUp: "/auth/signup/",
    account: accountPath,
    flagKey: "kb-auth-expires",
    // Added 2026-10-01 at the owner's request: the localStorage key of the member's name and email,
    // written next to the flag by the pages that load Clerk and cleared with it, so that the
    // feedback form (ContactModal.astro), which loads no Clerk, can fill them in for a member
    // (src/scripts/auth-flag.ts, AUTH.md section 12.7).
    contactKey: "kb-auth-contact",
  },

  // Added 2026-10-01 at the owner's request (AUTH.md section 12.6): the event that opens the
  // feedback form, ContactModal.astro, from any script, besides the envelope button in the footer.
  // The sign-in page sends it when a visitor presses "Помощь" or "Написать в поддержку" in Clerk's
  // form. Sent on the document; its detail may carry `email` and `subject` to fill in. Spelled here
  // once, as videoAccess.grantedEvent is, so the sender and the form cannot drift apart.
  contact: {
    openEvent: "contact:open",
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
