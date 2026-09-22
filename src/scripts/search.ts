// The search itself, for /search/ only. Added 2026-09-22 with src/pages/search.astro and
// src/pages/search-index.json.ts; the owner chose a search with no dependency, so the matching is
// here rather than in a library.
//
// It is a module of its own and not part of src/scripts/site.ts, which every page of the site
// loads: this code is useless anywhere but on the search page, and the index it fetches is 50KB.
// The page imports it, so only the page pays for it.
//
// TypeScript, like the other client scripts here since 2026-09-22 - a wrong property name on a DOM
// node fails the build instead of reaching a visitor. Astro erases the annotations, so the bundle
// is the same JavaScript either way.

/** One entry of /search-index.json; the shape is written out in the endpoint that builds it. */
type IndexEntry = {
  url: string;
  title: string;
  date: string;
  section: string;
  tags: string[];
  summary: string;
  text: string;
};

type Hit = {
  entry: IndexEntry;
  score: number;
  /** Where the first match sits in the body text, for the snippet; -1 when it is not in the body. */
  at: number;
};

// Case is folded and ё is read as е. Russian writes both for the same sound and a reader typing
// "елка" expects "ёлка"; the site's content is Russian, so this is the one normalisation that
// earns its place. Everything else - stemming, declension, transliteration - would need a
// dictionary, which is exactly the dependency the owner did not want.
function fold(text: string): string {
  return text.toLowerCase().replace(/ё/g, "е");
}

// The query is split on whitespace and every word has to be found somewhere in the entry. AND, not
// OR: with 42 entries an OR search returns most of the site and ranks the answer somewhere in the
// middle of it.
function words(query: string): string[] {
  return fold(query).split(/\s+/).filter(Boolean);
}

// Where a word is found decides what it is worth. A title match is what the reader is almost
// always after; a tag says the entry is about the subject rather than merely mentioning it; the
// summary is the opening of the text and is weighted between the two. Counting the occurrences in
// the body would let one long article outrank a page that is actually about the word, so the body
// scores once.
const weights = { title: 8, tag: 4, summary: 2, text: 1 } as const;

function scoreEntry(entry: IndexEntry, terms: string[]): Hit | null {
  const title = fold(entry.title);
  const tags = entry.tags.map(fold);
  const summary = fold(entry.summary);
  const text = fold(entry.text);

  let score = 0;
  let at = -1;

  for (const term of terms) {
    let found = false;

    if (title.includes(term)) {
      score += weights.title;
      found = true;
    }
    if (tags.some((tag) => tag.includes(term))) {
      score += weights.tag;
      found = true;
    }
    if (summary.includes(term)) {
      score += weights.summary;
      found = true;
    }
    const inText = text.indexOf(term);
    if (inText !== -1) {
      score += weights.text;
      found = true;
      if (at === -1) at = inText;
    }

    // One word missing is enough to drop the entry: that is what AND means.
    if (!found) return null;
  }

  // The whole query as one phrase, found as written, beats the same words scattered about.
  const phrase = fold(terms.join(" "));
  if (title.includes(phrase)) score += weights.title;
  else if (text.includes(phrase)) score += weights.text * 2;

  return { entry, score, at };
}

// A window of the body around the first match, cut on spaces so no word is halved.
const snippetRadius = 90;

function snippetAround(
  text: string,
  at: number,
): { text: string; from: number } {
  if (at < 0) return { text: "", from: 0 };
  const start = Math.max(0, at - snippetRadius);
  const end = Math.min(text.length, at + snippetRadius);
  const cutStart = start === 0 ? 0 : text.indexOf(" ", start) + 1;
  const cutEnd = end === text.length ? text.length : text.lastIndexOf(" ", end);
  const from = cutStart > 0 && cutStart < at ? cutStart : start;
  const to = cutEnd > at ? cutEnd : end;
  return {
    text:
      (from > 0 ? "…" : "") +
      text.slice(from, to) +
      (to < text.length ? "…" : ""),
    from,
  };
}

