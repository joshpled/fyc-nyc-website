/**
 * Site-wide client script (kept small on purpose).
 * - Live open/closed status from hours.json (New York time)
 * - Mobile menu + booking drawer (<dialog>)
 * - Lazy third-party booking widget
 * - Analytics events + UTM preservation
 */
import { getStatus, fmtPeriods } from '../lib/hours';
import { loadBookingWidget } from './booking';
import { initAnalytics, track } from './analytics';

function initStatus() {
  const s = getStatus();
  document.querySelectorAll<HTMLElement>('.status').forEach((el) => {
    el.dataset.state = s.open ? 'open' : 'closed';
  });
  document.querySelectorAll<HTMLElement>('[data-status="short"]').forEach((el) => (el.textContent = s.short));
  document.querySelectorAll<HTMLElement>('[data-status="long"]').forEach((el) => (el.textContent = s.long));
  document.querySelectorAll<HTMLElement>('[data-status="kitchen"]').forEach((el) => (el.textContent = s.kitchen));
  // "Tonight" quick facts on the homepage and /tonight
  document.querySelectorAll<HTMLElement>('[data-today="bar"]').forEach((el) => {
    el.textContent = s.today.bar.length ? `Bar ${fmtPeriods(s.today.bar, ' – ')}` : 'Bar closed today';
  });
  document.querySelectorAll<HTMLElement>('[data-today="kitchen"]').forEach((el) => {
    el.textContent = s.today.kitchen.length ? fmtPeriods(s.today.kitchen, ' – ') : 'Kitchen closed today';
  });
}

/** Where focus returns when each dialog closes */
const returnFocus = new WeakMap<HTMLDialogElement, HTMLElement>();

function openDialog(id: string, trigger?: HTMLElement | null) {
  const dlg = document.getElementById(id) as HTMLDialogElement | null;
  if (!dlg || dlg.open) return;
  let back = trigger ?? (document.activeElement as HTMLElement);
  // Only one modal at a time. If we're swapping from another dialog, return
  // focus to whatever opened that one (its links disappear when it closes).
  document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach((d) => {
    if (back && d.contains(back)) back = returnFocus.get(d) ?? back;
    d.close();
  });
  if (back) returnFocus.set(dlg, back);
  dlg.showModal();
  document.documentElement.classList.add('modal-open');
  if (id === 'mobile-nav') {
    document.querySelectorAll('[aria-controls="mobile-nav"]').forEach((b) => b.setAttribute('aria-expanded', 'true'));
  }
}

function initDialogs() {
  document.querySelectorAll<HTMLDialogElement>('dialog').forEach((dlg) => {
    dlg.addEventListener('close', () => {
      if (dlg.id === 'mobile-nav') {
        document.querySelectorAll('[aria-controls="mobile-nav"]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
      }
      if (document.querySelector('dialog[open]')) return; // swapped to another dialog
      document.documentElement.classList.remove('modal-open');
      const back = returnFocus.get(dlg);
      if (back && back.isConnected && back.offsetParent !== null) back.focus();
    });
    // Click on the backdrop closes
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg) dlg.close();
    });
    // Strict focus trap: Tab / Shift+Tab cycle inside the open dialog
    dlg.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const focusables = [...dlg.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select, textarea, iframe, [tabindex]:not([tabindex="-1"])',
      )].filter((el) => el.offsetParent !== null || el.getClientRects().length);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
  });

  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    const opener = target.closest<HTMLElement>('[data-open-dialog]');
    if (opener) {
      e.preventDefault();
      openDialog(opener.dataset.openDialog!, opener);
      return;
    }

    const closer = target.closest<HTMLElement>('[data-close-dialog]');
    if (closer) {
      closer.closest('dialog')?.close();
      return;
    }

    // Reserve links open the drawer (except on /reserve itself, and modified clicks)
    const booking = target.closest<HTMLAnchorElement>('a[data-booking]');
    if (booking && !(e as MouseEvent).metaKey && !(e as MouseEvent).ctrlKey && !(e as MouseEvent).shiftKey) {
      if (/^\/reserve\/?$/.test(location.pathname)) return;
      const drawer = document.getElementById('booking-drawer') as HTMLDialogElement | null;
      if (!drawer || typeof drawer.showModal !== 'function') return; // old browser: follow the link
      e.preventDefault();
      // Mobile menu link: close the menu first, then open the drawer
      openDialog('booking-drawer', booking);
      track('booking_drawer_open', { location: booking.dataset.trackLocation ?? '' });
      const widget = drawer.querySelector<HTMLElement>('[data-booking-widget]');
      if (widget) loadBookingWidget(widget);
      return;
    }

    // In-page links inside a dialog (e.g. mobile menu) close it
    const inDialogLink = target.closest<HTMLAnchorElement>('dialog a[href]');
    if (inDialogLink) inDialogLink.closest('dialog')?.close();
  });

  // /reserve loads the widget immediately
  document.querySelectorAll<HTMLElement>('[data-booking-widget][data-load="eager"]').forEach(loadBookingWidget);
}

function initReveal() {
  const els = document.querySelectorAll<HTMLElement>('.reveal');
  if (!els.length) return;
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    els.forEach((el) => el.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (en.isIntersecting) {
          en.target.classList.add('is-in');
          io.unobserve(en.target);
        }
      }
    },
    { rootMargin: '0px 0px -8% 0px' },
  );
  els.forEach((el) => io.observe(el));
}

export function initSite() {
  initStatus();
  initDialogs();
  initAnalytics();
  initReveal();
}
