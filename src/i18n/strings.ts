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
// Changed 2026-10-13 at the owner's word: the interface has one language, Russian. The values below are Russian
// now and the keys stay those of en.toml, as the note above foresaw. articles_count is the one key
// added: a Russian count needs its plural forms, which a single word cannot carry.
export const t = {
  // Footer
  footer_share_knowledge: "Делимся знаниями, опытом и идеями",
  footer_navigation: "Навигация",
  footer_stay_connected: "Оставайтесь на связи",
  footer_subscribe_contact: "Подпишитесь или напишите нам",
  footer_contact_me: "Написать нам",
  footer_github: "GitHub",
  footer_zhihu: "Zhihu",
  footer_email: "Почта",
  footer_rights_reserved: "Все права защищены",
  footer_built_with: "Сделано на",
  footer_built: "Собрано",
  footer_theme: "Тема",

  // Homepage
  home_recent_posts: "Последние статьи",
  home_view_all_posts: "Все статьи",
  home_welcome: "Добро пожаловать",

  // List page
  list_read_more: "Читать далее",
  year_indicator: "Год",
  decorative_halo: "Декоративный ореол",
  article_list: "Список статей",
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

  // Article date format. Hugo layout strings; see src/lib/date.ts for the formatter.
  date_month_day_format: "02 Jan",
  date_year: "",

  // Tags
  tag_icon_title: "Тег",
  all_tags: "Все теги",
  tags_help_text: "Нажмите на тег, чтобы увидеть статьи с ним",
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
  share: "Поделиться",
  share_copy_link: "Копировать ссылку",
  share_copy_summary: "Копировать описание",
  share_copied: "Скопировано",
  share_native: "Поделиться...",
  share_copy_link_success: "Ссылка скопирована.",
  share_copy_summary_success: "Текст скопирован.",
  share_copy_failed: "Не удалось скопировать.",
  share_native_failed: "Системная кнопка «Поделиться» недоступна.",
  last_updated: "Обновлено",
  load_comments: "Загрузить комментарии",
  // Added 2026-10-13 with the Russian values: the count on a tag's page, "1 статья", "2 статьи",
  // "5 статей". It counts the lectures too (the note on the tag page says why the word stays).
  articles_count: (count: number) =>
    `${count} ${ruPlural(count, "статья", "статьи", "статей")}`,
} as const;

// Added 2026-10-13: the Russian plural form for a count - one (1, 21), few (2-4, 22-24), many (the
// rest, 11-14 included).
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
