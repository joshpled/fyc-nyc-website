// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import netlify from '@astrojs/netlify';
import node from '@astrojs/node';

/**
 * Every page is prerendered (static HTML). Only /api/inquiry and /api/join run
 * on demand, so the adapter just packages those two as serverless functions.
 * The host is detected from its build environment; locally the Node adapter
 * is used so `npm run build && npm run preview` works.
 */
const adapter = process.env.NETLIFY
  ? netlify({ imageCDN: false })
  : process.env.VERCEL
    ? vercel()
    : node({ mode: 'standalone' });

export default defineConfig({
  site: 'https://thefycnyc.com',
  output: 'static',
  adapter,
  // Links and canonicals use trailing slashes ("/menus/"); 'ignore' lets old
  // slash-less URLs reach their redirects in one hop on every host.
  trailingSlash: 'ignore',
  build: { format: 'directory', inlineStylesheets: 'always' },
  // 301s from the old SpotHopper URLs (/catering keeps the same path)
  redirects: {
    '/food-menu': { status: 301, destination: '/menus/' },
    '/drink-menu': { status: 301, destination: '/menus/cocktails/' },
    '/wine': { status: 301, destination: '/menus/wine/' },
    '/reservations': { status: 301, destination: '/reserve/' },
    '/party': { status: 301, destination: '/private-events/' },
    '/events': { status: 301, destination: '/happenings/' },
    '/people-we-f-with': { status: 301, destination: '/our-story/#partners' },
  },
  integrations: [
    sitemap({
      // Keep confirmation pages and the 404 out of search
      filter: (page) => !/\/(404|thanks)(\/|$)/.test(page),
    }),
  ],
  image: {
    // AVIF/WebP generated at build time via sharp
    responsiveStyles: false,
  },
});
