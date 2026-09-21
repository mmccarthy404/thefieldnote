# The Field Note

Personal technical blog for a Databricks field engineer. Posts are practical
observations from day-to-day work: Databricks, data infrastructure, ML
infrastructure, and things that break in production.

- **Publication name:** The Field Note
- **Domain:** thefieldnote.dev (not yet live — see Domain cutover)
- **Deployed at:** https://thefieldnote.mmccarthy404.workers.dev

## Stack

| Concern | Choice |
|---|---|
| Framework | Astro 7, static output |
| Content | Astro Content Collections |
| Post format | Markdown (`.md`) |
| Hosting | Cloudflare, assets-only Worker |
| CI/CD | GitHub Actions → `wrangler-action@v4` |
| Styling | Undecided — see Open questions |

## Commands

```bash
npm run dev       # local dev server, localhost:4321
npm run build     # static build to dist/
npm run preview   # serve the built output locally
```

Astro 7 can run the dev server detached, which is the right mode for an agent
session — a foreground `npm run dev` never returns and blocks the turn:

```bash
npx astro dev --background   # start detached
npx astro dev status         # is one running?
npx astro dev logs --follow  # tail its output
npx astro dev stop           # stop it
```

Pushing to `main` deploys. `package.json` also has a `deploy` script that builds
and runs `wrangler deploy` directly — it exists as an escape hatch for debugging
a broken pipeline, not as the normal path. Do not use it routinely, and never as
a workaround for a failing CI run.

## Environment

WSL2 / Ubuntu, Node 22, npm. The repo lives on the Linux filesystem
(`~/projects/thefieldnote`). Never move it under `/mnt/c` — cross-filesystem
access makes npm installs and file watching unusably slow.

---

## Hard constraints

These are deliberate decisions, several of them made after hitting the problem
firsthand. If a task seems to require breaking one, stop and ask.

1. **No Astro adapter.** `@astrojs/cloudflare` was installed once by wrangler's
   setup wizard and deliberately removed. An adapter turns this into a
   server-rendered Worker with KV session bindings, which this site has no use
   for. Static asset requests on Cloudflare never invoke Worker code and are
   free — that property depends on staying assets-only.
2. **No Cloudflare Pages.** Cloudflare steers new projects to Workers with
   static assets. Do not add a Pages config or the Pages Git integration.
3. **No Cloudflare Git integration.** Deploys go through GitHub Actions only.
   Connecting the repo in the Cloudflare dashboard creates a second competing
   deploy path.
4. **No CMS.** Posts are Markdown files in Git.
5. **No third-party content layer.** Astro Content Collections only. The
   previous site died on Contentlayer; that is what we left.
6. **Markdown-first; MDX is unused.** The author has never written an MDX post.
   The old site's posts were plain Markdown with embedded images. Treat MDX as
   an escape hatch that has never been needed, not a requirement — do not build
   MDX-dependent tooling or components speculatively.
7. **No build-time Mermaid.** `rehype-mermaid` pulls in Playwright/Chromium. It
   was considered and cut; no diagram need has been established. If a diagram is
   ever needed, commit an exported SVG.
8. **100% static.** No browser storage, no client-side data fetching, no runtime
   API calls.
9. **Minimal JS.** Astro ships zero JS by default. Any island must be justified
   and use `client:visible`.
10. **Single source of truth for site metadata.** Site title, tagline, author,
    and base URL live in `src/consts.ts`. The header, `<title>`, meta
    description, OpenGraph tags, and RSS channel metadata all read from it.
    Never hardcode these strings into components. The favicon is not among
    them: it is an asset, `public/favicon.svg`, referenced once by `BaseHead`.
11. **Never push to `main`.** A ruleset requires a pull request with both the
    `build-deploy` and `gitleaks` checks passing. Branch, open a PR, let CI go
    green, then squash-merge. The
    repo admin can bypass the ruleset; that exists for a genuine emergency,
    not as the normal path, and never for an agent. CI cannot gate a direct
    push — a push is what triggers CI — so the PR is the only thing standing
    between a broken build and the live site.
