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
  type SearchSource,
} from "./lists";
// plainifyMarkdown added 2026-09-28 for membersOnlyHeadings() below: the same inline-Markdown
// stripping the search index uses, so a heading's text is compared in the form Astro reports it.
import { summary, plainifyMarkdown } from "./summary";
import { t } from "../i18n/strings";

export type Video = CollectionEntry<"video">;

// Added 2026-09-28, the colleague's "block 2": text and pictures under a paid lecture for the
// members who may watch it (PAID-VIDEO.md, section 4, "Materials for members"). The author wraps
// that part of the body in a div carrying data-members-only, with blank lines inside so the
// Markdown in it still renders, and VideoLayout.astro keeps it hidden until the access service
// has let the visitor watch - the same moment the comments appear. Hidden, not secret: the text
// is in the page source and in the repository, and the pictures are public files; the owner chose
// that on 2026-09-28 (option A), and a real lock would be the access service handing the block
// out like the video id (option B). What must not show the block is everything built from the
// body for everyone - the card, the feed, the search index, the table of contents - so those take
// publicBody() and membersOnlyHeadings() instead of the raw body.
const membersOnlyBlock = /<div data-members-only>[\s\S]*?<\/div>/g;
const membersOnlyMarker = "data-members-only";

/** A video's body without its members-only blocks: what a card, the feed and the search show. */
export function publicBody(video: Video): string {
  return video.body.replace(membersOnlyBlock, "");
}

/** The texts of the headings inside the members-only blocks, kept out of the table of contents. */
export function membersOnlyHeadings(video: Video): Set<string> {
  const texts = new Set<string>();
  for (const block of video.body.match(membersOnlyBlock) ?? []) {
    for (const line of block.split("\n")) {
      if (/^#{1,6}\s/.test(line)) texts.add(plainifyMarkdown(line));
    }
  }
  return texts;
}

// A YouTube address in any of its forms: the watch and embed pages, the short youtu.be links and
// the thumbnail host. Added 2026-09-28 for the guard below.
const youtubeAddress = /youtu\.be\/|youtube(?:-nocookie)?\.com\/|ytimg\.com\//i;

// A Yandex Disk address in any of its forms: disk.yandex.<domain> (ru, com, com.tr and the rest,
// and the download host downloader.disk.yandex.ru), Yandex 360's disk.360.yandex.ru and the old
// short yadi.sk. Added 2026-10-02 at the owner's request: a lecture stored on Yandex Disk
// (PAID-VIDEO.md section 10) is reached by the file's public link, which plays and downloads the
// file for anyone who has it, so it must stay out of a paid entry's text as much as a YouTube id.
const yandexDiskAddress = /disk\.(?:360\.)?yandex\.[a-z.]+\/|yadi\.sk\//i;

/** The published videos, newest first; the rule is published() in lists.ts. */
export async function getVideos(): Promise<Video[]> {
  // Changed 2026-09-28 (paid videos; .specify/consilium/2026-09-28-paid-video-access.md): the
  // schema in src/content/config.ts keeps the id fields out of a paid entry, but it never sees
  // the body, and the body of every video is printed on its page, in /video/rss.xml and in the
  // search index. A timestamped link to the lecture in the text would hand its id to anyone, so
  // a paid entry whose body holds a YouTube address fails the build here. Every video route goes
  // through this function, so the check runs on every build.
  const videos = await published("video");
  for (const video of videos) {
    if (video.data.access === "paid" && youtubeAddress.test(video.body)) {
      throw new Error(
        `src/content/video/${video.id}: a paid video must not link to YouTube in its text; its id lives only at the access service`,
      );
    }
    // Added 2026-10-02, the same guard for the lectures on Yandex Disk (yandexDiskAddress above).
    // Only a paid entry is checked: a post or a public lecture may still link to a file there, and
    // a paid entry may not even in its members-only block, which is hidden, not locked.
    if (video.data.access === "paid" && yandexDiskAddress.test(video.body)) {
      throw new Error(
        `src/content/video/${video.id}: a paid video must not link to Yandex Disk in its text; its file link lives only at the access service`,
      );
    }
    // Added 2026-09-28 with the members-only blocks (see membersOnlyBlock above). Only a paid
    // video's page ever reveals one, so on a public video the block would stay hidden from
    // everybody; and a block whose opening line is spelled differently or whose closing tag is
    // missing is not cut out of the card, the feed and the search index. Both fail the build.
    if (video.body.includes(membersOnlyMarker)) {
      if (video.data.access !== "paid") {
        throw new Error(
          `src/content/video/${video.id}: a data-members-only block belongs in a paid video (access: paid); on a public one nobody would ever see it`,
        );
      }
      if (publicBody(video).includes(membersOnlyMarker)) {
        throw new Error(
          `src/content/video/${video.id}: a members-only block must open with exactly <div data-members-only> and close with </div>, with no other div inside`,
        );
      }
    }
  }
  return videos;
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
    // Changed 2026-09-28: publicBody(), so a members-only block never reaches a list card.
    summary: summary(publicBody(video)),
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

/** A video as the search index takes it; the shape is SearchSource in lib/lists.ts. */
export function videoSearch(video: Video): SearchSource {
  return {
    card: videoCard(video),
    categories: video.data.categories,
    // Changed 2026-09-28: publicBody(), so the search cannot find the text of a members-only block.
    text: publicBody(video),
  };
}
