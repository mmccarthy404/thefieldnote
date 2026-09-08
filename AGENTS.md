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
    Never hardcode these strings into components.
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

- Every run is `npm ci` → `npm run check` (`astro check`) → `npm run build`.
  `npm ci` installs from the lockfile only — never `npm install` in CI, which
  resolves new versions silently and makes builds unreproducible.
- Builds on push to `main` and deploys via `cloudflare/wrangler-action`.
  PRs build but never deploy — that is the `if: github.ref` guard on the
  deploy step, not a separate workflow.
- Actions are pinned to commit SHAs, with the version in a trailing comment.
  Tags are mutable and can be repointed at hostile code; since Cloudflare has
  no OIDC, a long-lived API token is always in scope in this job. Never
  "tidy" a pin back to a tag. `.github/dependabot.yml` bumps them weekly,
  which is what keeps pinning maintainable rather than rotting.
- `concurrency` supersedes an in-flight run for the same ref, except on
  `main` — cancelling a deploy part-way could leave the Worker serving a
  half-uploaded asset set.
- Both credentials are stored as GitHub **secrets** (`gh secret list` shows
  `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`; `gh variable list` is
  empty), so both use the `secrets.` prefix. Using `vars.` for the account ID
  yields an empty value and a confusing auth error.
- `paths-ignore` on the `push` trigger skips runs for docs and editor config.
  Keep it an explicit list: a blanket `'**.md'` would match blog posts under
  `src/content/` and silently skip the deploy that publishes them. Never add
  the workflow file itself, or a fix to it can never run. It is deliberately
  not set on `pull_request` — PR builds are cheap insurance, and a filtered
  trigger would stall any PR that ever required this check.
- `permissions: contents: read` — the job needs no write scope.
- Node 22 with `cache: npm`, and `timeout-minutes` so a hung job cannot burn
  runner hours.

`.github/workflows/security.yml` runs gitleaks on every PR and every push to
`main`. It is a separate file on purpose:

- It has **no `paths-ignore`**. That filter answers "can this change the built
  site?", which is the wrong question for a secret — a token pasted into
  `AGENTS.md` changes no pixel and must still be caught. Never copy the
  deploy filter here.
- GitHub push protection already blocks known vendor tokens server-side, free
  and unskippable. gitleaks covers what it misses: generic credentials — a
  JDBC string with an embedded password, basic-auth in a URL, `password=` in
  a config snippet. Those are plausible in posts about data infrastructure.
- It catches a leak **before merge, not before push**. On a public repo a
  secret pushed to any branch is already public, so a failure here means
  *rotate that credential*, not merely *fix the diff*.
- **No scanner reads images.** Not gitleaks, not GitHub, not TruffleHog — they
  all scan text, and a screenshot is opaque binary. A token visible in a
  terminal capture or a Databricks UI screenshot is caught only by a human
  looking at the image diff in the PR. That is part of why PRs are required.

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

## Astro documentation

Full documentation: https://docs.astro.build — read it against the Hard
constraints above. The official guides assume options this project has ruled
out, so relevance varies:

| Guide | Relevance |
|---|---|
| [Content collections](https://docs.astro.build/en/guides/content-collections/) | Primary |
| [Astro components](https://docs.astro.build/en/basics/astro-components/) | Primary |
| [Styling](https://docs.astro.build/en/guides/styling/) | Reference |
| [Routing](https://docs.astro.build/en/guides/routing/) | Reference |
| [Framework components](https://docs.astro.build/en/guides/framework-components/) | Reference |
| [Internationalization](https://docs.astro.build/en/guides/internationalization/) | Not applicable |

---

## Current status

Update this section as work lands.

**Done:** Astro scaffolded from the official blog template. Adapter removed and
all wizard residue cleaned up (`public/.assetsignore` deleted, `tsconfig.json`
reverted, `package.json` scripts restored). Assets-only Worker deployed.
Cloudflare API token created. GitHub repo public, `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID` stored as repository secrets, code pushed.

CI works and the deploy loop is verified end to end: push to `main` → Actions
build → `wrangler-action` deploy → change live at the workers.dev URL.

**Not started:** everything in the roadmap below. The site is still Astro's
default sample template.

---

## Roadmap

1. **Content collection schema** — per the conventions above.
2. **Design and layout** — see Open questions. This is the largest remaining
   piece.
3. **Syntax highlighting** — Shiki is built in. Pick a theme readable in both
   light and dark. Expressive Code is an option if line highlighting, filename
   tabs, or diff markers are wanted; decide before writing many posts, since it
   changes code fence syntax.
4. **Feeds, SEO, metadata** — RSS via `@astrojs/rss` (already installed, default
   to full-content), sitemap, per-page OpenGraph, canonical URLs honoring the
   `canonicalUrl` field, `robots.txt`.
5. **OG images** — generate at build time with Satori or `astro-og-canvas`. No
   manual image creation.
6. **Custom 404** — `src/pages/404.astro`. `not_found_handling` is already
   configured to serve it.
7. **Search** — Pagefind. Build-time index, no server. Not urgent at low post
   counts, painful to retrofit later.
8. **Repo hygiene** — add `@astrojs/check` + `typescript` and run `astro check`
   in CI before the build; link checker; Renovate or Dependabot. Optionally
   per-PR preview deploys via `wrangler versions upload` (deliberately deferred).
9. **Analytics** — Cloudflare Web Analytics. Free, cookieless, one snippet.

**Explicitly out of scope:** migrating posts from the old `aheadinthecloud`
site. The Field Note starts empty. Do not propose importing old content or
building slug-preservation and redirect machinery — there is nothing to
preserve. May be revisited later.

---

## Open questions — ask, do not decide

**Design and layout.** The author has no design opinions yet and wants to work
this out interactively. Bring options, show alternatives, react to feedback. Do
not execute a spec.

The only fixed facts: the current look is Astro's placeholder template, not a
starting aesthetic to preserve; and the content is dense technical prose (code
blocks, config snippets, tables), so readability under load matters more than
visual novelty. Everything else is unsettled — typography, color, dark mode,
layout width, homepage structure, how tags and archives surface.

Offered as defaults to argue with, not requirements: settle body typography
early, since font, line height, and line length are the highest-leverage choices
for this content and churn every page if changed later; and build dark mode in
from the start via CSS custom properties and `prefers-color-scheme`, since it's
cheap early and annoying to retrofit.

**Tailwind vs. plain CSS with custom properties.** The old site used Tailwind so
the author knows it. Plain CSS is the lighter default. Either is fine; no heavy
component library either way. Decide this *inside* the design exploration — the
styling approach should follow the visual direction, not constrain it.

**Tagline.** The line under "The Field Note" in the header, also the site
description for search and social previews. Distinct from per-post
`description`. The author expects to want one but hasn't chosen the wording, and
it'll likely be easier to write once a few posts exist. Build so it can be
added, changed, or omitted without rework. Do not block on it, and do not invent
one.

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
