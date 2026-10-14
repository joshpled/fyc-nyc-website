/** POST /api/join: Join the Family signup. Logic lives in src/server/join.ts. */
import type { APIRoute } from 'astro';
import { handleJoin } from '../../server/join';

export const prerender = false;

export const POST: APIRoute = ({ request }) => handleJoin(request);
