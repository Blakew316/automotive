# WPI Driveline Shop Management System: marketing website

The static marketing website for **WPI Driveline Shop Management System**, shop management software for independent auto repair shops. Each page is a complete, standalone HTML document with no framework and no build step. Shared regions (head, header, mega menu, tab bar, More sheet, CTA band, footer, structured data, feature lists) are regenerated in place by `scripts/sync.mjs` from `business.json` and `partials/`.

It is published at https://blakew316.github.io/automotive/ next to the staff app at `/automotive/app/`; see the repository README for how the two are built and deployed together (`scripts/pages.mjs`, `scripts/netlify.mjs`).

- **Design**: light hues only. Canvas `#F5F9FE`, white paper, pale blue and green washes, navy `#0F2B4C` ink. Blue `#1F7AE0` and green `#2DB36A` are for bars, dots, fills and strokes, never text; status text uses `--accent` (blue) and `--green-ink` (green). The blue|green two-tone bar is the signature line. No dark blocks; mock device frames are light.
- **Brand**: the full name *WPI Driveline Shop Management System* goes in every `<title>`, the meta description lead, `og:site_name`, `application-name`, the JSON-LD, the header home link's accessible name and body copy. *WPI Driveline* alone appears only in tight spots (the © line, short labels). The header, footer and about card show `assets/img/logo.svg` with a live-text "Shop Management System" tagline; `logo-full.svg` is used only for `og-image.png`. Never hand-edit `assets/img/*`: regenerate them with `node scripts/brand-assets.mjs` from the repository root.

## Pages and information architecture

22 pages. `partials/features.json` is the IA: it drives the mega menu, the More sheet, the footer, breadcrumbs, related cards, the home feature cards, the features.html directory and finder, and the demo form's interest cards.

| Page | File | `data-page` |
| --- | --- | --- |
| Home: one car's shop day, check-in to paid | `index.html` | `home` |
| All features: bottleneck finder + role-filtered directory | `features.html` | `features` |
| Feature pages (12) | `features/workflow.html`, `repair-orders`, `inspections`, `messaging`, `booking`, `payments`, `parts`, `diagnosis`, `customers`, `fleet`, `reports`, `ai` | `features` (+ `data-tab="features"`) |
| iPhone, iPad & offline app | `mobile.html` | `mobile` |
| Security & your data | `security.html` | `security` |
| Integrations, and the Shop Cloud definition (`#shop-cloud`) | `works-with.html` | `integrations` |
| About | `about.html` | `about` |
| Questions & answers (the only page with FAQPage JSON-LD) | `faq.html` | `faq` |
| Request a demo (the one form) | `demo.html` | `demo` |
| Privacy | `privacy.html` | `privacy` |
| Not found (copied to `dist/not-found.html`) | `404.html` | `notfound` |

`features.json` holds:

- `stages[]`: the five canonical stops of a shop day (Check-in, Inspect & approve, In the bay, Payment, Follow-up), used verbatim by the home journey road, the home chapters' `data-stage`, the header lane ticks and the about driveline.
- `groups[]`: Before the car arrives, In the bay, At the counter, Behind the desk.
- `features[]`: 12 entries in shop-day order: `slug`, `title`, `short` (24 chars max), `line` (40 chars max), `blurb`, `icon`, `group`, `appRoute`, `demoLabel`, `roles`, `needs`, `related` (plus `note` and `featured` where used).
- `everywhere`: the directory's fifth group (iPhone & iPad, Security, Integrations).
- `roles[]`: the directory's role chips (`all`, `owner`, `manager`, `advisor`, `tech`).
- `pains[]`: the 14 finder chips, each mapped to feature slugs.

To add a feature: add its entry, create `features/<slug>.html` from the template below, and run sync. check.mjs fails if a feature page has no entry (or the reverse), if `short`/`line` are too long, or if a related, stage or pain slug doesn't exist.

### Navigation

