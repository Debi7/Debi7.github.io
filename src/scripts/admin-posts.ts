// The admin panel for posts, in the browser: src/pages/admin/posts/index.astro is the markup, and
// workers/content-admin/ is the service it asks. Added 2026-10-02; the design is the consilium
// verdict .specify/consilium/2026-10-02-admin-posts.md, and ADMIN.md is the how-to.
//
// Steps:
// 1. Load Clerk through auth.ts, the one place an instance is created; a page script, like the
//    three auth pages, so the Clerk chunk is paid only by whoever opens the panel. Not signed in:
//    off to the sign-in page, which brings the editor back here (`next`).
// 2. The status in the user's public metadata (site.admin.postEditors) decides what the page
//    shows. That is presentation: the service checks the same status in the session token on
//    every request and refuses
//    everyone else, whatever this script does.
// 3. List the posts, and open the form to add one or to edit one. A save sends the fields and the
//    text to the service, which commits them; the page then waits until the saved version is on
//    the site, so that "published" is said only when it is true.
//
// How the page knows the new version is live, without asking GitHub (the owner expects the
// hosting to change): it fetches the post's own page with the cache bypassed. A new post is live
// when its address answers 200, a deleted one when it answers 404, and an edited one when the
// page's article:modified_time is the lastmod the service stamped on that save - an edited post
// already answers 200 with its old text, so 200 alone would say "published" too early. The wait
// ends after WAIT_MS with advice to tell the owner: a build that fails publishes nothing.
//
// A draft, or a post dated in the future, is not on the site after its build at all, so the page
// says so instead of waiting.
import type { Clerk } from "@clerk/clerk-js";
import { getClerk, showLoadFailure } from "./auth";
import { site } from "../config";
// From post-url.ts, not posts.ts: posts.ts would bring astro:content and every post into the
// browser (post-url.ts says what that cost on the first build).
import { postUrl } from "../lib/post-url";
import { formatDateTime } from "../lib/date";
// Added later on 2026-10-02 at the owner's request: 20 posts to a page (AdminPager.astro).
import { bindPager, pageCount } from "./admin-pager";
// Added 2026-10-12 with the two interface languages (src/i18n/lang.ts): every message of the panel
// in both languages, from src/i18n/admin.ts, written with setPhrase() and setLangAttr() so that a
// language switch shows them in the new language at once - the page does not reload, because the
// form may hold unsaved text. A confirm() dialog takes plain text, so it gets the language shown.
// What goes into a post (the " (копия)" mark of a copy's title) stays Russian: it is content.
import { adminUi } from "../i18n/admin";
import { format, type Phrase, type Words } from "../i18n/lang";
import { phrase, setLangAttr, setPhrase } from "./lang";

type Fields = {
  title: string;
  description: string;
  date: string;
  tags: string[];
  categories: string[];
  draft: boolean;
};
type Listed = Fields & { slug: string; sha: string; editable: boolean };
type Problem = { field: string; code: string };
type Opened = { slug: string; sha: string } | undefined;

// About as long as a build of the site and its deployment take with a queue in front of them
// (a local build takes about a minute, 2026-10-02).
const WAIT_MS = 8 * 60_000;

// import.meta.env.DEV is replaced at build time, so a bundle carries one address
// (src/config.ts says why there are two).
const endpoint = import.meta.env.DEV
  ? site.admin.devEndpoint
  : site.admin.endpoint;

// An element of the page by id, or null when it is missing or of another kind.
function byId<T extends HTMLElement>(id: string, kind: new () => T): T | null {
  const element = document.getElementById(id);
  return element instanceof kind ? element : null;
}
const status = byId("admin-status", HTMLParagraphElement);
const forbidden = byId("admin-forbidden", HTMLParagraphElement);
const listBox = byId("admin-list", HTMLDivElement);
const list = byId("admin-posts", HTMLUListElement);
const rowTemplate = byId("admin-post-row", HTMLTemplateElement);
const termTemplate = byId("admin-term", HTMLTemplateElement);
const form = byId("admin-editor", HTMLFormElement);
const heading = byId("admin-editor-heading", HTMLHeadingElement);
const formError = byId("admin-form-error", HTMLParagraphElement);
const newButton = byId("admin-new", HTMLButtonElement);
const cancelButton = byId("admin-cancel", HTMLButtonElement);
const input = {
  title: byId("admin-title", HTMLInputElement),
  slug: byId("admin-slug", HTMLInputElement),
  date: byId("admin-date", HTMLInputElement),
  description: byId("admin-description", HTMLInputElement),
  tags: byId("admin-tags", HTMLInputElement),
  categories: byId("admin-categories", HTMLInputElement),
  draft: byId("admin-draft", HTMLInputElement),
  body: byId("admin-body", HTMLTextAreaElement),
};

