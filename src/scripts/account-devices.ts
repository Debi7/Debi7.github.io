// The "Устройства" page of the account card: the visitor's signed-in devices, five to a page.
// Added 2026-09-28 at the owner's request. Clerk's own list, the "Активные устройства" block under
// Безопасность, shows every session in one column, and a visitor who signs in from several browsers
// gets a list taller than the screen (the owner's screenshot had seven). Clerk's list cannot be
// paginated from outside, so account.astro hides it (appearance, profileSection__activeDevices) and
// adds this page through the documented `customPages` option of mountUserProfile() ("Add custom
// pages and links to the <UserProfile /> component", Clerk Core 3, JavaScript).
//
// Data and actions are Clerk's public API only: user.getSessions() lists the active sessions with
// their latest activity, and session.revoke() signs a device out - what Clerk's own "Выйти из
// устройства" does. The texts are ruRU's own words for the block it replaces. The markup is the
// three templates in account.astro (CLAUDE.md, "A component owns the markup its own script binds
// to"); this file clones and fills them. The pager looks like the site's lists (Pagination.astro)
// and follows the same rule for which numbers show, site.pagination.everyNumberUpTo; it is buttons,
// not links, because the pages exist only in the browser. pageNumbers() in src/lib/lists.ts could
// not be imported for the rule: that module imports astro:content, which does not run in a browser.
import type { Clerk } from "@clerk/clerk-js";
import { site } from "../config";

type Session = Awaited<
  ReturnType<NonNullable<Clerk["user"]>["getSessions"]>
>[number];

// The owner's number, 2026-09-28: five devices to a page, as five posts to a list page.
const perPage = 5;

const time = new Intl.DateTimeFormat("ru", {
  hour: "2-digit",
  minute: "2-digit",
});
const day = new Intl.DateTimeFormat("ru", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

// "Сегодня в 02:27", as Clerk's list words it; a date for anything older than yesterday.
function when(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(date, today)) return `Сегодня в ${time.format(date)}`;
  if (same(date, yesterday)) return `Вчера в ${time.format(date)}`;
  return `${day.format(date)} в ${time.format(date)}`;
}

function place(session: Session): string {
  const { ipAddress, city, country } = session.latestActivity;
  const where = [city, country].filter(Boolean).join(", ");
  return [ipAddress, where && `(${where})`].filter(Boolean).join(" ");
}

// Which page numbers the pager shows: all of them up to everyNumberUpTo pages, beyond that the
// first, the current and the last, with a gap between them - pageNumbers() in lists.ts.
function numbers(current: number, last: number): (number | "gap")[] {
  const shown =
    last <= site.pagination.everyNumberUpTo
      ? Array.from({ length: last }, (_, i) => i + 1)
      : [...new Set([1, current, last])];
  const out: (number | "gap")[] = [];
  let previous = 0;
  for (const n of shown) {
    if (n - previous > 1) out.push("gap");
    out.push(n);
    previous = n;
  }
  return out;
}

// Element, not HTMLElement: the icon template holds an svg, which is an SVGElement, and the first
// run left the navbar item without its icon because of that check.
function clone(id: string): Element | undefined {
  const template = document.getElementById(id);
  const node =
    template instanceof HTMLTemplateElement
      ? template.content.firstElementChild?.cloneNode(true)
      : undefined;
  return node instanceof Element ? node : undefined;
}

/** The custom page for mountUserProfile(): label, address, icon and content. */
export function devicesPage(clerk: Clerk) {
  return {
    label: "Устройства",
    url: "devices",
    mountIcon: (el: HTMLDivElement) => {
      const icon = clone("devices-icon-template");
      if (icon) el.replaceChildren(icon);
    },
    unmountIcon: (el?: HTMLDivElement) => el?.replaceChildren(),
    mount: (el: HTMLDivElement) => void mount(el, clerk),
    unmount: (el?: HTMLDivElement) => el?.replaceChildren(),
  };
}

