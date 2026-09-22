import { defineCollection, z } from "astro:content";

const posts = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    draft: z.boolean().default(false),
    description: z.string().default(""),
    tags: z
      .array(z.string())
      .default([])
      .transform((tags) => tags.map((t) => t.toLowerCase())),
    categories: z.array(z.string()).default([]),
    lastmod: z.coerce.date().optional(),
    summary: z.string().optional(),
    share_title: z.string().optional(),
    share_description: z.string().optional(),
  }),
});

const pages = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
  }),
});

const video = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    draft: z.boolean().default(false),
    description: z.string().default(""),
    tags: z
      .array(z.string())
      .default([])
      .transform((tags) => tags.map((t) => t.toLowerCase())),
    categories: z.array(z.string()).default([]),
    videoId: z.string().optional(),
    videoUrl: z.string().optional(),
    thumbnail: z.string().optional(),
    duration: z.string().optional(),
    heroImage: z.string().optional(),
    videoPlatform: z.string().default("youtube"), // youtube, vk, rutube и т.д.
    // For one day (2026-09-22) the four post-only fields - lastmod, summary, share_title,
    // share_description - were here too, because ArticleLayout.astro read them from a video
    // through Post.astro's `Post | Video` prop. The layout takes plain props now and
    // VideoLayout.astro maps a video onto them, so the video schema is its own again.
    // VIDEO-PAGE.md, section 4.
  }),
});

export const collections = { posts, pages, video };
