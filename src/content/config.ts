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
    // Added 2026-09-22 (VIDEO-PAGE.md, section 2): Post.astro renders a video through the
    // same ArticleLayout as a post since a3c194c, and that layout reads these four optional
    // fields from `data`. Without them `astro check` reported four errors. They mean the
    // same as in the posts schema above, and a video may set them the same way.
    lastmod: z.coerce.date().optional(),
    summary: z.string().optional(),
    share_title: z.string().optional(),
    share_description: z.string().optional(),
  }),
});

export const collections = { posts, pages, video };
