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
  disqus: { shortname: "biolocation-club" },
  searchSections: { posts: "Posts", video: "Video" },
  search: { minQuery: 3 },
  tagCloud: { hidden: ["hugo", "void", "draft"] },
  termLabels: {},
  clerk: {
    publishableKey:
      "pk_test_c3VwcmVtZS1sYWR5YnVnLTcwODAuY2xlcmsuYWNjb3VudHMuZGV2JA",
  },

  videoAccess: {
    endpoint: "",
    devEndpoint: "http://127.0.0.1:8787",
    playerHosts: ["www.youtube.com", "www.youtube-nocookie.com"],
    fileHosts: ["downloader.disk.yandex.ru"],
    grantedEvent: "paid-video:granted",
    signedInEvent: "paid-video:signed-in",
  },

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
      metr: "мэтр",
      admin: "администратор",
      blocked: "заблокирован",
    },
    postEditors: ["admin", "metr"],
    lectureViewers: ["student", "expert", "master", "metr", "admin"],
    pageSize: 20,
  },

  auth: {
    signIn: "/auth/signin/",
    signUp: "/auth/signup/",
    account: accountPath,
    flagKey: "kb-auth-expires",
    contactKey: "kb-auth-contact",
  },

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
    { name: "Account", url: accountPath },
    { name: "About", url: "/about/" },
  ],
} as const;
