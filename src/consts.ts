// Single source of truth for site metadata. The header, <title>, meta
// description, OpenGraph tags and the RSS channel all read from here —
// never hardcode these strings into a component.

export const SITE_TITLE = 'The Field Note';

/**
 * The line under the title in the header, and the site description used for
 * search results and social previews. Deliberately empty for now: it is easier
 * to write once a few posts exist, and everything that reads it degrades
 * gracefully when it is blank. Filling it in is the only change needed.
 */
export const SITE_TAGLINE = '';

/** Fallback for pages with no description of their own. */
export const SITE_DESCRIPTION =
	SITE_TAGLINE || 'Practical notes on Databricks, data infrastructure, and things that break.';

export const SITE_AUTHOR = 'Michael McCarthy';
