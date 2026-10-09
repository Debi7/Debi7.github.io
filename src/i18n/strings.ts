// Port of ../klub_biolocation/themes/void/i18n/en.toml (MIGRATION-PLAN.md §4). Ported in
// full while doing the Categories page, which needed `back_to_home`: the file is pure data,
// so translating it once is cheaper than growing it key by key.
//
// Hugo renders the ENGLISH strings today, because hugo.toml sets no
// `defaultContentLanguage`, so `en.toml` is what the live site shows. This file is
// therefore a copy of `en.toml`, not of `ru.toml`. Switching the site to Russian is a
// separate decision: change the values here, not the keys.
//
// Keys are exactly the TOML table names, so a template that reads `i18n "back_to_home"`
// becomes `t.back_to_home`. The two entries that take a value in Hugo (`{{ .Count }}`,
// `{{ .PageNumber }}`) are functions here.
//
// A Hugo template may also ask for a key that does NOT exist in en.toml and supply a
// fallback: `{{ i18n "categories_help_text" | default "..." }}`. Hugo then renders the
// fallback. Do not invent such keys here - keep the literal in the component, the way the
// theme does, so this file stays a faithful copy of the TOML.
export const t = {
  en: {
    // Footer
    footer_share_knowledge: "Sharing knowledge, experience, and ideas",
    footer_navigation: "Navigation",
    footer_stay_connected: "Stay Connected",
    footer_subscribe_contact: "Subscribe to my content or contact me",
    footer_contact_me: "Contact Me",
    footer_github: "GitHub",
    footer_zhihu: "Zhihu",
    footer_email: "Email",
    footer_rights_reserved: "All Rights Reserved",
    footer_built_with: "Built with",
    footer_built: "Built",
    footer_theme: "Theme",

    // Homepage
    home_recent_posts: "Recent Posts",
    home_view_all_posts: "View All Posts",
    home_welcome: "Welcome to my blog",

    // List page
    list_read_more: "Read more",
    year_indicator: "Year indicator",
    decorative_halo: "Decorative halo",
    article_list: "Article list",
    list_view_by_year: "View by year",
    list_view_by_category: "View by category",
    list_article_count: (count: number) => `${count} articles in total`,

    // Video page
    list_watch_video: "Watch the video",

    // About page
    about_skills: "Skills",
    about_experience: "Experience",
    about_education: "Education",
    about_projects: "Projects",
    about_interests: "Interests",
    about_contact: "Contact",

    // Article page
    reading_time: "min read",
    page_views: "Page Views",
    back_to_home: "Back to Home",

    // Article date format.
    date_month_day_format: "Jan 02",
    date_year: "",

    // Tags
    tag_icon_title: "Tag",
    all_tags: "All Tags",
    tags_help_text: "Click on any tag to view related articles",
    articles: "articles",

    // Common buttons and tips
    back_to_top: "Back to top",
    search_placeholder: "Search...",
    pagination_next: "Next",
    pagination_previous: "Previous",
    pagination_page: (pageNumber: number) => `Page ${pageNumber}`,
    related_posts: "Related Posts",
    table_of_contents: "Table of Contents",
    comments: "Comments",
    share: "Share",
    share_copy_link: "Copy link",
    share_copy_summary: "Copy summary",
    share_copied: "Copied",
    share_native: "Share...",
    share_copy_link_success: "Link copied.",
    share_copy_summary_success: "Share text copied.",
    share_copy_failed: "Copy failed.",
    share_native_failed: "Native sharing is unavailable.",
    last_updated: "Last updated on",
    load_comments: "Load Comments",
  },
  ru: {
    // Footer
    footer_share_knowledge: "Делюсь знаниями, опытом и идеями",
    footer_navigation: "Навигация",
    footer_stay_connected: "Stay Connected",
    footer_subscribe_contact:
      "Подпишитесь на мой контент или свяжитесь со мной",
    footer_contact_me: "Contact Me",
    footer_github: "GitHub",
    footer_zhihu: "Zhihu",
    footer_email: "Email",
    footer_rights_reserved: "Все права защищены",
    footer_built_with: "Built with",
    footer_built: "Built",
    footer_theme: "Тема",

    // Homepage
    home_recent_posts: "Свежие статьи",
    home_view_all_posts: "Все статьи",
    home_welcome: "Добро пожаловать в мой блог",

    // List page
    list_read_more: "Читать далее",
    year_indicator: "Year indicator",
    decorative_halo: "Decorative halo",
    article_list: "Article list",
    list_view_by_year: "По годам",
    list_view_by_category: "По категориям",
    list_article_count: (count: number) => `Всего статей: ${count}`,

    // Video page
    list_watch_video: "Смотреть видео",

    // About page
    about_skills: "Навыки",
    about_experience: "Опыт",
    about_education: "Образование",
    about_projects: "Проекты",
    about_interests: "Интересы",
    about_contact: "Контакты",

    // Article page
    reading_time: "мин чтения",
    page_views: "Просмотры",
    back_to_home: "На главную",

    // Article date format.
    date_month_day_format: "02 Jan",
    date_year: "",

    // Tags
    tag_icon_title: "Тег",
    all_tags: "Все теги",
    tags_help_text: "Нажмите на любой тег, чтобы посмотреть связанные статьи",
    articles: "статей",

    // Common buttons and tips
    back_to_top: "Наверх",
    search_placeholder: "Поиск...",
    pagination_next: "Далее",
    pagination_previous: "Назад",
    pagination_page: (pageNumber: number) => `Страница ${pageNumber}`,
    related_posts: "Похожие статьи",
    table_of_contents: "Содержание",
    comments: "Комментарии",
    share: "Share",
    share_copy_link: "Скопировать ссылку",
    share_copy_summary: "Скопировать summary",
    share_copied: "Скопировано",
    share_native: "Share...",
    share_copy_link_success: "Ссылка скопирована.",
    share_copy_summary_success: "Share text скопирован.",
    share_copy_failed: "Не удалось скопировать.",
    share_native_failed: "Native sharing недоступен.",
    last_updated: "Обновлено",
    load_comments: "Загрузить комментарии",
  },
} as const;

export const nav = {
  en: {
    home: "Home",
    posts: "Posts",
    video: "Video",
    categories: "Categories",
    tags: "Tags",
    account: "Account",
    about: "About",
    title: "Radiesthesia Club",
  },
  ru: {
    home: "Главная",
    posts: "Статьи",
    video: "Видео",
    categories: "Категории",
    tags: "Теги",
    account: "Кабинет",
    about: "О клубе",
    title: "Клуб Радиэстезии",
  },
} as const;

export type LangType = keyof typeof nav;
export type PageType = keyof (typeof nav)[LangType];

export const DEFAULT_LANG: LangType = "en";

// ключ для localStorage
export const LANG_STORAGE_KEY = "blog-lang";

// получить словарь для языка
export function getDict(lang: LangType) {
  return t[lang];
}

// получить навигацию для языка
export function getNav(lang: LangType) {
  return nav[lang];
}

// получаем значения
export function getNavValue(lang: LangType, page: PageType) {
  return nav[lang][page];
}
