import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const postSchema = z.object({
  title: z.string(),
  number: z.number(),
  date: z.string(),
  submolt: z.string().optional(),
  tags: z.string().optional(),
  // Optional documentary cover photo (Library of Congress / FSA / OWI etc).
  // When present, the card hero band and the exhibit page render the image
  // in place of the procedural typographic hero. Public-domain only.
  cover: z.string().optional(),
  coverAlt: z.string().optional(),
  coverCredit: z.string().optional(),
  coverHref: z.string().optional(),
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
