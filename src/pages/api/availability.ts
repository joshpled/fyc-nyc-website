/**
 * GET /api/availability?date=YYYY-MM-DD&seats=2: open Resy tables.
 * Runs on demand; responses are cached at the CDN for 5 minutes.
 * Logic lives in src/server/resy.ts.
 */
import type { APIRoute } from 'astro';
import { handleAvailability } from '../../server/resy';

export const prerender = false;

export const GET: APIRoute = ({ request }) => handleAvailability(request);
