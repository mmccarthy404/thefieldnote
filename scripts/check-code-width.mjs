/**
 * Fails the build if any fenced code block line exceeds MAX_CHARS.
 *
 * Code blocks scroll horizontally rather than wrap (`wrap: false` in the Shiki
 * config), which keeps indentation meaningful — it is syntax in Python. The
 * cost is that an over-long line produces a scrollbar, so the limit is enforced
 * here instead of being left to notice later.
 *
 * MAX_CHARS is 80: Prettier's default, one over PEP 8's 79, and the
 * cross-language convention. Black's 88 is deliberately not the target — it is
 * a formatter-internal optimisation ("10% over 80", chosen because it produced
 * shorter files), not a readability finding, and it is Python-only while these
 * posts also carry SQL, bash, JSON and YAML.
 *
 * The ceiling is physical: the block holds 81.4 characters at 15px. See the
 * --size-code comment in src/styles/global.css for the derivation. If the type
 * scale, the measure or the padding ever change, recompute both together.
 *
 * Counting characters is a valid proxy for width because JetBrains Mono is a
 * true monospace: every printable ASCII glyph advances at exactly 0.600em,
 * verified against the font's hmtx table. A line of 80 `w`s is the same width
 * as 80 `i`s. Three cases break that assumption, none of them likely here:
 * non-ASCII characters outside the latin subset Astro builds (CJK and emoji
 * are commonly double-width), any character missing from the font and served
 * by the `ui-monospace` fallback, and `String.length` counting UTF-16 code
 * units, so an astral-plane character counts as two. All three under-report
 * rather than over-report, so the check stays conservative.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const ROOT = 'src/content/blog';
const MAX_CHARS = 80;

async function markdownFiles(dir) {
	const out = [];
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) out.push(...(await markdownFiles(full)));
		else if (entry.name.endsWith('.md') || entry.name.endsWith('.mdx')) out.push(full);
	}
	return out;
}

let failures = 0;
let blocks = 0;

let files = [];
try {
	files = await markdownFiles(ROOT);
} catch {
	console.log(`check-code-width: no ${ROOT} yet, nothing to check`);
	process.exit(0);
}

for (const file of files) {
	const lines = (await readFile(file, 'utf8')).split('\n');
	let inFence = false;
	let fence = '';
	lines.forEach((line, i) => {
		const match = line.match(/^(\s*)(`{3,}|~{3,})/);
		if (match) {
			const marker = match[2];
			if (!inFence) {
				inFence = true;
				fence = marker;
				blocks++;
			} else if (marker[0] === fence[0] && marker.length >= fence.length) {
				inFence = false;
			}
			return;
		}
		if (inFence && line.length > MAX_CHARS) {
			failures++;
			console.error(
				`${relative('.', file)}:${i + 1}  ${line.length} chars (max ${MAX_CHARS})\n` +
					`    ${line.slice(0, MAX_CHARS)}\u001b[7m${line.slice(MAX_CHARS)}\u001b[0m`,
			);
		}
	});
}

if (failures > 0) {
	console.error(`\ncheck-code-width: ${failures} line(s) over ${MAX_CHARS} characters.`);
	console.error('Reformat the snippet — e.g. `black -l 80` — or shorten the line.');
	process.exit(1);
}
console.log(`check-code-width: ${blocks} code block(s) in ${files.length} file(s), all within ${MAX_CHARS}.`);
