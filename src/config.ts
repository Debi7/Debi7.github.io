// Site settings that lived in ../klub_biolocation/hugo.toml. Keep the values in sync with
// that file until the Hugo project is retired.
export const site = {
  title: "Radiesthesia Club",

  // hugo.toml language; ends up in <html lang>.
  language: "ru",

  // [params.social] - still placeholder values, as in hugo.toml.
  social: {
    github: "https://github.com/yourusername",
    email: "your.email@example.com",
    telegram: "@name",
  },

  // [params.avatar] url
  avatar: "/images/avatar.png",

  // params.carousel.interval (ms); the Hugo template defaults to 3000 when unset.
  carousel: { interval: 3000 },

  // [[menus.main]] in Hugo's order: by weight, then by name. Posts and Categories share
  // weight 20, so Categories renders first. Do not "fix" the order.
  menu: [
    { name: "Home", url: "/" },
    { name: "Categories", url: "/categories/" },
    { name: "Posts", url: "/posts/" },
    { name: "Tags", url: "/tags/" },
    { name: "About", url: "/about/" },
  ],
} as const;
