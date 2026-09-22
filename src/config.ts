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
  pagination: { pageSize: 5, everyNumberUpTo: 5, everyYearUpTo: 5 },

  menu: [
    { name: "Home", url: "/" },
    { name: "Posts", url: "/posts/" },
    { name: "Video", url: "/video/" },
    { name: "Categories", url: "/categories/" },
    { name: "Tags", url: "/tags/" },
    { name: "About", url: "/about/" },
  ],
} as const;
