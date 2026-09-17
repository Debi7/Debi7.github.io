export const site = {
  title: "Radiesthesia Club",
  language: "ru",
  social: {
    github: "https://github.com/yourusername",
    email: "your.email@example.com",
    telegram: "@name",
  },

  avatar: "/images/avatar.png",
  carousel: { interval: 3000 },

  menu: [
    { name: "Home", url: "/" },
    { name: "Categories", url: "/categories/" },
    { name: "Posts", url: "/posts/" },
    { name: "Tags", url: "/tags/" },
    { name: "About", url: "/about/" },
  ],
} as const;
