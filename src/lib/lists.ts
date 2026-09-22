// What every list on the site shares, and nothing about any one kind of entry. Added
// 2026-09-22, when the owner asked for the posts and the videos to stay apart and only what is
// truly common to be shared (VIDEO-PAGE.md, section 4): the filter and the order every
// collection is read with, the cutting into pages, the split by year, the year switcher's rule,
// and the two plain shapes the shared components render - a card of a list and a previous/next
// link. Everything here takes plain data or a type parameter; src/lib/posts.ts and
// src/lib/video.ts know their own collection and build these shapes from it. Until that day the
// list helpers lived in src/lib/posts.ts, typed to posts, and the colleague's src/lib/video.ts
// held a copy of them typed to videos.
import { getCollection, type CollectionEntry } from "astro:content";
import { formatYear } from "./date";
import { site } from "../config";

/** What a list needs of an item to split it by year: its date. A Card has one. */
export type Dated = { date: Date };

/**
 * What a list shows of an entry, whichever collection it comes from: rendered by
 * CardList.astro and by the tag route's own cards, built by postCard() in posts.ts and
 * videoCard() in video.ts.
 */
export type Card = {
  /** The entry's own page. */
  url: string;
  title: string;
  date: Date;
  /** Hugo's `.Summary | plainify | truncate 140`; empty when the body is. */
  summary: string;
  /** In front matter order, lower-cased by the collection schema. */
  tags: string[];
  /** The last line of the card: "Read more" on a post, "Watch the video" on a video. */
  action: string;
};

/** A previous or next link on an article page (PostNav.astro), built by postLink() and videoLink(). */
export type NavLink = { url: string; title: string };

// Hugo runs `hugo server -D`: drafts are visible in development and hidden in production.
// Every page must go through this helper so that no route forgets the filter.
//
// The order of every list on the site is decided here: newest first by `date`.
//
// Changed 2026-09-19: two tie-breaks after the date - the title, then the file name (`id`).
// Before, two posts with the same date and time kept whatever order the collection happened to
// return them in. With pagination that matters: such a pair on the boundary between two pages
// could swap pages from one build to the next. The title comes first because Hugo's default
// order also falls back to the title; the file name settles two posts with the same title as
// well, since no two posts can share one. `lastmod` plays no part. See PAGINATION.md.
//
// Changed 2026-09-19, the owner's decision: a post whose date is still in the future is left
// out as well, until that date, as Hugo does by default (`buildFuture = false`). Before, it was
// published at once and went to the top of its year. `npm run dev` still shows it, like a
// draft, so that it can be read before its day. The site is static, so "until that date"
// means until the first build after it. See PAGINATION.md, section 2.
//
// Was the body of getPosts() until 2026-09-22; getPosts() and getVideos() call it with their
// collection, so the rule is written once. scripts/check-pagination.mjs mirrors it.
export async function published<C extends "posts" | "video">(
  collection: C,
): Promise<CollectionEntry<C>[]> {
  const now = Date.now();
  const entries = await getCollection(
    collection,
    (e) =>
      import.meta.env.DEV || (!e.data.draft && e.data.date.getTime() <= now),
  );
  return entries.sort(
    (a, b) =>
      b.data.date.getTime() - a.data.date.getTime() ||
      a.data.title.localeCompare(b.data.title) ||
      a.id.localeCompare(b.id),
  );
}

// Added 2026-09-19, for the pagination the owner asked for. The lists are split into pages of
// `site.pagination.pageSize` entries, with Previous and Next links that move a whole page at a
// time, and every list is split by year first: /posts/<year>/ holds only that year's posts,
// and its Previous and Next never leave the year. See PAGINATION.md.

/** One page of a paginated list. */
export type ListPage<T> = {
  /** The entries shown on this page. */
  items: T[];
  /** 1-based. */
  number: number;
  /** The number of the last page; 1 when the list fits on one page. */
  last: number;
  /** Addresses of the neighbouring pages; undefined on the first and on the last page. */
  prevUrl: string | undefined;
  nextUrl: string | undefined;
  /** The numbered page links shown between Previous and Next; see pageNumbers(). */
  numbers: PageNumber[];
  // `numbersCompact`, a second set with a narrower window for screens below 640px, was removed
  // later on 2026-09-19 with the owner's new rule for the numbers: five entries at most, which
  // fit at every width, so one set is enough. See pageNumbers().
};

