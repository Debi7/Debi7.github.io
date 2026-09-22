// The posts feed, /rss.xml. Added 2026-09-22, once the deploy address was settled (DEPLOY.md
// section 0): every link in a feed is absolute, so this could not be built while `site` was a
// placeholder.
//
// Plan section 9 parked the feeds "until parity is done". What made them possible now is not
// parity but the address; the Hugo theme emits its own feed, so having one here is a step towards
// parity rather than away from it.
//
// There are two feeds, this one and /video/rss.xml, and not one combined feed. That follows the
// owner's rule of 2026-09-22 (VIDEO-PAGE.md section 4): posts and videos are two entities that
// share code only on plain data. A reader who subscribes for the lectures should not get the
// articles, and neither file knows about the other's collection.
import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { getPosts, postUrl } from "../lib/posts";
import { summary } from "../lib/summary";
import { site } from "../config";

// Added 2026-09-22 at the owner's request: the feed carries the newest 20 entries, not the whole
// archive. A feed is a rolling window rather than a catalogue - a reader keeps every item it has
// already fetched, so an entry falling off the end of the file does not disappear for anyone who
// was subscribed; only a new subscriber sees less history. 20 is the conventional size and the one
// most generators default to. The site itself remains the complete archive, and the sitemap lists
// all of it.
const feedLength = 20;

export async function GET(context: APIContext) {
  // getPosts() applies the site's one publication rule - no drafts, nothing dated in the future,
  // newest first - so the feed can never show what the site does not (lib/lists.ts, published()).
  const posts = await getPosts();

  return rss({
    title: site.title,
    // The feed needs a description of its own; the site has no tagline in src/config.ts, so the
    // title is the honest answer rather than inventing one.
    description: site.title,
    // context.site is the `site` value from astro.config.mjs. It is what makes every link below
    // absolute, and the reason this file takes the context instead of importing the config.
    site: context.site ?? site.title,
    // slice() and not a filter: getPosts() returns the newest first, so the window is the head of
    // that list.
    items: posts.slice(0, feedLength).map((post) => ({
      title: post.data.title,
      pubDate: post.data.date,
      // The same summary the list cards show (lib/summary.ts), so a reader sees in the feed what
      // they would see on /posts/.
      description: post.data.description || summary(post.body),
      link: postUrl(post),
      categories: post.data.tags,
    })),
    // Hugo's feed carries the site language; readers use it to pick a voice for text-to-speech and
    // search engines to group the feed.
    customData: `<language>${site.language}</language>`,
  });
}
