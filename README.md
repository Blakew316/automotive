# AutoShop Pro

Shop management for independent auto repair — repair orders from estimate to paid invoice, a drag-and-drop workflow board, live VIN decoding with NHTSA recalls, parts lookup across suppliers, and a technical library with OEM service information, wiring references and trouble codes.

Built with React, Vite and Tailwind. It runs entirely in the browser: shop data is stored locally (localStorage) and can be exported/imported as a JSON backup from **Settings → Data & backup**.

## Features

**Shop workflow**
- **Today** — car count, billed today, estimates awaiting approval, ready for pickup, receivables, what’s in the shop, today’s appointments, and a “needs attention” list (late promises, parts on order, stale estimates, unpaid invoices, low stock).
- **Workflow board** — Estimate → Approved → In Progress → Waiting on Parts → Ready for Pickup, with drag-and-drop, per-tech filtering and undo.
- **Repair orders** — one record from estimate to invoice: canned jobs, labor/part/fee/sublet lines, parts markup matrix, shop supplies, discounts, tax, per-service approve/decline, tech assignment, complaint/cause/correction, digital vehicle inspection with recommendations, notes, and payments. Send by text or email (`sms:`/`mailto:`) and print or save a PDF estimate, work order or invoice.
- **Calendar** — day/week scheduling with click-to-book and check-in to a new RO.
- **Customers & vehicles** — history, lifetime value, declined-work follow-ups, and per-vehicle service timeline.
- **Reports** — revenue, car count, ARO, gross profit, hours sold, effective labor rate, sales mix, estimate close rate, technician hours, top services, receivables aging.

**Technical data**
- **VIN decoder** — offline validation (ISO 3779 check digit, model-year cycle, 300+ WMI manufacturer codes) plus a live full decode from **NHTSA vPIC**; barcode scanning on devices that support the Shape Detection API.
- **Recalls, complaints & crash ratings** — live from **api.nhtsa.gov** for any year/make/model, with a link to NHTSA’s VIN-specific open-recall lookup.
- **Parts** — vehicle-aware search links into RockAuto, NAPA, O’Reilly, AutoZone and Advance; OEM parts stores; shop inventory with bins, min stock, markup-matrix pricing and CSV export; verified maintenance specs with sources.
- **Service library**
  - 22 OEM service-information portals (factory manuals, wiring diagrams, TSBs, programming) and 33 free official documents (Tesla service manuals & electrical reference, Ford/GM/Ram/Nissan body-builder guides, emergency-response guides, owner-manual portals).
  - Wiring references: interactive SAE J1962 OBD-II pinout with CAN tests, ISO relay schematic, blade/MAXI/J-case fuse colors, OEM wire-color abbreviations, trailer connectors (4-flat, 7-way RV & SAE J2863), AWG table.
  - 725 generic OBD-II trouble codes (SAE J2012) with causes and diagnostic checks for the most common 65.
  - Calculators: voltage drop / wire sizing, Ohm’s law, tire size comparison, unit conversions.

## Design

Apple-style UI: San Francisco on Apple devices (system font stack) with Inter as the fallback elsewhere, neutral surfaces with hairline separators, one accent color, status shown as small dots rather than colored blocks, light and dark appearance, a ⌘K / Ctrl+K command palette, and layouts that work from phone to desktop.

## Data sources

| Data | Source |
| --- | --- |
| VIN decode | NHTSA vPIC API (free, no key) |
| Recalls, complaints, NCAP ratings | api.nhtsa.gov (free, no key) |
| OEM service portals & free documents | Manufacturer and government sites, verified Sept 2026 |
| Trouble codes | SAE J2012 generic definitions |
| Electrical references | SAE J1962, DIN 72552, ISO 8820-3, SAE J2863, ASTM B258 |

Links to suppliers and OEM sites open their own pages; nothing is scraped. Demo customers, phone numbers (555-01xx) and emails (`.example`) are fictitious. Always confirm part fitment by VIN.

## Development

```bash
npm install
npm run dev      # http://localhost:5173
npm run lint
npm run build
```

Deploys to GitHub Pages via `.github/workflows/deploy.yml`.
