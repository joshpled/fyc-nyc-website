/**
 * Hours engine. Pure functions, used at build time (footer, /visit, JSON-LD)
 * and in the browser (live "Open now" status in New York time).
 * Source of truth: src/data/hours.json
 */
import hoursData from '../data/hours.json';

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export interface Period { open: string; close: string }
export type Week = Record<DayKey, Period[]>;

export const DAYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
export const DAY_SHORT: Record<DayKey, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
export const DAY_LONG: Record<DayKey, string> = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };

const pick = (w: Record<string, unknown>): Week =>
  Object.fromEntries(DAYS.map((d) => [d, (w[d] as Period[]) ?? []])) as Week;

export const hours = {
  timezone: hoursData.timezone,
  confirmed: hoursData.confirmed,
  bar: pick(hoursData.bar),
  kitchen: pick(hoursData.kitchen),
  brunch: pick(hoursData.brunch),
  exceptions: hoursData.exceptions.dates as Record<string, { note?: string; bar?: Period[]; kitchen?: Period[] }>,
};

/** "16:00" -> 960 minutes */
export const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

/** "16:00" -> "4pm", "11:30" -> "11:30am", "00:00" -> "12am" */
export function fmtTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const suffix = h < 12 || h === 24 ? 'am' : 'pm';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${String(m).padStart(2, '0')}${suffix}` : `${h12}${suffix}`;
}

/** Shorter form for tight spots: "11:30am" -> "11:30", keeps am/pm otherwise */
export const fmtRange = (p: Period, sep = '–') => `${fmtTime(p.open)}${sep}${fmtTime(p.close)}`;

export const fmtPeriods = (ps: Period[], sep = '–') =>
  ps.length ? ps.map((p) => fmtRange(p, sep)).join(' & ') : 'Closed';

/** Groups consecutive days with identical hours: [{ label: 'Mon–Tue', text: '4pm–10pm' }] */
export function groupWeek(week: Week): { label: string; text: string; days: DayKey[] }[] {
  const rows: { label: string; text: string; days: DayKey[] }[] = [];
  for (const d of DAYS) {
    const text = fmtPeriods(week[d]);
    const last = rows[rows.length - 1];
    if (last && last.text === text) last.days.push(d);
    else rows.push({ label: '', text, days: [d] });
  }
  for (const r of rows) {
    r.label = r.days.length > 1 ? `${DAY_SHORT[r.days[0]]}–${DAY_SHORT[r.days[r.days.length - 1]]}` : DAY_SHORT[r.days[0]];
  }
  return rows;
}

/** Current date parts in the venue's time zone (works in any visitor time zone). */
export function nowInVenue(date = new Date(), timeZone = hours.timezone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const day = get('weekday').toLowerCase().slice(0, 3) as DayKey;
  return {
    day,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
    iso: `${get('year')}-${get('month')}-${get('day')}`,
  };
}

const prevDay = (d: DayKey) => DAYS[(DAYS.indexOf(d) + 6) % 7];
const nextDay = (d: DayKey) => DAYS[(DAYS.indexOf(d) + 1) % 7];

/** Periods for a given day, honoring date exceptions. */
function periodsFor(kind: 'bar' | 'kitchen', day: DayKey, iso?: string): Period[] {
  const ex = iso ? hours.exceptions[iso] : undefined;
  if (ex && ex[kind]) return ex[kind]!;
  return hours[kind][day];
}

/** Is a period open at `min` (minutes after midnight)? Handles closes after midnight. */
function spans(p: Period, min: number, fromYesterday: boolean): boolean {
  const o = toMin(p.open);
  let c = toMin(p.close);
  const overnight = c <= o;
  if (fromYesterday) return overnight && min < c;
  if (overnight) c += 24 * 60;
  return min >= o && min < c;
}

function openPeriod(kind: 'bar' | 'kitchen', day: DayKey, min: number, iso?: string): Period | null {
  for (const p of periodsFor(kind, day, iso)) if (spans(p, min, false)) return p;
  for (const p of periodsFor(kind, prevDay(day))) if (spans(p, min, true)) return p;
  return null;
}

export interface Status {
  open: boolean;
  /** e.g. "Open now · Bar until 1am" */
  short: string;
  /** e.g. "Open now · Bar until 1am · Kitchen until 11pm" */
  long: string;
  /** e.g. "Kitchen open until 11pm" / "Kitchen opens at 5pm" (used on /menus) */
  kitchen: string;
  today: { bar: Period[]; kitchen: Period[]; day: DayKey };
}

/** Live status in venue time. */
export function getStatus(date = new Date()): Status {
  const { day, minutes, iso } = nowInVenue(date);
  const bar = openPeriod('bar', day, minutes, iso);
  const kitchen = openPeriod('kitchen', day, minutes, iso);
  const today = { bar: periodsFor('bar', day, iso), kitchen: periodsFor('kitchen', day, iso), day };

  const nextKitchen = today.kitchen.find((p) => toMin(p.open) > minutes);
  const kitchenText = kitchen
    ? `Kitchen open until ${fmtTime(kitchen.close)}`
    : nextKitchen
      ? `Kitchen opens at ${fmtTime(nextKitchen.open)}`
      : 'Kitchen closed now';

  if (bar) {
    const short = `Open now · Bar until ${fmtTime(bar.close)}`;
    let k = '';
    if (kitchen) k = ` · Kitchen until ${fmtTime(kitchen.close)}`;
    else {
      // Only mention a kitchen opening that happens before the bar closes.
      const barOpenedToday = today.bar.includes(bar);
      const barClose = toMin(bar.close) + (barOpenedToday && toMin(bar.close) <= toMin(bar.open) ? 1440 : 0);
      const later = today.kitchen.find((p) => toMin(p.open) > minutes && toMin(p.open) < barClose);
      k = later ? ` · Kitchen opens ${fmtTime(later.open)}` : ' · Kitchen closed';
    }
    return { open: true, short, long: short + k, kitchen: kitchenText, today };
  }

  // Closed: find the next opening today, else tomorrow (skip fully closed days).
  const laterToday = today.bar.find((p) => toMin(p.open) > minutes);
  if (laterToday) {
    const s = `Closed now · Opens at ${fmtTime(laterToday.open)}`;
    return { open: false, short: s, long: s, kitchen: kitchenText, today };
  }
  let d = nextDay(day);
  for (let i = 1; i <= 7; i++, d = nextDay(d)) {
    const first = hours.bar[d][0];
    if (first) {
      const when = i === 1 ? 'tomorrow' : DAY_LONG[d];
      const s = `Closed now · Opens ${when} at ${fmtTime(first.open)}`;
      return { open: false, short: s, long: s, kitchen: kitchenText, today };
    }
  }
  return { open: false, short: 'Closed now', long: 'Closed now', kitchen: kitchenText, today };
}

/** schema.org openingHoursSpecification from a week. */
export function toOpeningHoursSpec(week: Week = hours.bar) {
  return DAYS.flatMap((d) =>
    week[d].map((p) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: `https://schema.org/${DAY_LONG[d]}`,
      opens: p.open,
      closes: p.close,
    })),
  );
}
