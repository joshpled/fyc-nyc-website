/**
 * "Tables tonight" (src/components/TableFinder.astro).
 * Fetches /api/availability and renders day chips + open times. The block
 * stays hidden unless the first load succeeds.
 */
import { appendUtm, track } from './analytics';

interface Slot { time: string; label: string; area: string }
interface Day { date: string; status: 'available' | 'sold-out' | 'closed' }
interface Avail { ok: boolean; date?: string; seats?: number; slots?: Slot[]; days?: Day[] }

const TZ = 'America/New_York';
const started = new WeakSet<HTMLElement>();

const nyToday = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Noon UTC keeps the weekday right for any viewer's time zone */
const asDate = (ymd: string) => new Date(`${ymd}T12:00:00Z`);
const weekday = (ymd: string) => asDate(ymd).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
const dayNum = (ymd: string) => asDate(ymd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** Visually hidden text for screen readers */
function sr_(text: string): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = 'sr-only';
  span.textContent = text;
  return span;
}

function dayName(ymd: string, today: string): string {
  if (ymd === today) return 'Today';
  if (ymd === addDays(today, 1)) return 'Tomorrow';
  return weekday(ymd);
}

function titleFor(ymd: string, today: string): string {
  if (ymd === today) return 'tonight';
  if (ymd === addDays(today, 1)) return 'tomorrow';
  return `on ${weekday(ymd)}, ${dayNum(ymd)}`;
}

async function fetchAvail(date: string, seats: number, signal: AbortSignal): Promise<Avail> {
  const res = await fetch(`/api/availability?date=${date}&seats=${seats}`, { signal, headers: { accept: 'application/json' } });
  if (!res.ok) return { ok: false };
  return res.json();
}

export function initTableFinder(root: HTMLElement) {
  if (started.has(root)) return;
  started.add(root);

  const seatsSel = root.querySelector<HTMLSelectElement>('[data-tf-seats]')!;
  const daysEl = root.querySelector<HTMLElement>('[data-tf-days]')!;
  const slotsEl = root.querySelector<HTMLElement>('[data-tf-slots]')!;
  const titleEl = root.querySelector<HTMLElement>('[data-tf-title]');
  const resyUrl = root.dataset.resyUrl || 'https://resy.com';
  const location = root.dataset.location || '';
  const isSection = root.classList.contains('tf--section');

  const today = nyToday();
  let date = today;
  let days: Day[] = [];
  let ctrl: AbortController | null = null;

  function renderTitle() {
    if (!titleEl) return;
    const when = titleFor(date, today);
    if (isSection) {
      titleEl.innerHTML = '';
      titleEl.append('Tables ');
      const em = document.createElement('em');
      em.textContent = when;
      titleEl.append(em);
    } else {
      titleEl.textContent = `Tables ${when}`;
    }
  }

  function renderDays() {
    // Calendar from Resy when available; otherwise the next 7 days with no status
    const list: Day[] = days.length ? days : Array.from({ length: 7 }, (_, i) => ({ date: addDays(today, i), status: 'available' as const }));
    daysEl.replaceChildren(
      ...list.map((d) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.dataset.date = d.date;
        b.setAttribute('aria-pressed', String(d.date === date));
        b.disabled = d.status !== 'available' && d.date !== date;
        const name = document.createElement('span');
        name.textContent = dayName(d.date, today);
        const sub = document.createElement('small');
        sub.textContent = d.status === 'sold-out' ? 'Full' : d.status === 'closed' ? 'Closed' : dayNum(d.date);
        // Screen readers hear "Wed, Oct 28, Full" / "Today, Oct 26"
        const sr = sr_(d.status === 'available' ? ', ' : `, ${dayNum(d.date)}, `);
        name.append(sr);
        b.append(name, sub);
        return b;
      }),
    );
  }

  function renderSlots(slots: Slot[], seats: number) {
    if (!slots.length) {
      const p = document.createElement('p');
      p.className = 'tf__empty';
      p.textContent = date === today
        ? 'Nothing left online tonight. Walk-ins are always welcome, or try another day.'
        : 'Nothing open online that day. Try another day or party size.';
      slotsEl.replaceChildren(p);
      return;
    }
    const multiArea = new Set(slots.map((s) => s.area).filter(Boolean)).size > 1;
    const href = new URL(resyUrl);
    href.searchParams.set('date', date);
    href.searchParams.set('seats', String(seats));
    const link = appendUtm(href.toString());
    slotsEl.replaceChildren(
      ...slots.map((s) => {
        const a = document.createElement('a');
        a.href = link;
        a.target = '_blank';
        a.rel = 'noopener';
        a.dataset.time = s.time;
        a.append(s.label);
        if (multiArea && s.area) {
          a.append(sr_(', '));
          const small = document.createElement('small');
          small.textContent = s.area;
          a.append(small);
        }
        a.append(sr_(`, ${seats} ${seats === 1 ? 'guest' : 'guests'}, book on Resy (opens in a new tab)`));
        return a;
      }),
    );
  }

  async function load(first = false) {
    ctrl?.abort();
    ctrl = new AbortController();
    const seats = Number(seatsSel.value) || 2;
    slotsEl.setAttribute('aria-busy', 'true');
    try {
      const data = await fetchAvail(date, seats, ctrl.signal);
      if (!data.ok) {
        if (first) return; // stay hidden
        const p = document.createElement('p');
        p.className = 'tf__empty';
        p.textContent = 'Live times are unavailable right now. Use the Resy button below.';
        slotsEl.replaceChildren(p);
        return;
      }
      if (data.days?.length) days = data.days;
      renderTitle();
      renderDays();
      renderSlots(data.slots ?? [], seats);
      root.hidden = false;
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return;
    } finally {
      slotsEl.setAttribute('aria-busy', 'false');
    }
  }

  seatsSel.addEventListener('change', () => {
    track('table_finder_seats', { seats: Number(seatsSel.value), location });
    load();
  });
  daysEl.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-date]');
    if (!b || b.disabled || b.dataset.date === date) return;
    date = b.dataset.date!;
    daysEl.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    renderTitle();
    load();
  });
  slotsEl.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[data-time]');
    if (!a) return;
    track('slot_click', { date, time: a.dataset.time!, seats: Number(seatsSel.value), location });
  });

  load(true);
}

export function initTableFinders() {
  document.querySelectorAll<HTMLElement>('[data-table-finder][data-load="eager"]').forEach(initTableFinder);
}
