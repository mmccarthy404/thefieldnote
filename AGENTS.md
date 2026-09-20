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
    base URL, and the favicon emoji live in `src/consts.ts`. The header,
    `<title>`, meta description, OpenGraph tags, RSS channel metadata, and the
    `<link rel="icon">` data URI all read from it. Never hardcode these strings
    into components.
11. **Never push to `main`.** A ruleset requires a pull request with both the
    `build-deploy` and `gitleaks` checks passing. Branch, open a PR, let CI go
    green, then squash-merge. The
    repo admin can bypass the ruleset; that exists for a genuine emergency,
    not as the normal path, and never for an agent. CI cannot gate a direct
    push — a push is what triggers CI — so the PR is the only thing standing
    between a broken build and the live site.
12. **Edit `AGENTS.md`, never `CLAUDE.md`.** `AGENTS.md` is the real file and
    `CLAUDE.md` is a symlink to it, matching the Astro scaffold's original
    arrangement: the vendor-neutral name holds the content, the tool-specific
    alias points at it. An atomic save — write a temp file, then rename over
    the path — replaces a symlink rather than following it, so writing to
    `CLAUDE.md` breaks the link and leaves two files that silently drift. This
    has already happened once, in the opposite direction, and surfaced only as
    a cryptic `typechange` in `git status`.

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
Claude Code's local state. `wrangler.jsonc`, `AGENTS.md`, and `CLAUDE.md` are
committed — never ignore those. For Claude Code:

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

Filter `draft: true` out of the blog index, RSS, and sitemap in production while
keeping drafts visible in `astro dev`.

Colocate post images with the post and reference them relatively, so content
moves as a unit.

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

It appears verbatim wherever the 4.5:1 contrast floor for small text does not
apply — every non-text mark, and all text in dark mode, where it measures
5.04:1. On the light paper it is 3.38:1, and no light background fixes that:
even pure white only reaches 3.56:1. So light-mode link text uses `#00844D`,
the same green darkened in OKLCH with hue held at 157.9° and chroma at the
maximum renderable at that lightness — 4.53:1. One colour, rendered legibly.
**Do not "simplify" these to a single hex.** It is not possible.

Hairlines, rules and the code fill are tinted neutrals at chroma 0.005–0.020,
roughly an eighth of the brand's saturation. They read as warm greys, not as
green, and exist to make the palette feel like one system.

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
tournament so it never got its own blind test. The green code fill was chosen
in round one at the old scale and never compared head-to-head against a neutral
fill. Both are one-line changes and are better judged against real posts.

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

**The site has no posts.** That is intentional — The Field Note starts empty —
so `astro build` warns that the blog collection is empty. Expected, not a
problem.

**The tagline is still blank.** `SITE_TAGLINE` in `src/consts.ts` is an empty
string and everything that reads it degrades gracefully; the header simply
renders no tagline. Filling it in is the only change needed. Do not invent one.


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

**Tagline.** The line under "The Field Note" in the header, also the site
description for search and social previews. Distinct from per-post
`description`. `SITE_TAGLINE` in `src/consts.ts` is an empty string; the header
renders nothing when it is blank, so it can be added or changed at any time
without rework. Do not block on it, and do not invent one.

**Two design values left untested** — line length (pinned at 72ch during the
scale tournament, so never blind-tested on its own) and whether the code fill
should stay green-tinted or go neutral. Both are one-line changes in
`global.css`, and both are better judged against real posts than in another
round of comparisons. Raise them once a few posts exist; do not change either
unilaterally.

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
