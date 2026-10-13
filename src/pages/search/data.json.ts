// The search index, /search/data.json. Added 2026-09-22 at the owner's request, after he asked
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
// Moved into src/pages/search/ later the same day, with the page. src/pages is the site's map of
// addresses - Astro 4.16, "Project structure": routes are created by adding files to it - so the
// two files cannot leave it, but they can sit together under the address they serve, the way
// src/pages/video/ already holds its list, its entry page and its feed. The page keeps /search/;
// this file went from /search-index.json to /search/data.json, and the only reader of it is
// src/scripts/search.ts.
//
// The name is data.json.ts and not index.json.ts, and that is a fix rather than a preference.
// index.json.ts in a folder that also holds index.astro collides: both resolve to /search/, the
// page wins, and the build simply does not write the JSON - dist/search/ held index.html alone,
// /search/index.json answered 404, and the page reported that the index could not be loaded.
// Astro has an error page for exactly this ("Prerendered dynamic endpoint has path collision"),
// whose advice is the one taken here: give the endpoint file a name of its own. The docs' own
// example of the naming is src/pages/data.json.ts -> /data.json (Astro 4, "Endpoints").
//
// No dependency, by the owner's decision of 2026-09-22 after three options were weighed: this, a
// fuzzy matcher (Fuse.js, ~20KB, tolerates typos), and Pagefind. The index is the same in all
// three, so a change of mind costs the matching code and not the data.
import type { APIRoute } from "astro";
import { getPosts, postSearch } from "../../lib/posts";
import { getVideos, videoSearch } from "../../lib/video";
import { plainifyMarkdown } from "../../lib/summary";
import type { SearchSource } from "../../lib/lists";
import { site } from "../../config";

/** One entry as the client searches it: what a result shows, plus the text it matches against. */
type IndexEntry = {
  url: string;
  title: string;
  /** ISO date, so the client can sort without parsing the site's display format. */
  date: string;
  /** The label of the section the entry lives in, matching the menu in src/config.ts. */
  section: string;
  tags: string[];
  /** The categories the entry declares; the facet list on /search/ filters on them. */
  categories: string[];
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
// The section labels come from src/config.ts, not from a literal here: the search page prints a
// checkbox per label, so one spelling in two files would drift the day either is translated.
function entry(source: SearchSource, section: string): IndexEntry {
  return {
    url: source.card.url,
    title: source.card.title,
    date: source.card.date.toISOString(),
    section,
    tags: source.card.tags,
    categories: source.categories,
    summary: source.card.summary,
    text: plainifyMarkdown(source.text),
  };
}

export const GET: APIRoute = async () => {
  const [posts, videos] = await Promise.all([getPosts(), getVideos()]);

  const entries: IndexEntry[] = [
    ...posts.map((post) => entry(postSearch(post), site.searchSections.posts)),
    ...videos.map((video) =>
      entry(videoSearch(video), site.searchSections.video),
    ),
  ];

  // Newest first, so an empty query - or two entries scoring the same - falls back to the order
  // every list on the site uses.
  entries.sort((a, b) => b.date.localeCompare(a.date));

  // Only the body of this Response becomes the file. Astro's "Endpoints" guide for 4.16 is
  // explicit about it - "Astro will call this at build time and use the contents of the body to
  // generate the file" - so headers set here reach the dev and preview servers and nobody else;
  // the built site is a .json file that GitHub Pages serves with its own. Content-Type is kept
  // because it is what makes `npm run dev` answer as JSON; a Cache-Control header stood here
  // until it was checked against the documentation, promising something no visitor would ever
  // receive.
  return new Response(JSON.stringify(entries), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
};
