# F.Y.C. / N.Y.C. website

The website for F.Y.C. / N.Y.C., a wine bar and kitchen at 44 West 17th Street in Flatiron, NYC.

- **Stack:** Astro 7 + TypeScript, plain CSS design tokens, static HTML. Only two form endpoints run as serverless functions.
- **Design:** the v2 "Modern Gold" system from the marketing report (Fraunces + Manrope, black / gold / white).
- **Quality bar:** WCAG 2.1 AA (aiming for 2.2), Lighthouse 90+ on every page, zero axe violations. See [Audit results](#audit-results).
- **Content** lives in JSON files in `src/data/`, so hours, menus, events and prices can be changed without touching code.

> **Nothing on this site is invented.** Facts the owners haven’t confirmed show on the page as a
> visible, dashed‑underlined `[placeholder]`. Run `npm run placeholders` to list every one that’s left.
> See [Before launch](#before-launch-checklist).

---

## Contents

1. [Quick start](#quick-start)
2. [Project structure](#project-structure)
3. [Editing content](#editing-content)
4. [Photos and the hero video](#photos-and-the-hero-video)
5. [Deploying (Vercel or Netlify)](#deploying)
6. [Connecting Resy or OpenTable](#connecting-resy-or-opentable)
7. [Forms: email delivery and Turnstile](#forms-email-delivery-and-spam-protection)
8. [Join the Family: email / SMS provider](#join-the-family-email--sms-provider)
9. [Analytics (GA4)](#analytics-ga4)
10. [DNS cutover from SpotHopper](#dns-cutover-from-spothopper)
11. [Accessibility and QA](#accessibility-and-qa)
12. [Before launch checklist](#before-launch-checklist)

---

## Quick start

Requires **Node 22.12+**. Run everything from the project root (this repo, `joshpled/fyc-nyc-website`).

```bash
npm install
npm run dev            # http://localhost:4321 (forms work here too)
npm run build          # production build
npm run preview        # serve the production build locally
npm run check          # type-check
npm run placeholders   # list every unfilled fact in src/data
```

Forms post to `/api/inquiry/` and `/api/join/`. Without email keys (see [Forms](#forms-email-delivery-and-spam-protection)) they succeed locally and print the message to the terminal instead of sending it.

---

## Project structure

```
fyc-nyc-website/
├─ astro.config.mjs        Site URL, host adapter, 301 redirects, sitemap
├─ vercel.json             Security / cache headers (Vercel)
├─ netlify.toml            Build + headers (Netlify)
├─ .env.example            Every environment variable the forms use
├─ public/                 Fonts, favicons, OG image, hero video, robots.txt
├─ scripts/
│  ├─ list-placeholders.mjs   npm run placeholders
│  └─ subset-fonts.py         Rebuilds the trimmed font files (npm run fonts)
└─ src/
   ├─ data/                ← all editable content (see below)
   ├─ assets/img/          Photos (Astro turns them into AVIF/WebP at build)
   ├─ layouts/Base.astro   <head>/SEO/JSON-LD, status strip, header, footer, dock, booking drawer
   ├─ components/          Header, Footer, Dock, BookingDrawer, BookingWidget, JoinForm, Faq, …
   │  ├─ home/             Homepage sections
   │  ├─ menu/             Menu row
   │  └─ events/           Private-event inquiry form
   ├─ pages/               One file per URL (menus/[...menu].astro builds all four menus)
   │  └─ api/              inquiry.ts, join.ts (the only server code)
   ├─ server/              Form handlers: validation, Turnstile, email, subscriber adapters
   ├─ lib/                 hours engine, JSON-LD builders, events/.ics, nav
   ├─ scripts/             Small client scripts (status, dialogs, booking loader, forms, analytics)
   └─ styles/global.css    Design tokens and base styles
```

**Pages:** `/`, `/menus/` (+ `wine/`, `cocktails/`), `/reserve/`, `/private-events/`, `/happenings/`, `/join/`, `/our-story/`, `/gift-cards/`, `/catering/`, `/visit/`, `/press/`, `/accessibility/`, `/careers/`, `/tonight/` (sidewalk‑sign QR page), `/privacy/`, the three form thank‑you pages and a 404.

URLs end in a slash (`/menus/`). Every host serves that form directly, and the old slash‑less SpotHopper URLs still reach their redirects.

---

## Editing content

Edit the JSON, save, and redeploy (push to Git, or run `npm run build`). Any value set to `null` shows on the site as a `[placeholder]`. Keys starting with `_readme` are notes for editors and never show on the site.

| File | What it controls |
|---|---|
| `site.json` | Name, address, phone, emails, social links, gift-card links, booking provider, GA4 ID, Turnstile site key, SMS frequency, events reply time, hero video, amenities, brand lines |
| `hours.json` | **The only place hours live.** Status strip, quick facts, footer, `/visit/`, `/tonight/` and the Google structured data all read it |
| `menus.json` | Food courses, wine, cocktails; tags, featured dishes, pairings, Chef’s Dinner |
| `events.json` | Weekly rhythm + dated events (feeds `/happenings/`, the `.ics` calendar files and Google Event data) |
| `spaces.json` | Private event spaces from the events deck: seated, standing, seasonal buyout counts, photo, event length, deck link |
| `packages.json` | Food and bar packages from the events deck, with prices and notes |
| `faqs.json` | Private-events FAQ and Visit FAQ |
| `reviews.json` | Review quotes and the Google rating snapshot |
| `loyalty.json` | Join perks and the Cousin → Sibling → Family tiers (set `tiersEnabled: false` to hide) |
| `tonight.json` | Specials and note on the `/tonight/` QR page |
| `story.json` | Founders, sourcing, wine copy and the partner list for `/our-story/` |
| `catering.json`, `press.json`, `careers.json` | Those pages |

### Hours (`hours.json`)

Times are 24‑hour `"HH:MM"`. A close time earlier than the open time means after midnight (`16:00` → `01:00` = 4pm to 1am). Use `[]` for a closed day. For holidays, add an entry under `exceptions.dates`:

```json
"exceptions": { "_readme": "…", "dates": {
  "2026-11-26": { "note": "Thanksgiving", "bar": [{ "open": "16:00", "close": "22:00" }], "kitchen": [] }
} }
```

The “Open now · Bar until 1am” line is worked out in the visitor’s browser in New York time. Pages are static, so the server-rendered fallback never names a day: a cached page can’t show stale hours.

### Menus (`menus.json`)

Each item: `name`, `description`, `price` (number), `tags` (`vegetarian`, `gluten-free`, `shareable`), `featured`, `pairing`, `image`. Wine items can use `glass` and `bottle` instead of `price`.

- `"featured": 1` to `4` puts a dish on the homepage, with its photo, in that order. On the menu it gets a “Pairs with” line (menu pages show no photos). Use `false` for a regular item.
- Rows with `"placeholder": true` are stand-ins. Replace them with real items or delete them.
- Dietary filter buttons work without JavaScript. A tag with no dishes shows a “not tagged yet” message.

### Events (`events.json`)

```json
{ "id": "winemaker-night-nov", "draft": false, "title": "Winemaker Night",
  "date": "2026-11-06", "start": "19:00", "end": "21:00",
  "summary": "Five pours and snacks.", "price": 65, "seats": 20,
  "cta": "tickets", "ticketUrl": "https://…" }
```

- `cta: "reserve"` opens the booking drawer. `cta: "tickets"` links to `ticketUrl`.
- `draft: true` shows a “Draft” tag and keeps the event out of Google’s structured data. Set it to `false` once the details are real.
- Past events hide by themselves. Every event gets an add-to-calendar file at `/happenings/<id>.ics`.

---

## Photos and the hero video

- **Photos:** put files in `src/assets/img/`. Then:
  - **Menu items:** set `"image": "burger.jpg"` on the item. It shows on the homepage when the dish is featured; menu pages don't show photos.
  - **Event spaces:** set `"image"` in `spaces.json`.
  - **Homepage “Pick your night” cards:** edit the `cards` list at the top of `src/components/home/Bento.astro` (add `img` + `alt`).
  - **Our Story founders photo:** replace the placeholder `div` in `src/pages/our-story.astro`.

  Every photo slot without real photography shows a dark‑gold gradient. The [shot list](#photo-shot-list) says what goes where.
- **Photo library:** the old site's other food and cocktail shots are in `src/assets/img/library/` (burrata, pear salad, whipped ricotta, bruschetta, sole in parchment, smoked salmon, sandwich, whole branzino and three cocktails). Files there aren't built until you move one up into `src/assets/img/` and point an item at it.
- **Hero video:** replace both `public/video/hero-loop.mp4` (H.264) and `public/video/hero-loop.webm` (VP9). Use the bartender loop: 5–8 s, muted, each under 2 MB, about 1280×720.
  - The current files are the first 6 seconds of the house film from the old site (the bartender shaking, garnishing and pouring, then the bar room): MP4 0.96 MB, WebM 1.06 MB.
- **House film:** `public/video/fyc-film.mp4` is the full 35‑second video from the old site, with sound, re‑encoded to 1280×720 (7.8 MB). It plays on `/our-story/` with controls and only downloads when someone presses play. A “What’s in the film” text description sits under it. If the film ever includes speech, add captions (a `.vtt` track) before launch.
  - The poster stays `src/assets/img/video_poster.jpg`.
  - Example encode:
    ```bash
    ffmpeg -i loop.mov -an -vf scale=1280:-2 -c:v libx264 -crf 28 -preset slow -movflags +faststart public/video/hero-loop.mp4
    ffmpeg -i loop.mov -an -vf scale=1280:-2 -c:v libvpx-vp9 -b:v 0 -crf 40 public/video/hero-loop.webm
    ```
  - The video never loads before the poster. It doesn’t autoplay for reduced‑motion users or on data‑saver / 2G connections, and it always has a visible pause button.
- **Logos:** `logo_1.png` (white) and `logo_2.png` (gold) come from the current site. Ask the designer for SVGs and swap them in `Header.astro` / `Footer.astro`.

---

## Deploying

The site picks the right adapter from the host’s build environment (`astro.config.mjs`): Vercel → `@astrojs/vercel`, Netlify → `@astrojs/netlify`, anywhere else → `@astrojs/node`. Every page is prerendered. Only `/api/inquiry/` and `/api/join/` become functions.

### Vercel (recommended)

1. The code lives at `github.com/joshpled/fyc-nyc-website`.
2. In Vercel: **Add New → Project** and import `joshpled/fyc-nyc-website`. Leave **Root Directory** as the repo root; the framework preset auto‑detects as Astro.
3. Add the environment variables from `.env.example` (Settings → Environment Variables).
4. Deploy. Each pull request gets its own preview URL.

### Netlify

1. **Add new site → Import from Git**, pick the repo, and leave the base directory blank. `netlify.toml` sets the build command and publish dir.
2. Add the environment variables from `.env.example`.

### Environment variables

| Variable | Needed for | Notes |
|---|---|---|
| `RESEND_API_KEY` | Inquiry + catering emails, signup fallback | From resend.com. Verify the `thefycnyc.com` domain there first |
| `FORMS_FROM_EMAIL` | Sender | e.g. `F.Y.C. / N.Y.C. Website <website@thefycnyc.com>` |
| `EVENTS_TO_EMAIL` | Where inquiries go | Defaults to `events@thefycnyc.com`. Comma‑separate several addresses |
| `JOIN_TO_EMAIL` | Signup fallback inbox | Defaults to `info@thefycnyc.com` |
| `TURNSTILE_SECRET_KEY` | Spam check | The public site key goes in `site.json → forms.turnstileSiteKey` |
| `SUBSCRIBER_PROVIDER` | Join form | `klaviyo`, `mailchimp` or `email` (default) |
| `KLAVIYO_API_KEY`, `KLAVIYO_LIST_ID` | Klaviyo | Private API key |
| `MAILCHIMP_API_KEY`, `MAILCHIMP_LIST_ID` | Mailchimp | Key ends in `-usX` |

In production, a missing `RESEND_API_KEY` makes the form show an error with the email address. The site never silently drops a guest’s inquiry.

### Redirects from the old site

These are set in `astro.config.mjs → redirects`, and the adapter turns them into real 301s on either host.

| Old URL | New URL |
|---|---|
| `/food-menu` | `/menus/` |
| `/drink-menu` | `/menus/cocktails/` |
| `/wine` | `/menus/wine/` |
| `/reservations` | `/reserve/` |
| `/party` | `/private-events/` |
| `/events` | `/happenings/` |
| `/people-we-f-with` | `/our-story/#partners` |
| `/catering` | same path (no redirect needed) |

After launch, check each old URL in a browser, and check Google Search Console for any other old URLs that get traffic.

---

## Connecting Resy or OpenTable

Pick one (open question **Q1**), then edit `site.json → booking`:

```json
"booking": { "provider": "resy", "venueId": "12345", "resyApiKey": "…" }
```

- **Resy:** ask Resy for the venue ID and widget API key. The button opens Resy’s booking modal.
- **OpenTable:** `"provider": "opentable"` and the restaurant ID (`rid`) as `venueId`. The standard reservation widget loads in the drawer.

The provider’s script only loads when someone opens the booking drawer or visits `/reserve/`, so it never slows page loads. Until it’s set, the drawer shows “Book on Resy” and “Book on OpenTable” buttons, so booking works from day one.

Turn on the platform’s confirmation and reminder texts (they cut no‑shows), and test the widget with a keyboard only before launch.

---

## Forms: email delivery and spam protection

- **Private events** (`/private-events/`, 2 steps) and **catering** (`/catering/`) go to `/api/inquiry/`, then one email to `EVENTS_TO_EMAIL`. The guest’s address is set as reply‑to, so hitting Reply answers them.
- **Spam:**
  - **Hidden honeypot field:** always on.
  - **Cloudflare Turnstile:** create a widget at dash.cloudflare.com → Turnstile for `thefycnyc.com`. Put the site key in `site.json` and the secret in `TURNSTILE_SECRET_KEY`. Its script loads only when a form is about to be used.
- **Without JavaScript,** every form still submits and lands on a thank‑you page.
- **Swapping email services:** change `sendEmail()` in `src/server/http.ts` to use Postmark, SendGrid, etc.
- **Optional:** forward inquiries into a CRM such as Tripleseat by adding a call in `src/server/inquiry.ts`.

Show the real reply window by setting `site.json → forms.eventsReplyWindow` (e.g. `"2 hours"`). The report found that replies within an hour convert about 3× better.

---

## Join the Family: email / SMS provider

Open question **Q7**. Set `SUBSCRIBER_PROVIDER`:

| Provider | How |
|---|---|
| `klaviyo` | Subscribes the email (and SMS, only with consent) to `KLAVIYO_LIST_ID`, and stores the birthday as `birthday_mmdd` |
| `mailchimp` | Adds or updates the member with `BIRTHDAY` and `PHONE` merge fields. Create those fields in the audience first |
| `email` (default) | Emails each signup to `JOIN_TO_EMAIL` for manual import, e.g. into **Toast Marketing**, which has no public signup API |

> The Klaviyo and Mailchimp adapters (`src/server/subscribers.ts`) follow those services’ documented APIs but haven’t been run against live accounts. Test one signup with real keys before launch.

**SMS compliance:**
- Texts need a separate, unchecked consent box. The form refuses a mobile number without it.
- The consent text shows frequency, “Msg & data rates may apply” and “Reply STOP”, and links `/privacy/`.
- Fill in `site.json → forms.smsFrequency`. The report suggests 2–4 a month.

---

## Analytics (GA4)

Put the Measurement ID in `site.json → analytics.ga4Id` (`"G-XXXXXXX"`). Leave it empty and no tracking code loads.

| Event | Fires when |
|---|---|
| `reserve_click` | Any Reserve button (with `location`) |
| `booking_drawer_open` | Booking drawer opens |
| `booking_start` | Resy / OpenTable fallback button |
| `call_click` / `directions_click` / `email_click` | Phone, Google Maps and email links |
| `menu_view` | Any menu page (with `menu`) |
| `event_inquiry_start` / `event_inquiry_submit` | Inquire buttons / private event form sent |
| `catering_inquiry_submit` | Catering form sent |
| `join_submit` | Join form sent |
| `gift_card_click` / `gift_card_balance` | Toast links |
| `events_deck_download` | Events deck PDF links on `/private-events/` |
| `add_to_calendar` / `ticket_click` | Happenings buttons |

Mark `reserve_click`, `event_inquiry_submit` and `join_submit` as key events in GA4.

**UTM parameters** on the landing URL are kept for the visit and added to outbound Resy, OpenTable and Toast links, so attribution survives the hand‑off. Tag Instagram, Google Business Profile and email links with UTMs.

---

## DNS cutover from SpotHopper

Do this on a quiet weekday morning. Open question **Q6** (who controls the domain) must be answered first.

1. **Find the registrar** for `thefycnyc.com` (WHOIS lookup) and make sure the owners hold the login, not SpotHopper.
2. **Read the SpotHopper contract** for anything you’ll lose: social posting, email marketing, the current events form. Line up replacements.
3. **Export what you need:** email list, form submissions, photos.
4. **Keep email working.** Note the current **MX, SPF, DKIM and DMARC** records and don’t change them. Only the website records move.
5. **Deploy** to Vercel or Netlify and check the preview URL end to end: booking, forms, every redirect above.
6. **Add the domain** in Vercel / Netlify (both `thefycnyc.com` and `www.thefycnyc.com`, with www redirecting to the bare domain). Then update DNS at the registrar as the host instructs:
   - **Vercel:** an `A` record for `@` and a `CNAME` for `www`.
   - **Netlify:** its load‑balancer `A` record and a `CNAME`.
7. **Lower the TTL** to 300 seconds a day before the switch, then raise it again after.
8. **After the switch:**
   - Confirm HTTPS is working.
   - Submit `https://thefycnyc.com/sitemap-index.xml` in Google Search Console.
   - Re‑test the old URLs.
   - Update the website link in Google Business Profile, Resy, OpenTable, Yelp and Instagram.
9. **Cancel SpotHopper** only after a week of clean traffic.

---

## Accessibility and QA

Built for WCAG 2.1 AA:

- One H1 per page, landmarks, a skip link, `lang="en"` and visible focus rings.
- Modal dialogs trap focus and close with Esc.
- Forms have labels and inline errors.
- Menus are real text, and there’s a pause button on the video.
- Reduced‑motion is respected, text contrast is 4.5:1 or better, and there are no overlays or pop‑ups.
- The statement lives at `/accessibility/` and is linked from the footer.

### Audit results

Run October 13, 2026 against the production build, served with compression:
- Lighthouse 12, mobile (simulated slow 4G) and desktop.
- axe‑core 4 (WCAG 2.0/2.1/2.2 A + AA and best practices) at 390 px and 1440 px.

**axe: 0 violations on all 22 pages at both sizes (44 runs).**

| Page | Mobile P / A / BP / SEO | Mobile LCP | Mobile CLS | Desktop P / A / BP / SEO |
|---|---|---|---|---|
| `/` | 97 / 100 / 100 / 100 | 2.4 s | 0.002 | 100 / 100 / 100 / 100 |
| `/menus/` | 99 / 100 / 100 / 100 | 1.8 s | 0 | 100 / 100 / 100 / 100 |
| `/menus/wine/` | 99 / 100 / 100 / 100 | 1.8 s | 0 | 100 / 100 / 100 / 100 |
| `/menus/cocktails/` | 99 / 100 / 100 / 100 | 1.8 s | 0 | 100 / 100 / 100 / 100 |
| `/menus/brunch/` | 99 / 100 / 100 / 100 | 1.9 s | 0 | 100 / 100 / 100 / 100 |
| `/reserve/` | 99 / 100 / 100 / 100 | 2.0 s | 0 | 100 / 100 / 100 / 100 |
| `/private-events/` | 99 / 100 / 100 / 100 | 2.1 s | 0 | 100 / 100 / 100 / 100 |
| `/happenings/` | 99 / 100 / 100 / 100 | 1.8 s | 0 | 100 / 100 / 100 / 100 |
| `/join/` | 99 / 100 / 100 / 100 | 1.9 s | 0 | 100 / 100 / 100 / 100 |
| `/our-story/` | 99 / 100 / 100 / 100 | 2.0 s | 0.001 | 100 / 100 / 100 / 100 |
| `/gift-cards/` | 99 / 100 / 100 / 100 | 1.8 s | 0 | 100 / 100 / 100 / 100 |
| `/catering/` | 100 / 100 / 100 / 100 | 1.6 s | 0 | 100 / 100 / 100 / 100 |
| `/visit/` | 99 / 100 / 100 / 100 | 1.8 s | 0 | 100 / 100 / 100 / 100 |
| `/press/` | 99 / 100 / 100 / 100 | 1.8 s | 0 | 100 / 100 / 100 / 100 |
| `/accessibility/` | 99 / 100 / 100 / 100 | 1.8 s | 0 | 100 / 100 / 100 / 100 |
| `/careers/` | 99 / 100 / 100 / 100 | 1.9 s | 0 | 100 / 100 / 100 / 100 |
| `/tonight/` | 99 / 100 / 100 / 100 | 1.9 s | 0.022 | 100 / 100 / 100 / 100 |
| `/privacy/` | 99 / 100 / 100 / 100 | 1.8 s | 0 | 100 / 100 / 100 / 100 |
| `/private-events/thanks/` | 99 / 100 / 100 / 69* | 1.9 s | 0 | 100 / 100 / 100 / 69* |
| `/join/thanks/` | 99 / 100 / 100 / 69* | 1.8 s | 0 | 100 / 100 / 100 / 69* |
| `/catering/thanks/` | 100 / 100 / 100 / 69* | 1.5 s | 0 | 100 / 100 / 100 / 69* |
| `/404.html` | 99 / 100 / 100 / 69* | 2.0 s | 0 | 100 / 100 / 100 / 69* |

`/menus/brunch/` was removed on Oct 15, 2026 after the owners confirmed there’s no brunch service.

\* Thank‑you pages and the 404 are deliberately `noindex`. Lighthouse marks that down under SEO, but it’s correct.

Also checked:
- Keyboard focus is trapped in the drawer and menu, and returns to the button that opened them.
- Dietary filters and both form steps work with JavaScript off.
- Form handlers were tested against valid, missing, invalid and spam inputs.
- No broken internal links or redirect hops (crawled).
- Opening hours were tested across late-night closes (e.g. still open at 12:30am Saturday on Friday’s hours).

### Re‑running the checks

```bash
npm run build && npx serve dist/client -l 4400   # serve with compression
npx lighthouse http://localhost:4400/ --form-factor=mobile --view
npx @axe-core/cli http://localhost:4400/menus/
```

Before launch, also test by hand with **VoiceOver (iPhone)** and **TalkBack (Android)**:
- the homepage, a menu and the booking drawer
- the private‑events form and the Join form

Then do it again with the live Resy / OpenTable widget. Keep notes of each audit (the report recommends records of audits and fixes).

---

## Before launch checklist

`npm run placeholders` prints the live list from the data files: 133 items at hand‑off, 94 after the owners' first answers on Oct 15, 2026, and 68 once the events deck filled the private‑events page. Some of what's left is deliberately deferred (menus, weekly programming, Our Story); those sections fill in over time. Grouped:

### Facts to fill in

- [x] **Hours:** confirmed by the owners (Q9). There's no brunch service (Q10), so `/menus/brunch/`, the brunch hours and the homepage brunch card are gone.
- [ ] **Listings:** make Google Business Profile, Apple Maps, Yelp, Resy, OpenTable, Instagram and Birdeye match the website hours the same day. Google currently shows Tue 4–11pm and Sun 4–9pm.
- [x] **Booking platform:** Resy is primary (Q1).
- [x] **Resy widget:** venue ID 78264 and the widget key are in `site.json → booking`. Test a booking from the drawer and `/reserve/` with a keyboard and a phone.
- [x] **Events deck:** `public/docs/fyc-private-dining-and-events.pdf` (compressed from 3.7 MB to 1.4 MB) is linked twice on `/private-events/`. Its spaces, capacities, food packages and bar packages now fill the page (Q2, Q4). To update the deck, replace that file and edit `spaces.json` / `packages.json` to match.
- [ ] **Deck inquiry link:** page 1 of the deck points “Group event inquiry” at the SpotHopper form (`tmt.spotapps.co`). Re-export it pointing at `https://thefycnyc.com/private-events/#inquire` before SpotHopper is cancelled.
- [x] **Private‑events FAQ:** deposit and cancellation, service charge (new question), cake fee, dietary needs, music/AV/decor, invoicing.
- [x] **Events reply window:** 2 hours.
- [x] **Holiday events:** Halloween (Sat Oct 31, parade night) and Thanksgiving ($89 prix fixe, Thu Nov 26) are live on `/happenings/` with their flyers. NYE is not scheduled.
- [ ] **Event times:** add start / end times for Halloween and Thanksgiving in `events.json` when known (the calendar files are all-day until then).
- [ ] **Weekly programming** (Q5): deferred, the owners will add it over time. The “Every week” strip on `/happenings/` stays hidden until a day has a title.
- [ ] **Menus:** deferred because the menu changes often. Still needed:
  - Dish descriptions, the remaining items, wine and cocktail lists, “Pairs with” picks.
  - Gluten‑free and shareable tags.
  - Chef’s Dinner format and price.
  - Confirm which course each dish is in, plus the “Something sweet” section and the “bigger plates” / “mains” subtitles (added from the mockup).
- [ ] **Reviews:** paste the exact wording of the three Google reviews and each star rating, then set `paraphrased: false`.
  - Giulia A.’s quote names meatballs, branzino and steak tartare. Confirm they’re still on the menu, or choose another quote.
  - Refresh the 4.7 ★ / 182 snapshot.
- [ ] **Email / SMS tool** (Q7): not decided yet, so signups keep going to `JOIN_TO_EMAIL`.
- [x] **SMS frequency:** up to 4 a month.
- [x] **Loyalty** (Q8): simple birthday and email program first. Tiers are hidden (`tiersEnabled: false`).
- [x] **Join perks:** all four confirmed.
- [ ] **Our Story:** founder names and bios, sourcing, wine copy, the “People we f*** with” partner list. Owners: TBD.
- [x] **Press** (Q11): none yet. The page shows an empty‑state line; the media kit line appears once `mediaKitUrl` is set.
- [x] **Catering** (Q12): drop‑off and on‑site. Minimums, lead time and delivery area are handled per inquiry.
- [x] **Careers:** applications go to info@thefycnyc.com. No open roles right now.
- [x] **`/tonight/`:** Josh posts daily specials. An empty list hides the section.
- [x] **Accessibility statement:** “We aim to respond within an hour.”

### Setup

- [ ] Domain / DNS: Josh holds the registrar login (Q6). Still need the SpotHopper contract. See [DNS cutover](#dns-cutover-from-spothopper).
- [ ] Resend account + verified domain; set `RESEND_API_KEY`, `FORMS_FROM_EMAIL`.
- [ ] Create the `events@thefycnyc.com` inbox, if it doesn’t exist.
- [ ] Turnstile site key (`site.json`) + secret (env).
- [ ] GA4 Measurement ID; mark the key events.
- [ ] **Privacy policy:** `/privacy/` is a template. Have a lawyer review it and set the effective date. It’s required for the SMS program.
- [ ] **Visit page:** check the subway list on `/visit/` (lines and station names).
- [ ] **Facebook link:** check `site.json → social.facebook` opens the right page.
- [ ] **Logos:** get SVG versions from the designer.
- [ ] **QR code:** print one for the sidewalk sign pointing at `https://thefycnyc.com/tonight/?utm_source=sidewalk&utm_medium=qr`.
- [ ] **Final check:** run `npm run placeholders` until it’s empty (or everything left is intentional), then do the VoiceOver / TalkBack pass.

### Open questions from the report (Section 14)

| # | Question | Status | Where it goes |
|---|---|---|---|
| Q1 | Resy or OpenTable as primary? | **Resy** | `site.json → booking` |
| Q2 | Capacities: semi‑private section, back patio, full buyout | **From the events deck**: dining room, rear patio, both, full buyout (seasonal) | `spaces.json` |
| Q3 | Minimum spends, deposit %, cancellation window, service charge | Deposit, cancellation and service charge answered; minimums “on request” per the deck | `spaces.json`, `faqs.json` |
| Q4 | Package names, contents, price per person | **From the events deck**: 5 food formats, 3 bar packages | `packages.json` |
| Q5 | Real recurring programming (happy hour, music, wine classes) | Deferred | `events.json → weekly` |
| Q6 | Who controls domain/DNS; what the SpotHopper contract covers | Josh holds the domain; contract open | [DNS cutover](#dns-cutover-from-spothopper) |
| Q7 | Email/SMS tool | Not decided | `SUBSCRIBER_PROVIDER` env |
| Q8 | Loyalty tiers (Toast Loyalty) or simple birthday/email first? | **Birthday/email first** | `loyalty.json` |
| Q9 | Master hours | **Confirmed** | `hours.json` |
| Q10 | Weekend brunch service and menu | **No brunch** | (removed) |
| Q11 | Press and awards to feature | None yet | `press.json` |
| Q12 | Catering scope | **Drop‑off and on‑site** | `catering.json` |

### Photo shot list

Every gold‑gradient box on the site is waiting for one of these.

| # | Shot | Used on |
|---|---|---|
| 1 | Bartender pour loop, 5–8 s, plus a still frame | Home hero (`public/video/`) |
| 2 | Wide shot of the dining room, lights low, people present | Our Story (“Who we are”), Pick your night |
| 3 | Back patio at dusk, set and occupied | Pick your night (“The Back Patio”), Rear patio space card |
| 4 | Glass pour at the bar, close‑up | Pick your night (“Wines Worth Pouring”) |
| 5 | Signature dishes overhead and at 45°: burger, meatballs, branzino, steak tartare, scallop cru‑viche, brownie | Homepage dishes, featured menu items |
| 6 | Long table mid‑toast (real event, with permission) | Private Events hero, homepage events teaser |
| 7 | Each event space set for a party | Private Events space cards |
| 8 | The five founders together, candid | Our Story |
| 9 | The bar late at night, busy | Pick your night (“Late Nights”) |
| 10 | Exterior and sidewalk sign at night | Visit page, Google Business Profile |
| 11 | Vertical 9:16 versions of 1, 3, 5 and 6 | Instagram / TikTok |

**What's on the site now (Oct 15, 2026):** the old site's photos and stills from its house film fill most slots:

| Slot | File | Source |
|---|---|---|
| Home hero | `video_poster.jpg` + `hero-loop.*` | Old site photo + film |
| Pick your night: The Family Table | `about.jpg` | Old site photo |
| Pick your night: Wines Worth Pouring | `wine-bottle-brick.jpg` | Old site photo |
| Pick your night: The Back Patio; Rear patio space card | `video-patio.jpg` | Film still |
| Dining room space card | `video-dining-room.jpg` | Film still |
| Dining room + rear patio space card | `video-table-friends.jpg` | Film still |
| Pick your night: Late Nights | `video-late-night.jpg` | Film still |
| Pick your night: Throw a Party | `video-table-friends.jpg` | Film still |
| Homepage events teaser | `video-toast.jpg` | Film still |
| Private Events hero | `long-table.jpg` | Old site photo |
| Full buyout space card | `video-bar-room.jpg` | Film still |
| Our Story, Who we are | `dining-room-candles.jpg` | Old site photo |
| Our Story film poster | `video-sign.jpg` | Film still |
| Burger, scallop cru‑viche, brownie, mushroom tacos | `dish-*.jpg` | Old site photos |

Still gold: Stuffed ’Shrooms. Film stills are 1280×720, so a proper shoot (shots 2–7 and 10) would still sharpen those cards.
