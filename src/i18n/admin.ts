// The admin panel's strings in both interface languages, added 2026-10-12 at the owner's request
// (the interface in two languages; site.i18n in src/config.ts, the mechanism in src/i18n/lang.ts).
// The panel - /admin/posts/, /admin/users/, AdminNav.astro, AdminPager.astro and their scripts -
// was written in Russian; every Russian text that stood there is the ru half of an entry here, and
// the English half is new. A file of its own beside src/i18n/strings.ts, so that the public pages'
// scripts, which import that one, do not carry the panel's sentences.
//
// {name} marks a value the script fills in with format() from src/i18n/lang.ts. The names of the
// two panel pages are in strings.ts (admin_posts_title, admin_users_title), because the account page
// links to them too.
import type { Phrase } from "./lang";

export const adminUi = {
  // Shared by both pages (AdminNav.astro, AdminPager.astro, the two scripts).
  nav_label: { ru: "Панель управления", en: "Control panel" },
  saving: { ru: "Сохранение...", en: "Saving..." },
  token_hint: {
    ru: "Статус учётной записи «{status}» есть, но сессия его не передаёт: в шаблоне сессионного токена Clerk нет строки status (ADMIN.md, раздел 3, шаг 1).",
    en: "The account has the status '{status}', but the session does not carry it: Clerk's session token template has no status line (ADMIN.md, section 3, step 1).",
  },

  // /admin/posts/ - the markup.
  posts_noscript: {
    ru: "Для работы с публикациями нужен включённый JavaScript.",
    en: "Working with posts needs JavaScript turned on.",
  },
  posts_forbidden: {
    ru: "У этой учётной записи нет прав на публикации. Их выдаёт администратор сайта.",
    en: "This account has no rights to publish. The site's administrator grants them.",
  },
  posts_new: { ru: "Новая публикация", en: "New post" },
  posts_pages: {
    ru: "Страницы списка публикаций",
    en: "Pages of the list of posts",
  },
  posts_edit: { ru: "Изменить", en: "Edit" },
  posts_copy: { ru: "Копировать", en: "Copy" },
  posts_delete: { ru: "Удалить", en: "Delete" },
  field_title: { ru: "Заголовок", en: "Title" },
  field_slug: {
    ru: "Адрес: латинские буквы, цифры и дефисы, например poisk-vody. После сохранения не меняется.",
    en: "Address: Latin letters, digits and hyphens, for example poisk-vody. It does not change after saving.",
  },
  field_date: {
    ru: "Дата публикации (время клуба, UTC+3). Запись с будущей датой появится на сайте после первой сборки сайта после этой даты.",
    en: "Publication date (the club's time, UTC+3). A post with a future date appears on the site with the first build after that date.",
  },
  field_description: { ru: "Краткое описание", en: "Short description" },
  field_tags: { ru: "Теги, через запятую", en: "Tags, separated by commas" },
  field_categories: {
    ru: "Категории, через запятую",
    en: "Categories, separated by commas",
  },
  field_draft: {
    ru: "Черновик: сохранить, но не показывать на сайте",
    en: "Draft: save, but do not show on the site",
  },
  field_body: {
    ru: "Текст в Markdown. HTML-теги не принимаются; код - в обратных кавычках.",
    en: "The text in Markdown. HTML tags are not accepted; code goes in backticks.",
  },
  posts_save: { ru: "Сохранить", en: "Save" },
  posts_cancel: { ru: "Отмена", en: "Cancel" },

  // /admin/posts/ - the script (admin-posts.ts). The service's problem codes first.
  problem_required: { ru: "Заполните это поле.", en: "Fill in this field." },
  problem_too_long: { ru: "Слишком длинно.", en: "Too long." },
  problem_too_many: { ru: "Слишком много.", en: "Too many." },
  problem_format: {
    ru: "Не подходит по форме: смотрите подсказку над полем.",
    en: "Does not fit the format: see the hint above the field.",
  },
  problem_reserved: {
    ru: "Такой адрес занят страницами сайта: выберите другой.",
    en: "This address is taken by the site's own pages: choose another.",
  },
  problem_line_break: {
    ru: "Здесь не может быть переносов строк.",
    en: "Line breaks are not allowed here.",
  },
  problem_duplicate: { ru: "Есть повторы.", en: "There are repeats." },
  problem_html: {
    ru: "В тексте есть HTML-тег. Уберите его или поставьте в обратные кавычки как код.",
    en: "The text has an HTML tag. Remove it or put it in backticks as code.",
  },
  problem_link: {
    ru: "Ссылка ведёт не на страницу и не на почту. Разрешены адреса http(s), mailto и пути на сайте.",
    en: "The link leads neither to a page nor to an email. Allowed are http(s) and mailto addresses and paths on the site.",
  },
  problem_type: { ru: "Неверное значение.", en: "Wrong value." },
  problem_unknown: { ru: "Неизвестное поле.", en: "Unknown field." },
  posts_not_connected: {
    ru: "Сервис публикаций ещё не подключён (site.admin.endpoint, ADMIN.md).",
    en: "The publishing service is not connected yet (site.admin.endpoint, ADMIN.md).",
  },
  posts_no_rights: {
    ru: "У этой учётной записи нет прав на публикации.",
    en: "This account has no rights to publish.",
  },
  post_exists: {
    ru: "Публикация с таким адресом уже есть.",
    en: "A post with this address already exists.",
  },
  post_conflict: {
    ru: "Публикацию изменили или удалили с тех пор, как вы её открыли. Обновите страницу.",
    en: "The post was changed or deleted since you opened it. Please reload the page.",
  },
  post_not_found: {
    ru: "Такой публикации нет: её удалили?",
    en: "There is no such post: was it deleted?",
  },
  post_too_large: {
    ru: "Текст слишком большой.",
    en: "The text is too large.",
  },
  post_unsupported: {
    ru: "Эту публикацию нельзя изменить здесь: её заголовок записан в форме, которую панель не разбирает.",
    en: "This post cannot be edited here: its header is written in a form the panel does not read.",
  },
  post_unreadable: {
    ru: "Заголовок этой публикации записан в форме, которую панель не разбирает.",
    en: "This post's header is written in a form the panel does not read.",
  },
  posts_unavailable: {
    ru: "Сервис публикаций недоступен. Попробуйте позже.",
    en: "The publishing service is unavailable. Please try later.",
  },
  posts_count: { ru: "Публикаций: {n}.", en: "Posts: {n}." },
  state_draft: { ru: "черновик", en: "draft" },
  state_live: { ru: "на сайте", en: "on the site" },
  state_scheduled: { ru: "запланирована", en: "scheduled" },
  post_loading: { ru: "Загрузка публикации...", en: "Loading the post..." },
  form_edit: { ru: "Изменить публикацию", en: "Edit the post" },
  form_copy: {
    ru: "Новая публикация: копия «{title}»",
    en: "New post: a copy of '{title}'",
  },
  saved_rebuilding: {
    ru: "Сохранено. Сайт пересобирается, обычно это занимает пару минут...",
    en: "Saved. The site is being rebuilt; it usually takes a couple of minutes...",
  },
  saved_not_live: {
    ru: "Изменение сохранено, но за 8 минут так и не появилось на сайте. Сообщите владельцу сайта: сборка могла не пройти.",
    en: "The change is saved but did not appear on the site within 8 minutes. Tell the site's owner: the build may have failed.",
  },
  deleted_live: {
    ru: "Публикация удалена с сайта.",
    en: "The post is removed from the site.",
  },
  published: {
    ru: "Готово: публикация на сайте.",
    en: "Done: the post is on the site.",
  },
  fix_marked: {
    ru: "Исправьте отмеченные поля.",
    en: "Correct the marked fields.",
  },
  slug_taken: {
    ru: "Адрес «{slug}» уже занят другой публикацией. Предложен свободный «{next}»: проверьте его и сохраните ещё раз.",
    en: "The address '{slug}' is taken by another post. A free one is proposed, '{next}': check it and save again.",
  },
  unchanged: {
    ru: "Изменений нет: сохранять было нечего.",
    en: "No changes: there was nothing to save.",
  },
  saved_draft: {
    ru: "Сохранено как черновик: на сайте не показывается.",
    en: "Saved as a draft: not shown on the site.",
  },
  saved_future: {
    ru: "Сохранено. Публикация появится на сайте после первой сборки сайта после её даты.",
    en: "Saved. The post will appear on the site with the first build after its date.",
  },
  confirm_delete: {
    ru: "Удалить публикацию «{title}»? Вернуть её можно будет только из истории репозитория.",
    en: "Delete the post '{title}'? It can be brought back only from the repository's history.",
  },
  deleting: { ru: "Удаление...", en: "Deleting..." },
  deleted: { ru: "Публикация удалена.", en: "The post is deleted." },

  // /admin/users/ - the markup.
  users_noscript: {
    ru: "Для работы со статусами нужен включённый JavaScript.",
    en: "Working with statuses needs JavaScript turned on.",
  },
  users_forbidden: {
    ru: "Статусы назначают метр и администратор.",
    en: "Statuses are given by a metr and an administrator.",
  },
  users_query: { ru: "Имя или email", en: "Name or email" },
  users_find: { ru: "Найти", en: "Find" },
  users_pages: {
    ru: "Страницы списка пользователей",
    en: "Pages of the list of users",
  },
  users_apply: { ru: "Применить", en: "Apply" },
  users_footnote: {
    ru: "Новый статус доходит до сессии участника в течение минуты. Публикации:",
    en: "A new status reaches the member's session within a minute. Posts:",
  },

  // /admin/users/ - the script (admin-users.ts).
  users_not_connected: {
    ru: "Сервис статусов ещё не подключён (site.admin.statusesEndpoint, ADMIN.md).",
    en: "The status service is not connected yet (site.admin.statusesEndpoint, ADMIN.md).",
  },
  refusal_self: {
    ru: "Свой статус менять нельзя.",
    en: "You cannot change your own status.",
  },
  refusal_protected: {
    ru: "Этот администратор защищён: его статус меняется только в настройках сервиса.",
    en: "This administrator is protected: their status changes only in the service's settings.",
  },
  refusal_rank: {
    ru: "Метр не может менять статус метра или администратора и снимать блокировку, поставленную администратором.",
    en: "A metr cannot change the status of a metr or an administrator, nor lift a block an administrator set.",
  },
  refusal_not_found: {
    ru: "Такого пользователя нет.",
    en: "There is no such user.",
  },
  refusal_guest: {
    ru: "Статус «гость» не назначается: его получает только новая учётная запись.",
    en: "The status 'guest' is not given: only a new account gets it.",
  },
  settings_hint_dev: {
    ru: "Сервис статусов не настроен: секретный ключ Clerk не сохранён (npm run statuses:key) или в workers/statuses/settings.local.json нет ADMIN_IDS (ADMIN.md, раздел 3, шаг 4).",
    en: "The status service is not set up: the Clerk secret key is not saved (npm run statuses:key), or workers/statuses/settings.local.json has no ADMIN_IDS (ADMIN.md, section 3, step 4).",
  },
  settings_hint_live: {
    ru: "Сервис статусов не настроен: в настройках воркера нет CLERK_SECRET_KEY или ADMIN_IDS (ADMIN.md, раздел 7).",
    en: "The status service is not set up: the Worker's settings have no CLERK_SECRET_KEY or ADMIN_IDS (ADMIN.md, section 7).",
  },
  users_loading: { ru: "Загрузка...", en: "Loading..." },
  users_unavailable: {
    ru: "Сервис статусов недоступен. Попробуйте позже.",
    en: "The status service is unavailable. Please try later.",
  },
  users_none: { ru: "Никого не найдено.", en: "Nobody found." },
  users_shown: {
    ru: "Показаны {from}-{to} из {total}.",
    en: "Showing {from}-{to} of {total}.",
  },
  note_self: { ru: "Это вы.", en: "This is you." },
  note_protected: {
    ru: "Защищённый администратор.",
    en: "Protected administrator.",
  },
  note_blocked_by_admin: {
    ru: "Заблокирован администратором.",
    en: "Blocked by an administrator.",
  },
  note_blocked_by_metr: {
    ru: "Заблокирован метром.",
    en: "Blocked by a metr.",
  },
  no_name: { ru: "Без имени", en: "No name" },
  registered: { ru: "Регистрация: {date}", en: "Registered: {date}" },
  confirm_block: {
    ru: "Закрыть {who} доступ к материалам сайта?",
    en: "Close the site's materials to {who}?",
  },
  confirm_panel: {
    ru: "Дать {who} статус «{status}»? Он сможет менять публикации и статусы других.",
    en: "Give {who} the status '{status}'? They will be able to change posts and other members' statuses.",
  },
  confirm_status: {
    ru: "Дать {who} статус «{status}»?",
    en: "Give {who} the status '{status}'?",
  },
  status_set: {
    ru: "Статус {who}: «{status}».",
    en: "Status of {who}: '{status}'.",
  },
} satisfies Record<string, Phrase>;
