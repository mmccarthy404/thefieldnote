// Check Astro's generated HTML and exact-path Cloudflare redirects offline.
// External URLs and fragment targets are deliberately outside this check.
import { readdir, readFile } from 'node:fs/promises';
import { join, posix } from 'node:path';

const root = 'dist';
async function listFiles(dir, prefix = '') {
	const files = [];
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const name = posix.join(prefix, entry.name);
		if (entry.isDirectory()) files.push(...await listFiles(join(dir, entry.name), name));
		else files.push(name);
	}
	return files;
}

const files = new Set(await listFiles(root));
const home = await readFile(join(root, 'index.html'), 'utf8');
const canonical = home.match(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"/);
if (!canonical) throw new Error('Home page has no canonical URL.');
const origin = new URL(canonical[1]).origin;
const redirects = new Map();
for (const line of (await readFile(join(root, '_redirects'), 'utf8')).split('\n')) {
	const [from, to] = line.trim().split(/\s+/);
	if (from?.startsWith('/') && to) redirects.set(from, to);
}

const errors = [];
// The permanently drafted reference is an end-to-end draft-filtering sentinel.
if ([...files].some((file) => /^blog\/example(?:\/|\.html$)/.test(file))) {
	errors.push('The permanently drafted example has a production route.');
}

for (const file of files) {
	if (!file.endsWith('.html') && !file.endsWith('.xml')) continue;
	const text = await readFile(join(root, file), 'utf8');
	if (file.endsWith('.xml') && /\/blog\/example(?:\/|<)/.test(text)) {
		errors.push(`${file}: the permanently drafted example appears in a feed or sitemap.`);
	}
	if (!file.endsWith('.html')) continue;
	const pagePath = '/' + file.replace(/index\.html$/, '');
	// Astro emits quoted attributes. Match actual tags, not escaped code examples.
	const html = text.replace(/<!--[\s\S]*?-->/g, '');
	for (const tag of html.matchAll(/<(?:a|link|img|script|source)\b[^>]*>/gi)) {
		for (const attr of tag[0].matchAll(/\s(?:href|src)=(?:"([^"]*)"|'([^']*)')/gi)) {
			const value = (attr[1] ?? attr[2]).replaceAll('&amp;', '&');
			let url = new URL(value, origin + pagePath);
			const visited = new Set();
			while (url.origin === origin && redirects.has(url.pathname)) {
				if (visited.has(url.pathname)) break;
				visited.add(url.pathname);
				url = new URL(redirects.get(url.pathname), url);
			}
			if (url.origin !== origin) continue;
			const path = decodeURIComponent(url.pathname).replace(/^\//, '');
			const candidates = [path, posix.join(path, 'index.html'), path.replace(/\/$/, '') + '.html'];
			if (!candidates.some((candidate) => files.has(candidate))) {
				errors.push(`${file}: missing local target ${value}`);
			}
		}
	}
}

if (errors.length) {
	console.error(errors.join('\n'));
	process.exitCode = 1;
} else {
	console.log('check-build: local links and assets resolve; reference draft is excluded.');
}
