/**
 * Loads the reservation provider's official widget on demand.
 * Configure in src/data/site.json > booking (provider + venueId).
 *
 * Resy: https://widgets.resy.com  (needs venueId + API key from Resy)
 * OpenTable: reservation widget loader (needs the restaurant ID, "rid")
 */
import { appendUtm } from './analytics';

const loaded = new WeakSet<HTMLElement>();

function injectScript(src: string, onload?: () => void, parent: HTMLElement = document.body) {
  const s = document.createElement('script');
  s.src = src;
  s.async = true;
  if (onload) s.onload = onload;
  parent.appendChild(s);
  return s;
}

export function loadBookingWidget(el: HTMLElement) {
  if (loaded.has(el)) return;
  const provider = el.dataset.provider;
  const venueId = el.dataset.venueId;
  const mount = el.querySelector<HTMLElement>('[data-booking-mount]');
  if (!provider || !venueId || !mount) return; // fallback links are already rendered
  loaded.add(el);

  if (provider === 'opentable') {
    // OpenTable injects its iframe next to the loader script
    mount.innerHTML = '';
    const params = new URLSearchParams({
      rid: venueId, type: 'standard', theme: 'wide', color: '1', dark: 'true',
      iframe: 'true', domain: 'com', lang: 'en-US', newtab: 'false', ot_source: 'Restaurant website',
    });
    injectScript(`https://www.opentable.com/widget/reservation/loader?${params}`, undefined, mount);
    return;
  }

  if (provider === 'resy') {
    const apiKey = el.dataset.resyKey ?? '';
    mount.innerHTML = '';
    const btn = document.createElement('a');
    btn.id = `resy-button-${venueId}`;
    btn.href = appendUtm(`https://resy.com/cities/new-york-ny/venues/fyc-nyc`);
    btn.className = 'btn btn--primary btn--block';
    btn.textContent = 'See tables on Resy';
    mount.appendChild(btn);
    injectScript('https://widgets.resy.com/embed.js', () => {
      const rw = (window as any).resyWidget;
      if (rw?.addButton) rw.addButton(btn, { venueId: Number(venueId), apiKey, replace: true });
    });
  }
}
