// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig, fontProviders } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://thefieldnote.dev',
  integrations: [mdx(), sitemap()],

  markdown: {
    shikiConfig: {
      // Dual themes: Shiki emits both, CSS picks one via light-dark().
      // `defaultColor: false` means no inline colours win by default.
      //
      // The high-contrast GitHub pair was chosen by measuring every common
      // token colour against this site's code fill. Syntax colours are text,
      // so the 4.5:1 floor applies to them, and most popular themes miss it
      // badly in light mode — Solarized bottoms out at 2.38:1, One Light at
      // 2.29:1, Catppuccin Latte at 2.65:1, even Vitesse at 2.08:1. This pair
      // is the only one that comes close: 4.48:1 worst case in light and
      // 8.92:1 in dark.
      //
      // Its one weak token is comments and strings at #66707b, which landed
      // at 4.48:1 against the original code fill — short by 0.02. Astro's
      // config schema drops Shiki's `colorReplacements`, so that is fixed
      // from the other side instead: --code-bg in global.css is a shade
      // lighter than first chosen, which clears it at 4.57:1. Comments are
      // the token people most need to read, so it was worth the adjustment.
      themes: {
        light: 'github-light-high-contrast',
        dark: 'github-dark-high-contrast',
      },
      defaultColor: false,
      wrap: false,
    },
  },

  fonts: [
    // Only the two families the settled design uses. Self-hosted and
    // subsetted by Astro at build time; no requests to Google at runtime.
    {
      provider: fontProviders.google(),
      name: 'IBM Plex Sans',
      cssVariable: '--font-plex-sans',
      weights: [400, 600, 700],
      styles: ['normal', 'italic'],
      fallbacks: ['system-ui', 'sans-serif'],
    },
    {
      provider: fontProviders.google(),
      name: 'JetBrains Mono',
      cssVariable: '--font-jetbrains-mono',
      weights: ['400 700'],
      fallbacks: ['ui-monospace', 'monospace'],
    },
  ],
});
