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
//
// Changed 2026-10-12 at the owner's request: the interface is in two languages, English by default
// and Russian on the visitor's choice (site.i18n in src/config.ts, the mechanism in
// src/i18n/lang.ts). Three things above no longer hold, and the rest does:
// - Every entry is a Phrase, the string in both languages side by side; the English values are the
//   en.toml values as they were, the Russian ones are new. The object is `ui` (it was `t`), and a
//   template prints an entry with <T s={ui.back_to_home} />.
// - The file is no longer a faithful copy of the TOML, and the rule about not inventing keys is
//   withdrawn: every interface string of the public site has its home here now, the theme's keys
//   first, the site's own below them (the colleague's labels that stood in the components). The
//   admin panel's strings are in src/i18n/admin.ts, so the public pages' scripts do not carry them.
// - The entries that take a value return a Phrase.
// The articles and the video descriptions are content and are not translated; nor are the tags and
// the categories, which their front matter names.
import type { Phrase } from "./lang";

export const ui = {
  // Footer
  footer_share_knowledge: {
    ru: "Делимся знаниями, опытом и идеями",
    en: "Sharing knowledge, experience, and ideas",
  },
  footer_navigation: { ru: "Навигация", en: "Navigation" },
  footer_stay_connected: { ru: "Оставайтесь на связи", en: "Stay Connected" },
  footer_subscribe_contact: {
    ru: "Подпишитесь или напишите нам",
    en: "Subscribe to my content or contact me",
  },
  footer_contact_me: { ru: "Написать нам", en: "Contact Me" },
  footer_github: { ru: "GitHub", en: "GitHub" },
  footer_zhihu: { ru: "Zhihu", en: "Zhihu" },
  footer_email: { ru: "Почта", en: "Email" },
  footer_rights_reserved: {
    ru: "Все права защищены",
    en: "All Rights Reserved",
  },
  footer_built_with: { ru: "Сделано на", en: "Built with" },
  footer_built: { ru: "Собрано", en: "Built" },
  footer_theme: { ru: "Тема", en: "Theme" },

  // Homepage
  home_recent_posts: { ru: "Последние статьи", en: "Recent Posts" },
  home_view_all_posts: { ru: "Все статьи", en: "View All Posts" },
  home_welcome: { ru: "Добро пожаловать", en: "Welcome to my blog" },

  // List page
  list_read_more: { ru: "Читать далее", en: "Read more" },
  year_indicator: { ru: "Год", en: "Year indicator" },
  decorative_halo: { ru: "Декоративный ореол", en: "Decorative halo" },
  article_list: { ru: "Список статей", en: "Article list" },
  list_view_by_year: { ru: "По годам", en: "View by year" },
  list_view_by_category: { ru: "По категориям", en: "View by category" },
  list_article_count: (count: number): Phrase => ({
    ru: `Всего статей: ${count}`,
    en: `${count} articles in total`,
  }),

  // Video page
  list_watch_video: { ru: "Смотреть видео", en: "Watch the video" },

  // About page
  about_skills: { ru: "Навыки", en: "Skills" },
  about_experience: { ru: "Опыт", en: "Experience" },
  about_education: { ru: "Образование", en: "Education" },
  about_projects: { ru: "Проекты", en: "Projects" },
  about_interests: { ru: "Интересы", en: "Interests" },
  about_contact: { ru: "Контакты", en: "Contact" },

  // Article page
  reading_time: { ru: "мин чтения", en: "min read" },
  page_views: { ru: "Просмотры", en: "Page Views" },
  back_to_home: { ru: "На главную", en: "Back to Home" },

  // Article date format. Hugo layout strings; see src/lib/date.ts for the formatter.
  // (2026-10-12: nothing reads these two; the formatter in src/lib/date.ts holds both languages.)
  date_month_day_format: { ru: "02 Jan", en: "Jan 02" },
  date_year: { ru: "", en: "" },

  // Tags
  tag_icon_title: { ru: "Тег", en: "Tag" },
  all_tags: { ru: "Все теги", en: "All Tags" },
  tags_help_text: {
    ru: "Нажмите на тег, чтобы увидеть статьи с ним",
    en: "Click on any tag to view related articles",
  },
  articles: { ru: "статей", en: "articles" },

  // Common buttons and tips
  back_to_top: { ru: "Наверх", en: "Back to top" },
  search_placeholder: { ru: "Поиск...", en: "Search..." },
  pagination_next: { ru: "Далее", en: "Next" },
  pagination_previous: { ru: "Назад", en: "Previous" },
  pagination_page: (pageNumber: number): Phrase => ({
    ru: `Страница ${pageNumber}`,
    en: `Page ${pageNumber}`,
  }),
  related_posts: { ru: "Похожие статьи", en: "Related Posts" },
  table_of_contents: { ru: "Содержание", en: "Table of Contents" },
  comments: { ru: "Комментарии", en: "Comments" },
  share: { ru: "Поделиться", en: "Share" },
  share_copy_link: { ru: "Копировать ссылку", en: "Copy link" },
  share_copy_summary: { ru: "Копировать описание", en: "Copy summary" },
  share_copied: { ru: "Скопировано", en: "Copied" },
  share_native: { ru: "Поделиться...", en: "Share..." },
  share_copy_link_success: { ru: "Ссылка скопирована.", en: "Link copied." },
  share_copy_summary_success: {
    ru: "Текст скопирован.",
    en: "Share text copied.",
  },
  share_copy_failed: { ru: "Не удалось скопировать.", en: "Copy failed." },
  share_native_failed: {
    ru: "Системная кнопка «Поделиться» недоступна.",
    en: "Native sharing is unavailable.",
  },
  last_updated: { ru: "Обновлено", en: "Last updated on" },
  load_comments: { ru: "Загрузить комментарии", en: "Load Comments" },

  // ---------------------------------------------------------------------------------------------
  // The site's own strings, added 2026-10-12 (the note at the top). Where a component held the text
  // as a literal, the old literal is the half of its language here: the Russian ones were the
  // colleague's, the English ones the theme's or ours.

  // The header and the menu (Header.astro, Menu.astro, ThemeToggle.astro, LangToggle.astro,
  // site.ts). The menu items' own names are site.sections in src/config.ts.
  menu_label: { ru: "Меню сайта", en: "Site" },
  menu_open: { ru: "Открыть меню", en: "Open menu" },
  menu_close: { ru: "Закрыть меню", en: "Close menu" },
  search_label: { ru: "Поиск", en: "Search" },
  theme_toggle: { ru: "Переключить тему", en: "Toggle dark mode" },
  theme_to_light: { ru: "Включить светлую тему", en: "Switch to light mode" },
  theme_to_dark: { ru: "Включить тёмную тему", en: "Switch to dark mode" },
  // What the switch shows: the language the page is in.
  lang_current: { ru: "RU", en: "EN" },
  // What a press does, in the language the visitor is reading.
  lang_switch: {
    ru: "Переключить на английский (English)",
    en: "Switch to Russian (Русский)",
  },
  auth_signin: { ru: "Войти на сайт", en: "Sign in" },
  auth_account: { ru: "Личный кабинет", en: "Account" },

  // The footer (Footer.astro) and the button back to the top (ScrollToTop.astro uses back_to_top).
  footer_powered_by: { ru: "Работает на", en: "Powered by" },
  footer_total_visits: { ru: "Всего посещений:", en: "Total visits:" },

  // The feedback form (ContactModal.astro).
  contact_title: { ru: "Обратная связь", en: "Feedback" },
  contact_name: { ru: "Ваше имя", en: "Your name" },
  contact_email: { ru: "Email для связи", en: "Email for the reply" },
  contact_message: { ru: "Сообщение", en: "Message" },
  contact_send: { ru: "Отправить письмо", en: "Send" },
  contact_sent: { ru: "Сообщение отправлено!", en: "Message sent!" },
  contact_failed: {
    ru: "Ошибка отправки. Попробуйте ещё раз.",
    en: "Sending failed. Please try again.",
  },

  // Lists and articles (YearSwitcher.astro, Terms.astro, the tag and category pages).
  years_label: { ru: "Годы", en: "Years" },
  terms_label: { ru: "Теги:", en: "Tags:" },
  categories_help_text: {
    ru: "Нажмите на категорию, чтобы раскрыть или свернуть её статьи",
    en: "Click any category to expand or collapse articles",
  },
  // The count on a tag's page: the theme's "articles" after the number, with the Russian plural.
  articles_count: (count: number): Phrase => ({
    ru: `${count} ${ruPlural(count, "статья", "статьи", "статей")}`,
    en: `${count} articles`,
  }),

  // Comments (Disqus.astro).
  comments_show: { ru: "Показать комментарии", en: "Show comments" },
  comments_hide: { ru: "Скрыть комментарии", en: "Hide comments" },
  comments_noscript: {
    ru: "Чтобы увидеть комментарии, включите JavaScript. Комментарии работают на",
    en: "Please enable JavaScript to view the comments powered by",
  },

  // A paid lecture's player (PaidVideo.astro).
  paid_noscript: {
    ru: "Для просмотра лекции нужен включённый JavaScript.",
    en: "Watching the lecture needs JavaScript turned on.",
  },
  paid_loading: { ru: "Проверяем доступ...", en: "Checking access..." },
  paid_guest: {
    ru: "Эта лекция доступна участникам клуба.",
    en: "This lecture is open to club members.",
  },
  paid_sign_in: { ru: "Войти", en: "Sign in" },
  paid_denied: {
    ru: "Лекция откроется после оплаты участия в клубе. Написать нам можно через значок письма внизу страницы.",
    en: "The lecture opens once club membership is paid. You can write to us with the envelope icon at the bottom of the page.",
  },
  paid_recheck: { ru: "Проверить ещё раз", en: "Check again" },
  paid_missing: {
    ru: "Лекция ещё не подключена. Загляните позже.",
    en: "The lecture is not connected yet. Please come back later.",
  },
  paid_blocked: {
    ru: "Доступ к материалам сайта для этой учётной записи закрыт.",
    en: "Access to the site's materials is closed for this account.",
  },
  paid_failed: {
    ru: "Видео сейчас недоступно. Обновите страницу позже.",
    en: "The video is unavailable right now. Please reload the page later.",
  },

  // The carousel on the home page (Carousel.astro, carousel.ts). The photos' own descriptions are
  // in Carousel.astro, next to their file names.
  carousel_label: { ru: "Фотографии природы", en: "Nature photos" },
  carousel_slide: (number: number, total: number): Phrase => ({
    ru: `${number} из ${total}`,
    en: `${number} of ${total}`,
  }),
  carousel_photo_alt: (number: number): Phrase => ({
    ru: `Природа, фото ${number}`,
    en: `Nature, photo ${number}`,
  }),
  carousel_prev: { ru: "Предыдущее фото", en: "Previous photo" },
  carousel_next: { ru: "Следующее фото", en: "Next photo" },
  carousel_pause: { ru: "Остановить прокрутку", en: "Pause autoplay" },
  carousel_resume: { ru: "Продолжить прокрутку", en: "Resume autoplay" },
  carousel_choose: { ru: "Выбор фото", en: "Choose a photo" },
  carousel_dot: (number: number): Phrase => ({
    ru: `Фото ${number}`,
    en: `Photo ${number}`,
  }),

  // The search page (src/pages/search/index.astro, src/scripts/search.ts). {n}, {q} and {total}
  // are filled in by the script.
  search_description: {
    ru: "Поиск по статьям и видеолекциям.",
    en: "Search the articles and the video lectures.",
  },
  search_clear: {
    ru: "Очистить поиск и фильтры",
    en: "Clear the search and the filters",
  },
  search_filters: { ru: "Фильтры", en: "Filters" },
  search_section: { ru: "Раздел", en: "Section" },
  search_category: { ru: "Категория", en: "Category" },
  search_tag: { ru: "Тег", en: "Tag" },
  search_searching: { ru: "Ищем...", en: "Searching..." },
  search_too_short: (minimum: number): Phrase => ({
    ru: `Для поиска введите не меньше ${minimum} символов`,
    en: `Type at least ${minimum} characters to search`,
  }),
  search_found: {
    ru: "Найдено: {n}. Запрос: {q}",
    en: "{n} result(s) for {q}",
  },
  search_empty: {
    ru: "По запросу {q} ничего не найдено",
    en: "No results for {q}",
  },
  search_filtered: {
    ru: "Найдено: {n} из {total}. Запрос: {q}",
    en: "{n} of {total} result(s) for {q}",
  },
  search_listing: {
    ru: "Найдено с этими фильтрами: {n}",
    en: "{n} result(s) with these filters",
  },
  search_empty_filter: {
    ru: "С этими фильтрами ничего не найдено",
    en: "No results with these filters",
  },
  search_failed: {
    ru: "Не удалось загрузить поиск. Попробуйте ещё раз.",
    en: "The search index could not be loaded. Please try again.",
  },
  search_noscript: {
    ru: "Поиску нужен JavaScript: сайт статический, и спросить некого. Всё, что он находит, доступно и без него: статьи, видео, категории и теги.",
    en: "Search needs JavaScript, because this site is static and there is no server to ask. Everything it finds is reachable without it: Posts, Video, Categories and Tags.",
  },
  search_tag_prefix: { ru: "Найдено в тегах:", en: "Found in tags:" },

  // The sign-in, sign-up and account pages (src/pages/auth/, src/scripts/auth.ts and the account
  // scripts). auth_account above names the account page as well.
  auth_title_signin: { ru: "Вход", en: "Sign in" },
  auth_title_signup: { ru: "Регистрация", en: "Sign up" },
  auth_loading: { ru: "Загрузка...", en: "Loading..." },
  auth_noscript_signin: {
    ru: "Для входа нужен включённый JavaScript.",
    en: "Signing in needs JavaScript turned on.",
  },
  auth_noscript_signup: {
    ru: "Для регистрации нужен включённый JavaScript.",
    en: "Signing up needs JavaScript turned on.",
  },
  auth_not_set_up: {
    ru: "Вход на сайт ещё не подключён.",
    en: "Signing in is not set up yet.",
  },
  auth_load_failed: {
    ru: "Не удалось загрузить форму. Обновите страницу.",
    en: "The form could not be loaded. Please reload the page.",
  },
  account_noscript: {
    ru: "Для личного кабинета нужен включённый JavaScript.",
    en: "The account page needs JavaScript turned on.",
  },
  account_demo: {
    ru: "Демо: доступ участника клуба подтверждён.",
    en: "Demo: club membership confirmed.",
  },
  account_sign_out: { ru: "Выйти", en: "Sign out" },
  account_signing_out: { ru: "Выходим...", en: "Signing out..." },
  account_your_status: { ru: "Ваш статус:", en: "Your status:" },
  account_status_title: { ru: "Статус", en: "Status" },
  account_blocked_by_admin: {
    ru: "Доступ к материалам сайта закрыт администратором.",
    en: "Access to the site's materials was closed by an administrator.",
  },
  account_blocked_by_metr: {
    ru: "Доступ к материалам сайта закрыт метром.",
    en: "Access to the site's materials was closed by a metr.",
  },
  // The account card's "Devices" page (account.astro, account-devices.ts).
  devices_tab: { ru: "Устройства", en: "Devices" },
  devices_title: { ru: "Активные устройства", en: "Active devices" },
  devices_pages: {
    ru: "Страницы списка устройств",
    en: "Pages of the list of devices",
  },
  devices_this: { ru: "Это устройство", en: "This device" },
  devices_revoke: { ru: "Выйти из устройства", en: "Sign out of the device" },
  devices_failed: {
    ru: "Не удалось загрузить список. Обновите страницу.",
    en: "The list could not be loaded. Please reload the page.",
  },
  devices_phone: { ru: "Телефон", en: "Phone" },
  devices_computer: { ru: "Компьютер", en: "Computer" },
  devices_today: { ru: "Сегодня в {time}", en: "Today at {time}" },
  devices_yesterday: { ru: "Вчера в {time}", en: "Yesterday at {time}" },
  devices_on_day: { ru: "{day} в {time}", en: "{day} at {time}" },
  // The names of the two admin panel pages, here and not in src/i18n/admin.ts because the account
  // page links to them too.
  admin_posts_title: { ru: "Публикации", en: "Publications" },
  admin_users_title: { ru: "Пользователи", en: "Users" },
} satisfies Record<string, Phrase | ((...values: number[]) => Phrase)>;

// Added 2026-10-12 for articles_count: the Russian plural of a count - one (1, 21, 101), few (2-4,
// 22-24) and many (0, 5-20, 25-30). Written out rather than through Intl.PluralRules so that the
// result does not depend on the build machine's ICU data, the reason src/lib/date.ts gives for its
// month names.
function ruPlural(
  count: number,
  one: string,
  few: string,
  many: string,
): string {
  const tens = count % 100;
  const units = count % 10;
  if (tens >= 11 && tens <= 14) return many;
  if (units === 1) return one;
  if (units >= 2 && units <= 4) return few;
  return many;
}