/** One entry of the numbered page links: a page, or a gap drawn as an ellipsis. */
export type PageNumber =
  | { kind: "page"; number: number; url: string; current: boolean }
  | { kind: "gap" };

// Added 2026-09-19, asked for by the owner: numbered page links between Previous and Next, so
// that a list with many pages does not take one click per page. The theme has no such block;
// see PAGINATION.md, section 6.
//
// The rule is the owner's, set later the same day, and replaced a sliding window (the first and
// the last page plus two pages either side of the current one, at most nine entries, with a
// second set of one page either side for screens below 640px, where nine did not fit in a row):
//   - a list of at most `pagination.everyNumberUpTo` pages shows every number: "1 2 3 4 5";
//   - a longer one shows only the first, the current and the last page, and every run of
//     skipped pages is one gap drawn as an ellipsis: "1 ... 7 ... 20", "1 2 ... 20" on the
//     second page, "1 ... 20" on the first and on the last. A gap is a gap even when it hides a
//     single page, because only the first and the last page are meant to be links there; the
//     current page is never a link.
// Five entries at most either way, which fit at every width, so the second set went with the
// window. The rendering is Pagination.astro; scripts/check-pagination.mjs mirrors this rule.
export function pageNumbers(
  current: number,
  last: number,
  base: string,
): PageNumber[] {
  const shown =
    last <= site.pagination.everyNumberUpTo
      ? Array.from({ length: last }, (_, i) => i + 1)
      : [...new Set([1, current, last])];
  const page = (n: number): PageNumber => ({
    kind: "page",
    number: n,
    url: pageUrl(base, n),
    current: n === current,
  });
  const entries: PageNumber[] = [];
  let previous = 0;
  for (const n of shown) {
    if (n - previous > 1) entries.push({ kind: "gap" });
    entries.push(page(n));
    previous = n;
  }
  return entries;
}

// The address of page `n` of the list whose own address is `base` ("/posts/2025/", or a tag or
// category page with its slug already encoded): `base` itself for page 1, `<base>page/<n>/`
// after it. That is the shape Hugo uses for its paginated lists.
export function pageUrl(base: string, n: number): string {
  return n === 1 ? base : `${base}page/${n}/`;
}

// The value of the `[...page]` route parameter that produces page `n` under `prefix` (the year,
// for the Posts list; nothing for a tag or a category, whose route already has the slug). A
// rest parameter may be undefined, which renders the route at its own address, and may contain
// slashes, which is how one route file serves /posts/, /posts/2025/ and /posts/2025/page/2/.
export function pageParam(n: number, prefix?: string): string | undefined {
  const parts = [prefix, n === 1 ? undefined : `page/${n}`].filter(Boolean);
  return parts.length > 0 ? parts.join("/") : undefined;
}

// Splits `items`, already in display order, into pages. An empty list still gets one page, so
// a list route always renders at its own address.
export function paginateList<T>(
  items: T[],
  base: string,
  pageSize: number = site.pagination.pageSize,
): ListPage<T>[] {
  const last = Math.max(1, Math.ceil(items.length / pageSize));
  return Array.from({ length: last }, (_, index) => {
    const number = index + 1;
    return {
      items: items.slice(index * pageSize, number * pageSize),
      number,
      last,
      prevUrl: number > 1 ? pageUrl(base, number - 1) : undefined,
      nextUrl: number < last ? pageUrl(base, number + 1) : undefined,
      // One set since later on 2026-09-19; see the note in ListPage.
      numbers: pageNumbers(number, last, base),
    };
  });
}

/** A link of the year switcher above a list. */
export type YearLink = { year: string; url: string };

// Added 2026-09-19, asked for by the owner: the year switcher above the Posts list. Every year
// that has entries links to the first page of that year under `base`, "/posts/2025/" or
// "/tags/hugo/2025/". The groups come from groupByYear(), so the years are newest first.
// `base` was added the same evening, when every list got years; it used to be "/posts/".
export function yearLinks(
  groups: YearGroup<unknown>[],
  base: string,
): YearLink[] {
  return groups.map((group) => ({
    year: group.year,
    url: `${base}${group.year}/`,
  }));
}

/** One page of a list split by year, in the shape getStaticPaths needs; see paginateByYear(). */
export type YearListPage<T> = {
  /** The `[...page]` parameter: "2025", "2025/page/2", or undefined for the list's own address. */
  param: string | undefined;
  page: ListPage<T>;
  years: YearLink[];
  /** The year shown, e.g. "2025"; undefined only on the own address of a list with no entries. */
  year: string | undefined;
};