- **Header** (every page): the brand link (`{{logoInline}}` + tagline, accessible name "WPI Driveline Shop Management System home"), the primary nav (Features with the mega menu, iPhone & iPad, Integrations, Security, FAQ; 1080px and up), and the actions: **Sign in** (`{{root}}app/signin`, icon-only below 600px and from 1080 to 1279px) and **Request a demo**. Below it, the lane car (`.road-progress`).
- **Tab bar** (below 1080px): Home, Features, Get a demo (raised), iPhone, More. The **More sheet** holds Request a demo, Try the sample shop, Sign in, the Explore grid, the 12 feature links and the Pause animations toggle.
- **Footer**: the logo card and blurb, Product (the 12 features + iPhone & iPad), Company, Help, "Talk to us" (`{{contactRow}}`: mailto/tel when `business.json` has them, else the demo form), the © line and the Pause animations toggle.
- `sync.mjs` marks the active header link (sliding pill), tab and sheet link from `<body data-page>` / `data-tab`. Every `features/*` page lights up "Features"; `works-with.html` lights up "Integrations"; the header's Request a demo button is active on `demo.html`.

### The feature page template

Every `features/<slug>.html` follows it exactly:

1. `<body data-page="features" data-tab="features" id="top">` with the partials head, jsonld, icons, header, cta, footer and tabbar.
2. **hero**: `.page-hero` > `.page-hero-bg` + `.container.page-hero-grid`. The copy column holds `<!-- @partial breadcrumbs --><!-- @end breadcrumbs -->` (generated nav + BreadcrumbList JSON-LD), an `.eyebrow` with an `.icon-tile` (the features.json icon, inline `style="view-transition-name: ft-<slug>"`), the h1 with one `.accent-text` phrase, the `.lead`, `.hero-actions` (btn-primary "Request a demo" → `../demo.html?interest=<slug>`, btn-secondary `{demoLabel}` → `{{appLink}}<appRoute>` with `data-no-prerender`) and three `.chip` check chips. The art column is the hero scene.
3. **pains** (not on diagnosis or ai): `.split` with a page-specific heading, a `.signal-list` and a `.callout` answer.
4. The page-specific sections (ids exactly as in the spec).
5. **how**: the RO journey road (`--steps: 4`).
6. **needs**: `.callout` "Good to know" with `i-info`, listing needs and limits; every Shop Cloud mention links `works-with.html#shop-cloud`.
7. **faq**: plain `details.faq name="feat-faq"`, no JSON-LD.
8. **related**: heading "Works alongside", then `<!-- @partial related --><!-- @end related -->` (cards from features.json `related[]`).

## Shared parts and tokens

Partials are regenerated between `<!-- @partial NAME -->` and `<!-- @end NAME -->`. An unknown name makes sync throw.

| Partial | Source | Used on |
| --- | --- | --- |
| `head` | `partials/head.html` + generated canonical, `og:*` (title and description copied from the page), `twitter:card` | every page |
| `jsonld` | generated `@graph`: Organization, SoftwareApplication (`featureList` = the 12 titles), WebSite | every page |
| `icons` | `partials/icons.html` (sprite + shared `<defs>`) | every page |
| `header`, `tabbar`, `footer` | `partials/*.html` | every page |
| `cta` | `partials/cta.html` (the CTA road band) | every page except demo, privacy and 404 |
| `breadcrumbs`, `related` | generated | `features/*` |
| `featuresCards` | generated `.grid.grid-3` of 12 `.feature-card` links + "See every feature" | index |
| `finderChips`, `finderData`, `roleChips`, `featuresDirectory` | generated (pain chips, `#finder-data` JSON, role chips, the `.dir` directory with `data-roles`, Needs lines and sample-shop links) | features.html |
| `featuresInterests` | generated: 12 checkbox `.choice` cards (`name="interests"`, value = title) | demo.html |
| `contact-email` | generated: a mailto link when `business.json` email is set, else nothing | demo.html |

Tokens work in partials and in page content: `{{root}}`, `{{appLink}}` (`{{root}}app/`), `{{signInLink}}`, `{{name}}`, `{{shortName}}`, `{{company}}`, `{{tagline}}`, `{{description}}`, `{{email}}`, `{{phone}}`, `{{tel}}`, `{{siteUrl}}`, `{{basePath}}`, `{{year}}`, `{{canonical}}`, `{{logoInline}}`, `{{motionToggle}}`, `{{contactRow}}`, `{{featuresMega}}`, `{{featuresSheet}}`, `{{featuresFooter}}`. A token in page content is replaced in the file on the next sync; an unknown token is left in place and fails check.mjs.