12. **Use `AGENTS.md` as the only project instruction file.** Claude Code
    2.1.277 and newer can load it natively; enable AGENTS.md support under
    "Project instructions" in `/config`. Edit this file directly and do not
    create tool-specific copies or symlinks.
13. **No LLM-written site content.** The about page states that everything on
    this site is written by hand, without LLMs. That claim is load-bearing and
    a reader can check it, so it constrains the agent as much as the author.

    **In scope — every word a visitor reads:** post bodies and titles, page
    bodies, frontmatter `title` and `description`, `SITE_TAGLINE`,
    `SITE_DESCRIPTION`, and any interface string that carries a voice rather
    than being a plain label. Do not draft it, ghost-write it, "polish" it or
    paste it in, and do not offer to. Asked for wording, decline and offer
    review instead.

    **Out of scope:** code, components, layouts, config, this file, commit
    messages and PR descriptions. Those are not content on the site. Plain
    functional labels — "Skip to content", "Posts", "About", "Draft" — are
    interface furniture, not voice.

    **Reviewing is encouraged, and is the useful role.** Flag typos, grammar,
    comma splices, repetition, filler, character counts, truncation points,
    and sentences that are not doing their job. Say plainly when something
    reads weakly. An illustrative example may be given in chat when asked
    for one, clearly marked as illustration — never written into a file.

    **Hold the author to it.** Before any pull request that touches content,
    check that no agent-written prose is shipping and say so if it is. The
    claim is only worth making while it is true.

---

## Configuration — treat as correct

Installed: `@astrojs/mdx`, `@astrojs/sitemap`, `@astrojs/rss`, `sharp`,
`wrangler`. Note that `@astrojs/mdx` is installed but unused (see constraint 6);
leaving it costs nothing and keeps the escape hatch open. Removing it is fine
too — ask before doing so, don't decide unilaterally.

