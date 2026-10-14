/**
 * URL helpers. The site uses trailing-slash URLs everywhere ("/menus/"), which is
 * what every static host serves without a redirect (trailingSlash: 'always').
 */

/** "/menus/index.html", "/menus.html", "/menus" → "/menus/" ; "/" stays "/" */
export function cleanPath(pathname: string): string {
  const p = pathname.replace(/index\.html$/, '').replace(/\.html$/, '').replace(/\/+$/, '');
  return p ? `${p}/` : '/';
}
