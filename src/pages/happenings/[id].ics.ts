/** /happenings/<event-id>.ics: "Add to calendar" file for each event, generated at build time. */
import type { APIRoute } from 'astro';
import eventsData from '../../data/events.json';
import { eventIcs, type FycEvent } from '../../lib/events';

export function getStaticPaths() {
  return (eventsData.events as FycEvent[]).map((e) => ({ params: { id: e.id }, props: { event: e } }));
}

export const GET: APIRoute = ({ props }) =>
  new Response(eventIcs((props as { event: FycEvent }).event), {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8' },
  });