async function mount(el: HTMLDivElement, clerk: Clerk): Promise<void> {
  const root = clone("devices-template");
  if (root === undefined) return;
  el.replaceChildren(root);
  const list = root.querySelector<HTMLElement>("[data-devices-list]");
  const pager = root.querySelector<HTMLElement>("[data-devices-pager]");
  const pageNumbers = root.querySelector<HTMLElement>("[data-devices-numbers]");
  const prev = root.querySelector<HTMLButtonElement>("[data-devices-prev]");
  const next = root.querySelector<HTMLButtonElement>("[data-devices-next]");
  const status = root.querySelector<HTMLElement>("[data-devices-status]");
  if (!list || !pager || !pageNumbers || !prev || !next || !status) return;

  let sessions: Session[];
  try {
    sessions = (await clerk.user?.getSessions()) ?? [];
  } catch (error) {
    console.error("Account devices: the sessions could not be loaded.", error);
    status.textContent = "Не удалось загрузить список. Обновите страницу.";
    return;
  }
  const currentId = clerk.session?.id;
  // This device first, as in Clerk's list; the rest by last activity, newest first.
  sessions.sort(
    (a, b) =>
      Number(b.id === currentId) - Number(a.id === currentId) ||
      b.lastActiveAt.getTime() - a.lastActiveAt.getTime(),
  );
  status.remove();
  let page = 1;

  const render = () => {
    const last = Math.max(1, Math.ceil(sessions.length / perPage));
    page = Math.min(page, last);
    list.replaceChildren(
      ...sessions
        .slice((page - 1) * perPage, page * perPage)
        .flatMap((session) => {
          const item = clone("device-item-template");
          return item ? [fill(item, session)] : [];
        }),
    );
    // A class, not the hidden attribute: the pager carries Tailwind's `flex`, whose display beats
    // the attribute's, so a single page still showed "Назад 1 Далее" (seen on 2026-09-28 with four
    // devices). `hidden` is generated after `flex` and wins, as on #disqus_thread.
    pager.classList.toggle("hidden", last === 1);
    prev.disabled = page === 1;
    next.disabled = page === last;
    pageNumbers.replaceChildren(
      ...numbers(page, last).flatMap((entry) => {
        const node = clone(
          entry === "gap"
            ? "devices-gap-template"
            : entry === page
              ? "devices-current-template"
              : "devices-number-template",
        );
        if (node === undefined) return [];
        if (entry !== "gap") {
          node.textContent = String(entry);
          if (entry !== page) {
            node.setAttribute("aria-label", `Страница ${entry}`);
            node.addEventListener("click", () => go(entry));
          }
        }
        return [node];
      }),
    );
  };

  const go = (target: number) => {
    page = target;
    render();
  };

  // Element, like clone() returns; the item is an li and needs nothing HTMLElement-only.
  const fill = (item: Element, session: Session): Element => {
    const { deviceType, browserName, browserVersion, isMobile } =
      session.latestActivity;
    const set = (name: string, text: string) => {
      const field = item.querySelector(`[data-device-${name}]`);
      if (field) field.textContent = text;
    };
    set("name", deviceType || (isMobile ? "Телефон" : "Компьютер"));
    set("browser", [browserName, browserVersion].filter(Boolean).join(" "));
    set("place", place(session));
    set("time", when(session.lastActiveAt));
    const current = item.querySelector<HTMLElement>("[data-device-current]");
    const revoke = item.querySelector<HTMLButtonElement>(
      "[data-device-revoke]",
    );
    if (session.id === currentId) {
      if (current) current.hidden = false;
      revoke?.remove();
    } else {
      revoke?.addEventListener("click", async () => {
        revoke.disabled = true;
        try {
          await session.revoke();
          sessions = sessions.filter((s) => s.id !== session.id);
          render();
        } catch (error) {
          console.error(
            "Account devices: the session could not be ended.",
            error,
          );
          revoke.disabled = false;
        }
      });
    }
    return item;
  };

  prev.addEventListener("click", () => go(page - 1));
  next.addEventListener("click", () => go(page + 1));
  render();
}
