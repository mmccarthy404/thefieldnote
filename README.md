# The Field Note

Personal technical blog. Practical observations from day-to-day work:
Databricks, data infrastructure, ML infrastructure, and things that break in
production.

- **Live:** https://thefieldnote.mmccarthy404.workers.dev
- **Domain:** thefieldnote.dev — registered, not yet cut over

## Stack

| Concern | Choice |
|---|---|
| Framework | Astro 7, static output |
| Content | Astro Content Collections, Markdown |
| Styling | Plain CSS with custom properties — one stylesheet, no framework |
| Type | IBM Plex Sans, JetBrains Mono — self-hosted, subsetted at build |
| Hosting | Cloudflare, assets-only Worker (no adapter, no Pages) |
| CI/CD | GitHub Actions → `wrangler-action` |

## Commands

```sh
npm install
npm run dev       # localhost:4321
npm run check     # astro check — typechecks .astro files
npm run build     # static build to dist/
npm run preview   # serve the built output
```

The dev server can run detached, which is usually what you want:

```sh
npx astro dev --background
npx astro dev status
npx astro dev logs --follow
npx astro dev stop
```

## Writing a post

Add a Markdown file to `src/content/blog/`. The filename becomes the URL slug.

```yaml
---
title: 'Delta write conflicts are a layout problem'
description: 'Used for the post list, RSS, and social previews.'
pubDate: 2026-09-13
updatedDate: 2026-09-20   # optional
tags: ['databricks', 'delta-lake']
draft: false
heroImage: './images/hero.png'   # optional, relative to the post
canonicalUrl: 'https://elsewhere.example/post'   # optional, if cross-posted
---
```

Only `title`, `description` and `pubDate` are required. The schema is in
`src/content.config.ts`.

**Drafts** (`draft: true`) are visible in `npm run dev` and excluded from
production builds — which covers the post list, RSS, and the sitemap, since a
filtered post never gets a route.

**Images** live next to the post and are referenced relatively, so a post moves
as a unit. For a caption, follow the image with an italic-only paragraph:

```md
![Alt text describing the image](./images/timeline.svg)

*The caption goes here.*
```

**Tags** generate `/tags/<tag>/` pages automatically.

## Deploying

Pushing to `main` deploys. `main` is protected: it requires a pull request with
both the `build-deploy` and `gitleaks` checks passing, so the flow is branch →
PR → green CI → squash-merge.

There is a `deploy` script that builds and runs `wrangler deploy` directly. It
exists to debug a broken pipeline, not as the normal path.

## Design

Typography, scale and colour were settled by blind A/B testing against a
full-length technical post — including a round-robin tournament over complete
type scales, run blind with repeated pairs to control for bias. The results,
the reasoning, and the contrast measurements behind the colour choices are
written up in [AGENTS.md](AGENTS.md).

Short version: IBM Plex Sans on a major-third scale at a 19px body; a single
brand green (`#169B62`) with an OKLCH-darkened variant for light-mode link text
so it clears WCAG AA; dark mode via `light-dark()` on every colour token.

## Repo conventions

`AGENTS.md` is the working brief for both humans and coding agents — stack
decisions, hard constraints, and the reasoning behind them. It is the only
project instruction file. Claude Code 2.1.277+ can read it natively; enable
AGENTS.md support under "Project instructions" in `/config`.