// What the service's problem codes mean, in the site's language.
// Changed 2026-10-12: in both languages, from src/i18n/admin.ts, where the Russian texts that stood
// here are the ru halves (problem_*).
const problemText: Record<string, Phrase> = {
  required: adminUi.problem_required,
  too_long: adminUi.problem_too_long,
  too_many: adminUi.problem_too_many,
  format: adminUi.problem_format,
  reserved: adminUi.problem_reserved,
  line_break: adminUi.problem_line_break,
  duplicate: adminUi.problem_duplicate,
  html: adminUi.problem_html,
  link: adminUi.problem_link,
  type: adminUi.problem_type,
  unknown: adminUi.problem_unknown,
};

let opened: Opened;
let busy = false;
let posts: Listed[] = [];
// Added later on 2026-10-02: the page of the list on show, kept across a save or a deletion, which
// reload the list.
let page = 1;

// Changed 2026-10-12: Words, and written with setPhrase (both languages); it took a string.
function say(text: Words, isError = false): void {
  if (status === null) return;
  setPhrase(status, text);
  status.classList.toggle("text-red-600", isError);
}

// The offset the posts write their dates in: the club's time, +03:00 (src/lib/date.ts).
const clubOffset = formatDateTime(new Date()).slice(19);

// A post's date for the form's datetime-local field, in the club's time.
function toLocalInput(date: string): string {
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime())
    ? ""
    : formatDateTime(parsed).slice(0, 19);
}

function fromLocalInput(value: string): string {
  const full = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)
    ? `${value}:00`
    : value;
  return `${full}${clubOffset}`;
}

function terms(value: string, lower: boolean): string[] {
  const all = value
    .split(",")
    .map((t) => (lower ? t.trim().toLowerCase() : t.trim()))
    .filter((t) => t !== "");
  return [...new Set(all)];
}

function isLive(fields: Pick<Fields, "draft" | "date">): boolean {
  return !fields.draft && new Date(fields.date).getTime() <= Date.now();
}

function setBusy(value: boolean): void {
  busy = value;
  for (const button of document.querySelectorAll<HTMLButtonElement>(
    "#admin-list button, #admin-editor button",
  )) {
    button.disabled = value || button.dataset.locked === "true";
  }
}

