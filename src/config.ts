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
