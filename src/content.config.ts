import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Conventional frontmatter field names, so posts stay portable to any other
// generator. No issue or series number field — numbered posts were considered
// and rejected.
const blog = defineCollection({
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string(),
			pubDate: z.coerce.date(),
			updatedDate: z.coerce.date().optional(),
			tags: z.array(z.string()).default([]),
			draft: z.boolean().default(false),
			heroImage: image().optional(),
			/** For posts cross-posted elsewhere. */
			canonicalUrl: z.url().optional(),
		}),
});

export const collections = { blog };
