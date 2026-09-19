import { getCollection, type CollectionEntry } from "astro:content";
import { urlize } from "./urlize";
import { titleize } from "./titleize";
import { formatYear } from "./date";
import { site } from "../config";

export type Post = CollectionEntry<"posts">;

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
export async function getPosts(): Promise<Post[]> {
  const now = Date.now();
  const posts = await getCollection(
    "posts",
    (p) =>
      import.meta.env.DEV || (!p.data.draft && p.data.date.getTime() <= now),
  );
  return posts.sort(
    (a, b) =>
      b.data.date.getTime() - a.data.date.getTime() ||
      a.data.title.localeCompare(b.data.title) ||
      a.id.localeCompare(b.id),
  );
}

// Added 2026-09-19, for the pagination the owner asked for. The lists are split into pages of
// `site.pagination.pageSize` posts, with Previous and Next links that move a whole page at a
// time. The Posts list is split by year first: /posts/<year>/ holds only that year's posts,
// and its Previous and Next never leave the year. The tag and category pages are split across
// all years. See PAGINATION.md.

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
  /** The numbered page links shown between Previous and Next from 640px up; see pageNumbers(). */
  numbers: PageNumber[];
  /** The same below 640px, with one page either side of the current one instead of two. */
  numbersCompact: PageNumber[];
};

/** One entry of the numbered page links: a page, or a gap drawn as an ellipsis. */
export type PageNumber =
  | { kind: "page"; number: number; url: string; current: boolean }
  | { kind: "gap" };

// Added 2026-09-19, asked for by the owner: numbered page links between Previous and Next, so
// that a list with many pages does not take one click per page. Shown: the first and the last
// page, and `radius` pages either side of the current one; a run of skipped pages becomes one
// gap. A gap that would hide a single page shows that page instead, since the ellipsis would
// take the same room. With the radius of 2 used from 640px up a list has at most nine entries,
// whatever its length: "1 ... 8 9 10 11 12 ... 20". Below 640px nine did not fit in one row -
// measured at 390px, the last page wrapped onto a row of its own - so there the radius is 1 and
// the most is seven: "1 ... 9 10 11 ... 20". The theme has no such block; see PAGINATION.md,
// section 6.
export function pageNumbers(
  current: number,
  last: number,
  base: string,
  radius: number,
): PageNumber[] {
  const around = Array.from(
    { length: 2 * radius + 1 },
    (_, i) => current - radius + i,
  );
  const shown = [1, ...around, last]
    .filter((n, index, all) => n >= 1 && n <= last && all.indexOf(n) === index)
    .sort((a, b) => a - b);
  const page = (n: number): PageNumber => ({
    kind: "page",
    number: n,
    url: pageUrl(base, n),
    current: n === current,
  });
  const entries: PageNumber[] = [];
  let previous = 0;
  for (const n of shown) {
    if (n - previous === 2) entries.push(page(previous + 1));
    else if (n - previous > 2) entries.push({ kind: "gap" });
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
      numbers: pageNumbers(number, last, base, 2),
      numbersCompact: pageNumbers(number, last, base, 1),
    };
  });
}

/** A link of the year switcher above the Posts list. */
export type YearLink = { year: string; url: string };

// Added 2026-09-19, asked for by the owner: the year switcher above the Posts list. Every year
// that has posts links to the first page of that year, /posts/<year>/. The groups come from
// groupByYear(), so the years are newest first.
export function yearLinks(groups: YearGroup[]): YearLink[] {
  return groups.map((group) => ({
    year: group.year,
    url: `/posts/${group.year}/`,
  }));
}

export type Term = {
  /** As written in the front matter, e.g. "blog". Sort key and slug source. */
  name: string;
  /** What Hugo prints on a term page, e.g. "Blog". See lib/titleize.ts. */
  title: string;
  slug: string;
  posts: Post[];
};

// Tags or categories with their posts, sorted by the front-matter name. That is Hugo's
// `.Data.Terms.Alphabetical`, which orders by the term key, not by the title-cased label -
// so "blog" before "education" is decided on the lower-case names, and `title` is only for
// display. Posts inside a term keep getPosts' order (newest first), as Hugo's term pages do.
//
// Used by src/pages/categories/index.astro today; the tag pages will use the same shape.
export async function getTerms(kind: "tags" | "categories"): Promise<Term[]> {
  const byName = new Map<string, Post[]>();
  for (const post of await getPosts()) {
    for (const name of post.data[kind]) {
      byName.set(name, [...(byName.get(name) ?? []), post]);
    }
  }
  return [...byName]
    .map(([name, posts]) => ({
      name,
      title: titleize(name),
      slug: urlize(name),
      posts,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export type YearGroup = { year: string; posts: Post[] };

// Hugo's `.Pages.GroupByDate "2006"` followed by `.Pages.ByDate.Reverse` inside each group:
// years newest first, and posts newest first within a year. The input is expected to come
// from getPosts() (or a filtered subset of it), which is already sorted newest first, so the
// groups come out in the right order without a second sort.
export function groupByYear(posts: Post[]): YearGroup[] {
  const groups: YearGroup[] = [];
  for (const post of posts) {
    const year = formatYear(post.data.date);
    const last = groups[groups.length - 1];
    if (last && last.year === year) last.posts.push(post);
    else groups.push({ year, posts: [post] });
  }
  return groups;
}

// Hugo: math.Round (div (countwords .Content) 200.0)
export function readingTime(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.round(words / 200);
}
