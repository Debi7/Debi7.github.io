// The site's tags and categories, over every collection that has them. Added 2026-09-22.
//
// Until this file existed, term pages were built by getTerms() in lib/posts.ts, which walked the
// posts and nothing else. The reviewer found the visible half of what that costs: every video
// declares `tags: ["video", ...]` and prints those tags as links, and /tags/video/ was built by
// nobody, so the link was a 404. The quieter half is worse, because it looks like it works -
// /tags/биолокация/ does exist, built from the posts that carry it, and a visitor arriving from a
// video finds a page without a single video on it. Same for the categories: all ten videos
// declare one, and the Categories page listed the two the posts use. REVIEW-VIDEO.md, remarks 2
// and 3, has the measurements and the options that were weighed.
//
// This is the one place that says the site's terms span both collections. It is deliberately the
// only file in lib/ that imports from both, and it does the one thing that requires knowing both:
// it concatenates what each of them hands out. It does not read an entry, it does not know what a
// post or a video is, and there is no branch on where a card came from - collectTerms() in
// lists.ts receives flat data and returns flat data. That keeps the owner's rule of 2026-09-22
// intact (VIDEO-PAGE.md, section 4): posts and videos share code only on plain data, and a third
// kind of entry would be one more line here.
//
// The four routes that render terms - the two indexes and the two paginated term pages - call
// this and nothing else, so what a term contains is decided once rather than four times.
import { collectTerms, type Term, type TermKind } from "./lists";
import { postTerms } from "./posts";
import { videoTerms } from "./video";

/**
 * Every tag or category on the site with the entries that carry it, terms sorted by their
 * front-matter name and the entries inside each newest first.
 */
export async function getTerms(kind: TermKind): Promise<Term[]> {
  const [posts, videos] = await Promise.all([
    postTerms(kind),
    videoTerms(kind),
  ]);
  return collectTerms([...posts, ...videos]);
}
