import rss from '@astrojs/rss';
import { SITE_DESCRIPTION, SITE_TITLE } from '../consts';
import { getPublishedPosts, postPath } from '../lib/posts';

export async function GET(context) {
	const posts = await getPublishedPosts();
	return rss({
		title: SITE_TITLE,
		description: SITE_DESCRIPTION,
		site: context.site,
		// Description-only for now. Full-content feeds need each post rendered to
		// HTML inside this endpoint, which means the container API and a
		// sanitiser — worth doing, but not before there are posts to test it on.
		items: posts.map((post) => ({
			title: post.data.title,
			description: post.data.description,
			pubDate: post.data.pubDate,
			categories: post.data.tags,
			link: postPath(post),
		})),
	});
}
