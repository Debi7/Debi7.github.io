// The search itself, for /search/ only. Added 2026-09-22 with src/pages/search/index.astro and
// src/pages/search/data.json.ts; the owner chose a search with no dependency, so the matching is
// here rather than in a library. The facets down the left - Section, Category and Tag, with a count
// every name - were asked for the same day, against the reference site he sent.
//
// It is a module of its own and not part of src/scripts/site.ts, which every page of the site
// loads: this code is useless anywhere but on the search page, and the index it fetches is 93KB.
// The page imports it, so only the page pays for it.
//
// TypeScript, like the other client scripts here since 2026-09-22 - a wrong property name on a DOM
// node fails the build instead of reaching a visitor. Astro erases the annotations, so the bundle
// is the same JavaScript either way.

/** One entry of /search/data.json; the shape is written out in the endpoint that builds it. */
type IndexEntry = {
  url: string;
  title: string;
  date: string;
  section: string;
  tags: string[];
  categories: string[];
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
// OR: with 41 entries an OR search returns most of the site and ranks the answer somewhere in the
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

function snippetAround(text: string, at: number): string {
  if (at < 0) return "";
  const start = Math.max(0, at - snippetRadius);
  const end = Math.min(text.length, at + snippetRadius);
  const cutStart = start === 0 ? 0 : text.indexOf(" ", start) + 1;
  const cutEnd = end === text.length ? text.length : text.lastIndexOf(" ", end);
  const from = cutStart > 0 && cutStart < at ? cutStart : start;
  const to = cutEnd > at ? cutEnd : end;
  return (
    (from > 0 ? "…" : "") + text.slice(from, to) + (to < text.length ? "…" : "")
  );
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

/** The date as the index carries it: the first ten characters of an ISO string. */
function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

(function searchInit() {
  const form = document.getElementById("search-form");
  const input = document.getElementById("search-input");
  const results = document.getElementById("search-results");
  const status = document.getElementById("search-status");
  const clear = document.getElementById("search-clear");
  if (
    !(form instanceof HTMLFormElement) ||
    !(input instanceof HTMLInputElement) ||
    !(clear instanceof HTMLButtonElement) ||
    !results ||
    !status
  ) {
    return;
  }

  const checks = Array.from(
    document.querySelectorAll<HTMLInputElement>(".search-facet__check"),
  );
  const counts = Array.from(
    document.querySelectorAll<HTMLElement>("[data-count-for]"),
  );

  let index: IndexEntry[] | null = null;
  let loading: Promise<IndexEntry[]> | null = null;

  // The address of the index differs between `npm run dev` and the built site, and that is not a
  // quirk of this project but of the one setting in astro.config.mjs that makes the URLs match
  // Hugo. Astro 4, "Configuration Reference": trailingSlash sets "the route matching behavior of
  // the dev server", and `always` means "Only match URLs that include a trailing slash". So the
  // dev server answers /search/data.json/ and gives 404 without the slash, while the built site is
  // a real file at /search/data.json and 404s with one. Measured on 2026-09-22, after the page
  // reported that the index could not be loaded on the owner's dev server while every preview
  // build worked: the same is true of /rss.xml and /video/rss.xml in dev, which nothing fetches,
  // so nothing had ever noticed.
  //
  // import.meta.env.DEV is replaced at build time, so each bundle carries exactly one of the two
  // addresses and no request is ever wasted on the wrong one.
  const indexUrl = import.meta.env.DEV
    ? "/search/data.json/"
    : "/search/data.json";

  // Fetched once, on the first query or the first tick rather than on load: someone who opens the
  // page from the header and then changes their mind downloads nothing.
  const loadIndex = (): Promise<IndexEntry[]> => {
    if (index) return Promise.resolve(index);
    if (!loading) {
      loading = fetch(indexUrl)
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

  /** The ticked boxes of one facet, by their front-matter names. */
  const picked = (facet: string): string[] =>
    checks
      .filter((box) => box.dataset.facet === facet && box.checked)
      .map((box) => box.value);

  // Within one facet the ticks are an OR - two categories mean "either of them" - and the three
  // facets are an AND. That is what every faceted list does, and the alternative (AND inside a
  // facet) would answer nothing on a site where an entry rarely carries two categories.
  //
  // Section joined the other two on 2026-09-22, at the owner request of that afternoon. An entry
  // has exactly one section, so this one is a comparison where the others are a search.
  const keep = (
    entry: IndexEntry,
    inSections: string[],
    inCategories: string[],
    inTags: string[],
  ): boolean =>
    (inSections.length === 0 || inSections.includes(entry.section)) &&
    (inCategories.length === 0 ||
      entry.categories.some((name) => inCategories.includes(name))) &&
    (inTags.length === 0 || entry.tags.some((name) => inTags.includes(name)));

  // The number beside a facet name is how many of the CURRENT query's results carry that term,
  // before any tick is applied. So the counts answer "what would this filter give me", which is
  // what a reader is asking when they look at them, and ticking a box never makes the other
  // numbers in the same list collapse to zero.
  const showCounts = (hits: Hit[]) => {
    const tally = new Map<string, number>();
    for (const hit of hits) {
      const section = "section:" + hit.entry.section;
      tally.set(section, (tally.get(section) ?? 0) + 1);
      for (const name of hit.entry.categories)
        tally.set("category:" + name, (tally.get("category:" + name) ?? 0) + 1);
      for (const name of hit.entry.tags)
        tally.set("tag:" + name, (tally.get("tag:" + name) ?? 0) + 1);
    }
    for (const element of counts) {
      const key = element.dataset.facet + ":" + element.dataset.countFor;
      element.textContent = "(" + (tally.get(key) ?? 0) + ")";
    }
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
        hit.at >= 0 ? snippetAround(hit.entry.text, hit.at) : hit.entry.summary;
      body.append(withMarks(snippet, terms));
      item.append(body);

      results.append(item);
    }
  };

  const message = (name: string, values: Record<string, string>): string => {
    const template = status.dataset[name] ?? "";
    return Object.entries(values).reduce(
      (text, [key, value]) => text.split("{" + key + "}").join(value),
      template,
    );
  };

  const run = (push: boolean) => {
    const query = input.value.trim();
    const terms = words(query);
    const inSections = picked("section");
    const inCategories = picked("category");
    const inTags = picked("tag");
    const filtering =
      inSections.length > 0 || inCategories.length > 0 || inTags.length > 0;

    clear.hidden = !query && !filtering;

    // The address carries the query and the ticks, so a search can be linked to and survives a
    // reload. replace, not push, while typing: otherwise every keystroke is a step in the
    // browser's history.
    const url = new URL(window.location.href);
    const set = (key: string, value: string) => {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    };
    set("q", query);
    set("section", inSections.join(","));
    set("category", inCategories.join(","));
    set("tag", inTags.join(","));
    window.history[push ? "pushState" : "replaceState"]({}, "", url);

    // Nothing asked for: the page goes back to how it opened, with the counts showing the whole
    // site again.
    if (!terms.length && !filtering) {
      results.textContent = "";
      status.textContent = "";
      loadIndex()
        .then((entries) =>
          showCounts(entries.map((e) => ({ entry: e, score: 0, at: -1 }))),
        )
        .catch(() => undefined);
      return;
    }

    status.textContent = message("searching", {});
    loadIndex()
      .then((entries) => {
        // Without a query every entry is a hit, so the facets alone can be used to browse.
        const hits: Hit[] = terms.length
          ? entries
              .map((item) => scoreEntry(item, terms))
              .filter((hit): hit is Hit => hit !== null)
          : entries.map((item) => ({ entry: item, score: 0, at: -1 }));

        showCounts(hits);

        const shown = hits
          .filter((hit) => keep(hit.entry, inSections, inCategories, inTags))
          // Score first, then the site's own order (the index is already newest first), so two
          // equally good answers appear the way every list on the site would show them.
          .sort((a, b) => b.score - a.score);

        render(shown, terms);

        const n = String(shown.length);
        if (!shown.length) {
          status.textContent = terms.length
            ? message("empty", { q: query })
            : message("emptyFilter", {});
        } else if (!terms.length) {
          status.textContent = message("listing", { n });
        } else if (shown.length !== hits.length) {
          status.textContent = message("filtered", {
            n,
            total: String(hits.length),
            q: query,
          });
        } else {
          status.textContent = message("found", { n, q: query });
        }
      })
      .catch(() => {
        results.textContent = "";
        status.textContent = message("failed", {});
      });
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    run(true);
  });

  // Typing searches as it goes, but not on every keystroke: the index is in memory after the first
  // query, and 150ms is short enough to feel immediate and long enough not to re-rank 41 entries
  // between two letters.
  let timer = 0;
  input.addEventListener("input", () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => run(false), 150);
  });

  for (const box of checks) box.addEventListener("change", () => run(true));

  clear.addEventListener("click", () => {
    input.value = "";
    for (const box of checks) box.checked = false;
    run(true);
    input.focus();
  });

  // The facet sections are written open, which is right on a wide screen and wrong on a phone,
  // where seventeen tags would stand between the field and the first result. The markup cannot say
  // "open above 768px", so this is the one thing about them decided here.
  if (!window.matchMedia("(min-width: 768px)").matches) {
    for (const section of document.querySelectorAll<HTMLDetailsElement>(
      "[data-facet-section]",
    )) {
      section.open = false;
    }
  }

  // ?q=, ?category= and ?tag= on arrival: the header's magnifier links here without them, but a
  // shared link carries whatever the sender was looking at.
  const params = new URL(window.location.href).searchParams;
  const initialQuery = params.get("q") ?? "";
  const fromUrl: Record<string, string[]> = {
    section: (params.get("section") ?? "").split(","),
    category: (params.get("category") ?? "").split(","),
    tag: (params.get("tag") ?? "").split(","),
  };
  input.value = initialQuery;
  for (const box of checks) {
    const wanted = fromUrl[box.dataset.facet ?? ""] ?? [];
    box.checked = wanted.includes(box.value);
  }
  run(false);
  input.focus();
})();
