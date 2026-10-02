// The admin panel for the members' statuses, in the browser: src/pages/admin/users/index.astro is
// the markup, and workers/statuses/ is the service it asks. Added 2026-10-02 with the owner's status
// model (src/config.ts, site.admin; ADMIN.md).
//
// Steps:
// 1. Load Clerk through auth.ts, the one place an instance is created; not signed in: off to the
//    sign-in page, which brings the visitor back here.
// 2. Ask the service for the list. It answers 403 to anyone who is neither metr nor admin, and the
//    page then says who assigns statuses; there is no check of its own here, so the page cannot
//    disagree with the service (an admin named in the service's ADMIN_IDS is an admin even without
//    a status in their metadata).
// 3. Each member gets a list of the statuses the service says the visitor may give, and only for
//    members the visitor may change at all; the service checks every change again anyway.
import type { Clerk } from "@clerk/clerk-js";
import { getClerk, showLoadFailure } from "./auth";
import { site } from "../config";
// Added later on 2026-10-02 at the owner's request: pages of 20 (AdminPager.astro). The
// "Показать ещё" button and its element lookup went with it.
import { bindPager, pageCount } from "./admin-pager";

type Status = (typeof site.admin.statuses)[number];
type User = {
  id: string;
  name: string;
  email: string;
  status: Status;
  statusBy: "" | "admin" | "metr";
  // Added later on 2026-10-02: the service always sent it (Clerk's created_at, milliseconds); the
  // row shows it now. 0 when Clerk gave none.
  createdAt: number;
  protected: boolean;
  self: boolean;
};
type ListAnswer = {
  users: User[];
  total: number;
  you: { id: string; status: Status; assignable: Status[] };
};

// What a metr may change and change to; the service's METR_SCOPE says the same and decides.
// Changed later on 2026-10-02: only "may change" now - guest is never given, so what may be given
// comes from the service alone (`you.assignable`, which no longer holds guest).
const metrScope: readonly string[] = [
  "guest",
  "student",
  "expert",
  "master",
  "blocked",
];

const endpoint = import.meta.env.DEV
  ? site.admin.statusesDevEndpoint
  : site.admin.statusesEndpoint;

function byId<T extends HTMLElement>(id: string, kind: new () => T): T | null {
  const element = document.getElementById(id);
  return element instanceof kind ? element : null;
}
const status = byId("users-status", HTMLParagraphElement);
const forbidden = byId("users-forbidden", HTMLParagraphElement);
const box = byId("users-box", HTMLDivElement);
const searchForm = byId("users-search", HTMLFormElement);
const queryInput = byId("users-query", HTMLInputElement);
const count = byId("users-count", HTMLParagraphElement);
const list = byId("users-list", HTMLUListElement);
const rowTemplate = byId("users-row", HTMLTemplateElement);

const names: Record<string, string> = site.admin.statusNames;

function say(text: string, isError = false): void {
  if (status === null) return;
  status.textContent = text;
  status.classList.toggle("text-red-600", isError);
}

let clerk: Clerk | undefined;
try {
  clerk = await getClerk();
} catch (error) {
  showLoadFailure(status, error);
}
if (clerk !== undefined) await start(clerk);

