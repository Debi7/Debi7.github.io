import { getCollection, type CollectionEntry } from "astro:content";
import { urlize } from "./urlize";
import { titleize } from "./titleize";
import { formatYear } from "./date";

export type Post = CollectionEntry<"posts">;

// Hugo runs `hugo server -D`: drafts are visible in development and hidden in production.
// Every page must go through this helper so that no route forgets the filter.
export async function getPosts(): Promise<Post[]> {
  const posts = await getCollection(
    "posts",
    (p) => import.meta.env.DEV || !p.data.draft,
  );
  return posts.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
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
