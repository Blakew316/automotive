# WPI Driveline: website

A fast, static, multi-page website for **WPI Driveline**, auto and small engine repair.
Each page is a complete, standalone HTML document with no framework and no build step, so it can be hosted anywhere (Netlify, GitHub Pages, Cloudflare Pages, any web server) or opened straight from disk.

It is published as the public site for AutoShop Pro at https://blakew316.github.io/automotive/ (the staff app is at `/automotive/app/`); see the repository README for how the two are built and deployed together.

- **Design**: light hues taken from the WPI Driveline logo: white and pale blue surfaces, navy ink for text and line art, and the logo's two-tone bar (blue | green) as the accent motif in eyebrows, underlines, progress lanes and timelines. No dark or heavy blocks; the only solid fill is the blue primary button. Apple system typography (SF Pro on Apple devices, with Inter as the fallback elsewhere).
- **Motion**: automotive-themed animations throughout: the light 3D brand card with the logo, a soft sheen and cursor tilt, a scroll-progress car under the header, a "road" process timeline the car drives along, a rolling odometer, a live "open now" status, and a custom animated line illustration on every page (spinning brake rotor, running mower, and so on). Everything respects *Reduce Motion*.
- **Navigation**: cross-document View Transitions (the header stays put while pages glide, and the active-tab pill slides between tabs), Speculation Rules prerendering on hover (Chrome/Edge) with a prefetch fallback for Safari and Firefox, a desktop mega menu, and an iOS-style bottom tab bar with a "More" sheet on phones and tablets.

## Pages

| Page | File |
| --- | --- |
| Home (landing page) | `index.html` |
| Services hub + symptom finder | `services.html` |
| Service pages (11) | `services/brakes.html`, `oil-change`, `diagnostics`, `engine-repair`, `transmission`, `heating-ac`, `tires-alignment`, `suspension-steering`, `electrical-battery`, `inspections`, `small-engine-repair` |
| About | `about.html` |
| Makes we service | `brands.html` |
| Fleet & business | `fleet.html` |
| Specials | `specials.html` |
| Car care guides (warning-light decoder, maintenance timeline, seasonal checklists) | `resources.html` |
| FAQ | `faq.html` |
| Contact | `contact.html` |
| Book a service (multi-step request form) | `appointment.html` |
| Careers | `careers.html` |
| Privacy | `privacy.html` |
| Not found | `404.html` |

## Before you launch: replace the placeholders

The shop's real details weren't available, so these are placeholders. They all live in **one file**:

1. Edit **`business.json`**: phone, email, street address, city/state/ZIP, Google Maps link, website URL, opening hours (and optionally a time zone like `America/Chicago` for the live "Open now" badge), social links.
2. Run `node scripts/sync.mjs`. Every page, the structured data (for Google), `sitemap.xml` and `robots.txt` are updated.

Also review:
- **`specials.html`**: all five coupon offers are examples (each is marked `<!-- EXAMPLE OFFER -->` in the source). Confirm or replace the amounts and terms.
- **`careers.html`**: the roles are the kinds of positions a shop like this typically hires for. Adjust to suit.
- **`privacy.html`**: a plain-language template that assumes Netlify Forms and no analytics. Have it reviewed.

### Owner confirmation checklist

The copy describes *how the shop works* rather than claiming credentials. Please confirm each of these matches reality, or edit the page:

- **Everywhere**: written estimates before work, a call before anything extra, old parts shown on request, detailed invoices, road tests when it matters.
- **Services offered**: refrigerant service for both R-134a and R-1234yf (`heating-ac`); tire sales, alignment equipment, TPMS programming (`tires-alignment`); clutches, CV axles, differential and transfer case work (`transmission`); compression and leak-down testing (`engine-repair`); battery sales (`electrical-battery`); what an oil service includes (`oil-change`).
- **Small engines**: the equipment list (including commercial zero-turns, chainsaws, snow blowers, tillers), carburetor rebuilds and blade sharpening, and the 14 small-engine brands listed (`small-engine-repair`, `brands`).
- **Makes**: the 31 vehicle makes on `brands.html`, and the "hybrids: call ahead" wording.
- **Inspections**: the inspection types offered and the green/amber/red written report (`inspections`). No state safety or emissions inspection is claimed.
- **Fleet**: that you offer fleet and landscaping-crew accounts with per-unit records (`fleet`).
- **Diagnostics**: that any diagnostic fee is explained before testing begins (`diagnostics`, `faq`).
- **Booking**: that customers can wait on site, and confirmation by call, text or email (`appointment`).

The animated "status" chips on each page (for example "Front pads: 3 mm") are illustrations, not customer data.

## Editing

- **Page content**: edit the page's HTML directly. Shared regions are marked like `<!-- @partial header --> … <!-- @end header -->`; don't edit inside those markers, because they are regenerated.
- **Header, footer, mobile tab bar, call-to-action band, icons**: edit `partials/*.html` (services list: `partials/services.json`), then run `node scripts/sync.mjs`.
- **Styles and behaviour**: `assets/css/site.css` (design tokens at the top) and `assets/js/site.js`.
- **Check your work**: `node scripts/check.mjs` validates every page (one `<h1>`, links and assets resolve, labels, ids, no leftover placeholders).
- **Preview locally**: `npm run serve`, then open http://localhost:8080.

## Forms

The appointment, contact and fleet forms send straight to the shop's **AutoShop Pro** inbox when `shopInbox` (`url` + public anon `key`) is set in `business.json`: booking requests appear in the app's Calendar with the preferred day and time of day, and contact and fleet messages in Messages. The careers form, and any form when the inbox isn't set, uses **Netlify Forms** on Netlify, or `"formEndpoint"` (e.g. Formspree) on other hosts.
If a submission can't be sent, visitors see a friendly fallback that opens a pre-filled email or offers the phone number, so a request is never lost.

`basePath` is the folder the site is served from (`/automotive/` on GitHub Pages, `/` on its own domain); the 404 page uses it for its links. `staffAppUrl` adds a *Staff sign-in* link to the footer.

## Brand assets

`assets/img/` holds the WPI Driveline logo and icons, generated by `node scripts/brand-assets.mjs` at the repository root (don't hand-edit them):

- `logo.svg`: the lockup ("WPI", the blue | green bar, "DRIVELINE"). Used on the home and About brand cards and in the footer; the header partial inlines the same artwork so it paints with the page.
- `logo-mark.svg`: just "WPI" over its bar, for tight spots.
- `logo-full.svg`: the lockup plus a "Shop Management System" tagline. That describes the staff app, so it is not used on these customer-facing pages.
- Favicons and app icons (`favicon.ico`, `favicon-32.png`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`) and the social-share image `og-image.png` (1200x630).

Colors live as tokens at the top of `assets/css/site.css`: navy `--ink` (#0F2B4C), logo blue `--blue` (#1F7AE0) and green `--green` (#2DB36A), their text-safe versions `--accent` (#1A6FD6) and `--green-ink` (#188048), the `--bar` two-tone gradient, and the light `--canvas`, `--mist-*`, `--blue-*` and `--green-*` surfaces.
