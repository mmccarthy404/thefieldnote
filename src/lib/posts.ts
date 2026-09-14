import { getCollection, type CollectionEntry } from 'astro:content';

/**
 * Posts for public listings, newest first.
 *
 * Drafts stay visible in `astro dev` so they can be written and previewed, and
 * are filtered out of every production build — which covers the blog index,
 * the RSS feed and, because a filtered post never gets a route, the sitemap.
 */
export async function getPublishedPosts(): Promise<CollectionEntry<'blog'>[]> {
	const posts = await getCollection('blog', ({ data }) => import.meta.env.DEV || !data.draft);
	return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

export function postPath(post: CollectionEntry<'blog'>): string {
	return `/blog/${post.id}/`;
}