async function start(clerk: Clerk): Promise<void> {
  if (!clerk.isSignedIn) {
    location.replace(
      site.auth.signIn + "?next=" + encodeURIComponent(site.admin.usersPage),
    );
    return;
  }
  if (endpoint === "") {
    say(
      "Сервис статусов ещё не подключён (site.admin.statusesEndpoint, ADMIN.md).",
      true,
    );
    return;
  }

  // As on /admin/posts/: a 401 or a 403 is tried once more with a fresh token, since a status given
  // a moment ago reaches the token only when Clerk renews it.
  const call = async (action: string, payload: object): Promise<Response> => {
    const send = async (fresh: boolean) => {
      const token = await clerk.session?.getToken({ skipCache: fresh });
      if (token === null || token === undefined) {
        throw new Error("no session token");
      }
      return fetch(`${endpoint}/users/${action}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    };
    const first = await send(false);
    return first.status === 401 || first.status === 403 ? send(true) : first;
  };

  const refusals: Record<string, string> = {
    self: "Свой статус менять нельзя.",
    protected:
      "Этот администратор защищён: его статус меняется только в настройках сервиса.",
    rank: "Метр не может менять статус метра или администратора и снимать блокировку, поставленную администратором.",
    not_found: "Такого пользователя нет.",
    // Added later on 2026-10-02: the service's 403 "guest" (the owner's rule).
    guest:
      "Статус «гость» не назначается: его получает только новая учётная запись.",
  };

  // Added later on 2026-10-02 at the owner's request: say what to fix instead of "unavailable".
  // A 403 to an account whose public metadata holds metr or admin means the session token does not
  // carry the status - the line is missing from Clerk's token template (ADMIN.md 4.1, step 1); the
  // same sentence is in admin-posts.ts. A 503 "not_configured" means the service lacks its secret
  // key or ADMIN_IDS: the local file here, the Worker's settings on the live site.
  const own = clerk.user?.publicMetadata.status;
  const panelStatus =
    own === "admin" || own === "metr" ? (names[own] ?? own) : undefined;
  const tokenHint = `Статус учётной записи «${panelStatus}» есть, но сессия его не передаёт: в шаблоне сессионного токена Clerk нет строки status (ADMIN.md, раздел 3, шаг 1).`;
  // Changed again the same evening: locally the secret key is saved encrypted by
  // `npm run statuses:key` and no longer read from settings.local.json, which holds ADMIN_IDS only.
  const settingsHint = import.meta.env.DEV
    ? "Сервис статусов не настроен: секретный ключ Clerk не сохранён (npm run statuses:key) или в workers/statuses/settings.local.json нет ADMIN_IDS (ADMIN.md, раздел 3, шаг 4)."
    : "Сервис статусов не настроен: в настройках воркера нет CLERK_SECRET_KEY или ADMIN_IDS (ADMIN.md, раздел 7).";

  let query = "";
  let offset = 0;
  let you: ListAnswer["you"] | undefined;
  // Added later on 2026-10-02 at the owner's request: numbered pages of site.admin.pageSize members
  // in place of "Показать ещё". The service is asked for one page at a time, so `offset` is now the
  // first member of the page on show, and `page` its number.
  let page = 1;
  const size = site.admin.pageSize;
  const drawPager = bindPager("users-pager", (target) => {
    void load(target).then(() => box?.scrollIntoView({ block: "start" }));
  });

  // Changed later on 2026-10-02: takes the page to show instead of "append or start over".
  async function load(target: number): Promise<void> {
    page = Math.max(1, target);
    offset = (page - 1) * size;
    say("Загрузка...");
    try {
      const response = await call("list", { query, offset, limit: size });
      // Changed later on 2026-10-02: the token hint for an account that has a panel status.
      if (response.status === 403 && panelStatus !== undefined) {
        say(tokenHint, true);
        return;
      }
      if (response.status === 403) {
        say("");
        if (forbidden !== null) forbidden.hidden = false;
        return;
      }
      // Added later on 2026-10-02: the settings hint (the note above tokenHint).
      if (response.status === 503) {
        const refusal: unknown = await response
          .clone()
          .json()
          .catch(() => undefined);
        if (
          typeof refusal === "object" &&
          refusal !== null &&
          "error" in refusal &&
          refusal.error === "not_configured"
        ) {
          say(settingsHint, true);
          return;
        }
      }
      if (!response.ok) {
        console.error(
          "Admin: the status service answered",
          response.status,
          await response.text(),
        );
        say("Сервис статусов недоступен. Попробуйте позже.", true);
        return;
      }
      const answer = (await response.json()) as ListAnswer;
      you = answer.you;
      // Changed later on 2026-10-02: the page replaces the list, and a page past the end (members
      // removed since, or a stale number) falls back to the last one.
      const last = pageCount(answer.total);
      if (answer.users.length === 0 && page > last) {
        await load(last);
        return;
      }
      list?.replaceChildren(...answer.users.map(row));
      if (count !== null) {
        count.textContent =
          answer.total === 0
            ? "Никого не найдено."
            : `Показаны ${offset + 1}-${offset + answer.users.length} из ${answer.total}.`;
      }
      drawPager?.(page, last);
      if (box !== null) box.hidden = false;
      say("");
    } catch (error) {
      console.error("Admin: the status service could not be asked.", error);
      say("Сервис статусов недоступен. Попробуйте позже.", true);
    }
  }

  // Whether the visitor may change this member at all: the service's rules, read the same way.
  function changeable(user: User): boolean {
    if (you === undefined || user.self || user.protected) return false;
    if (you.status === "admin") return true;
    return (
      metrScope.includes(user.status) &&
      !(user.status === "blocked" && user.statusBy === "admin")
    );
  }

  function note(user: User): string {
    if (user.self) return "Это вы.";
    if (user.protected) return "Защищённый администратор.";
    if (user.status === "blocked") {
      return `Заблокирован ${user.statusBy === "admin" ? "администратором" : "метром"}.`;
    }
    return "";
  }

  function row(user: User): HTMLLIElement {
    const item = rowTemplate?.content.firstElementChild?.cloneNode(true);
    if (!(item instanceof HTMLLIElement)) return document.createElement("li");
    const set = (selector: string, text: string) => {
      const element = item.querySelector(selector);
      if (element !== null) element.textContent = text;
    };
    set("[data-name]", user.name || "Без имени");
    set("[data-email]", user.email);
    // Added later on 2026-10-02 (the template's note): the status badge and the registration date.
    set("[data-status]", names[user.status] ?? user.status);
    set(
      "[data-created]",
      user.createdAt > 0
        ? // Clerk's Backend API counts milliseconds; a value below 10^12 would be seconds (before
          // 2001 in milliseconds), so it is read as such rather than shown as January 1970.
          `Регистрация: ${new Date(
            user.createdAt < 1e12 ? user.createdAt * 1000 : user.createdAt,
          ).toLocaleDateString("ru-RU")}`
        : "",
    );
    set("[data-note]", note(user));
    const choice = item.querySelector<HTMLSelectElement>("[data-choice]");
    const apply = item.querySelector<HTMLButtonElement>("[data-apply]");
    if (choice === null || apply === null) return item;
    const allowed: readonly string[] = changeable(user)
      ? (you?.assignable ?? [])
      : [];
    for (const value of site.admin.statuses) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = names[value] ?? value;
      option.selected = value === user.status;
      option.disabled = value !== user.status && !allowed.includes(value);
      choice.append(option);
    }
    choice.disabled = allowed.length === 0;
    apply.disabled = true;
    choice.addEventListener("change", () => {
      apply.disabled = choice.value === user.status;
    });
    apply.addEventListener(
      "click",
      () => void change(user, choice, apply, item),
    );
    return item;
  }

  async function change(
    user: User,
    choice: HTMLSelectElement,
    apply: HTMLButtonElement,
    item: HTMLLIElement,
  ): Promise<void> {
    const wanted = choice.value;
    const who = user.email || user.name || user.id;
    const question =
      wanted === "blocked"
        ? `Закрыть ${who} доступ к материалам сайта?`
        : wanted === "admin" || wanted === "metr"
          ? `Дать ${who} статус «${names[wanted]}»? Он сможет менять публикации и статусы других.`
          : `Дать ${who} статус «${names[wanted] ?? wanted}»?`;
    if (!confirm(question)) return;
    apply.disabled = true;
    choice.disabled = true;
    say("Сохранение...");
    try {
      const response = await call("set", { userId: user.id, status: wanted });
      const answer: unknown = await response.json().catch(() => undefined);
      if (
        response.ok &&
        typeof answer === "object" &&
        answer !== null &&
        "user" in answer
      ) {
        const updated = answer.user as User;
        item.replaceWith(row(updated));
        say(`Статус ${who}: «${names[updated.status] ?? updated.status}».`);
        return;
      }
      const code =
        typeof answer === "object" && answer !== null && "error" in answer
          ? String(answer.error)
          : "";
      if (code in refusals) {
        say(refusals[code] ?? "", true);
      } else {
        console.error(
          "Admin: the status service answered",
          response.status,
          answer,
        );
        say("Сервис статусов недоступен. Попробуйте позже.", true);
      }
      choice.disabled = false;
      apply.disabled = false;
    } catch (error) {
      console.error("Admin: the status could not be changed.", error);
      say("Сервис статусов недоступен. Попробуйте позже.", true);
      choice.disabled = false;
      apply.disabled = false;
    }
  }

  searchForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    query = queryInput?.value.trim() ?? "";
    // Changed later on 2026-10-02: a new search starts on its first page.
    void load(1);
  });

  await load(1);
}
