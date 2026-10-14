/**
 * POST /api/inquiry: private event + catering inquiries.
 * Runs on demand (a Vercel / Netlify function, or the Node server locally).
 * Logic lives in src/server/inquiry.ts.
 */
import type { APIRoute } from 'astro';
import { handleInquiry } from '../../server/inquiry';

export const prerender = false;

export const POST: APIRoute = ({ request }) => handleInquiry(request);
