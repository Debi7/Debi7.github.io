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

  menu: [
    { name: "Home", url: "/" },
    { name: "Categories", url: "/categories/" },
    { name: "Posts", url: "/posts/" },
    { name: "Tags", url: "/tags/" },
    { name: "About", url: "/about/" },
  ],
} as const;
