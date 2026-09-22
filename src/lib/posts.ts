// The posts: everything the site knows about the `posts` collection, and nothing about the
// videos (src/lib/video.ts). Until 2026-09-22 this file also held the list helpers - the
// pages, the years, the switcher's rule - typed to posts; they are in src/lib/lists.ts now,
// generic, because the Video list uses them too and the owner asked for the two kinds of entry
// to stay apart with only what is truly common shared (VIDEO-PAGE.md, section 4). What stays
// here is what only a post has: the terms, the reading time, and how a post becomes a Card of
// a list or a NavLink of an article page.
import type { CollectionEntry } from "astro:content";
// urlize and titleize used to be imported here for getTerms(); they moved to lib/lists.ts with
// collectTerms() on 2026-09-22 and nothing in this file needs them any more.
import { summary } from "./summary";
import {
  published,
  type Card,
  type NavLink,
  type TermKind,
  type TermSource,
  type SearchSource,
} from "./lists";
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

// Replaced on 2026-09-22. What stood here was `export type Term` and `getTerms(kind)`, which
// grouped posts by their tags or categories and returned the posts themselves. Both moved: the
// shape and the grouping are collectTerms() in lib/lists.ts, and what asks for the terms of the
// whole site is lib/terms.ts. The comment that explained Hugo's `.Data.Terms.Alphabetical`
// moved with the code and is quoted there in full.
//
// The reason for the move is a defect the reviewer found: term pages were built from this file
// alone, so /tags/video/ was built by nobody although ten videos carry that tag, and
// /tags/биолокация/ listed articles only although videos carry it too (REVIEW-VIDEO.md, remarks
// 2 and 3). A term is a subject, and a subject does not stop at a collection boundary.
//
// What is left here is this file's half of the work, and it stays inside the owner's rule that
// the two kinds of entry share code only on plain data (VIDEO-PAGE.md, section 4): posts.ts
// knows the posts collection and hands out flat data, video.ts does the same for videos, and
// neither learns about the other.

/** A post as the search index takes it; the shape is SearchSource in lib/lists.ts. */
export function postSearch(post: Post): SearchSource {
  return {
    card: postCard(post),
    categories: post.data.categories,
    text: post.body,
  };
}

/** Every published post as the term builder takes it: the names it declares, and its card. */
export async function postTerms(kind: TermKind): Promise<TermSource[]> {
  return (await getPosts()).map((post) => ({
    names: post.data[kind],
    card: postCard(post),
  }));
}

// Hugo: math.Round (div (countwords .Content) 200.0)
export function readingTime(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.round(words / 200);
}
