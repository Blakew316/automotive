# AutoShop Pro

Shop management for independent auto repair — repair orders from estimate to paid invoice, a drag-and-drop workflow board, a built-in vehicle database (every make and model NHTSA has VIN data for, with system diagrams, parts lists and repair guides), on-device VIN decoding, parts lookup across suppliers, and a technical library with OEM service information, wiring references and trouble codes.

Built with React, Vite and Tailwind. It runs entirely in the browser: shop data is stored locally (localStorage) and can be exported/imported as a JSON backup from **Settings → Data & backup**.

## Features

**Shop workflow**
- **Today** — car count, billed today, estimates awaiting approval, ready for pickup, receivables, what’s in the shop, today’s appointments, and a “needs attention” list (late promises, parts on order, stale estimates, unpaid invoices, low stock).
- **Workflow board** — Estimate → Approved → In Progress → Waiting on Parts → Ready for Pickup, with drag-and-drop, per-tech filtering and undo.
- **Repair orders** — one record from estimate to invoice: canned jobs, labor/part/fee/sublet lines, parts markup matrix, shop supplies, discounts, tax, per-service approve/decline, tech assignment, complaint/cause/correction, digital vehicle inspection with recommendations, notes, and payments. Send by text or email (`sms:`/`mailto:`) and print or save a PDF estimate, work order or invoice.
- **Photos & video on every RO** — take pictures or video from a phone/tablet camera or drag files in; attach them to the whole vehicle, a service line or an inspection point; add captions; mark any as internal. Photos are resized and stripped of location data before they’re stored.
- **Customer vehicle report** — a clean, mobile-friendly page with the inspection results, recommendations, work performed, photos and video, and totals. Show it on a counter tablet (customers can approve or decline work there), text/email a **share link** that opens on any phone, or download a single self-contained **report file** (.html) with everything embedded.
- **Calendar** — day/week scheduling with click-to-book and check-in to a new RO.
- **Customers & vehicles** — history, lifetime value, declined-work follow-ups, and per-vehicle service timeline.
- **Reports** — revenue, car count, ARO, gross profit, hours sold, effective labor rate, sales mix, estimate close rate, technician hours, top services, receivables aging.

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

## Photo & video sharing

Photos and video are stored in the browser on the device that took them (IndexedDB), so they work offline and cost nothing. A share link has to point at files hosted online, so links use the shop’s own [Supabase](https://supabase.com) project:

1. Create a project; copy the Project URL and anon (publishable) key into **Settings → Photo & video sharing**.
2. Create a **public** Storage bucket (default name `shop-media`) and set its file size limit for your videos (50 MB per file on the free plan).
3. Add a staff user under Authentication → Users and turn off public sign-ups.
4. Run the storage policies shown in Settings (SQL Editor) so only signed-in staff can upload, replace or delete files.
5. Sign in on each device that publishes reports and press **Test**.

Only items marked “Customer can see” are uploaded. Links use random 22-character IDs and can be updated or turned off from the RO (turning one off deletes its files). Without Supabase, shops can still show the report on screen or send the downloadable report file.

## Getting service records onto CARFAX

CARFAX doesn’t accept uploads from individual shops. Records reach CARFAX Reports through a data connection set up when a shop enrolls in the free CARFAX Car Care service-shop program ([carfaxserviceshops.com](https://www.carfaxserviceshops.com/)); integrated shop systems then send each closed RO automatically. **Settings → Vehicle history reporting** explains the steps and exports a service-history CSV (VIN, year/make/model, date, odometer, RO number, service performed, shop name/address/phone) for any date range to hand to CARFAX’s onboarding team. ROs without a 17-character VIN are skipped and counted so they can be fixed.

## Design

Apple-style UI: San Francisco on Apple devices (system font stack) with Inter as the fallback elsewhere, neutral surfaces with hairline separators, one accent color, status shown as small dots rather than colored blocks, light and dark appearance, a ⌘K / Ctrl+K command palette, and layouts that work from phone to desktop.

## Data sources

| Data | Source |
| --- | --- |
| Vehicle database & VIN decode | NHTSA vPIC (public domain), stored in `public/data` |
| Recalls, complaints, NCAP ratings | api.nhtsa.gov (optional, live) |
| Shared reports, photos & video | The shop’s own Supabase Storage bucket (optional) |
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
npm run build
```

Deploys to GitHub Pages via `.github/workflows/deploy.yml`.
