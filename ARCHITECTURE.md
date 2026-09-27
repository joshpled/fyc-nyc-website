# Website preview architecture

The site is intentionally small: four HTML pages, one shared stylesheet, one shared JavaScript file, and local image assets. It needs no framework or backend because its current job is to show the design and route visitors to the restaurant's existing booking and inquiry services.

## How it fits together

- Each HTML file owns its page content and metadata. Static pages remain readable and easy to edit.
- `styles.css` holds the visual system, page layouts, and responsive rules.
- `site.js` inserts the shared header and footer and controls the mobile navigation. It contains no external data or network calls.
- `assets/` contains selected FYC photos in the local preview. Git ignores the supplied photos. A committed SVG gives public checkouts a visible fallback when a photo file is absent.

The primary conversion path is a reservation link to Resy. The group page links to the existing private-party inquiry form. Other outbound links lead to the current restaurant menus, directions, gift cards, email, and Instagram. These services remain the source of truth for transactions and changing information.

## Why this structure

Plain HTML, CSS, and JavaScript make this concept quick to review and cheap to host. The main tradeoff is that changes to menu highlights or opening hours must be updated by hand. Keeping the full menus external reduces that maintenance burden until the business decides how it wants to maintain live content.

All pages carry `noindex,nofollow` while this is a preview. Any future public launch needs an explicit content review and search-indexing decision.
