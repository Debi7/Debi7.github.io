// The videos: everything the site knows about the `video` collection (src/content/video/), and
// nothing about the posts. The colleague's file of this name (2026-09-20 to 2026-09-22) was a
// copy of src/lib/posts.ts with the names changed; since 2026-09-22 the shared rules - the
// filter and the order, the pages, the years - live in src/lib/lists.ts, and this file only
// says how a video becomes what those helpers and the shared components work with: a Card of
// a list and a NavLink of an article page. VIDEO-PAGE.md, section 4.
import type { CollectionEntry } from "astro:content";
import {
  published,
  type Card,
  type NavLink,
  type TermKind,
  type TermSource,
} from "./lists";
import { summary } from "./summary";
import { t } from "../i18n/strings";

export type Video = CollectionEntry<"video">;

/** The published videos, newest first; the rule is published() in lists.ts. */
export async function getVideos(): Promise<Video[]> {
  return published("video");
}

/** A video's own page, /video/<slug>/. */
export function videoUrl(video: Video): string {
  return `/video/${video.slug}/`;
}

/** What the Video list shows of a video; the last line is the colleague's "Watch the video". */
export function videoCard(video: Video): Card {
  return {
    url: videoUrl(video),
    title: video.data.title,
    date: video.data.date,
    summary: summary(video.body),
    tags: video.data.tags,
    action: t.list_watch_video,
  };
}

/** A video as the previous or next link of a video page. */
export function videoLink(video: Video): NavLink {
  return { url: videoUrl(video), title: video.data.title };
}

// Added 2026-09-22, the video half of what collectTerms() in lib/lists.ts needs. The tag and
// category pages used to be built from the posts alone, so a click on a tag printed on a video
// card led either to a 404 (/tags/video/, which no post carries) or to a page listing articles
// only (REVIEW-VIDEO.md, remarks 2 and 3). This file says what a video contributes to a term and
// nothing about how terms are assembled, exactly as it says what a video contributes to a list.
/** Every published video as the term builder takes it: the names it declares, and its card. */
export async function videoTerms(kind: TermKind): Promise<TermSource[]> {
  return (await getVideos()).map((video) => ({
    names: video.data[kind],
    card: videoCard(video),
  }));
}
