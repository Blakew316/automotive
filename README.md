# AutoShop Pro

Shop management for independent auto repair — estimates with fast customer authorization, repair orders through to paid invoice, a drag-and-drop workflow board, digital inspections, two-way customer messaging, online booking, a tech time clock with team pay and productivity, purchase orders, payments, accounting with QuickBooks exports, marketing, a built-in vehicle database (every make and model NHTSA has VIN data for, with system diagrams, parts lists and repair guides), on-device VIN decoding, parts lookup across suppliers, and a technical library with OEM service information, wiring references and trouble codes.

Built with React, Vite and Tailwind. It runs entirely in the browser: shop data is stored locally (localStorage) and can be exported/imported as a JSON backup from **Settings → Data**. It installs to phones, tablets and computers as an app and works offline. Features that need to reach customers' phones (share links, online approvals, customer replies and the online booking inbox) use the shop's own free Supabase project — see [Shop Cloud](#shop-cloud).

The repo also holds the shop's public website (`website/`), published alongside the app:

| URL | What |
| --- | --- |
| https://blakew316.github.io/automotive/ | Public website — Clinton Complete Auto Care |
| https://blakew316.github.io/automotive/app/ | AutoShop Pro staff app |

## Features

**Shop workflow**
- **Today** — car count, billed today, estimates awaiting approval, ready for pickup, receivables, what’s in the shop, today’s appointments, and a “needs attention” list (late promises, parts on order, stale estimates, unpaid invoices, low stock).
- **Workflow board** — Estimate → Approved → In Progress → Waiting on Parts → Ready for Pickup, with drag-and-drop, per-tech filtering and undo.
- **Repair orders** — one record from estimate to invoice: canned jobs, labor/part/fee/sublet lines, parts markup matrix, shop supplies, discounts, tax, per-service approve/decline, tech assignment, complaint/cause/correction, digital vehicle inspection with recommendations, notes, and payments. Send by text or email (`sms:`/`mailto:`) and print or save a PDF estimate, work order or invoice.
- **Photos & video on every RO** — take pictures or video from a phone/tablet camera or drag files in; attach them to the whole vehicle, a service line or an inspection point; add captions; mark any as internal. Photos are resized and stripped of location data before they’re stored.
- **Customer vehicle report** — a clean, mobile-friendly page with the inspection results, recommendations, work performed, photos and video, and totals. Show it on a counter tablet (customers can approve or decline work there), text/email a **share link** that opens on any phone, or download a single self-contained **report file** (.html) with everything embedded.
- **Job profitability** — every service shows its gross profit (GP%, GP$ and GP per labor hour after parts, sublet and the assigned tech’s pay), and the RO shows a profit meter against the shop’s GP target.
- **Tire management** — quote good / better / best tire options side by side on any service; the customer taps their choice on the counter tablet or their report link, and the tire line follows it. Record each tire’s DOT TIN (with date-code checks and age warnings) and keep a registration log (Parts → Tires) to export for manufacturer registration.
- **Estimates & authorization** — record approval per service in person (with on-screen signature), by phone, text or email; customers can also approve or decline each item from their report link with a typed name and signature. Every authorization is logged with who, how, when, what and the amount.
- **Digital inspections** — editable inspection templates, good / needs attention soon / needs attention now ratings, measurements (tread depth, pad thickness), notes and photos per point, with recommendations carried to the customer report.
- **Calendar & online booking** — day/week scheduling, plus a public booking page customers open from your website, Google profile or a text: they choose services, see open times based on your hours and capacity, and send a request that lands in **Calendar → Requests** to confirm (customer and vehicle are created automatically, with a confirmation text ready to send).
- **Messages** — one inbox for texts, emails and portal replies per customer, with templates and merge fields (estimate ready, status update, ready for pickup, pay request, receipt, appointment reminder, service reminder, declined-work follow-up, review request, win-back). Texts and emails open in the shop phone’s Messages / Mail app so they come from the shop’s own number and address; customer replies are logged with **Log reply** or arrive automatically from report links.
- **Payments** — record card, cash, check, ACH, financing, warranty and fleet payments with tips and an optional card surcharge; text-to-pay links through the shop’s own Stripe, Square, PayPal, Venmo or Cash App account; receipts by text or email.
- **Financing** — “as low as $/mo” on estimates and the customer report, with a link to the shop’s financing partner.
- **Customers & vehicles** — history, lifetime value, recent messages, declined-work follow-ups, and per-vehicle service timeline.

**Team & techs**
- **Tech Time Clock** — a phone-friendly view for each technician: clock in/out, their assigned jobs, one-tap job timers (starting a job clocks them in and moves the RO to In Progress), mark jobs done, and the inspection checklist.
- **Team** — live board of who’s on what, timesheets with editable entries, efficiency (flagged ÷ clocked) and productivity (on jobs ÷ on the clock), and gross pay for hourly or flat-rate techs with labor/parts commission — exportable for payroll.

**Parts & purchasing**
- **Inventory status** — value by parts, tires, batteries and fluids; in stock, on open jobs and on order; min/max with Reorder / Above max flags; last used.
- **Purchase orders** — create POs by vendor (from low stock or parts needed on ROs), mark ordered with an expected date, receive in full or partially into inventory (updating cost) and onto the RO, and see what’s on order.

**Business**
- **Reports** — sales & profit (revenue, car count, ARO, gross profit, hours sold, effective labor rate, sales mix, close rate, top services, receivables aging, and a period-over-period table with hours presented vs sold), goals & growth (a monthly scorecard against your targets and a what-if growth planner), technicians (efficiency, productivity, labor sales, commission), estimates & approvals (quoted vs approved vs declined, time to approve, approval methods, most-declined services) and customers (returning rate, new customers, online bookings, messages, top customers).
- **Accounting** — profit & loss (income by type, parts and sublet cost, tech pay from the time clock, operating expenses by category, net income), an expense ledger, deposits by day and payment method (tips and surcharges separated), sales tax by month, and CSV exports in QuickBooks Online’s import layouts (invoices, payments, expenses, a balanced daily sales journal, customers).
- **Marketing** — automations that line up today’s follow-ups (appointment confirmations, day-before reminders, review requests, service due, declined work, win-back) with sent and coming-up counts; vehicles due for an oil service (by time or projected mileage), declined work to follow up, lapsed customers to win back, review requests after closed visits, and custom campaigns by tag, make or last visit. Send personalized texts one tap at a time from the shop phone, one BCC email, or export the list for a bulk texting/email service.
- **Shop website** — the shop's public site ([Public website](#public-website)). Its *Book a service* form drops requests into **Calendar → Requests** with the customer's preferred day and time of day, and its contact and fleet forms arrive in **Messages** (new people are added as customers).
- **Roles & access** — staff profiles for owner, shop manager, service advisor and technician with optional 4-digit PINs; each role sees only the pages it needs (switch people from the sidebar).
- **Integrations** — Shop Cloud, online booking, Google reviews, QuickBooks exports, payment links, financing, PartsTech / Nexpart / WORLDPAC ordering with POs, NHTSA, calendar (.ics) export for Google/Apple/Outlook, CARFAX service history, and data import.
- **Data migration** — import customers & vehicles or parts inventory from CSV (or paste from a spreadsheet) exported from Shopmonkey, Tekmetric, Mitchell 1, ALLDATA Manage, Shop-Ware, NAPA TRACS, RO Writer, QuickBooks or Excel: columns are matched automatically, previewed, and de-duplicated by phone, email, VIN and part number.
- **Mobile app** — installable on iPhone, iPad, Android, Mac and PC (Settings → General → Mobile & desktop app); opens full-screen, works offline, with home-screen shortcuts to a new RO, the tech clock, the board and messages.

**Vehicle database (stored on the site, works offline)**
- **435 makes · 4,073 models · 1981–2027** — passenger cars, SUVs/MPVs, trucks and incomplete chassis from NHTSA’s vPIC database, browsable by make, model and model year, with search from the page or the ⌘K palette.
- **Model-year pages** — the engines, drive types, bodies, transmissions, trims and plants the manufacturer filed for that year, each tied to the VIN codes that select it (including the VIN 8th-digit engine code where it applies), plus a full VIN pattern table.
- **Per-configuration system diagrams** (generated SVG, light/dark): engine layout with cylinder numbering, bank 1/2 and firing order; engine-control inputs/outputs (gas or diesel); starting & charging or 12 V supply; drivetrain layout (FWD/RWD/AWD/4WD, PTU/RDU, transfer case); cooling or EV thermal loops; brake hydraulics (diagonal vs front/rear split, ABS, booster type, air brakes); CAN/legacy network topology; OBD-II connector pins in use; and the high-voltage system for hybrids and EVs.
- **Service parts list** for each configuration — quantities derived from the build (plugs per cylinder, O2 sensors per bank, coils, injectors, driveline parts by drive type, HV components…), verified part numbers where sourced, and matching items from the shop’s inventory.
- **Repair guides** — tailored workshop procedures (HV disable, oil, plugs, brakes, charging/starting/parasitic draw, cooling, misfire, CAN, TPMS, CV/driveshaft, diesel aftertreatment, ADAS, throttle relearn) with tools, steps, cautions and the OEM specs to look up.
- The same panel appears on decoded VINs and on every vehicle in the shop.

**Technical data**
- **VIN decoder** — decodes on the device against the stored vPIC pattern data (any vehicle sold in the U.S. since 1981, including six-character WMIs for small manufacturers), plus ISO 3779 check-digit and model-year validation; barcode scanning on devices that support the Shape Detection API.
- **Recalls, complaints & crash ratings** — optional live lookups from **api.nhtsa.gov** (these change daily, so they are fetched only when you click *Check now* or turn on *Always check*).
- **Parts** — vehicle-aware search links into RockAuto, NAPA, O’Reilly, AutoZone and Advance; OEM parts stores; shop inventory with bins, min stock, markup-matrix pricing and CSV export; verified maintenance specs with sources.
- **Service library**
  - 22 OEM service-information portals (factory manuals, wiring diagrams, TSBs, programming) and 33 free official documents (Tesla service manuals & electrical reference, Ford/GM/Ram/Nissan body-builder guides, emergency-response guides, owner-manual portals).
  - Wiring references: interactive SAE J1962 OBD-II pinout with CAN tests, ISO relay schematic, blade/MAXI/J-case fuse colors, OEM wire-color abbreviations, trailer connectors (4-flat, 7-way RV & SAE J2863), AWG table.
  - 725 generic OBD-II trouble codes (SAE J2012) with causes and diagnostic checks for the most common 65.
  - Calculators: voltage drop / wire sizing, Ohm’s law, tire size comparison, unit conversions.

## Shop Cloud

Shop data and photos live on the device (localStorage and IndexedDB), so everything works offline and costs nothing. Anything that has to open on a customer’s phone needs to be online, so it uses a [Supabase](https://supabase.com) project dedicated to AutoShop Pro.

**It comes preconfigured.** The app ships connected to the *AutoShop Pro* project (`src/lib/cloudDefaults.js`): a public-read `autoshop-media` Storage bucket (photos, video and report files, 50 MB per file) and a `shop_inbox` table. Customers can only *add* booking requests, approvals and messages to the inbox; reading or clearing it, and uploading, replacing or deleting files, require a signed-in account whose `app_metadata.autoshop_staff` flag is set (checked by `public.is_shop_staff()` in every policy). Staff just sign in under **Settings → Shop Cloud** on each device; the first staff sign-in publishes the booking page, and passwords can be changed from the same screen. A signed-in account without the staff flag is warned and gets no access.

To add another staff login: create the user under Authentication → Users, then run

```sql
update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"autoshop_staff": true}'::jsonb
  where email = 'person@yourshop.com';
```

Turning off “Allow new users to sign up” (Authentication → Sign In / Providers) is recommended; accounts without the flag can’t see or change anything either way.

**Using a different Supabase project** (e.g. one per shop): open *Connection details* in **Settings → Shop Cloud**, paste the Project URL and anon key, create the bucket, and run the setup SQL shown there — it creates the same staff function, storage policies and inbox table.

With it connected:
- **Share links** for vehicle reports with photos and video. Only items marked “Customer can see” are uploaded; links use random 22-character IDs and can be updated or turned off (which deletes the files).
- **Online approvals & replies** — customers approve or decline work with a signature, or send a message, from the report; it arrives in the shop’s inbox and is applied to the RO automatically while a staff member is signed in.
- **Online booking** shows real open times (business hours minus booked appointments, up to the capacity you set) and requests arrive in Calendar without the customer texting. The booking page republishes itself when the calendar changes.

Without Shop Cloud, shops can still show reports on a counter tablet, send the downloadable report file, and take booking requests by text or email from the booking page.

## Public website

`website/` is the shop's static, multi-page website (copied from the `automotiverepair` repo): home, services and 11 service pages, about, makes, fleet, specials, car care guides, FAQ, contact, careers and a multi-step *Book a service* form. Every page is a standalone HTML file with no build step; see `website/README.md` for editing.

- **Shop details** (phone, email, address, hours, social links) live in `website/business.json`. Edit it, then run `node website/scripts/sync.mjs` to update every page, the structured data, `sitemap.xml` and `robots.txt`; `node website/scripts/check.mjs` validates the pages.
- **Forms → AutoShop Pro.** `shopInbox` in `business.json` points the booking, contact and fleet forms at the Shop Cloud inbox (the public anon key; customers can only add). Staff signed in to the app receive them automatically. If the inbox can't be reached, the visitor is offered a pre-filled email or the phone number instead.
- **Staff sign-in** in the site footer links to the app (`staffAppUrl`).
- **Hosting.** `npm run build:pages` (`scripts/pages.mjs`) builds the app into `dist/app/` and copies the website to `dist/`. GitHub Pages serves one `404.html` for every missing path; it is the app shell, so deep links into the app load directly, and a small script forwards old links from before the app moved under `app/` (e.g. `/automotive/orders`) and sends unknown pages to the website's not-found page. A self-removing `sw.js` at the root retires the service worker from the old layout.
- **Own domain.** Point the domain at the site, set `siteUrl`, `basePath` (`"/"` at a domain root) and `staffAppUrl` in `business.json`, run the sync script, build with that base (`node scripts/pages.mjs /`), and enter the address under **Settings → Website** in the app.

## Getting service records onto CARFAX

CARFAX doesn’t accept uploads from individual shops. Records reach CARFAX Reports through a data connection set up when a shop enrolls in the free CARFAX Car Care service-shop program ([carfaxserviceshops.com](https://www.carfaxserviceshops.com/)); integrated shop systems then send each closed RO automatically. **Integrations → Vehicle history** explains the steps and exports a service-history CSV (VIN, year/make/model, date, odometer, RO number, service performed, shop name/address/phone) for any date range to hand to CARFAX’s onboarding team. ROs without a 17-character VIN are skipped and counted so they can be fixed.

## Design

Navy and light grey, kept calm: a white sidebar with dark, easy-to-read labels, light grey canvas with white cards, navy for actions and links, and quiet navy or grey icon tints instead of colored tiles — no gradients or glows. Green / amber / red are reserved for status and appear only as dots and small pills. Monospaced section labels, chart colors checked for color-blind separation, San Francisco on Apple devices with Inter elsewhere, light appearance by default with an optional dark mode, a ⌘K / Ctrl+K command palette, and layouts that work from phone to desktop.

## Data sources

| Data | Source |
| --- | --- |
| Vehicle database & VIN decode | NHTSA vPIC (public domain), stored in `public/data` |
| Recalls, complaints, NCAP ratings | api.nhtsa.gov (optional, live) |
| Shared reports, photos & video, online approvals, customer replies, booking requests | The AutoShop Pro Supabase project — `autoshop-media` Storage bucket and `shop_inbox` table |
| Firing orders & cylinder numbering | Manufacturer-published data for the engine families in `src/data/engines.js` |
| OEM service portals & free documents | Manufacturer and government sites, verified Sept 2026 |
| Trouble codes | SAE J2012 generic definitions |
| Electrical references | SAE J1962, DIN 72552, ISO 8820-3, SAE J2863, ASTM B258 |

Links to suppliers and OEM sites open their own pages; nothing is scraped. Demo customers, phone numbers (555-01xx) and emails (`.example`) are fictitious. Always confirm part fitment by VIN.

Generated diagrams, parts lists and procedures are representative of the vehicle’s configuration: facts that come from the VIN data are shown as such, anything inferred from the model year or layout is labelled *typical*, and torque values, capacities, connector pin-outs and wire colors are always deferred to factory service information. No OEM wiring diagrams or part numbers are invented.

### Rebuilding the vehicle data

`public/data` is generated from the SQLite build of the vPIC database bundled in the ISC-licensed [`@cardog/corgi`](https://www.npmjs.com/package/@cardog/corgi) npm package:

```bash
npm run data:vehicles   # downloads the database (≈60 MB, cached in scripts/vpic/.cache) and rewrites public/data
```

- `public/data/vin/wmi/<first 3 VIN chars>.json` — VIN pattern shards used by the decoder (loaded one at a time).
- `public/data/vehicles/index.json` — makes and models; `public/data/vehicles/<make>.json` — per-make model-year patterns, loaded when a make is opened.

## Development

```bash
npm install
npm run dev      # http://localhost:5173
npm run lint
npm run build          # app only, into dist/
npm run build:pages    # website + app as deployed (dist/ and dist/app/)
```

Deploys to GitHub Pages via `.github/workflows/deploy.yml` (`npm run build:pages`).
