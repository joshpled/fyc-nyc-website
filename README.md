# F.Y.C. / N.Y.C. website preview

A four-page, static concept for the restaurant website. This is a review preview, not the live `thefycnyc.com` site.

## Pages

- `index.html` — restaurant story, food and drink, and reservation calls to action
- `menu.html` — full food, cocktail, and wine snapshot with listed prices and links to the live menus
- `gather.html` — group dinners, celebrations, and catering inquiries
- `visit.html` — address, hours, directions, and contact

## Run locally

Open `index.html` in a browser, or serve this folder with any static file server. There is no build step, package manager, or environment variable. The supplied restaurant photos are kept outside the public GitHub repository. Without them, the pages show a branded placeholder image. The local FYC folder has the complete photo preview.

The shared header and footer use the transparent FYC logo variant chosen for better readability at small sizes. Its strokes are subtly heavier than the original; the untouched original remains in the parent FYC folder. The accent color is the supplied Golden Wheat sample (`#DEA33E`); text on light sections uses a darker shade for legibility. The chosen logo is committed so it appears in public checkouts, while the restaurant photos remain local.

## Content and operating links

The local preview uses photos supplied in the FYC folder. Those photos are excluded from GitHub. Hours, address, and contact details were checked against [the restaurant site](https://thefycnyc.com/) on September 27, 2026. The menu page contains a September 30, 2026 snapshot of every item and listed price on the [live food menu](https://thefycnyc.com/food-menu), [live cocktail menu](https://thefycnyc.com/drink-menu), and [wine page](https://thefycnyc.com/wine). Prices and wine availability can change; the menu page links back to each source. See [menu snapshot notes](docs/menu-snapshot.md) before refreshing it.

Reservation buttons open the restaurant's existing Resy listing. Group inquiries open its existing event form. Gift cards open its existing Toast page. Catering uses the restaurant's published email address. This preview does not collect personal information or submit forms itself.

## Before replacing the live site

Confirm current menu, hours, links, photo rights, and final copy with the business. Remove `noindex,nofollow` only when the replacement is approved and ready for search indexing. Connect the approved domain and verify booking and inquiry flows in production.
