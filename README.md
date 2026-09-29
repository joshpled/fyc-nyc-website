# F.Y.C. / N.Y.C. website preview

A four-page, static concept for the restaurant website. This is a review preview, not the live `thefycnyc.com` site.

## Pages

- `index.html` — restaurant story, food and drink, and reservation calls to action
- `menu.html` — selected menu highlights with links to current full menus
- `gather.html` — group dinners, celebrations, and catering inquiries
- `visit.html` — address, hours, directions, and contact

## Run locally

Open `index.html` in a browser, or serve this folder with any static file server. There is no build step, package manager, or environment variable. The supplied restaurant photos are kept outside the public GitHub repository. Without them, the pages show a branded placeholder image. The local FYC folder has the complete photo preview.

The site uses the restaurant's approved transparent logo in the shared header and footer. The accent color is the supplied Golden Wheat sample (`#DEA33E`); text on light sections uses a darker shade for legibility. The logo is committed so it appears in public checkouts, while the restaurant photos remain local.

## Content and operating links

The local preview uses photos supplied in the FYC folder. Those photos are excluded from GitHub. Menu highlights, hours, address, and contact details were checked against [the current restaurant site](https://thefycnyc.com/) on September 27, 2026. The food and cocktail menus can change, so this preview links to the [live food menu](https://thefycnyc.com/food-menu), [live cocktail menu](https://thefycnyc.com/drink-menu), and [wine page](https://thefycnyc.com/wine). It deliberately omits static prices.

Reservation buttons open the restaurant's existing Resy listing. Group inquiries open its existing event form. Gift cards open its existing Toast page. Catering uses the restaurant's published email address. This preview does not collect personal information or submit forms itself.

## Before replacing the live site

Confirm current menu, hours, links, photo rights, and final copy with the business. Remove `noindex,nofollow` only when the replacement is approved and ready for search indexing. Connect the approved domain and verify booking and inquiry flows in production.