The icon sprite's `<defs>` holds `#art-tint`, `#gauge-tint`, `#gauge-pad`, `#gauge-tread` and the `#arrow-head`, `#arrow-head-accent`, `#arrow-head-green` markers. Page SVGs never redefine those ids (the duplicate-id check catches it); page-specific gradients use slug-prefixed ids.

## App links

- **Try the sample shop** is a relative link to `{{root}}app/` (`{{appLink}}`). On a device with no saved shop it opens Main Street Auto Service, the made-up sample shop, without sign-in. A device that already has a shop opens that shop instead.
- **Sign in** goes to `{{root}}app/signin` (`{{signInLink}}`).
- Feature pages link `{demoLabel}` to `{{appLink}}<appRoute>`.
- **Every link into `app/` carries `data-no-prerender`** (check.mjs enforces it). The head's speculation rules exclude `{{basePath}}app/*` and `[data-no-prerender]`, and site.js's prefetch fallback skips them: prerendering would boot the app, register its service worker and seed the sample shop into IndexedDB on a hover.
- `404.html` uses root-absolute paths (it is served at any URL), including `{{basePath}}app/`.

### The APP_ROUTE naming rule

GitHub Pages, Netlify and `tests/support/pages-server.mjs` serve `<name>.html` for an extensionless `/automotive/<name>`, which would shadow the 404 forwarder that sends old app links (`/automotive/orders`, `/automotive/integrations`, …) into `app/`. So **never add a top-level page or folder named after an app route**: orders, workflow, calendar, messages, marketing, tech, team, accounting, integrations, import, customers, vehicles, vin, catalog, parts, library, reports, settings, share, book. That is why the integrations page is `works-with.html`. check.mjs reads `APP_ROUTES` from `scripts/pages.mjs` and fails on a collision. A new website subfolder must be added to `PAGE_DIRS` in both `sync.mjs` and `check.mjs`.

### Old URLs

The old shop website's pages forward to their new homes: `scripts/pages.mjs` `LEGACY` (client-side, in `dist/404.html`, checked before the app routes) and `netlify.toml` (real 301s), for both the `.html` and extensionless forms: services/diagnostics → features/diagnosis.html, services/inspections → features/inspections.html, services and services/* → features.html, appointment and contact → demo.html, fleet → features/fleet.html, brands and resources → features/diagnosis.html, specials → index.html, careers → about.html.

## Honesty rules (hard)

- Every capability sentence maps to something `src/` or `supabase/` does today. Every feature page has a "Good to know" callout with needs and limits.
- Anything server-side or using an outside service says it needs **Shop Cloud** and links `works-with.html#shop-cloud` (check.mjs warns on an unlinked mention). Inbox-driven features (self check-ins, online approvals, booking requests, website messages, Stripe payments) land on the shop's signed-in devices, which check about every minute while open. Never "by itself" or "before you open".
- AI rules are described as instructions ("it's set up not to quote prices"), not guarantees. A page that says staff review every AI draft also names the exception: the AI receptionist talks to callers and can text them the booking link or directions.
- **Never**: testimonials, customer logos, ratings, user counts, ROI or time-saved figures, uptime, awards, years in business, team bios, certifications, prices, trials or sign-ups, store badges, or service promises (response times, walkthroughs, account support) until the owner confirms them. Never "adds no fees"; the safe line is "Payments go straight to your own Stripe account at Stripe's standard rates."
- The pricing answer, everywhere: "We don't publish prices. Tell us about your shop in a demo request, and ask how Shop Cloud is set up and billed for you. Services you connect (Stripe, Twilio, Resend, Anthropic, Smartcar, Intuit) bill your shop directly at their own rates."
- Third parties appear as text only, never logos (check.mjs warns on a provider name in an `img alt`).
- Standalone counters show only built-in product facts (435 makes, 4,073 models, model years through 2027, 725 codes, 37 points, 14 backups kept, 6 months of history).

### Mockups and example data

