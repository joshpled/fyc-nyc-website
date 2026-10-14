/** Events helpers: sorting, display formatting, .ics files and Event JSON-LD. */
import eventsData from '../data/events.json';
import site from '../data/site.json';
import { fmtTime } from './hours';

export interface FycEvent {
  id: string;
  draft?: boolean;
  title: string;
  date: string; // YYYY-MM-DD
  start: string | null; // HH:MM
  end: string | null;
  summary: string | null;
  price: number | null;
  seats: number | null;
  cta: 'reserve' | 'tickets';
  ticketUrl: string | null;
}

export const weekly = eventsData.weekly;
const TZ = 'America/New_York';

/** Today in New York as YYYY-MM-DD */
export const todayNY = (d = new Date()) => d.toLocaleDateString('en-CA', { timeZone: TZ });

/** Upcoming events (today or later), soonest first. */
export function upcoming(now = new Date()): FycEvent[] {
  const today = todayNY(now);
  return (eventsData.events as FycEvent[]).filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? '').localeCompare(b.start ?? ''));
}

export function dateParts(iso: string) {
  const d = new Date(`${iso}T12:00:00Z`);
  return {
    month: d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase(),
    day: d.toLocaleDateString('en-US', { day: 'numeric', timeZone: 'UTC' }),
    weekday: d.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }),
    long: d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }),
  };
}

export const timeRange = (e: FycEvent) => (e.start ? (e.end ? `${fmtTime(e.start)}–${fmtTime(e.end)}` : fmtTime(e.start)) : null);

/** UTC offset for New York on a date, e.g. "-05:00" (handles daylight saving). */
function nyOffset(iso: string, hhmm = '12:00'): string {
  const probe = new Date(`${iso}T${hhmm}:00Z`);
  const name = new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'shortOffset' })
    .formatToParts(probe)
    .find((p) => p.type === 'timeZoneName')?.value ?? 'GMT-5';
  const m = name.match(/GMT([+-]\d+)(?::(\d+))?/);
  const h = m ? Number(m[1]) : -5;
  return `${h < 0 ? '-' : '+'}${String(Math.abs(h)).padStart(2, '0')}:${m?.[2] ?? '00'}`;
}

/** End date rolls to the next day when the end time is earlier than the start (after midnight). */
function endDateFor(e: FycEvent): string {
  if (!e.start || !e.end || e.end > e.start) return e.date;
  const d = new Date(`${e.date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

const absUrl = (p: string) => new URL(p, site.url).toString();
const address = `${site.address.street}, ${site.address.locality}, ${site.address.region} ${site.address.postalCode}`;

/** schema.org Event (confirmed events only: drafts are excluded so placeholders never reach Google). */
export function eventSchema(e: FycEvent) {
  if (e.draft) return null;
  const start = e.start ? `${e.date}T${e.start}:00${nyOffset(e.date, e.start)}` : e.date;
  const endDay = endDateFor(e);
  const end = e.end ? `${endDay}T${e.end}:00${nyOffset(endDay, e.end)}` : undefined;
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: e.title,
    startDate: start,
    ...(end ? { endDate: end } : {}),
    ...(e.summary ? { description: e.summary } : {}),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    image: [absUrl('/og/og-default.jpg')],
    url: absUrl(`/happenings/#${e.id}`),
    location: {
      '@type': 'Place',
      name: site.name,
      address: {
        '@type': 'PostalAddress',
        streetAddress: site.address.street,
        addressLocality: site.address.locality,
        addressRegion: site.address.region,
        postalCode: site.address.postalCode,
        addressCountry: site.address.country,
      },
    },
    organizer: { '@type': 'Organization', name: site.name, url: site.url },
    ...(e.price != null
      ? {
          offers: {
            '@type': 'Offer',
            price: String(e.price),
            priceCurrency: 'USD',
            url: e.ticketUrl || absUrl('/reserve/'),
            availability: 'https://schema.org/InStock',
          },
        }
      : {}),
  };
}

/* ---------------- .ics (RFC 5545) ---------------- */
const icsEscape = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const fold = (line: string) => {
  const out: string[] = [];
  let rest = line;
  while (Buffer.byteLength(rest, 'utf8') > 75) {
    let cut = 75;
    while (Buffer.byteLength(rest.slice(0, cut), 'utf8') > 75) cut--;
    out.push(rest.slice(0, cut));
    rest = ' ' + rest.slice(cut);
  }
  out.push(rest);
  return out.join('\r\n');
};
const compact = (iso: string) => iso.replace(/-/g, '');

const VTIMEZONE = [
  'BEGIN:VTIMEZONE', 'TZID:America/New_York',
  'BEGIN:DAYLIGHT', 'TZOFFSETFROM:-0500', 'TZOFFSETTO:-0400', 'TZNAME:EDT', 'DTSTART:19700308T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU', 'END:DAYLIGHT',
  'BEGIN:STANDARD', 'TZOFFSETFROM:-0400', 'TZOFFSETTO:-0500', 'TZNAME:EST', 'DTSTART:19701101T020000', 'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU', 'END:STANDARD',
  'END:VTIMEZONE',
];

export function eventIcs(e: FycEvent, now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:-//${site.name}//Happenings//EN`, 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', ...VTIMEZONE, 'BEGIN:VEVENT'];
  lines.push(`UID:${e.id}@thefycnyc.com`, `DTSTAMP:${stamp}`);
  if (e.start) {
    lines.push(`DTSTART;TZID=America/New_York:${compact(e.date)}T${e.start.replace(':', '')}00`);
    const end = e.end ?? `${String(Math.min(23, Number(e.start.slice(0, 2)) + 2)).padStart(2, '0')}:${e.start.slice(3)}`;
    lines.push(`DTEND;TZID=America/New_York:${compact(endDateFor({ ...e, end }))}T${end.replace(':', '')}00`);
  } else {
    const next = new Date(`${e.date}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    lines.push(`DTSTART;VALUE=DATE:${compact(e.date)}`, `DTEND;VALUE=DATE:${compact(next.toISOString().slice(0, 10))}`);
  }
  lines.push(`SUMMARY:${icsEscape(`${e.title} · ${site.name}`)}`);
  const desc = [e.summary, e.ticketUrl ? `Tickets: ${e.ticketUrl}` : `Reserve: ${absUrl('/reserve/')}`, `Questions? ${site.phone}`].filter(Boolean).join('\n');
  lines.push(`DESCRIPTION:${icsEscape(desc)}`);
  lines.push(`LOCATION:${icsEscape(`${site.name}, ${address}`)}`);
  lines.push(`GEO:${site.geo.lat};${site.geo.lng}`);
  lines.push(`URL:${absUrl(`/happenings/#${e.id}`)}`);
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