// Start.
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
      site.auth.signIn + "?next=" + encodeURIComponent(site.admin.postsPage),
    );
    return;
  }
  const status = clerk.user?.publicMetadata.status;
  const editors: readonly string[] = site.admin.postEditors;
  if (typeof status !== "string" || !editors.includes(status)) {
    say("");
    if (forbidden !== null) forbidden.hidden = false;
    return;
  }
  if (endpoint === "") {
    // Changed 2026-10-12: the message from src/i18n/admin.ts, here and in every say() below.
    say(adminUi.posts_not_connected, true);
    return;
  }

  // One request to the service. A 401 is tried once more with a fresh token (Clerk renews them
  // every 60 seconds), and so is a 403: a status granted a moment ago is not in the cached token yet.
  const call = async (action: string, payload: object): Promise<Response> => {
    const send = async (fresh: boolean) => {
      const token = await clerk.session?.getToken({ skipCache: fresh });
      if (token === null || token === undefined) {
        throw new Error("no session token");
      }
      return fetch(`${endpoint}/posts/${action}`, {
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

  // A failure the editor can act on gets a sentence; anything else is "unavailable", with the
  // service's answer in the console for whoever is testing.
  // Changed 2026-10-12: answers a Phrase (both languages); it answered a string.
  const explain = async (response: Response): Promise<Phrase> => {
    const answer: unknown = await response.json().catch(() => undefined);
    const code =
      typeof answer === "object" && answer !== null && "error" in answer
        ? String(answer.error)
        : "";
    // Added later on 2026-10-02 at the owner's request: this page asks the service only after the
    // account's public metadata showed metr or admin (start() above), so a "forbidden" here means
    // the session token does not carry that status - the line is missing from Clerk's token
    // template (ADMIN.md 4.1, step 1). The same sentence is in admin-users.ts.
    if (response.status === 403 && code === "forbidden") {
      const names: Record<string, Phrase> = site.admin.statusNames;
      return format(adminUi.token_hint, { status: names[status] ?? status });
    }
    if (response.status === 403) {
      return adminUi.posts_no_rights;
    }
    if (code === "exists") return adminUi.post_exists;
    if (code === "conflict") {
      return adminUi.post_conflict;
    }
    if (code === "not_found") return adminUi.post_not_found;
    if (code === "too_large") return adminUi.post_too_large;
    if (code === "unsupported") {
      return adminUi.post_unsupported;
    }
    console.error("Admin: the service answered", response.status, answer);
    return adminUi.posts_unavailable;
  };

  // Added later on 2026-10-02: the pager; a click draws that page and brings the list into view.
  const drawPager = bindPager("admin-pager", (target) => {
    page = target;
    render();
    listBox?.scrollIntoView({ block: "start" });
  });

  async function load(): Promise<void> {
    try {
      const response = await call("list", {});
      if (!response.ok) {
        say(await explain(response), true);
        return;
      }
      const answer = (await response.json()) as { posts: Listed[] };
      posts = answer.posts;
      render();
      say(format(adminUi.posts_count, { n: posts.length }));
      if (listBox !== null) listBox.hidden = false;
    } catch (error) {
      console.error("Admin: the service could not be asked.", error);
      say(adminUi.posts_unavailable, true);
    }
  }

  function render(): void {
    if (list === null || rowTemplate === null) return;
    list.replaceChildren();
    // Changed later on 2026-10-02: one page of the list, site.admin.pageSize posts; a page past the
    // end after a deletion falls back to the last one.
    const last = pageCount(posts.length);
    page = Math.min(Math.max(page, 1), last);
    const size = site.admin.pageSize;
    for (const post of posts.slice((page - 1) * size, page * size)) {
      const row = rowTemplate.content.firstElementChild?.cloneNode(true);
      if (!(row instanceof HTMLLIElement)) continue;
      const link = row.querySelector<HTMLAnchorElement>("[data-title]");
      if (link !== null) {
        link.textContent = post.title || post.slug;
        link.href = postUrl(post);
      }
      const set = (selector: string, text: string) => {
        const element = row.querySelector(selector);
        if (element !== null) element.textContent = text;
      };
      set(
        "[data-date]",
        toLocalInput(post.date).replace("T", " ").slice(0, 16),
      );
      // Changed 2026-10-12: both languages (setPhrase); it set "черновик", "на сайте" or
      // "запланирована" as text.
      const state = row.querySelector("[data-state]");
      if (state !== null) {
        setPhrase(
          state,
          post.draft
            ? adminUi.state_draft
            : isLive(post)
              ? adminUi.state_live
              : adminUi.state_scheduled,
        );
      }
      set("[data-slug]", post.slug);
      const edit = row.querySelector<HTMLButtonElement>("[data-edit]");
      if (edit !== null) {
        if (!post.editable) {
          edit.dataset.locked = "true";
          edit.disabled = true;
          // Changed 2026-10-12: both languages (setLangAttr); it was the Russian sentence.
          setLangAttr(edit, "title", adminUi.post_unreadable);
        }
        edit.addEventListener("click", () => void openPost(post));
      }
      // Added later on 2026-10-02: the copy, locked like the edit when the panel cannot read the
      // post's header (it would copy nothing of it).
      const copy = row.querySelector<HTMLButtonElement>("[data-copy]");
      if (copy !== null) {
        if (!post.editable) {
          copy.dataset.locked = "true";
          copy.disabled = true;
          // Changed 2026-10-12: as for the edit button above.
          setLangAttr(copy, "title", adminUi.post_unreadable);
        }
        copy.addEventListener("click", () => void copyPost(post));
      }
      row
        .querySelector<HTMLButtonElement>("[data-delete]")
        ?.addEventListener("click", () => void remove(post));
      list.append(row);
    }
    drawPager?.(page, last);
    suggest();
  }

  // The tags and categories the posts already use, most used first, as buttons under their
  // fields: a click adds one, so that a new post joins the existing tags instead of starting a
  // near-duplicate.
  function suggest(): void {
    const fill = (inputId: string, values: string[]) => {
      const box = document.querySelector(`[data-terms-for="${inputId}"]`);
      const target = byId(inputId, HTMLInputElement);
      if (box === null || target === null || termTemplate === null) return;
      const counts = new Map<string, number>();
      for (const value of values) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }
      box.replaceChildren();
      for (const [value] of [...counts].sort((a, b) => b[1] - a[1])) {
        const button = termTemplate.content.firstElementChild?.cloneNode(true);
        if (!(button instanceof HTMLButtonElement)) continue;
        button.textContent = value;
        button.addEventListener("click", () => {
          const current = terms(target.value, false);
          if (!current.includes(value)) {
            target.value = [...current, value].join(", ");
          }
        });
        box.append(button);
      }
    };
    fill(
      "admin-tags",
      posts.flatMap((p) => p.tags),
    );
    fill(
      "admin-categories",
      posts.flatMap((p) => p.categories),
    );
  }

  function clearErrors(): void {
    for (const element of document.querySelectorAll<HTMLElement>(
      "[data-error-for]",
    )) {
      element.hidden = true;
    }
    if (formError !== null) formError.hidden = true;
  }

  // Changed 2026-10-12: the title is a Phrase, written with setPhrase (it was a string).
  function showForm(
    title: Phrase,
    values: Fields & { body: string },
    slug?: string,
  ): void {
    if (form === null || heading === null) return;
    clearErrors();
    setPhrase(heading, title);
    if (input.title) input.title.value = values.title;
    if (input.slug) {
      input.slug.value = slug ?? "";
      input.slug.readOnly = slug !== undefined;
    }
    if (input.date) input.date.value = toLocalInput(values.date);
    if (input.description) input.description.value = values.description;
    if (input.tags) input.tags.value = values.tags.join(", ");
    if (input.categories) input.categories.value = values.categories.join(", ");
    if (input.draft) input.draft.checked = values.draft;
    if (input.body) input.body.value = values.body;
    if (listBox !== null) listBox.hidden = true;
    form.hidden = false;
    input.title?.focus();
  }

  function closeForm(): void {
    if (form !== null) form.hidden = true;
    if (listBox !== null) listBox.hidden = false;
    opened = undefined;
  }

  async function openPost(post: Listed): Promise<void> {
    if (busy) return;
    setBusy(true);
    say(adminUi.post_loading);
    try {
      const response = await call("get", { slug: post.slug });
      if (!response.ok) {
        say(await explain(response), true);
        return;
      }
      const { post: full } = (await response.json()) as {
        post: { slug: string; sha: string; fields: Fields; body: string };
      };
      opened = { slug: full.slug, sha: full.sha };
      say("");
      showForm(
        adminUi.form_edit,
        { ...full.fields, body: full.body },
        full.slug,
      );
    } catch (error) {
      console.error("Admin: the post could not be loaded.", error);
      say(adminUi.posts_unavailable, true);
    } finally {
      setBusy(false);
    }
  }

  // Added later on 2026-10-02 at the owner's request ("a copy button: Markdown is not for everyone,
  // and changing the fields of a copy is easier"). Opens the form for a NEW post filled with every
  // field and the text of `post`, except two:
  // - the address, which must be unique: two posts cannot share /posts/<slug>/, and the comments
  //   thread hangs on the address too. The form proposes "<slug>-copy", then "-copy-2", "-copy-3",
  //   the first one no post in the list has (drafts and future posts are in the list too), cut to
  //   the service's 80 characters. It stays editable, and the service refuses an address already
  //   taken anyway ("Публикация с таким адресом уже есть"), so even a list that is out of date
  //   cannot overwrite a post;
  // - the date, which is now: a copy is a new post, and the original's date would file it among
  //   the old ones.
  // Nothing is saved until the editor presses save, as for a new post.
  async function copyPost(post: Listed): Promise<void> {
    if (busy) return;
    setBusy(true);
    say(adminUi.post_loading);
    try {
      const response = await call("get", { slug: post.slug });
      if (!response.ok) {
        say(await explain(response), true);
        return;
      }
      const { post: full } = (await response.json()) as {
        post: { slug: string; sha: string; fields: Fields; body: string };
      };
      opened = undefined;
      say("");
      // The owner, the same evening: by default a copy must conflict with nothing. So the title is
      // marked as well, within the service's 200 characters: two equal titles in this list would
      // invite editing or deleting the wrong post.
      const suffix = " (копия)";
      showForm(
        format(adminUi.form_copy, { title: full.fields.title || full.slug }),
        {
          ...full.fields,
          title: full.fields.title.slice(0, 200 - suffix.length) + suffix,
          date: new Date().toISOString(),
          body: full.body,
        },
      );
      if (input.slug) input.slug.value = freeSlug(full.slug, "-copy");
    } catch (error) {
      console.error("Admin: the post could not be loaded.", error);
      say(adminUi.posts_unavailable, true);
    } finally {
      setBusy(false);
    }
  }

  // The first of "<base><stem>", "<base><stem>-2", "<base><stem>-3", ... that no listed post has,
  // cut to the service's 80 characters: "<slug>-copy..." for a copy (copyPost's note), and
  // "<slug>-2..." for an address found taken on save (an empty stem; "<slug>" itself is taken).
  function freeSlug(base: string, stem: string): string {
    const taken = new Set(posts.map((p) => p.slug));
    for (let n = 1; ; n++) {
      const suffix = n === 1 ? stem : `${stem}-${n}`;
      if (suffix === "") continue;
      const candidate =
        base.slice(0, 80 - suffix.length).replace(/-+$/, "") + suffix;
      if (!taken.has(candidate)) return candidate;
    }
  }

  // Waits until the post's own page shows what was saved (the header of this file).
  async function waitUntil(
    slug: string,
    done: (response: Response, html: string) => boolean,
  ): Promise<boolean> {
    const deadline = Date.now() + WAIT_MS;
    let pause = 2000;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, pause));
      pause = 10_000;
      try {
        const response = await fetch(`${postUrl({ slug })}?v=${Date.now()}`, {
          cache: "no-store",
        });
        const html = response.ok ? await response.text() : "";
        if (done(response, html)) return true;
      } catch {
        // No answer this time; the next attempt decides.
      }
    }
    return false;
  }

  const modifiedTime = (html: string) =>
    /<meta property="article:modified_time" content="([^"]+)"/.exec(html)?.[1];

  async function publishWait(
    slug: string,
    expectation: "created" | "edited" | "deleted",
    lastmod?: string,
  ): Promise<void> {
    say(adminUi.saved_rebuilding);
    const live = await waitUntil(slug, (response, html) =>
      expectation === "created"
        ? response.status === 200
        : expectation === "deleted"
          ? response.status === 404
          : Date.parse(modifiedTime(html) ?? "") === Date.parse(lastmod ?? ""),
    );
    if (!live) {
      say(adminUi.saved_not_live, true);
      return;
    }
    say(expectation === "deleted" ? adminUi.deleted_live : adminUi.published);
  }

  async function save(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (busy) return;
    clearErrors();
    const fields: Fields = {
      title: input.title?.value.trim() ?? "",
      description: input.description?.value.trim() ?? "",
      date: fromLocalInput(input.date?.value ?? ""),
      tags: terms(input.tags?.value ?? "", true),
      categories: terms(input.categories?.value ?? "", false),
      draft: input.draft?.checked ?? false,
    };
    const slug = opened?.slug ?? input.slug?.value.trim() ?? "";
    const editing = opened;
    setBusy(true);
    say(adminUi.saving);
    try {
      const response = await call("save", {
        slug,
        ...(editing === undefined ? {} : { sha: editing.sha }),
        fields,
        body: input.body?.value ?? "",
      });
      if (response.status === 400) {
        const { problems } = (await response.json()) as {
          problems: Problem[];
        };
        for (const problem of problems) {
          const target = document.querySelector<HTMLElement>(
            `[data-error-for="${problem.field}"]`,
          );
          const text = problemText[problem.code] ?? problemText.type;
          // Changed 2026-10-12: setPhrase, both languages (it set textContent).
          if (target !== null) {
            setPhrase(target, text);
            target.hidden = false;
          } else if (formError !== null) {
            setPhrase(formError, text);
            formError.hidden = false;
          }
        }
        say(adminUi.fix_marked, true);
        return;
      }
      // Added later on 2026-10-02, the owner's "by default, no conflicts": a new post whose address
      // was taken after the form opened (by another editor, or a copy saved twice) is never written
      // over - the service refuses it - and the panel now also reloads the list and puts the next
      // free address into the field, for the editor to check and save again. A copy's address goes
      // on in its own sequence ("-copy-2"), any other gets "-2", "-3".
      if (response.status === 409 && editing === undefined) {
        const refusal: unknown = await response
          .clone()
          .json()
          .catch(() => undefined);
        if (
          typeof refusal === "object" &&
          refusal !== null &&
          "error" in refusal &&
          refusal.error === "exists"
        ) {
          await load();
          // load() shows the list again; the form stays the one thing on screen.
          if (listBox !== null) listBox.hidden = true;
          const copyOf = /^(.+?)-copy(?:-\d+)?$/.exec(slug);
          const next =
            copyOf === null
              ? freeSlug(slug, "")
              : freeSlug(copyOf[1] ?? slug, "-copy");
          if (input.slug) input.slug.value = next;
          // Changed 2026-10-12: a Phrase (adminUi.slug_taken), written with setPhrase.
          const text = format(adminUi.slug_taken, { slug, next });
          const target = document.querySelector<HTMLElement>(
            '[data-error-for="slug"]',
          );
          if (target !== null) {
            setPhrase(target, text);
            target.hidden = false;
          }
          say(text, true);
          return;
        }
      }
      if (!response.ok) {
        const text = await explain(response);
        if (formError !== null) {
          // Changed 2026-10-12: setPhrase, both languages (it set textContent).
          setPhrase(formError, text);
          formError.hidden = false;
        }
        say(text, true);
        return;
      }
      const answer = (await response.json()) as {
        unchanged?: boolean;
        lastmod?: string;
      };
      closeForm();
      await load();
      if (answer.unchanged === true) {
        say(adminUi.unchanged);
      } else if (fields.draft) {
        say(adminUi.saved_draft);
      } else if (!isLive(fields)) {
        say(adminUi.saved_future);
      } else {
        await publishWait(
          slug,
          editing === undefined ? "created" : "edited",
          answer.lastmod,
        );
      }
    } catch (error) {
      console.error("Admin: the post could not be saved.", error);
      say(adminUi.posts_unavailable, true);
    } finally {
      setBusy(false);
    }
  }

  async function remove(post: Listed): Promise<void> {
    if (busy) return;
    // Changed 2026-10-12: in the language shown (a dialog holds plain text; the note at the top).
    const ok = confirm(
      phrase(
        format(adminUi.confirm_delete, { title: post.title || post.slug }),
      ),
    );
    if (!ok) return;
    setBusy(true);
    say(adminUi.deleting);
    try {
      const response = await call("delete", { slug: post.slug, sha: post.sha });
      if (!response.ok) {
        say(await explain(response), true);
        return;
      }
      await load();
      if (isLive(post)) await publishWait(post.slug, "deleted");
      else say(adminUi.deleted);
    } catch (error) {
      console.error("Admin: the post could not be deleted.", error);
      say(adminUi.posts_unavailable, true);
    } finally {
      setBusy(false);
    }
  }

  newButton?.addEventListener("click", () => {
    if (busy) return;
    opened = undefined;
    showForm(adminUi.posts_new, {
      title: "",
      description: "",
      date: new Date().toISOString(),
      tags: [],
      categories: [],
      draft: false,
      body: "",
    });
  });
  cancelButton?.addEventListener("click", () => {
    closeForm();
    say(format(adminUi.posts_count, { n: posts.length }));
  });
  form?.addEventListener("submit", (event) => void save(event));

  await load();
}
