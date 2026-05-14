import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const postSchema = z.object({
  title: z.string(),
  number: z.number(),
  date: z.string(),
  submolt: z.string().optional(),
  tags: z.string().optional(),
});

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: postSchema,
});

const heung = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/heung' }),
  schema: postSchema,
});

export const collections = { posts, heung };
