// The search index, /search-index.json. Added 2026-09-22 at the owner's request, after he asked
// for the search the reference site (daucloud.com) puts in its header. That site answers with a
// page of its own at /search/, and its index is built at deploy time - its own build says the
// index is missing - so nothing could be copied from it but the shape of the feature.
//
// This is a static site: there is no server to ask, so the site ships what it knows and the
// browser does the searching. 42 entries is small enough that the whole text of every one of them
// fits here - 44KB of Markdown across the posts and the videos as this was written - so nothing is
// truncated and a match deep inside a long article is found like any other. If the site ever grows
// to the point where this file is heavy, the honest answers are to cut the text down to a few
// hundred characters an entry or to move to a real index (Pagefind builds one from the built HTML);
// the client in src/scripts/search.ts reads this shape and nothing else, so either is a change to
// one file and this one.
//
// No dependency, by the owner's decision of 2026-09-22 after three options were weighed: this, a
// fuzzy matcher (Fuse.js, ~20KB, tolerates typos), and Pagefind. The index is the same in all
// three, so a change of mind costs the matching code and not the data.
import type { APIRoute } from "astro";
import { getPosts, postCard } from "../lib/posts";
import { getVideos, videoCard } from "../lib/video";
import { plainifyMarkdown } from "../lib/summary";
import type { Card } from "../lib/lists";

/** One entry as the client searches it: what a result shows, plus the text it matches against. */
type IndexEntry = {
  url: string;
  title: string;
  /** ISO date, so the client can sort without parsing the site's display format. */
  date: string;
  /** The label of the section the entry lives in, matching the menu in src/config.ts. */
  section: string;
  tags: string[];
  /** The same summary a card shows, for the result that has no match inside the body. */
  summary: string;
  /** The whole body as plain text: what most matches are found in. */
  text: string;
};

// The two collections are read through their own lib/ files and reduced to a Card first, so this
// file never touches an entry's fields; it is the same arrangement as src/lib/terms.ts, which is
// the only other place where the two meet. published() has already left out the drafts and
// anything dated in the future, so the index cannot offer a page the site does not have.
//
// The section labels are written here rather than derived, because they are display text: they
// match the menu items "Posts" and "Video" in src/config.ts, and if those are ever translated
// these follow.
function entry(card: Card, section: string, body: string): IndexEntry {
  return {
    url: card.url,
    title: card.title,
    date: card.date.toISOString(),
    section,
    tags: card.tags,
    summary: card.summary,
    text: plainifyMarkdown(body),
  };
}

export const GET: APIRoute = async () => {
  const [posts, videos] = await Promise.all([getPosts(), getVideos()]);

  const entries: IndexEntry[] = [
    ...posts.map((post) => entry(postCard(post), "Posts", post.body)),
    ...videos.map((video) => entry(videoCard(video), "Video", video.body)),
  ];

  // Newest first, so an empty query - or two entries scoring the same - falls back to the order
  // every list on the site uses.
  entries.sort((a, b) => b.date.localeCompare(a.date));

  return new Response(JSON.stringify(entries), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      // The file is rebuilt with the site, and its address never changes, so a browser may keep
      // it for a day. GitHub Pages sends its own headers for static files; this is what the dev
      // and preview servers answer with.
      "Cache-Control": "public, max-age=86400",
    },
  });
};
