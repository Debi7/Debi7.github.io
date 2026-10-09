import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { getPosts, postUrl } from "../lib/posts";
import { summary } from "../lib/summary";
import { site } from "../config";

const feedLength = 20;

export async function GET(context: APIContext) {
  const posts = await getPosts();

  return rss({
    title: site.title,
    description: site.title,
    site: context.site ?? site.title,
    items: posts.slice(0, feedLength).map((post) => ({
      title: post.data.title,
      pubDate: post.data.date,
      description: post.data.description || summary(post.body),
      link: postUrl(post),
      categories: post.data.tags,
    })),

    customData: `<language>${site.language}</language>`,
  });
}
