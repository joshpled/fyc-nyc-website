/**
 * GA4 events via data attributes:
 *   <a data-track="reserve_click" data-track-location="hero">
 * Events used: reserve_click, booking_drawer_open, call_click, directions_click,
 * menu_view, event_inquiry_submit, join_submit, gift_card_click (+ booking_start, email_click).
 *
 * UTM preservation: utm_* params from the landing URL are kept for the session
 * and appended to outbound booking / gift-card links so attribution survives.
 */
const UTM_KEY = 'fyc_utm';
const UTM_FIELDS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
const OUTBOUND_HOSTS = ['resy.com', 'opentable.com', 'toasttab.com'];

export function track(name: string, params: Record<string, string | number> = {}) {
  const gtag = (window as any).gtag;
  if (typeof gtag === 'function') gtag('event', name, params);
}

function readUtm(): Record<string, string> {
  try {
    return JSON.parse(sessionStorage.getItem(UTM_KEY) || '{}');
  } catch {
    return {};
  }
}

function captureUtm() {
  const q = new URLSearchParams(location.search);
  const found: Record<string, string> = {};
  for (const k of UTM_FIELDS) {
    const v = q.get(k);
    if (v) found[k] = v;
  }
  if (Object.keys(found).length) {
    try {
      sessionStorage.setItem(UTM_KEY, JSON.stringify(found));
    } catch {
      /* storage blocked: attribution still works on the landing page */
    }
  }
}

export function appendUtm(href: string): string {
  const utm = readUtm();
  if (!Object.keys(utm).length) return href;
  try {
    const u = new URL(href, location.href);
    for (const [k, v] of Object.entries(utm)) if (!u.searchParams.has(k)) u.searchParams.set(k, v);
    return u.toString();
  } catch {
    return href;
  }
}

export function initAnalytics() {
  captureUtm();

  // Carry UTMs onto outbound booking / gift card links
  if (Object.keys(readUtm()).length) {
    document.querySelectorAll<HTMLAnchorElement>('a[href^="http"]').forEach((a) => {
      if (OUTBOUND_HOSTS.some((h) => a.hostname.endsWith(h))) a.href = appendUtm(a.href);
    });
  }

  document.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-track]');
    if (!el) return;
    const params: Record<string, string> = {};
    if (el.dataset.trackLocation) params.location = el.dataset.trackLocation;
    if (el.dataset.trackProvider) params.provider = el.dataset.trackProvider;
    params.page = location.pathname;
    track(el.dataset.track!, params);
  });

  // menu_view fires on any /menus page
  if (location.pathname.startsWith('/menus/')) {
    track('menu_view', { menu: location.pathname.split('/')[2] || 'food' });
  }
}
