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
// Added 2026-10-12 with the two interface languages (src/i18n/lang.ts): every message in both
// languages, from src/i18n/admin.ts, written with setPhrase() so that a language switch shows it in
// the new language at once, as on /admin/posts/ (admin-posts.ts says why the panel does not reload).
// What cannot hold a span - the options of a status list, a confirm() dialog - gets the language
// shown, and the options are written again after a switch.
import { adminUi } from "../i18n/admin";
import { format, type Phrase, type Words } from "../i18n/lang";
import { phrase, setPhrase } from "./lang";

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

// Changed 2026-10-12: Phrase, each name in both languages (it was Record<string, string>).
const names: Record<string, Phrase> = site.admin.statusNames;

// Changed 2026-10-12: Words, written with setPhrase (both languages); it took a string.
function say(text: Words, isError = false): void {
  if (status === null) return;
  setPhrase(status, text);
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
    // Changed 2026-10-12: the message from src/i18n/admin.ts, here and in every say() below.
    say(adminUi.users_not_connected, true);
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

  // Changed 2026-10-12: both languages, from src/i18n/admin.ts (refusal_*), where the Russian
  // sentences that stood here are the ru halves.
  const refusals: Record<string, Phrase> = {
    self: adminUi.refusal_self,
    protected: adminUi.refusal_protected,
    rank: adminUi.refusal_rank,
    not_found: adminUi.refusal_not_found,
    // Added later on 2026-10-02: the service's 403 "guest" (the owner's rule).
    guest: adminUi.refusal_guest,
  };

  // Added later on 2026-10-02 at the owner's request: say what to fix instead of "unavailable".
  // A 403 to an account whose public metadata holds metr or admin means the session token does not
  // carry the status - the line is missing from Clerk's token template (ADMIN.md 4.1, step 1); the
  // same sentence is in admin-posts.ts. A 503 "not_configured" means the service lacks its secret
  // key or ADMIN_IDS: the local file here, the Worker's settings on the live site.
  const own = clerk.user?.publicMetadata.status;
  const panelStatus =
    own === "admin" || own === "metr" ? (names[own] ?? own) : undefined;
  // Changed 2026-10-12: the shared sentence of src/i18n/admin.ts, in both languages.
  const tokenHint = format(adminUi.token_hint, { status: panelStatus ?? "" });
  // Changed again the same evening: locally the secret key is saved encrypted by
  // `npm run statuses:key` and no longer read from settings.local.json, which holds ADMIN_IDS only.
  // Changed 2026-10-12: both languages, from src/i18n/admin.ts.
  const settingsHint = import.meta.env.DEV
    ? adminUi.settings_hint_dev
    : adminUi.settings_hint_live;

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
    say(adminUi.users_loading);
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
        say(adminUi.users_unavailable, true);
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
        // Changed 2026-10-12: both languages (setPhrase); it set the Russian line as text.
        setPhrase(
          count,
          answer.total === 0
            ? adminUi.users_none
            : format(adminUi.users_shown, {
                from: offset + 1,
                to: offset + answer.users.length,
                total: answer.total,
              }),
        );
      }
      drawPager?.(page, last);
      if (box !== null) box.hidden = false;
      say("");
    } catch (error) {
      console.error("Admin: the status service could not be asked.", error);
      say(adminUi.users_unavailable, true);
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

  // Changed 2026-10-12: answers Words in both languages (src/i18n/admin.ts); it answered the
  // Russian sentences.
  function note(user: User): Words {
    if (user.self) return adminUi.note_self;
    if (user.protected) return adminUi.note_protected;
    if (user.status === "blocked") {
      return user.statusBy === "admin"
        ? adminUi.note_blocked_by_admin
        : adminUi.note_blocked_by_metr;
    }
    return "";
  }

  function row(user: User): HTMLLIElement {
    const item = rowTemplate?.content.firstElementChild?.cloneNode(true);
    if (!(item instanceof HTMLLIElement)) return document.createElement("li");
    // Changed 2026-10-12: Words, written with setPhrase (both languages); it set a string as text.
    const set = (selector: string, text: Words) => {
      const element = item.querySelector(selector);
      if (element !== null) setPhrase(element, text);
    };
    set("[data-name]", user.name || adminUi.no_name);
    set("[data-email]", user.email);
    // Added later on 2026-10-02 (the template's note): the status badge and the registration date.
    set("[data-status]", names[user.status] ?? user.status);
    set(
      "[data-created]",
      user.createdAt > 0
        ? // Clerk's Backend API counts milliseconds; a value below 10^12 would be seconds (before
          // 2001 in milliseconds), so it is read as such rather than shown as January 1970.
          // Changed 2026-10-12: the line in both languages, the date in each language's form; it
          // was "Регистрация:" and the date in "ru-RU".
          registered(
            new Date(
              user.createdAt < 1e12 ? user.createdAt * 1000 : user.createdAt,
            ),
          )
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
      // Changed 2026-10-12: the name in the language shown - an option holds text only (MDN,
      // "<option>": only text content in a traditional select) - and written again after a
      // language switch by the listener at the end of start(). It was names[value] ?? value.
      option.textContent = phrase(names[value] ?? value);
      option.dataset.status = value;
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
    // Changed 2026-10-12: the question in the language shown (a dialog holds plain text); it was
    // one of three Russian sentences, now confirm_block, confirm_panel and confirm_status.
    const status = names[wanted] ?? wanted;
    const question =
      wanted === "blocked"
        ? format(adminUi.confirm_block, { who })
        : wanted === "admin" || wanted === "metr"
          ? format(adminUi.confirm_panel, { who, status })
          : format(adminUi.confirm_status, { who, status });
    if (!confirm(phrase(question))) return;
    apply.disabled = true;
    choice.disabled = true;
    say(adminUi.saving);
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
        // Changed 2026-10-12: both languages (it was the Russian line "Статус who: ...").
        say(
          format(adminUi.status_set, {
            who,
            status: names[updated.status] ?? updated.status,
          }),
        );
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
        say(adminUi.users_unavailable, true);
      }
      choice.disabled = false;
      apply.disabled = false;
    } catch (error) {
      console.error("Admin: the status could not be changed.", error);
      say(adminUi.users_unavailable, true);
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

  // Added 2026-10-12: the status lists' options hold plain text, so a language switch writes them
  // again in the new language; everything else on the page carries both languages already.
  document.addEventListener(site.i18n.changeEvent, () => {
    for (const option of document.querySelectorAll<HTMLOptionElement>(
      "#users-list option[data-status]",
    )) {
      const value = option.dataset.status ?? "";
      option.textContent = phrase(names[value] ?? value);
    }
  });

  await load(1);
}

// Added 2026-10-12: "Регистрация: 12.10.2026" / "Registered: 10/12/2026", each date in its own
// language's form. Intl's own data decides the form, which can differ between browsers; this is a
// line for the panel's users, not something compared or stored.
function registered(date: Date): Phrase {
  return {
    ru: format(adminUi.registered, {
      date: date.toLocaleDateString("ru-RU"),
    }).ru,
    en: format(adminUi.registered, {
      date: date.toLocaleDateString("en-GB"),
    }).en,
  };
}
