// The posts: everything the site knows about the `posts` collection, and nothing about the
// videos (src/lib/video.ts). Until 2026-09-22 this file also held the list helpers - the
// pages, the years, the switcher's rule - typed to posts; they are in src/lib/lists.ts now,
// generic, because the Video list uses them too and the owner asked for the two kinds of entry
// to stay apart with only what is truly common shared (VIDEO-PAGE.md, section 4). What stays
// here is what only a post has: the terms, the reading time, and how a post becomes a Card of
// a list or a NavLink of an article page.
import type { CollectionEntry } from "astro:content";
import { urlize } from "./urlize";
import { titleize } from "./titleize";
import { summary } from "./summary";
import { published, type Card, type NavLink } from "./lists";
import { t } from "../i18n/strings";

export type Post = CollectionEntry<"posts">;

// The published posts, newest first. The rule - drafts and future dates left out in
// production, the order by date with its tie-breaks - is published() in lists.ts, with its
// history; it was the body of this function until 2026-09-22.
export async function getPosts(): Promise<Post[]> {
  return published("posts");
}

/** A post's own page, /posts/<slug>/. */
export function postUrl(post: Post): string {
  return `/posts/${post.slug}/`;
}

// What a list shows of a post. Hugo's list.html and tag.html read these off the page object:
// .RelPermalink, .Title, .Date, `.Summary | plainify | truncate 140` (summary() in
// lib/summary.ts, see its header for the one known divergence), .Params.tags, and the i18n
// string list_read_more for the last line.
export function postCard(post: Post): Card {
  return {
    url: postUrl(post),
    title: post.data.title,
    date: post.data.date,
    summary: summary(post.body),
    tags: post.data.tags,
    action: t.list_read_more,
  };
}

/** A post as the previous or next link of a post page. */
export function postLink(post: Post): NavLink {
  return { url: postUrl(post), title: post.data.title };
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

// Hugo: math.Round (div (countwords .Content) 200.0)
export function readingTime(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.round(words / 200);
}