// Added 2026-09-19 evening, asked for by the owner: one way of splitting a list by year for
// every list route - /posts/, /tags/<tag>/, /categories/<category>/ and, since 2026-09-22,
// /video/. Until then only /posts/ was split, and its route held this code. `base` is the
// list's own address with the slug already encoded, "/tags/hugo/". The result: every year with
// entries, newest first, cut into pages under `<base><year>/` (page 1 there, page n at
// `<base><year>/page/<n>/`), and `base` itself, which shows the newest year's first page so
// that a link to the list always leads somewhere - with no entries at all, one empty page.
// Every year keeps its own addresses, so they do not change when a new year begins.
// ListByYear.astro renders one of these pages with the navigation of both levels. To undo the
// split of the tag and category lists, revert the commit that added this function; the Posts
// route worked the same way before it.
//
// Generic: the items are whatever the route renders - the cards of a list, built from posts
// or from videos - and nothing in here reads more of them than the date.
export function paginateByYear<T extends Dated>(
  items: T[],
  base: string,
): YearListPage<T>[] {
  const groups = groupByYear(items);
  const years = yearLinks(groups, base);
  const pages = groups.flatMap((group) =>
    paginateList(group.items, `${base}${group.year}/`).map((page) => ({
      param: pageParam(page.number, group.year),
      page,
      years,
      year: group.year,
    })),
  );
  const newest = pages.at(0);
  const own: YearListPage<T> = newest
    ? { ...newest, param: undefined }
    : {
        param: undefined,
        page: paginateList([], base)[0],
        years,
        year: undefined,
      };
  return [own, ...pages];
}

/** One entry of the year switcher: a year, or a gap drawn as an ellipsis. */
export type YearEntry =
  | { kind: "year"; year: string; url: string; current: boolean }
  | { kind: "gap" };

// Added later on 2026-09-19, when the owner asked for the year switcher to be a component of
// its own (YearSwitcher.astro) with its own rule, separate from the page numbers. Which years
// are shown: every year while there are at most `pagination.everyYearUpTo` of them; beyond
// that the newest, the oldest, and the year being shown with the year either side of it, and a
// run of hidden years is one gap drawn as an ellipsis: "2026 ... 2023 2022 2021 ... 2015". The
// neighbours stay, unlike on the page numbers, because a reader browsing by year moves to the
// year next door far more often than to the first page of a long list; the owner left that
// detail to this side, and it is one line to change. Every year shown is a link, the current
// one included - it leads back to the first page of its year. `years` are newest first, as
// yearLinks() builds them, and adjacency is in that list: 2026 sits next to 2024 when 2025 has
// no entries. scripts/check-pagination.mjs mirrors this rule.
export function yearSwitcher(
  years: YearLink[],
  currentYear: string,
): YearEntry[] {
  const current = years.findIndex((link) => link.year === currentYear);
  const shown =
    years.length <= site.pagination.everyYearUpTo
      ? years.map((_, index) => index)
      : [...new Set([0, current - 1, current, current + 1, years.length - 1])]
          .filter((index) => index >= 0 && index < years.length)
          .sort((a, b) => a - b);
  const entries: YearEntry[] = [];
  let previous = -1;
  for (const index of shown) {
    const link = years[index];
    if (index - previous > 1) entries.push({ kind: "gap" });
    entries.push({
      kind: "year",
      year: link.year,
      url: link.url,
      current: link.year === currentYear,
    });
    previous = index;
  }
  return entries;
}

/** The entries of one year, in display order. */
export type YearGroup<T> = { year: string; items: T[] };

// Hugo's `.Pages.GroupByDate "2006"` followed by `.Pages.ByDate.Reverse` inside each group:
// years newest first, and entries newest first within a year. The input is expected to come
// from published() (or a filtered subset of it, or the cards built from one), which is already
// sorted newest first, so the groups come out in the right order without a second sort.
export function groupByYear<T extends Dated>(items: T[]): YearGroup<T>[] {
  const groups: YearGroup<T>[] = [];
  for (const item of items) {
    const year = formatYear(item.date);
    const last = groups[groups.length - 1];
    if (last && last.year === year) last.items.push(item);
    else groups.push({ year, items: [item] });
  }
  return groups;
}
