import { defineCollection, z } from "astro:content";

// Mirrors the Hugo front matter (../klub_biolocation/archetypes/posts.md) and the
// `tags = [":lower"]` front matter rule from hugo.toml. See MIGRATION-PLAN.md §5.1.
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

// Stand-alone pages with a dedicated route (about.md -> src/pages/about.astro).
const pages = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
  }),
});

// Добавляем новую коллекцию для видео
const videos = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    videoUrl: z.string(), // Ссылка на YouTube/Vimeo или локальный файл
    heroImage: z.string().optional(),
  }),
});

export const collections = { posts, pages, videos };