- Example data (customer or tech names, amounts, counts, times, VINs, key suffixes) appears only inside a `figure.mock-figure` with a visible `<span class="mock-tag">Example · sample shop</span>`, inside a `.roadmap` (or its `ol.roadmap-steps`) whose `aria-label` contains "Example", or in float-notes inside such a figure. Data-free art is a plain `figure.page-hero-art[data-play]` with no tag.
- Figures never nest. The only interactive element inside a mock figure is `button.mock-replay`: no headings, links or form controls (mock buttons and headings are spans or divs).
- Mock text is at least 12px and AA on white; device frames are light.
- Values come from the sample shop (`createSeed()` in `src/data/seed.js`). Never print RO numbers (they shift with the load date). Phone numbers only as (217) 555-01xx, emails only on `.example` domains. Never show Stripe test mode, the simulated reader, Smartcar Simulated mode or the QuickBooks sandbox as live, and never the "AutoShop Pro" strings.
- check.mjs flags sample-shop names, RO-number patterns, dollar amounts with cents and VINs outside those places ("Main Street Auto Service" is allowed).

## Motion

Every animation respects Reduce Motion, has a no-JS end state in the markup, prints in its final state, and stops with the site-wide **Pause animations** toggle (footer and More sheet; stored as `wpi-site:motion`). Loops are capped at 1 to 2 and run only while their figure is on screen (`[data-play]`).

**Motion budget**: one sequenced hero scene per page, plus at most two other Mock-player sequences; everything else uses Scroll reveal, the one-pass Reveal sequence or a Reveal accent, the RO journey road, Rolling counters (once), tabs and Hover & press.

| Page | Sequenced (Mock player) |
| --- | --- |
| index | hero + #ch-approve, #ch-work (other chapters: Reveal sequence; only the feature ticker moves continuously) |
| features | hero (plus the finder and role-filter interactions) |
| features/workflow | hero + #today, #tech-clock |
| features/repair-orders | hero + #profit |
| features/inspections | hero + #media, #live-status |
| features/messaging | hero + #receptionist |
| features/booking | hero + #booking-page, #lobby |
| features/payments | hero + the reader tab panel, #financing |
| features/parts | hero + #inventory |
| features/diagnosis | hero + the #database firing-order illustration |
| features/customers, features/ai, works-with | hero only |
| features/fleet | hero + #pm |
| features/reports | hero + #quickbooks |
| mobile | hero + #offline |
| security | hero + #history |
| about | the card orbit + #driveline |
| demo | hero, the gear shifter + #switching |

**Primitives** (site.css + site.js): header lane car (home adds stage ticks and a label), RO journey road, Rolling counters, Slot roll, Scroll reveal, Reveal sequence, Hero entrance, App notification chips (`data-cycle`), Mock player (`data-play`, `data-seq`, `data-loops`, Replay), Hero scene components, Illustration kit, Board slide, Stamp, Data flow line, Live dot, CTA road band (with the "In progress" → "Paid · RO closed" chip), tickers, Hover & press, page transitions (the `ft-<slug>` icon morph), bottleneck finder, role filter, concern lamps, gear shifter, tabs and accordions, mega menu, tab bar and More sheet, scroll-spy pills.

### Keyframe migration (from the removed pages)

| Keyframes | From | Now |
| --- | --- | --- |
| tag-swing, tag-sway, tag-check, gear-pop | appointment.html | site.css (booking, demo) |
| stamp-in | specials.html | site.css (Stamp) |
| mk-in, mk-out | brands.html | site.css as fx-in/fx-out (finder) and rt-in/rt-out (role filter) |
| lamp-flicker, jump-in, odo-tenth | resources.html | site.css (concern lamps, finder, odometer) |
| bp-*, g-sweep | services.html | features hero and finder gauge |
| gear shifter CSS + WAAPI | appointment.html | site.css + an inline demo.html script |
| convoy-*, status-blink | fleet.html | inline in features/fleet.html as fleet-* |
| spd-drive, cluster gauges | resources.html | inline in features/reports.html as reports-* |
| careers gears | careers.html | demo.html (art-spin is shared) |
| pk-* | privacy.html | stay on privacy; security uses a security-pk-click copy |

`stub-off` is retired. Page-local keyframes stay inline, slug-prefixed and single-use. check.mjs fails when a page references an animation name that neither site.css nor the page defines.

