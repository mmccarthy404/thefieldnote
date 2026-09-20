// Single source of truth for site metadata. The header, <title>, meta
// description, OpenGraph tags and the RSS channel all read from here —
// never hardcode these strings into a component.

export const SITE_TITLE = 'The Field Note';

/**
 * The line under the title in the header. Optional, and deliberately empty:
 * the header renders nothing when it is blank, so one can be added whenever
 * there is a line worth having — or never. Short, a few words, read by
 * someone who is already on the site.
 *
 * Independent of SITE_DESCRIPTION by design. They were briefly the same
 * string; a tagline that works under a masthead makes a poor search snippet,
 * and tying them meant an empty tagline forced an empty description.
 */
export const SITE_TAGLINE = 'Data and AI notes and learnings from the field';

/**
 * The site's own description: the meta description on the home page, the
 * fallback for any page that sets none of its own, and the RSS channel
 * description.
 *
 * Around 140–155 characters, with the important part in the first 120.
 * Search engines rewrite it most of the time and it does not affect ranking,
 * but `og:description` is never rewritten — this is the sentence that appears
 * verbatim in every Slack, Discord, iMessage and Mastodon link preview, which
 * is where it actually earns its place.
 *
 * Blank is safe: BaseHead omits the description tags entirely rather than
 * emitting empty ones.
 */
export const SITE_DESCRIPTION = 'A collection of notes and learnings focused on Databricks in the life sciences industry, written from the lived experience of a field engineer.';

export const SITE_AUTHOR = 'Michael McCarthy';