// The matched words are wrapped in <mark>, and the text goes in as text nodes rather than as
// innerHTML: the index holds whatever an author wrote, and a title with a < in it must not be able
// to become markup on this page.
function withMarks(text: string, terms: string[]): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const folded = fold(text);

  // Every occurrence of every term, then the overlaps are dropped so the ranges can be walked once.
  const ranges: Array<[number, number]> = [];
  for (const term of terms) {
    let from = folded.indexOf(term);
    while (from !== -1) {
      ranges.push([from, from + term.length]);
      from = folded.indexOf(term, from + term.length);
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);

  let cursor = 0;
  for (const [from, to] of ranges) {
    if (from < cursor) continue;
    if (from > cursor) fragment.append(text.slice(cursor, from));
    const mark = document.createElement("mark");
    mark.textContent = text.slice(from, to);
    fragment.append(mark);
    cursor = to;
  }
  if (cursor < text.length) fragment.append(text.slice(cursor));
  return fragment;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : iso.slice(0, 10);
}

(function searchInit() {
  const form = document.getElementById("search-form");
  const input = document.getElementById("search-input");
  const results = document.getElementById("search-results");
  const status = document.getElementById("search-status");
  if (
    !(form instanceof HTMLFormElement) ||
    !(input instanceof HTMLInputElement) ||
    !results ||
    !status
  ) {
    return;
  }

  let index: IndexEntry[] | null = null;
  let loading: Promise<IndexEntry[]> | null = null;

  // Fetched once, on the first query rather than on load: someone who opens the page from the
  // header and then changes their mind downloads nothing.
  const loadIndex = (): Promise<IndexEntry[]> => {
    if (index) return Promise.resolve(index);
    if (!loading) {
      loading = fetch("/search-index.json")
        .then((response) => {
          if (!response.ok) throw new Error(String(response.status));
          return response.json() as Promise<IndexEntry[]>;
        })
        .then((entries) => {
          index = entries;
          return entries;
        });
    }
    return loading;
  };

  const render = (hits: Hit[], terms: string[]) => {
    results.textContent = "";
    for (const hit of hits) {
      const item = document.createElement("li");
      item.className = "search-result";

      const link = document.createElement("a");
      link.href = hit.entry.url;
      link.className = "search-result__title";
      link.append(withMarks(hit.entry.title, terms));
      item.append(link);

      const meta = document.createElement("p");
      meta.className = "search-result__meta";
      const section = document.createElement("span");
      section.className = "search-result__section";
      section.textContent = hit.entry.section;
      meta.append(section, " ", formatDate(hit.entry.date));
      item.append(meta);

      const body = document.createElement("p");
      body.className = "search-result__snippet";
      const snippet =
        hit.at >= 0
          ? snippetAround(hit.entry.text, hit.at).text
          : hit.entry.summary;
      body.append(withMarks(snippet, terms));
      item.append(body);

      results.append(item);
    }
  };

  const run = (query: string, push: boolean) => {
    const terms = words(query);

    // The address carries the query, so a search can be linked to and survives a reload. replace,
    // not push, while typing: otherwise every keystroke is a step in the browser's history.
    const url = new URL(window.location.href);
    if (terms.length) url.searchParams.set("q", query);
    else url.searchParams.delete("q");
    window.history[push ? "pushState" : "replaceState"]({}, "", url);

    if (!terms.length) {
      results.textContent = "";
      status.textContent = "";
      return;
    }

    status.textContent = status.dataset.searching ?? "";
    loadIndex()
      .then((entries) => {
        const hits = entries
          .map((item) => scoreEntry(item, terms))
          .filter((hit): hit is Hit => hit !== null)
          // Score first, then the site's own order (the index is already newest first), so two
          // equally good answers appear the way every list on the site would show them.
          .sort((a, b) => b.score - a.score);

        render(hits, terms);
        const template = hits.length
          ? (status.dataset.found ?? "")
          : (status.dataset.empty ?? "");
        status.textContent = template
          .replace("{n}", String(hits.length))
          .replace("{q}", query);
      })
      .catch(() => {
        results.textContent = "";
        status.textContent = status.dataset.failed ?? "";
      });
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    run(input.value.trim(), true);
  });

  // Typing searches as it goes, but not on every keystroke: the index is in memory after the first
  // query, and 150ms is short enough to feel immediate and long enough not to re-rank 42 entries
  // between two letters.
  let timer = 0;
  input.addEventListener("input", () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => run(input.value.trim(), false), 150);
  });

  // ?q= on arrival: the header's magnifier links here without one, but a shared link carries it.
  const initial = new URL(window.location.href).searchParams.get("q");
  if (initial) {
    input.value = initial;
    run(initial, false);
  }
  input.focus();
})();
