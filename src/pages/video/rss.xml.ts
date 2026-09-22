// The video feed, /video/rss.xml. The companion of /rss.xml; see the notes there for why there
// are two feeds rather than one, and why both could only be built once the deploy address was
// settled.
//
// This file knows the `video` collection and nothing else, the way lib/video.ts does: a reader
// who subscribes here gets the lectures and not the articles.
import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { getVideos, videoUrl } from "../../lib/video";
import { summary } from "../../lib/summary";
import { site } from "../../config";
import { t } from "../../i18n/strings";

// The same rolling window as the posts feed, and for the same reasons - see the note next to
// feedLength in src/pages/rss.xml.ts. The number is repeated rather than shared: the two feeds are
// separate subscriptions, and either one may want a different depth later without disturbing the
// other. There are ten lectures today, so this limit does nothing yet; it is here so that the two
// files behave alike when the collection grows.
const feedLength = 20;

export async function GET(context: APIContext) {
  const videos = await getVideos();

  return rss({
    // The feed's own title says which half of the site it carries, so the two feeds are told apart
    // in a reader. "Video" is the menu item's label (src/config.ts), kept as it is written there.
    title: `${site.title} - Video`,
    description: t.list_watch_video,
    site: context.site ?? site.title,
    items: videos.slice(0, feedLength).map((video) => ({
      title: video.data.title,
      pubDate: video.data.date,
      description: video.data.description || summary(video.body),
      link: videoUrl(video),
      categories: video.data.tags,
    })),
    customData: `<language>${site.language}</language>`,
  });
}
