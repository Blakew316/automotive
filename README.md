# AutoShop Pro

Shop management for independent auto repair — estimates with fast customer authorization, repair orders through to paid invoice, a drag-and-drop workflow board, digital inspections, two-way customer messaging, online booking, a tech time clock with team pay and productivity, purchase orders, payments, accounting with QuickBooks exports, marketing, a built-in vehicle database (every make and model NHTSA has VIN data for, with system diagrams, parts lists and repair guides), on-device VIN decoding, parts lookup across suppliers, and a technical library with OEM service information, wiring references and trouble codes.

Built with React, Vite and Tailwind. It installs to phones, tablets and computers as an app and works offline: each device keeps the shop in IndexedDB, and with **shared shop data** turned on every device stays in sync through the shop's Supabase project — live updates, offline edits that sync later, merged concurrent edits, a change history on every record and nightly backups. Features that reach customers' phones (share links, online approvals, customer replies and the online booking inbox) use the same project — see [Shop Cloud](#shop-cloud).

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
- **Digital inspections** — editable inspection templates, good / needs attention soon / needs attention now ratings, measurements (tread depth, pad thickness) that rate themselves and show on a color gauge, a *tires & brakes at a glance* diagram (top-down car with each tire's tread, plus pad gauges) on the RO and the customer report, notes and photos per point, and recommendations carried to the customer report. Notes can be **dictated** with the mic button (the browser's built-in speech recognition; Chrome, Edge and Safari).
- **Photo markup** — draw arrows, circles, freehand lines and labels on any photo (red, yellow or white, with undo). Saving keeps the original and adds the marked-up copy next to it; by default the customer sees only the marked-up one.
- **Live status page** — *Send → Live status link* texts the customer a link that shows where their vehicle is (checked in → approved → being worked on → waiting on parts → ready → picked up, with times), the promised time, the approved work, and buttons for the inspection report, paying the balance and calling the shop. The page updates itself whenever the RO changes and can be turned off from *More*.
- **Front desk** — self check-in and an after-hours key drop: customers scan the QR code (print the key-drop sign or open the link on a lobby tablet in kiosk mode), enter their details, vehicle, concern, key tag and how they're getting around, and sign the diagnosis authorization. The check-in opens a repair order on its own, matched to the existing customer and vehicle (or adding them), attached to today's appointment, with the signed authorization saved. **Front Desk** shows today's check-ins, customers waiting in the lobby, the loaner board and today's shuttle rides.
  - **Loaners:** check out from the RO with odometer, fuel and a signed loaner agreement, then check back in; it flags low fuel, and each loaner's odometer and fuel are remembered.
  - **Shuttle:** ride times and addresses per RO, with a map link and a done checkbox.
  - **Waiting-room screen** (`/app/lobby`): every vehicle's status (first name and last initial only), ready vehicles first, with rotating messages, Wi-Fi details and the check-in QR code. It pages through long lists by itself.
- **Comebacks & no-charge work** — mark an RO as a comeback of an earlier one (reason and responsible technician); mark any service no charge (shop warranty, comeback, goodwill). The customer isn't billed, the shop's parts and labor cost still counts, and Reports → Technicians shows comeback rate and cost by technician.
- **Core returns** — enter a core charge on a part line; **Parts → Cores** tracks each core from to-return to returned to credited.
- **Calendar & online booking** — day/week scheduling, plus a public booking page customers open from your website, Google profile or a text: they choose services, see open times based on your hours and capacity, and send a request that lands in **Calendar → Requests** to confirm (customer and vehicle are created automatically, with a confirmation text ready to send).
- **Messages** — one inbox for texts, emails and portal replies per customer, with templates and merge fields (estimate ready, status update, ready for pickup, pay request, receipt, appointment reminder, service reminder, declined-work follow-up, review request, win-back). Texts and emails open in the shop phone’s Messages / Mail app so they come from the shop’s own number and address; customer replies are logged with **Log reply** or arrive automatically from report links.
- **Payments** — record card, cash, check, ACH, financing, warranty and fleet payments with tips and an optional card surcharge; text-to-pay links through the shop’s own Stripe, Square, PayPal, Venmo or Cash App account; receipts by text or email.
- **Financing** — “as low as $/mo” on estimates and the customer report, with a link to the shop’s financing partner.
- **Customers & vehicles** — history, lifetime value, recent messages, declined-work follow-ups, and per-vehicle service timeline.
- **Fleet & business accounts** — turn a commercial customer into an account (customer menu → *Set up business account*, or **Fleet & Accounts → Business account**) with payment terms (due on receipt to Net 60), a credit limit, a pre-approved (not-to-exceed) amount per visit, required PO numbers, tax exemption with the certificate number, a billing email and a note printed on every invoice.
  - **Units & maintenance:** each vehicle gets a unit number and driver/department; maintenance plans (e.g. oil every 5,000 mi or 6 months) show every unit as up to date, due soon or overdue, worked out from its repair orders (or recorded by hand for work done elsewhere), with one-click *PM RO* that starts the repair order with the due jobs.
  - **Invoicing on terms:** *Charge to account* closes a finished RO onto the account (asking for the PO number when it's required and warning when it goes over the credit limit); invoices print the PO, unit, terms and due date.
  - **Receivables:** aging by days past due (current, 1–30, 31–60, 61–90, 90+) per account and across the shop (**Fleet & Accounts → Receivables**, also on Reports and the Today page). *Receive payment* applies one check or ACH across several invoices, oldest first, under one batch.
  - **Statements:** a printable/PDF statement with aging, open invoices and recent payments, or emailed to the billing contact.
  - **Fleet portal:** a private link for the fleet manager showing every unit's maintenance status, what's in the shop (with live status and estimate links), open invoices, the balance and payment/booking buttons; it updates itself and can be turned off.

**Team & techs**
- **Tech Time Clock** — a phone-friendly view for each technician: clock in/out, their assigned jobs, one-tap job timers (starting a job clocks them in and moves the RO to In Progress), mark jobs done, and the inspection checklist.
- **Team** — live board of who’s on what, timesheets with editable entries, efficiency (flagged ÷ clocked) and productivity (on jobs ÷ on the clock), and payroll:
  - Pay periods (weekly, every two weeks, twice a month or monthly) and overtime by workweek (and by day where the state requires it).
  - Hourly techs are paid on clock hours, flat-rate techs on flagged hours, with labor and parts commission.
  - Exports: an **hours-import CSV** in the simple layout payroll services take (Gusto, ADP, Paychex, QuickBooks Payroll — match the columns on the import screen), a detailed payroll CSV, and printable **timecards** with employee and manager signature lines.
  - Owner approval of each period.

**Parts & purchasing**
- **Barcode & VIN scanning** — scan VINs (door-jamb/windshield Code 39, Code 128, Data Matrix, QR) in the VIN decoder, the vehicle form and self check-in, and part barcodes (UPC/EAN, Code 128, QR) to find parts, pull them onto an RO, receive purchase orders box by box, and **count inventory**. It uses the browser's built-in barcode detector where there is one, and a bundled ZXing decoder (self-hosted WebAssembly, downloaded only the first time it's needed) everywhere else, including iPhone/Safari. A photo of the barcode or typing the code works when the camera can't focus.
- **Multiple locations** — add locations under Settings → General. Each can have its own address, phone, sales tax and labor rate.
  - Each device picks the location it's working at from the sidebar (or all of them).
  - Repair orders, appointments, time, purchase orders and inventory belong to a location. The shop-floor pages show the current one, and estimates, invoices, texts and customer pages use that location's details.
  - Reports compare locations side by side, and parts can be transferred between locations. Customers, vehicles and accounts are shared.
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

### Shared shop data

Settings → Shop Cloud → **Shared shop data** puts the whole shop in the cloud so the front counter, bay tablets and the owner's phone all work on the same repair orders, customers and schedule.

- **Turning it on.** The owner signs in on the device that has the shop's data and chooses *Use this device's data* (or *Start with an empty shop*, which keeps settings, rates, the service menu and the team). Other devices go to `/app/signin`, sign in, and the shop loads automatically.
- **Logins.** Team → Staff & access → **Logins**: the owner gives each person their own login (a temporary password to hand over; they choose their own at first sign-in), resets passwords and removes access. A login is linked to a staff profile, so signing in also switches the device to that person. Logins are managed by the `shop-admin` Edge Function (`supabase/functions/shop-admin`).
- **How sync works.** Each record (repair order, customer, vehicle …) is a row in `shop_records` with a version. Devices write through `push_records()`, which only accepts an edit based on the current version; otherwise it returns the current copy and the device merges the two (`src/lib/sync/merge.js`: changes to different fields — and lines added to the same repair order — are all kept; if both changed the same field, the later edit wins) and retries. Changes arrive over Supabase Realtime, with polling as a fallback and a periodic version check so nothing is missed. Edits made offline or while signed out are kept on the device (and survive reloads) until they can be sent. Repair order and PO numbers created offline on two devices are renumbered the same way everywhere.
- **Photos and video** from each device upload to the private `autoshop-files` bucket (staff-only) and download on other devices when opened. Files over the free plan's 50 MB limit stay on the device that took them.
- **Change history.** Every version of every record is kept in `shop_record_history` (six months): *Change history* on a repair order, customer or vehicle shows who changed what, when and from which device, with one-click restore.
- **Backups.** `snapshot_shop()` runs nightly at 3:15 AM Central (pg_cron) and keeps the last 14; Settings → Data → **Cloud backups** downloads any of them as a regular backup file, and the owner can restore the whole shop to one (the current state is backed up first).

**Using a different Supabase project** (e.g. one per shop): open *Connection details* in **Settings → Shop Cloud**, paste the Project URL and anon key, create the bucket, and run the setup SQL shown there — it creates the same staff function, storage policies and inbox table.

With it connected:
- **Share links** for vehicle reports with photos and video. Only items marked “Customer can see” are uploaded; links use random 22-character IDs and can be updated or turned off (which deletes the files).
- **Online approvals & replies** — customers approve or decline work with a signature, or send a message, from the report; it arrives in the shop’s inbox and is applied to the RO automatically while a staff member is signed in.
- **Self check-in** publishes `site/checkin.json` (shop name, hours, wording, the diagnosis limit and the inbox address — no customer data). Check-ins arrive in `shop_inbox` as kind `checkin` (`supabase/migrations/20261002120000_inbox_checkin.sql`) and become repair orders on the next signed-in device; the ids come from the inbox row, so two devices can't open it twice.
- **Fleet portals** — each account's portal publishes `fleet/<random id>.json` (units, maintenance status, open ROs, open invoice totals, payments, balance — no line costs, margins or notes), republished by a signed-in device when any of that changes and at least daily for the countdowns.
- **Live status pages** — each tracked RO publishes a small `track/<random id>.json` file (shop name and phone, first name, vehicle, status, step times, promised time, service titles, balance due — no prices per line, costs or notes). A signed-in device republishes it when something the page shows changes; turning it off replaces the file with a notice.
- **Online booking** shows real open times (business hours minus booked appointments, up to the capacity you set) and requests arrive in Calendar without the customer texting. The booking page republishes itself when the calendar changes.

Without Shop Cloud, shops can still show reports on a counter tablet, send the downloadable report file, and take booking requests by text or email from the booking page.

## Public website

`website/` is the shop's static, multi-page website (copied from the `automotiverepair` repo): home, services and 11 service pages, about, makes, fleet, specials, car care guides, FAQ, contact, careers and a multi-step *Book a service* form. Every page is a standalone HTML file with no build step; see `website/README.md` for editing.

- **Shop details** (phone, email, address, hours, social links) live in `website/business.json`. Edit it, then run `node website/scripts/sync.mjs` to update every page, the structured data, `sitemap.xml` and `robots.txt`; `node website/scripts/check.mjs` validates the pages.
- **Forms → AutoShop Pro.** `shopInbox` in `business.json` points the booking, contact and fleet forms at the Shop Cloud inbox (the public anon key; customers can only add). Staff signed in to the app receive them automatically. If the inbox can't be reached, the visitor is offered a pre-filled email or the phone number instead.
- **Staff sign-in** in the footer goes to `/app/signin`.
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