## The demo form and the inbox

`demo.html` holds the only form (`form#demo-form name="demo"`): four gears (Your shop, What to see, Contact, Review), the topic select (`?topic=question` skips gear 2) and the 12 interest cards (`?interest=<slug>` pre-checks one). site.js sends it to the shop inbox (`business.json` `shopInbox`, the `shop_inbox` table) as kind `message` with `payload.source = "website"` and `payload.form = "demo"`; the text starts with the topic ("Demo request" by default). A signed-in staff device on that Shop Cloud turns it into a customer tagged Website and Demo request plus an unread message. If the inbox fails it tries `formEndpoint`, then Netlify Forms; on failure it shows "We couldn't send that online." with a mailto fallback only when `business.json` email is set (otherwise "try again"). Nothing typed is lost. Spam protection: the honeypot plus a 3-second minimum fill time.

## Editing and checking

1. Edit `business.json` (product name, vendor email and optional phone, `siteUrl`, `basePath`, `appPath`, `signInPath`, `formEndpoint`, `shopInbox`) or `partials/*`.
2. Run `node scripts/sync.mjs` (every page, `sitemap.xml` with all pages except 404 and privacy, `robots.txt`), or `node scripts/sync.mjs about.html` for one page.
3. Run `node scripts/check.mjs`. It fails on:
   - a missing doctype, lang, viewport, title or description; a title without the full product name; the brand link without it; required partials; not exactly one h1; duplicate ids; images without alt;
   - broken links or assets (`href`, `src`, `srcset` and CSS `url()`; links into `app/` are fine); app links without `data-no-prerender`; deep links with an unknown `?interest=` slug, `?topic=` other than `question`, or `?role=` other than owner/manager/advisor/tech;
   - anchors, icons, `url(#…)` and ARIA references to missing ids; unlabelled form controls;
   - mock-figure rules (the visible Example tag; nothing interactive but Replay; no nesting; no RO numbers; phones only (217) 555-01xx; emails only on `.example`), and example data outside tagged figures (sample-shop names, RO numbers, amounts with cents, VINs, sample phones and emails);
   - FAQPage JSON-LD outside faq.html, or any offers/ratings/reviews; a web app manifest or `apple-mobile-web-app-title`;
   - an animation name with no `@keyframes` (in a page, or in site.css itself); a duplicate inline `view-transition-name`, or an `ft-*` name anywhere but its own feature page;
   - mailto to example domains; banned text (old shop wording, social proof, superlatives, results percentages, uptime, trials, sign-ups, store badges, compliance claims, "adds no fees", "your own Supabase project", the account-help topic, prices outside example figures); a leftover `{{token}}` anywhere, scripts included;
   - a top-level page named after an app route; and features.json inconsistencies.

   It warns on long titles and descriptions, em dashes, unlinked Shop Cloud mentions, "by itself" / "before you open" wording, blue or green as a text colour, provider names in alt text, feature pages still missing template parts (#hero, #needs with "Good to know", #faq, #related, the `?interest=<slug>` and sample-shop links, the `ft-<slug>` tile), a blank email or remaining `_placeholders`, and `[data-owner-review]` sections.
4. `node scripts/check.mjs --release` turns the email, placeholder and owner-review warnings into errors. Switch `scripts/pages.mjs` to `--release` once the owner has supplied the vendor email and confirmed the privacy statements. `--draft` tolerates links to planned pages that don't exist yet.

`scripts/pages.mjs` runs check.mjs before every build, so a page error blocks the deploy.

## Before launch (owner)

- **Vendor email** (`business.json` `email`, then remove it from `_placeholders`) and, optionally, a phone. Until then the footer offers the demo form and the error fallback says "try again". Never an example.com address.
- **Privacy**: the routing and retention sections of `privacy.html` are marked `[data-owner-review]`.
- **Shop Cloud hosting and billing**, what "WPI" stands for, and any response-time, walkthrough or account-support promise: none of these are stated until confirmed.
- **Canonical domain**: `siteUrl` drives canonical, `og:url`, the sitemap and JSON-LD.
- **Search Console** will flag the SoftwareApplication structured data for missing `offers` (and ratings). That is by choice: the site publishes no prices or ratings.
