---
# Every field the schema accepts is shown here. See src/content.config.ts.
# Required: title, description, pubDate.
title: Example post
description: A reference post showing the frontmatter, Markdown and image conventions this site uses. Around 150 characters is the target.
pubDate: 2026-09-20
# updatedDate: 2026-09-21      # optional, shows "Updated" in the post meta
tags: ['databricks', 'unity-catalog']
# canonicalUrl: https://...    # optional, only if cross-posted elsewhere
heroImage: ./hero.png          # optional, colocated, becomes the og:image
draft: true                    # a reference file, never publish this
---

This first paragraph carries the weight. The `description` above appears as the
dek under the title and in search results, so it should not simply repeat this
opening line.

## Headings use sentence case

Only proper nouns and code identifiers keep their capitals — Databricks, Delta
Lake, `spark.conf`. Title Case fights with lowercase identifiers and looks
broken next to them.

Headings run h2 (30px) and h3 (24px); h1 is the post title and is generated for
you, so never write one in the body.

### h3 is the deepest level worth using

Below h3 the scale stops signalling hierarchy.

## Links

Internal links are relative: [the about page](/about) or
[a tag page](/tags/databricks/). External ones are ordinary URLs, like
[the Astro docs](https://docs.astro.build/). Both render green and underlined,
and thicken on hover.

## Lists

Unordered, for things with no sequence:

- A point
- Another point, which can contain `inline code` or [a link](/about)
- A third

Ordered, when sequence matters:

1. First step
2. Second step
3. Third step

## Code

Inline code uses single backticks: `getPublishedPosts()`.

Fenced blocks take a language for syntax highlighting:

```python
def ingest(catalog: str, schema: str) -> None:
    """Keep lines to about 72 characters.

    The block is ~76 characters wide before it scrolls
    horizontally, and narrower on a phone.
    """
    spark.sql(f"USE CATALOG {catalog}")
```

```sql
-- SQL, bash, json, yaml and diff all highlight too
SELECT catalog_name, schema_name
FROM   system.information_schema.schemata
WHERE  catalog_name = 'main';
```

Always label the language. An unlabelled block renders as plain text.

## Images

Images live next to the post and are referenced relatively. That is what lets
Astro convert them to WebP, generate responsive sizes and add width, height and
lazy loading — files in `public/` get none of that.

![Describe the image for screen readers; do not write "image of"](./diagram.png)

*An italic-only paragraph directly after an image becomes its caption.*

The caption is plain Markdown — no `<figure>` tag, which would force the image
into `public/` and break colocation.

## Blockquotes

> For quoting a source, a spec, or an error message worth setting apart.

## Tables

| Column | What it holds |
| --- | --- |
| Left | Tables work, and are useful for comparisons |
| Right | Keep them narrow; there is no horizontal scroll |

## Emphasis

*Italic* for emphasis and titles of works, **bold** sparingly for genuine
warnings. A horizontal rule separates major sections:

---

## Starting a new post

Copy this folder, rename it, and the folder name becomes the URL —
`src/content/blog/my-post/` serves at `/blog/my-post/`. Delete `draft: true`
when it is ready to publish. A post with no images can be a single flat file,
`src/content/blog/my-post.md`, with no folder at all.