`wrangler.jsonc`. Do not add `main`, bindings, `compatibility_flags`, or
`observability`. The absence of `main` is what makes this assets-only.

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "thefieldnote",
  "compatibility_date": "2026-09-07",
  "assets": {
    "directory": "./dist",
    "not_found_handling": "404-page"
  }
}
```

`.github/workflows/deploy.yml` is the source of truth — read the file rather
than a copy kept here. The decisions it encodes:

- `npm ci` → `npm run check` → `npm run build`. Never `npm install` in CI: it
  resolves new versions silently and makes builds unreproducible.
- PRs build; only `main` deploys, via the `if: github.ref` guard on the deploy
  step rather than a second workflow.
- Both credentials are GitHub **secrets**, so both use the `secrets.` prefix.
  `vars.` yields an empty value and a confusing auth error.
- Actions are pinned to commit SHAs, version in a trailing comment. Tags are
  mutable, and Cloudflare has no OIDC, so a long-lived token is always in
  scope here. Never tidy a pin back to a tag — `.github/dependabot.yml` bumps
  them weekly, which is what keeps pinning maintainable.
- `concurrency` supersedes in-flight runs, except on `main`, where cancelling
  part-way could leave the Worker serving a half-uploaded asset set.
- Every push builds. There is no `paths-ignore`: it saved about a minute on
  doc-only pushes and cost a silent failure mode, since a plausible-looking
  `'**.md'` matches blog posts and stops publishing them.
- `permissions: contents: read`, Node 22 with `cache: npm`, `timeout-minutes`.

`.github/workflows/security.yml` runs gitleaks on every PR and push to `main`:

- GitHub push protection already blocks known vendor tokens server-side, free
  and unskippable. gitleaks covers what it misses — generic credentials like a
  JDBC string with an embedded password, plausible in posts about data
  infrastructure.
- It catches a leak before **merge**, not before **push**. On a public repo a
  secret pushed to any branch is already public, so a failure means *rotate
  that credential*, not merely *fix the diff*.
- **No scanner reads images.** A token visible in a screenshot is caught only
  by a human reading the image diff in a PR. Part of why PRs are required.

`.gitignore` must cover `node_modules/`, `dist/`, `.astro/`, `.wrangler/`, and
Claude Code's local state. `wrangler.jsonc` and `AGENTS.md` are committed —
never ignore those. For Claude Code:

```
.claude/*
!.claude/settings.json
```

`.claude/settings.json` is shared project config and is committed;
`.claude/settings.local.json`, session state, and caches are personal and are
not.

---

## Content conventions

Posts are `.md` files in the blog collection. Schema lives in
`src/content.config.ts`. Use conventional frontmatter field names so posts stay
portable to any other generator:

```yaml
title:         # string, required
description:   # string, required — used for OG and RSS
pubDate:       # date, required
updatedDate:   # date, optional
tags:          # string[], default []
draft:         # boolean, default false
heroImage:     # optional
canonicalUrl:  # optional — for posts cross-posted elsewhere
```

Do **not** add an issue or series number field. Numbered posts were considered
and rejected.

**Start from `src/content/blog/example/`.** It is a permanently-drafted
reference post carrying every frontmatter field, all the Markdown this site
styles, and the conventions below. Copy the folder, rename it, replace the
text, delete `draft: true`. Keep it drafted and do not copy its prose into a
real post — its wording is instructional, not voice (constraint 13).

**Titles use sentence case.** Proper nouns and code identifiers keep their own
casing — Databricks, Delta Lake, `spark.conf`. Title Case collides with
lowercase identifiers, which a blog about data tooling hits constantly.

**Never write an `h1` in a post body.** It is generated from `title`. Bodies
run `h2` and `h3`; below `h3` the scale stops signalling hierarchy.

**Keep code lines to 80 characters or fewer.** Blocks hold 81 at the current
15px code size, and `npm run check` fails the build on anything longer — see
Code width under Open questions for the derivation. Always label the fence
language; an unlabelled block renders as plain text.

Filter `draft: true` out of the blog index, RSS, and sitemap in production while
keeping drafts visible in `astro dev`.

**Draft filtering is easy to break.** Every route that enumerates posts must go
through `getPublishedPosts()` in `src/lib/posts.ts`. Calling `getCollection('blog')`
directly in a `getStaticPaths()` builds a route for every draft, giving it a
live URL and listing it in the sitemap — the index and RSS still hide it, so it
looks hidden while being fully public. This shipped undetected for weeks
because the site had no posts to expose it.

**Colocate post images with the post** and reference them relatively, so content
moves as a unit. A post with images lives in a folder as `index.md`; the folder
name becomes the URL, so `blog/my-post/index.md` serves at `/blog/my-post/`. A
post with no images can stay a flat `.md` file. This is not only tidiness:
images under `src/` go through Astro's pipeline and get WebP conversion,
responsive `srcset`, intrinsic width/height and lazy loading. A 5.8KB test PNG
was served at 632 bytes. Files in `public/` are copied verbatim and get none of
it.

## Page format — `.md` or `.astro`

- **`.md` in `src/pages/`** for standalone prose with a `layout:` pointing at
  `src/layouts/Page.astro` — currently `about.md` and `404.md`. Astro's docs
  endorse this for one-off pages and steer collections toward "directories of
  related Markdown files that share a similar structure".
- **A content collection** for files sharing a schema — the blog.
- **`.astro`** for anything that generates pages from data: `index.astro`,
  `tags/[tag].astro`, `blog/[...slug].astro`. A dynamic route cannot be
  Markdown.

Two things depend on this and are easy to break:

- The `layout:` frontmatter property means **Astro stops injecting
  `<meta charset="utf-8">`**. `BaseHead` emits it explicitly; removing that
  line silently breaks the Markdown pages while leaving the `.astro` ones fine.
- `src/pages/*.md` gets **no schema validation**. A mistyped frontmatter key
  fails silently rather than erroring. Acceptable at two pages; if standalone
  pages reach five or six, move them into their own collection with a schema.

**Redirects belong in `public/_redirects`, not in a page.** Cloudflare's
static-asset runtime parses that file and issues real HTTP 301s; the file is
never served as an asset. `/blog` redirects there, replacing a
`<meta http-equiv="refresh">` page — a meta refresh returns HTTP 200 and asks
the browser to bounce, which is slower and a weaker signal to crawlers. Note
`astro dev` does not honour `_redirects`, so redirected paths 404 locally and
work in production.

---

## Spacing and sizing — the system

**Every spacing value is a whole number of 4px units**, declared in `rem` via
`--u: 0.25rem` and the `--space-N` tokens. Before this, values landed at 7.6,
11.4, 14.4, 17.6, 22.4, 25.6, 38 and 51 — a set of tuned numbers rather than a
system.

**It is quantization, not vertical rhythm.** A baseline grid is unreachable
here: the line boxes are body 31.35, h1 46.25, h2 37.5, h3 30 and code 26.25,
which share no common divisor. Any claim of rhythm from a 4px unit would be
fiction. What the grid buys is a short, reviewable vocabulary. A modular scale
derived from the 31.35px line box was considered and rejected — it reproduces
exactly the 7.6/11.4/22.4 texture this replaced, with a nicer derivation.

**The grid governs spacing only. Type sizes stay off-grid.** `--size-code` at
15px and `--size-ui` at 14px are deliberate. Rounding `--size-code` to 16
silently breaks the 80-character content rule: a block holds 81.4 characters at
15px and 76.3 at 16px.

### The heading ladder

`--rhythm` 28 → h3-top 36 → h2-top 48, steps of 1.29 and 1.33. Bottom margins
stay **tight at 16 and 12**.

Do not raise the bottoms to Databricks' 20/16. Their absolute pixels do not
port: their body leading is 1.40 against this site's 1.65, so identical
declared margins read looser here. Measured optically, with half-leading
included, tight bottoms give an above:below ratio of 1.96 at h2 and 1.87 at h3.
Loosening them drops both and widens the gap between levels.

**Move tops and bottoms in the same direction or not at all.** Lowering tops
while raising bottoms compresses the contrast from both ends — that was a
rejected proposal, not a hypothetical.

Known trade, accepted: the pre-grid values (51/18, 38/12) had an optical spread
of 0.006 between the two levels; the current values have 0.093. Every on-grid
combination reaching near-zero spread requires `--h2-top` back at 60–68px,
which undoes a reduction that was the point of the exercise.

### Units — the rule that prevents a repeated bug

Three separate bugs came from one mistake: a font-relative unit resolving
against the *consuming* element rather than the intended basis.

- **Spacing is `rem`.** `--rhythm` was `1.5em` and produced 28.50 on
  paragraphs, 25.65 on tables and 22.50 on code blocks — three rhythms from one
  token.
- **`em` only where the element's own size is the intended basis** — inline
  code padding, blockquote indent.
- **`ch` is resolved once and never re-derived.** `--measure` is `51.3rem`
  (72ch at 19px = 820.8px). As `72ch` it computed to 561.6px on `.site-foot`,
  which carries both `.wrap` and a 13px font-size — a column 259px narrower
  than every other on the site. In a *media condition* `ch` resolves against
  the root font, so `sizes="(max-width: 72ch)"` was a ~691px breakpoint.

### Small text

Two tokens replace six ad-hoc sizes (11, 13, 13, 13, 14, 14.25). They are split
by **case**, not by role: for uppercase, cap-height is the perceived size and
x-height does not participate, so one token cannot serve both.

- `--size-meta` 12px — uppercase and tracked: post meta, post-list dates.
- `--size-ui` 14px — nav, footer, tagline, tags, **and captions**. A caption at
  14px sits at 0.737 of the body x-height, within 2% of the 0.750 the blind
  rounds settled on. 12px would drop it to 0.632 in already-muted text.

### h4

Redefined at body size, distinguished by weight and tracking. It was 18px
against a 19px body — a heading smaller than its own text, the same inversion
the scale tournament was re-run to fix. **Do not "delete h4" to solve this:**
it is in the grouped `.prose h1, h2, h3, h4` selector, so removing its own rule
leaves it 19px bold with zero margins, which is worse.

### Code block padding

20px block, 24px inline — deliberately asymmetric. JetBrains Mono's
half-leading adds ~7.6px above the first cap that the horizontal axis does not
have, so equal padding reads 25% looser vertically. **The inline value must not
grow:** 24px leaves 81.4 characters against a content rule of 80, and the
ceiling is 30.4px.

---

## Astro 7 notes

Astro 7 shipped 2026-06-22. Differences from Astro 5/6 docs you may have
memorized:

- The default Markdown processor is a Rust engine (Sätteri). **Any remark or
  rehype plugin requires installing `@astrojs/markdown-remark`** to restore the
  unified pipeline. Prefer solutions that need no plugin.
- The compiler is stricter — unclosed tags are errors, no HTML auto-correction.
- Vite 8 under the hood.
- Wrangler warns that Astro 7 is "not officially supported." Cosmetic; its
  framework presets lag Astro releases and only affect build-command detection.

Astro 7 postdates the training cutoff of most models. Verify CLI flags against
`npx astro <command> --help` rather than memory — the background dev server
above is a real Astro 7 feature that looks invented if you only recall Astro 5.

---

## Design — settled

Settled over four rounds of blind A/B testing against a full-length technical
post, not chosen from a mockup. Tokens live in `src/styles/global.css`.

**Type.** IBM Plex Sans for body and headings, JetBrains Mono for code. The
scale is a major third (1.25) on a 19px body — `body 19 · h3 24 · h2 30 ·
h1 37` — at a 72ch measure, 1.65 line height.

That scale won a blind round-robin 8–0 against four alternatives, with all ten
repeated pairs agreeing with themselves. Worth knowing why it was re-run: the
first two rounds asked "keep this, or this larger value" one variable at a
time, which ratchets — every step wins in isolation and nothing pushes back.
Body drifted 18 → 19 → 20px while h1 was never asked about, ending with h3
*smaller* than body text. Blind, whole-system, repeated comparison fixed it and
pulled body size back down. **If more design questions come up, test them that
way: hide the numbers, change whole systems, ask twice with the sides swapped.**

**Colour.** `#169B62` is the brand green and the only colour on the site. There
is no secondary, deliberately.

It appears verbatim only where the 4.5:1 floor for small text does not apply:
`--brand` is now used for the `::selection` fill and the favicon, nothing else.
All coloured **text** uses `--accent`, `light-dark(#007f4e, #169b62)`.

**One hex cannot serve both modes.** This was re-derived numerically and is
arithmetic, not preference. `#169B62` has luminance 0.245; a colour passing
4.5:1 against both the light and dark papers would need luminance ≤0.172 and
≥0.213 at once. No colour of any hue can. Even pure white and pure black do not
admit one. **Do not try to "simplify" the pair.**

There is one legitimate route to the raw hex in light mode, unused so far:
WCAG's large-text floor is 3:1 at 24px+, and `#169B62` on the paper is 3.38:1.
The scale runs h1 37 / h2 30 / h3 24, so **the brand hex is already legal on
every heading in light mode**. `h4` at 18px is not eligible.

Every neutral sits on the brand hue (157.9° nominal) with chroma scaled down —
roughly an eighth for marks that carry weight, a twentieth for fills. Paper and
ink were moved onto that hue too: they previously sat at 91° and 258°, so the
site changed temperature between light and dark. Lightness was held, so
contrast did not move. Note the swap is **below the just-noticeable threshold**
(ΔE 0.004–0.010 in OKLab) — it buys a rule with no exception, not a visible
change. If a genuinely warm paper is ever wanted, it needs roughly three times
the chroma, around `#faf6ef`, and that is a real aesthetic decision.

Below about chroma 0.010 the hue is bookkeeping: one 8-bit step swings it by
tens of degrees, which is why some tokens read 152–165° rather than 157.9°.

**`::selection` pins `color`, not just a background.** The tint alone drops
everything but body text under 4.5:1 while selected — links to 3.52, `--muted`
to 3.81, code comments to 3.72. That is not fixable by picking a different
tint: the paper is already near the top of the luminance scale, so any visible
highlight of any hue does it. Setting `color: var(--fg)` forces selected runs
to 11.92:1. Cost: selected code loses its syntax colours while selected.

**Interactive elements follow two rules, no exceptions.** Links that must
identify themselves inside running text — `.prose a` only — carry colour *and*
an underline at rest, and thicken the underline on hover; colour alone would
fail colour-blind readers and hover does not exist on touch. Links whose
clickability is obvious from position — nav, footer, post-list titles and post
tags — are `--muted` at rest and take `--accent` on hover, nothing else.

Post tags render as `#tag`, with the hash generated by CSS `::before` rather
than stored, so the tag string stays clean for the URL, the frontmatter and the
tag page's `<h1>`. Their rules are scoped `.prose .post-tags a` because the tag
list sits inside `<article class="prose">`: at equal specificity `.prose a`
wins on source order, which silently rendered tags as green underlined body
links until it was caught.

**Dark mode** is built in via `light-dark()` pairs on every colour token, with
`color-scheme` on the root deciding. There is no visible theme toggle —
remembering a choice needs storage, which constraint 8 rules out. The
`[data-theme]` hooks are present and cost nothing if that is ever revisited.

**Syntax highlighting** is `github-light-high-contrast` / `github-dark-high-contrast`.
Chosen by measuring common token colours against the code fill: syntax colours
are text, so 4.5:1 applies, and most popular themes miss badly in light mode —
Solarized bottoms out at 2.38:1, One Light 2.29:1, Catppuccin Latte 2.65:1,
Vitesse 2.08:1. This pair reaches 4.48:1 worst case light, 8.92:1 dark. The
light `--code-bg` is a shade lighter than first picked specifically so the
weakest token (comments) clears 4.5:1 at 4.57:1. Astro's config schema drops
Shiki's `colorReplacements`, so that is the only lever available.

**Captions** use the plugin-free pattern: a Markdown image followed by an
italic-only paragraph, styled via `:has()`. Astro only rewrites Markdown image
syntax, so a raw `<figure>` would force images into `public/` and break
colocation. MDX components are ruled out by constraint 6.

**Still open, deliberately.** Line length was pinned at 72ch during the scale
tournament so it never got its own blind test. The code fill was chosen in
round one at the old scale and never compared head-to-head against a neutral
fill — though note it now measures 1.05:1 against the paper, so it is barely a
fill at all and the block is delimited mostly by its border. It cannot be
darkened more than about 2 OKLCH lightness points without pushing the weakest
syntax token (comments, 4.57:1) under the floor. Both are better judged against
real posts.

## Current status

**Infrastructure is done and verified.** Astro scaffolded from the official
blog template, adapter removed, wizard residue cleaned up, assets-only Worker
deployed. The loop is proven end to end: PR → `build-deploy` + `gitleaks` →
squash-merge → deploy → live at the workers.dev URL.

- Ruleset on `main` requires a PR with both checks green (constraint 11).
- Cloudflare token is scoped to `Workers Scripts:Edit` and
  `Account Settings:Read` only. It deliberately cannot create Pages projects,
  KV namespaces, Workers Builds, or observability — constraints 1, 2 and 3 are
  enforced by the credential, not just written down here.
- Dependabot runs weekly for npm and github-actions. Secret scanning, push
  protection and Dependabot alerts are on.

**Design is settled and built** — see Design above. Astro's sample posts,
placeholder images and bundled Atkinson font are gone; `src/` is now the real
site. Shipped: the collection schema with `draft`/`tags`/`canonicalUrl`, draft
filtering that keeps drafts visible in `astro dev` and out of production
builds, the post list as the home page, per-tag pages, an about page, a custom
404, RSS, sitemap, `robots.txt`, and per-page canonical and OpenGraph tags.

**The favicon is Lucide's `clipboard-pen`**, recoloured to `#169B62` and
committed as `public/favicon.svg`, with `public/favicon.ico` (16/32/48px)
generated from it as the fallback. `BaseHead` declares both. Astro's bundled
logo is gone.

Lucide is ISC-licensed, so no attribution is required in the rendered page; the
provenance is recorded in a comment inside the SVG. Stock 2px stroke, not the
2.5px variant — both were rendered at 16/32/48px and bold was no cleaner.

Single colour, no `prefers-color-scheme` variant: it is a non-text mark, so the
4.5:1 floor does not apply and `#169B62` is legible on both a light and a dark
tab strip. Known trade-off: Lucide leaves the board's right edge open where the
pen crosses it, which reads as depth at 32px and as an unclosed rectangle at
1x 16px. Accepted deliberately.

Regenerate the `.ico` after any change to the SVG. `sharp` is already a
dependency and emits PNGs; the ICO container is a 6-byte header plus one 16-byte
directory entry per image, then the PNG payloads.

**The site has no published posts.** That is intentional — The Field Note
starts empty. The collection holds one permanently-drafted reference post,
`src/content/blog/example/`, which is excluded from production builds and the
sitemap; see Content conventions.

**All site copy is the author's, written by hand.** Tagline, site description,
about page, 404 page and the tag-page description template. The about page
states this publicly, which is what constraint 13 exists to protect. The only
agent-written strings still rendered are plain interface labels — "Skip to
content", "Posts", "About", "Draft", "Updated" — and the `©` line.


## Roadmap

Done: collection schema, design and layout, syntax highlighting, feeds and SEO
(RSS, sitemap, OpenGraph, canonical URLs honouring `canonicalUrl`,
`robots.txt`), custom 404.

Remaining:

1. **OG images** — generate at build time with Satori or `astro-og-canvas`. No
   manual image creation. `BaseHead` already emits `og:image` when a post has a
   `heroImage`, so this slots in without restructuring.
2. **Search** — Pagefind. Build-time index, no server. Not urgent at low post
   counts, painful to retrofit later.
3. **Repo hygiene** — link checker. `astro check` already runs in CI. Optionally
   per-PR preview deploys via `wrangler versions upload` (deliberately
   deferred).
4. **Analytics** — Cloudflare Web Analytics. Free, cookieless, one snippet.

**Cut, not deferred:** full-content RSS. The feed carries descriptions only
and stays that way — rendering every post to HTML inside the endpoint needs the
container API and a sanitiser, which is real machinery for a nicety.

**RSS has no visible link.** The feed is discoverable only through the
`<link rel="alternate">` tag in `BaseHead`, which is what feed readers actually
use. A naked link to raw XML reads as a broken page to anyone who does not
already know what a feed is. If it is ever surfaced again, style the feed with
XSLT or link to an explainer page — do not point a nav item at `rss.xml`.

**Explicitly out of scope:** migrating posts from the old `aheadinthecloud`
site. The Field Note starts empty. Do not propose importing old content or
building slug-preservation and redirect machinery — there is nothing to
preserve. May be revisited later.

---

## Open questions — ask, do not decide

**Tagline and site description — written, and decoupled.** `SITE_TAGLINE` is
the visible line under the header; `SITE_DESCRIPTION` is the invisible meta
description used for search results, link previews and the RSS channel. They
were briefly the same string, which forced one to do both jobs — a tagline that
works under a masthead makes a poor search snippet, and an empty tagline meant
an empty description. They are independent now. Both are the author's words;
**never draft either** (constraint 13). Blank is safe: `BaseHead` omits the
description tags entirely rather than emitting empty ones.

**Code width — settled.** Code is 15px and lines are capped at 80
characters, enforced by `scripts/check-code-width.mjs` in `npm run check`.

The numbers, so they are not re-derived by guesswork: IBM Plex Sans and
JetBrains Mono both advance `"0"` at exactly **0.600em**, measured out of the
font's `hmtx` table rather than assumed. So 72ch at 19px is 820.8px; less 40px
of `.prose` padding and 48px of `pre` padding leaves 732.8px, which is **81.4
characters at 15px** and 76.3 at 16px. An earlier session recorded the measure
as "about 750px" — that was an estimate and it is wrong.

Why 15px rather than a layout change: the blind round picked 16px against a
**20px** body (ratio 0.80), the body later dropped to 19px without code
following (0.84), and 15px restores **0.79** — closer to the tested proportion
than the shipped site was. It touches one token and leaves the measure, inline
code, padding and layout alone.

Why 80 and not Black's 88: 88 needs code at ~13.8px, which is below the tested
ratio. It is also a formatter-internal optimisation — Black's docs say it was
chosen as "10% over 80" because it "produced significantly shorter files" — not
a readability finding, and it is Python-only while these posts carry SQL, bash,
JSON and YAML. 80 is Prettier's default and one over PEP 8's 79.

Why scroll rather than wrap: wrapping restarts a line at column zero, which
destroys indentation — syntax, in Python. With the limit enforced, desktop
never scrolls anyway; the scrollbar only appears on a phone, where the column
is narrower than any limit can account for and a horizontal swipe is the
expected affordance. Databricks wraps (`white-space: pre-wrap`, code at 14px on
a 20px body); Cloudflare scrolls at 14px. Neither widens the block beyond the
prose column, and neither did we.

If the type scale, the measure or the block padding ever change, recompute the
capacity and `MAX_CHARS` together — they are one decision.

**NEXT — there is no responsive system at all.** The stylesheet contains
**zero width-based media queries**. The column needs 860.8px; below that
everything goes fluid on 20px gutters with no adjustment to type or spacing. On
a 375px phone a code block's content area is about 287px — roughly **32
monospace characters** against an 80-character content rule — and a 48px h2
ladder tuned for an 820px column is proportionally far heavier on a 335px one.
For a code-heavy blog this is the largest ungoverned area in the file, larger
than anything the spacing work addressed. Raise it before any further spacing
tuning; the answers may change what the desktop values should be.

**Two design values left untested** — line length (pinned at 72ch during the
scale tournament, so never blind-tested on its own) and whether the code fill
should stay tinted or go neutral. Both are one-line changes in `global.css`,
and both are better judged against real posts than in another round of
comparisons. Both are entangled with the 80-character question above: the
measure sets how wide code can be, and the fill cannot be judged until the
block has a visible edge. Raise them once a few posts exist; do not change
either unilaterally.

**Warm paper.** Paper and ink now sit on the brand hue, which is invisible
(ΔE < 0.01) but makes the neutral rule exceptionless. A visibly warm, printed
paper is a legitimate alternative and would need roughly three times the
chroma, around `#faf6ef` — a real change, unlike the one already made. Raise
it against a real post; do not change unilaterally.

**Styling approach — decided.** Plain CSS with custom properties, no Tailwind
and no component library. One stylesheet, `src/styles/global.css`, driven
entirely by tokens. This followed from the visual direction rather than
constraining it, which was the intent.

---


## Domain cutover — author-driven, do not attempt

The domain is parked at Squarespace with no email and no DNS records in use, so
there is nothing to preserve and the usual record-migration risk doesn't apply.

1. Confirm the Squarespace DNS panel is empty apart from defaults; disable
   DNSSEC if enabled.
2. Add `thefieldnote.dev` as a zone in Cloudflare.
3. Point Squarespace nameservers at Cloudflare's two.
4. Worker → Settings → Domains & Routes → add the apex as a custom domain. TLS
   auto-provisions.
5. Redirect Rule: `www` → apex. Apex is canonical.
6. Registrar transfers to Porkbun after 2026-10-14. Nameservers survive the
   transfer. Do not edit DNS while a transfer is pending.

Attaching an apex domain requires the zone to live on the same Cloudflare
account; there is no supported ALIAS/ANAME-from-elsewhere path. This was
investigated and ruled out.

Timing is the author's call, likely once the site no longer looks like the
sample template.
