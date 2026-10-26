/**
 * Live table availability from Resy, for the "Tables tonight" strip.
 *
 * Uses the same endpoints Resy's own booking widget calls, with the venue's
 * widget key (RESY_API_KEY) and RESY_VENUE_ID from the host's environment.
 * These endpoints are not a published API, so Resy can change them: every
 * failure returns { ok: false } and the strip on the page stays hidden. The
 * Reserve button keeps working either way.
 *
 * Booking itself still happens on Resy (guests sign in there). Slots link to
 * the venue's Resy page with the date and party size filled in.
 */
import { env } from './http';

// RESY_API_BASE only exists so local tests can point at a mock server
const API = (env.RESY_API_BASE || 'https://api.resy.com').replace(/\/$/, '');
const TZ = 'America/New_York';
const MAX_DAYS_AHEAD = 60;
const CAL_DAYS = 14;
export const MAX_SEATS = 7; // 8+ goes to private events

export interface Slot {
  /** 24h "19:30" */
  time: string;
  /** "7:30 PM" */
  label: string;
  /** Seating area, e.g. "Dining Room", "Patio" */
  area: string;
}
export interface Day {
  date: string;
  /** available | sold-out | closed */
  status: 'available' | 'sold-out' | 'closed';
}
export interface Availability {
  ok: boolean;
  date?: string;
  seats?: number;
  slots?: Slot[];
  days?: Day[];
  error?: string;
}

/** YYYY-MM-DD for a Date, in New York time */
export function nyDate(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

/** "HH:MM" right now, New York time */
function nyClock(d = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
}

function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

function label12(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

function headers(key: string): HeadersInit {
  return {
    authorization: `ResyAPI api_key="${key}"`,
    accept: 'application/json',
    origin: 'https://widgets.resy.com',
    referer: 'https://widgets.resy.com/',
    'x-origin': 'https://widgets.resy.com',
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  };
}

async function getJson(url: string, key: string): Promise<any> {
  const res = await fetch(url, { headers: headers(key), signal: AbortSignal.timeout(4500) });
  if (!res.ok) throw new Error(`Resy ${new URL(url).pathname} → ${res.status}`);
  return res.json();
}

/** Open slots for one day, sorted, de-duplicated by time + area */
async function findSlots(venueId: string, key: string, date: string, seats: number): Promise<Slot[]> {
  const q = new URLSearchParams({ lat: '0', long: '0', day: date, party_size: String(seats), venue_id: venueId });
  const data = await getJson(`${API}/4/find?${q}`, key);
  const venues: any[] = data?.results?.venues ?? [];
  const raw: any[] = venues.flatMap((v) => (Array.isArray(v?.slots) ? v.slots : []));

  const today = date === nyDate();
  const now = nyClock();
  const seen = new Set<string>();
  const slots: Slot[] = [];
  for (const s of raw) {
    // "2026-10-26 19:30:00"
    const start: string = s?.date?.start ?? '';
    const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/.exec(start);
    if (!m || m[1] !== date) continue;
    const time = m[2];
    if (today && time <= now) continue;
    const area = String(s?.config?.type ?? '').trim();
    const k = `${time}|${area}`;
    if (seen.has(k)) continue;
    seen.add(k);
    slots.push({ time, label: label12(time), area });
  }
  return slots.sort((a, b) => a.time.localeCompare(b.time) || a.area.localeCompare(b.area));
}

/** Next CAL_DAYS days marked available / sold out / closed */
async function calendar(venueId: string, key: string, from: string, seats: number): Promise<Day[]> {
  const q = new URLSearchParams({
    venue_id: venueId,
    num_seats: String(seats),
    start_date: from,
    end_date: addDays(from, CAL_DAYS - 1),
  });
  const data = await getJson(`${API}/4/venue/calendar?${q}`, key);
  const list: any[] = data?.scheduled ?? [];
  return list
    .map((d): Day | null => {
      const date = String(d?.date ?? '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
      const r = String(d?.inventory?.reservation ?? '');
      const status = r === 'available' ? 'available' : r === 'sold-out' ? 'sold-out' : 'closed';
      return { date, status };
    })
    .filter((d): d is Day => d !== null);
}

const json = (body: Availability, status: number, cache: string) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': cache },
  });

/** GET /api/availability?date=YYYY-MM-DD&seats=2 */
export async function handleAvailability(req: Request): Promise<Response> {
  const venueId = (env.RESY_VENUE_ID ?? '').trim();
  const key = (env.RESY_API_KEY ?? '').trim();
  if (!venueId || !key) return json({ ok: false, error: 'not-configured' }, 200, 'public, s-maxage=300');

  const url = new URL(req.url);
  const today = nyDate();
  const date = url.searchParams.get('date') || today;
  const seats = Number(url.searchParams.get('seats') || 2);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < today || date > addDays(today, MAX_DAYS_AHEAD)) {
    return json({ ok: false, error: 'bad-date' }, 400, 'no-store');
  }
  if (!Number.isInteger(seats) || seats < 1 || seats > MAX_SEATS) {
    return json({ ok: false, error: 'bad-seats' }, 400, 'no-store');
  }

  try {
    const [slots, days] = await Promise.all([
      findSlots(venueId, key, date, seats),
      calendar(venueId, key, today, seats).catch((e) => {
        console.error('[availability] calendar', e instanceof Error ? e.message : e);
        return [] as Day[];
      }),
    ]);
    // Shared CDN cache: Resy is called at most once per date + party size every 5 minutes
    return json({ ok: true, date, seats, slots, days }, 200, 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
  } catch (e) {
    console.error('[availability]', e instanceof Error ? e.message : e);
    return json({ ok: false, error: 'unavailable' }, 200, 'public, s-maxage=60');
  }
}
