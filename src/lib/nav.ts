/** Site navigation. Desktop header shows `left` + logo + `right` + Reserve. */
import site from '../data/site.json';
import { cleanPath } from './url';

export const navLeft = [
  { label: 'Menus', href: '/menus/' },
  { label: 'Wine', href: '/menus/wine/' },
  { label: 'Happenings', href: '/happenings/' },
];
export const navRight = [
  { label: 'Private Events', href: '/private-events/' },
  { label: 'Join the Family', href: '/join/' },
];

/** Mobile menu: primary links large, secondary small */
export const mobilePrimary = [...navLeft, ...navRight, { label: 'Visit', href: '/visit/' }];
export const mobileSecondary = [
  { label: 'Our story', href: '/our-story/' },
  { label: 'Gift cards', href: '/gift-cards/' },
  { label: 'Catering', href: '/catering/' },
  { label: 'Press', href: '/press/' },
  { label: 'Careers', href: '/careers/' },
];

export const footerVisit = [
  { label: 'Reservations', href: '/reserve/' },
  { label: 'Menus', href: '/menus/' },
  { label: 'Wine list', href: '/menus/wine/' },
  { label: 'Happenings', href: '/happenings/' },
  { label: 'Private events', href: '/private-events/' },
  { label: 'Catering', href: '/catering/' },
  { label: 'Gift cards', href: '/gift-cards/' },
  { label: 'Hours & directions', href: '/visit/' },
];
export const footerFamily = [
  { label: 'Instagram', href: site.social.instagram, external: true },
  { label: 'Facebook', href: site.social.facebook, external: true },
  { label: 'Join the list', href: '/join/' },
  { label: 'Our story', href: '/our-story/' },
  { label: 'Press', href: '/press/' },
  { label: 'Careers', href: '/careers/' },
  { label: 'Accessibility statement', href: '/accessibility/' },
  { label: 'Privacy', href: '/privacy/' },
];

/** True when `href` is the current page or a parent section of it. */
export function isCurrent(href: string, path: string): boolean {
  const p = cleanPath(path);
  const h = cleanPath(href);
  if (h === '/') return p === '/';
  // "Menus" covers food, cocktails and brunch; "Wine" has its own nav item
  if (h === '/menus/') return p === '/menus/' || p === '/menus/cocktails/' || p === '/menus/brunch/';
  return p === h || p.startsWith(h);
}
