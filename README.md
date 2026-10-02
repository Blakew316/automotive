# WPI Driveline Shop Management System

WPI Driveline Shop Management System is shop management software for independent auto repair — estimates with fast customer authorization, repair orders through to paid invoice, a drag-and-drop workflow board, digital inspections, two-way customer messaging, online booking, a tech time clock with team pay and productivity, purchase orders, payments, accounting synced to QuickBooks Online, connected cars, marketing, a built-in vehicle database (every make and model NHTSA has VIN data for, with system diagrams, parts lists and repair guides), on-device VIN decoding, parts lookup across suppliers, and a technical library with OEM service information, wiring references and trouble codes.

Built with React, Vite and Tailwind. It installs to phones, tablets and computers as an app and works offline: each device keeps the shop in IndexedDB, and with **shared shop data** turned on every device stays in sync through the shop's Supabase project — live updates, offline edits that sync later, merged concurrent edits, a change history on every record and nightly backups. Features that reach customers' phones (share links, online approvals, customer replies and the online booking inbox) use the same project — see [Shop Cloud](#shop-cloud).

The repo also holds the product's marketing website (`website/`), published alongside the app:

| URL | What |
| --- | --- |
| https://blakew316.github.io/automotive/ | Marketing website — WPI Driveline Shop Management System |
| https://blakew316.github.io/automotive/app/ | WPI Driveline Shop Management System staff app |

## Features

**Shop workflow**
- **Today** — car count, billed today, estimates awaiting approval, ready for pickup, receivables, what’s in the shop, today’s appointments, and a “needs attention” list (late promises, parts on order, stale estimates, unpaid invoices, low stock).
- **Workflow board** — Estimate → Approved → In Progress → Waiting on Parts → Ready for Pickup, with drag-and-drop, per-tech filtering and undo.
- **Repair orders** — one record from estimate to invoice: canned jobs, labor/part/fee/sublet lines, parts markup matrix, shop supplies, discounts, tax, per-service approve/decline, tech assignment, complaint/cause/correction, digital vehicle inspection with recommendations, notes, and payments. Send by text or email (from the shop's own number and address once those are set up, with the estimate or invoice attached as a PDF), and print or download a PDF estimate, work order, invoice or receipt.
- **Photos & video on every RO** — take pictures or video from a phone/tablet camera or drag files in; attach them to the whole vehicle, a service line or an inspection point; add captions; mark any as internal. Photos are resized and stripped of location data before they’re stored.
- **Customer vehicle report** — a clean, mobile-friendly page with the inspection results, recommendations, work performed, photos and video, and totals. Show it on a counter tablet (customers can approve or decline work there), text/email a **share link** that opens on any phone, or download a single self-contained **report file** (.html) with everything embedded.
- **Labor & parts memory** — add a job to an RO and it shows how often the shop has done it, how long it usually takes and the parts that went into it — on the same model first, then the same make, then any vehicle — from the shop's own repair orders. One tap sets the labor to the usual hours or adds the parts with their last cost and vendor.
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
- **Messages** — one inbox for texts, emails and portal replies per customer, with templates and merge fields (estimate ready, status update, ready for pickup, pay request, receipt, appointment reminder, service reminder, declined-work follow-up, review request, win-back). Texts and emails open in the shop phone’s Messages / Mail app so they come from the shop’s own number and address; customer replies are logged with **Log reply** or arrive automatically from report links. With email set up, emails go out from the shop's own address instead, with the RO as a PDF, and each one shows Delivered, Opened or Bounced.
- **Business texting & calling** — connect the shop's own Twilio number (Settings → Messaging) and the shop gets:
  - **Two-way texting** from the business number: send from Messages, repair orders, report links and follow-ups (in one pass for a whole list); replies, photos and delivery receipts arrive in the conversation live, people who text in for the first time become contacts, and STOP/START is honored.
  - **Calls** that ring every listed phone at once, with a **screen pop** on signed-in devices showing who's calling, their vehicle and open repair order. Voicemail is recorded and transcribed, and a **missed-call text** goes out so the caller can reply instead. Missed calls you haven't returned are flagged on Today and in Messages → Call back.
  - **Click-to-call** from Messages, customers, repair orders and the front desk: it rings your phone first, then connects the customer, who sees the shop's number.
  - An **AI receptionist** (Claude) that answers after hours, when nobody picks up, or every call. It greets known callers by name, tells them where their vehicle is (when the caller ID matches), answers from your hours and notes, takes messages, files appointment requests in Calendar → Requests, texts the booking link or directions, and transfers to a person on request. Each call is summarized in Messages with its transcript.
  - **Automatic texts**: appointment confirmations, day-before reminders (sent by the server even when no device is open, never 9 PM–8 AM) and an optional after-hours auto-reply.
- **Payments** — record card, cash, check, ACH, financing, warranty and fleet payments with tips and an optional card surcharge; text-to-pay links through the shop’s own Stripe, Square, PayPal, Venmo or Cash App account; Stripe card readers at the counter that put the payment on the RO when the card is approved; receipts by text or email.
- **Online card payments (Stripe)** — connect the shop's own Stripe account (Settings → Payments & financing):
  - Payment requests and ready-for-pickup texts carry a secure pay link for the exact balance, made on the spot; the RO's payment card can copy or send one too.
  - The customer's pay page shows the shop, the RO and the amount, then hands off to Stripe Checkout: cards, Apple Pay and Google Pay, Link, ACH, and pay-over-time with Affirm, Klarna or Afterpay when they're turned on in Stripe.
  - Live status pages show a Pay button that always matches the current balance.
  - Payments land on the repair order by themselves, with the card, last four digits and Stripe's fee. The RO closes when it's paid in full, staff get a "payment received" notice, and fees show in the P&L.
  - The owner or a manager can refund part or all of a payment from the RO.
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
- **QuickBooks Online sync** — connect the shop's QuickBooks company (Accounting → QuickBooks & exports) and each day's sales, payments, sales tax, tips, surcharges and Stripe fees post as one balanced journal entry (SALES-YYYYMMDD). Choose which QuickBooks account each line posts to (suggested from your chart of accounts), post any period by hand, or turn on daily posting of the last week through yesterday. Posting a day again updates its entry, so nothing is ever doubled.
- **Connected cars** — text a customer a link to connect their car (Smartcar); with their OK the vehicle page shows its real odometer, oil life, tire pressures and fuel or charge. The vehicle's mileage stays current, low oil life and low tires are flagged, and oil-change reminders go out when the car says so.
- **Marketing** — automations that line up today’s follow-ups (appointment confirmations, day-before reminders, review requests, service due, declined work, win-back) with sent and coming-up counts; vehicles due for an oil service (by time or projected mileage), declined work to follow up, lapsed customers to win back, review requests after closed visits, and custom campaigns by tag, make or last visit. Send personalized texts or emails all at once from the business number or the shop's email address, one tap at a time from the shop phone, as one BCC email, or export the list for a bulk texting/email service.
- **AI assistant** — an *Assistant* button on repair orders, *Suggest reply* in Messages and *Summarize with AI* on customers. It drafts a plain-English explanation of the estimate grouped by urgency, a status text, a reply to the customer's latest message, the cause & correction for a service (from the tech's notes and the inspection), diagnostic ideas and a test plan for the tech, a customer summary for the advisor, or answers any question about the record on screen. Answers go into the message composer, onto the service, or into an internal note; staff review everything before it reaches a customer. It runs on Claude through the shop's own Anthropic API key (see [Integration keys & the AI assistant](#integration-keys--the-ai-assistant)).
- **Your website & booking button** — link the shop's own website and add a *Book online* button to it (**Settings → Website**): the shop's booking link, a copy button and a ready-to-paste `<a href="…">Book online</a>` snippet. The button opens the shop's booking page, whose requests land in **Calendar → Requests** to confirm. Customer pages (booking, status, payment, check-in, fleet portal, lobby screen, reports and PDFs) lead with the shop's own name; a small *Powered by WPI Driveline Shop Management System* line sits at the bottom.
- **Roles & access** — staff profiles for owner, shop manager, service advisor and technician with optional 4-digit PINs; each role sees only the pages it needs (switch people from the sidebar).
- **Integrations** — Shop Cloud, the AI assistant (Claude), business texting & calls (Twilio), online card payments (Stripe), QuickBooks Online sync, connected cars (Smartcar), online booking, Google reviews, payment links, financing, PartsTech / Nexpart / WORLDPAC ordering with POs, NHTSA, calendar (.ics) export for Google/Apple/Outlook, CARFAX service history, and data import.
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

**It comes preconfigured.** The app ships connected to the *AutoShop Pro* Supabase project (its name from before the rebrand to WPI Driveline Shop Management System; the project keeps that name) (`src/lib/cloudDefaults.js`): a public-read `autoshop-media` Storage bucket (photos, video and report files, 50 MB per file) and a `shop_inbox` table. Customers can only *add* booking requests, approvals and messages to the inbox; reading or clearing it, and uploading, replacing or deleting files, require a signed-in account whose `app_metadata.autoshop_staff` flag is set (checked by `public.is_shop_staff()` in every policy). Staff just sign in under **Settings → Shop Cloud** on each device; the first staff sign-in publishes the booking page, and passwords can be changed from the same screen. A signed-in account without the staff flag is warned and gets no access.

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

### Two-step sign-in

Anyone can protect their login with an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password, Authy or the phone's built-in password app) under **Settings → Shop Cloud → Two-step sign-in**: scan the QR code, enter the 6-digit code, done. From then on, signing in on a new device asks for the code after the password.

- **It's enforced on the server, not just the screen.** Someone who uses two-step sign-in can reach the shop's data, files and every server function only with a session that used the code (Supabase Auth's "aal2"). A stolen password alone gets nothing (`shop_mfa_ok()` inside `is_shop_staff()`, plus a check in each Edge Function).
- **The owner can require it** for any role (e.g. owner and manager, who can see the books, take refunds and change keys). People in a required role set it up at their next sign-in; anyone already signed in is shown a banner and can't reach the shop's data until they do.
- **Lost phone:** the owner resets it under **Team → Staff & access**, which also shows who uses two-step sign-in.
- Supabase's leaked-password check (rejecting passwords found in known breaches) is a project setting in the Supabase dashboard (Authentication → Policies), available on paid plans.

### Integration keys & the AI assistant

**Settings → Keys & AI** (owner; managers can view) stores the shop's integration keys on the Shop Cloud server, encrypted in [Supabase Vault](https://supabase.com/docs/guides/database/vault). After saving, a key is never sent back to any device — the screen shows only that it's set, its last four characters and when it changed. The same screen holds the Twilio keys for business texting & calls, the Resend key and sending address for email, the Stripe key for online payments, the Intuit app keys for QuickBooks Online and the Smartcar keys for connected cars.

- `shop_secret_set` / `shop_secret_get` / `shop_secret_list` (`supabase/migrations/20261003120000_secrets_and_ai.sql`) wrap Vault and can only be called by the service role — the browser can't read a key even with a staff login.
- The `shop-secrets` Edge Function lets the owner set or remove keys from an allowlist and returns status only; the AI model and monthly limit are plain settings.
- The `shop-ai` Edge Function runs each assistant task with a fixed instruction and the shop data for that screen (repair order, conversation or customer history — never customer email, phone or payment details), calls the Anthropic Messages API with the shop's key, and counts requests per month in `shop_ai_usage` so the owner can set a limit. Shop data is wrapped as information only, so instructions inside a customer's message aren't followed.
- To turn it on: create an API key at [console.anthropic.com](https://console.anthropic.com) (usage is billed to the shop's Anthropic account), paste it into **Anthropic API key**, and optionally pick the model (Claude Opus 5.5 by default, the most capable; Sonnet 5.5 and Haiku 4.5 are faster and cheaper) and a monthly request limit.

### Business texting & calling (Twilio)

Texts and calls run on the shop's own Twilio account (billed by Twilio per text and minute). Setup:

1. Buy (or port) a number with texting and voice in the [Twilio console](https://www.twilio.com/console).
2. Save the Account SID, Auth token and number in **Settings → Keys & AI**.
3. Choose **Connect** in **Settings → Messaging**. The `shop-phone` Edge Function checks the keys and points the number's texting, calling and call-status webhooks at the `twilio-webhook` function.
4. Register the number for business texting. Local numbers need **A2P 10DLC** registration and toll-free numbers need **toll-free verification**. U.S. carriers block unregistered business texts; calls work right away.

How it fits together (`supabase/migrations/20261004120000_business_phone.sql`):
- **`twilio-webhook`** (`supabase/functions/twilio-webhook`):
  - Checks every Twilio request against its `X-Twilio-Signature`.
  - Handles calls end to end: ringing the listed phones, voicemail, the receptionist, transfers and the missed-call text.
  - Copies picture messages and voicemail into the private `autoshop-files` bucket.
- **`shop_phone_events`**: what happened (texts, receipts, calls, server-sent texts). Signed-in devices pick these up over Realtime, with polling as a fallback, and file them into conversations. Ids come from Twilio's, so two devices never file the same text twice. A ringing call drives the screen pop.
- **Receptionist profile**: the receptionist reads `phone/profile.json` in the private bucket, which signed-in devices republish whenever something in it changes. It contains:
  - hours, address and services
  - the receptionist settings and notes
  - a small caller directory: phone number, first name, open repair orders' status and promised time, and the next appointment
- **The receptionist's replies** use Twilio speech recognition and text-to-speech, with Claude choosing what to say through structured output. The model defaults to Claude Haiku 4.5 for quick replies on a live call; Sonnet 5.5 and Opus 5.5 are available.
- **AI usage**: replies and call summaries count toward the AI monthly limit.
- **Scheduled texts**: devices queue appointment confirmations and reminders in `shop_sms_outbox` (keyed by appointment and date, so every device queues the same rows and rescheduling replaces them). A pg_cron job checks every minute and calls the webhook's dispatcher only when something is due. The dispatcher:
  - skips numbers that replied STOP (`shop_sms_optouts`)
  - moves anything due between 9 PM and 8 AM to 8 AM
  - drops anything more than six hours late

### Email from the shop's address (Resend)

Customer emails (estimates, invoices, receipts, updates and campaigns) can go out from the shop's own address through the shop's [Resend](https://resend.com) account, with the RO attached as a PDF. Resend has a free tier and paid plans above it. Setup:

1. Create a Resend account and an API key with sending access.
2. Save the key and the address to send from (e.g. `Main Street Auto <service@mainstreetauto.com>`) in **Settings → Keys & AI**, plus an optional reply-to address.
3. Under **Settings → Messaging → Email from your shop's address**, add the domain and put the DNS records it lists where the domain is managed, then choose **Check DNS records**. Until the domain is verified, emails keep opening in the device's Mail app.
4. For delivery tracking, add a webhook in Resend for *delivered, bounced, complained, opened* and *delivery delayed*, pointing at the address shown there, and save its signing secret in Keys & AI.

How it fits together (`supabase/migrations/20261008120000_shop_email.sql`):
- **`shop-email`** sends one email at a time with the shop's branded layout and the plain text as written, checks the domain's DNS status, sends a test, and sends the daily summary.
- **PDFs** (`src/lib/pdf.js`) are made in the browser with [pdf-lib](https://pdf-lib.js.org), which loads only when a PDF is made. They have the same content as the print view: estimate, work order, invoice, or receipt once paid. The print view and the email composer can also download them.
- **`email-webhook`** checks Resend's signature (Svix, with a five-minute replay window) and records each delivery event in `shop_email_events`. Signed-in devices pick these up over Realtime, with polling as a fallback, and mark the message Delivered, Opened, Delayed, Bounced or Marked as spam. A bounce or spam complaint flags the customer's address, and bulk sends skip flagged addresses.
- **Daily summary**: owner and manager devices keep today's numbers in `shop_digest`, at most every 10 minutes and only when they change. A pg_cron job checks each hour and emails the summary at the hour the owner picked, in the shop's time zone. It covers sales, money collected, car count and ARO, what's in the shop, open estimates, receivables, tomorrow's appointments and anything that needs attention. If no device was open that day, the email says so instead of sending old numbers.

### Online payments (Stripe)

Payments go straight to the shop's own Stripe account at Stripe's rates. Setup: paste the secret key (`sk_test_…` to try it, `sk_live_…` for real) in **Settings → Keys & AI**, then choose **Connect Stripe** under **Settings → Payments & financing**. The `shop-pay` Edge Function checks the key, registers the `stripe-webhook` endpoint in the shop's Stripe account and saves its signing secret to Vault, so there's nothing to copy from the Stripe dashboard.

How it fits together (`supabase/migrations/20261005120000_online_payments.sql`):
- **Pay links** (`shop_pay_links`) are random 12-character ids for one repair order's balance, opened at `/app/pay/<id>`. Making a new link for an RO voids the old one, so a customer can't pay a stale amount.
- **`pay-link`** (public) tells the pay page what the link is for and starts Stripe Checkout, or resumes the open one. It uses the payment methods enabled in the shop's Stripe dashboard.
- **`stripe-webhook`** verifies Stripe's signature (with a five-minute replay window) and records each payment in `shop_pay_events`, with the card brand, last four digits and Stripe's fee. Bank payments are recorded once they clear; refunds are recorded as cumulative totals.
- **Devices** pick up payment events over Realtime (with polling as a fallback) and add them to the repair order. Stripe's payment id is the payment's reference, so nothing is recorded twice.
- **Card readers at the counter** (Stripe Terminal, server-driven): the owner adds a Stripe smart reader (Stripe Reader S700 or BBPOS WisePOS E, bought from Stripe) under **Settings → Payments & financing** with the pairing code from the reader's screen; in test mode there's a simulated reader. **Take payment** on an RO then sends the amount, with the tip and any surcharge, to the reader. The customer taps, inserts or swipes, and the payment is captured and recorded on the RO with the card, the reader and Stripe's fee. `shop-pay` captures it when the counter's screen sees the approval; `stripe-webhook` (`payment_intent.amount_capturable_updated` / `payment_intent.succeeded`) does the same if nobody is watching, and the payment intent id keeps it from being recorded twice. A declined card can be retried, and Cancel clears the reader. The first reader creates a Terminal location from the shop's address. Bluetooth readers and Tap to Pay on a phone need Stripe's mobile SDKs, so they aren't supported in the web app: record those payments by hand.

### QuickBooks Online

The app posts to QuickBooks through the shop's own Intuit app, so the shop's books are never shared with anyone else's. Setup (about ten minutes):
1. Create an app at [developer.intuit.com](https://developer.intuit.com/app/developer/dashboard) with the **Accounting** scope.
2. Under *Keys & credentials → Redirect URIs*, add the address **Accounting → QuickBooks & exports** shows (`…/functions/v1/oauth-callback`).
3. Paste the Client ID and Client secret in **Settings → Keys & AI**, then choose **Connect to QuickBooks** and approve.

A new Intuit app's development keys connect to a free **sandbox** company right away. To connect the shop's real company, Intuit asks the app's owner to fill in its production-keys questionnaire (links to a privacy policy and terms, and how the app uses data) and then switch to the production keys — plan for that review before going live. The CSV exports keep working with any version of QuickBooks meanwhile.

How it fits together (`supabase/migrations/20261006120000_quickbooks_connected_cars.sql`):
- **`shop-qbo`** (owner or manager) starts the connection, lists the chart of accounts and posts journals. Tokens live in Vault and are refreshed as needed (Intuit rotates refresh tokens; the new one is saved each time). Disconnecting revokes them.
- **`oauth-callback`** (public) finishes the sign-in. A random one-time state value ties it to the request that started it and expires after 30 minutes.
- **Journals** are built on the device from the RO and payment records (`salesJournals` in `src/lib/accounting.js`, the same entries as the CSV). Sales post on the invoice date (accrual); payments post on the day received to Undeposited Funds; Stripe's fee is booked to card processing fees so deposits match the bank. Receivable lines use a customer named "AutoShop Pro daily sales" (the name from before the rebrand, kept because companies that already post look the customer up by that name). Unbalanced or unmapped entries are refused, and each day is matched by its DocNumber, so a re-post updates instead of duplicating.
- **Daily posting** runs on the first owner or manager device open each day and records the outcome on the Accounting screen.

### Connected cars (Smartcar)

Connected cars read data from a car maker's connected services through [Smartcar](https://smartcar.com), with the vehicle owner's consent. Setup: create an application in the [Smartcar dashboard](https://dashboard.smartcar.com), add the redirect URI shown in **Settings → General → Connected cars**, and paste the Client ID and Client secret in **Settings → Keys & AI**. *Simulated* mode connects Smartcar's test vehicles for a trial run.

- From the vehicle page, **Send connect link** texts the owner a link (`oauth-callback?go=…`, good for 7 days) that opens Smartcar Connect. They sign in to their maker's account and approve read-only access: vehicle info, VIN, odometer, oil life, tire pressure, fuel and battery — no unlocking, starting or location.
- **`shop-cars`** (staff) keeps each car's tokens in `shop_connected_cars` (never sent to a device), reads the car in one batch request, and disconnects it on request. The vehicle record keeps the latest reading, so every device and the service reminders can use it.
- Be upfront with customers and with yourself about coverage: Smartcar is a paid service beyond its free developer tier, which readings are available depends on the make, model and year (most 2015-and-newer cars from the larger brands), and the owner needs an active account with the maker's app. Readings a car doesn't share show as "—". Owners can disconnect anytime from their maker's app or by asking the shop.

**Using a different Supabase project** (e.g. one per shop): open *Connection details* in **Settings → Shop Cloud**, paste the Project URL and anon key, create the bucket, and run the setup SQL shown there — it creates the same staff function, storage policies and inbox table.

With it connected:
- **Share links** for vehicle reports with photos and video. Only items marked “Customer can see” are uploaded; links use random 22-character IDs and can be updated or turned off (which deletes the files).
- **Online approvals & replies** — customers approve or decline work with a signature, or send a message, from the report; it arrives in the shop’s inbox and is applied to the RO automatically while a staff member is signed in.
- **Self check-in** publishes `site/checkin.json` (shop name, hours, wording, the diagnosis limit and the inbox address — no customer data). Check-ins arrive in `shop_inbox` as kind `checkin` (`supabase/migrations/20261002120000_inbox_checkin.sql`) and become repair orders on the next signed-in device; the ids come from the inbox row, so two devices can't open it twice.
- **Fleet portals** — each account's portal publishes `fleet/<random id>.json` (units, maintenance status, open ROs, open invoice totals, payments, balance — no line costs, margins or notes), republished by a signed-in device when any of that changes and at least daily for the countdowns.
- **Live status pages** — each tracked RO publishes a small `track/<random id>.json` file (shop name and phone, first name, vehicle, status, step times, promised time, service titles, balance due — no prices per line, costs or notes). A signed-in device republishes it when something the page shows changes; turning it off replaces the file with a notice.
- **Online booking** shows real open times (business hours minus booked appointments, up to the capacity you set) and requests arrive in Calendar without the customer texting. The booking page republishes itself when the calendar changes.

Without Shop Cloud, shops can still show reports on a counter tablet, send the downloadable report file, and take booking requests by text or email from the booking page.

## Marketing website

`website/` is the static marketing website for WPI Driveline Shop Management System: a home page that follows one car through a shop day, an all-features directory and 12 feature pages, iPhone & iPad, security, integrations (`works-with.html`, which also defines Shop Cloud), about, questions & answers, *Request a demo*, privacy and a not-found page. Every page is a standalone HTML file with no build step; `website/README.md` covers the page template, the honesty rules for mockups (example data only inside figures tagged *Example · sample shop*), the motion budget and animations, and how to edit.

- **Sync and check.** Shared regions (head, header and mega menu, tab bar, More sheet, CTA band, footer, structured data, feature lists) come from `website/business.json` and `website/partials/` (`features.json` is the site map). After editing either, run `node website/scripts/sync.mjs`; `node website/scripts/check.mjs` validates every page (links, ids, brand and honesty rules), and `--release` turns launch warnings into errors. `npm run build:pages` runs the check first and stops on errors.
- **Animations** live in `assets/css/site.css` and `assets/js/site.js`: mock app screens that play while they're on screen (at most twice, with a Replay button), a car travelling the five stages of a shop day, rolling counters and scroll reveals. Each page has a motion budget, and every animation has a static end state that shows with Reduce Motion, without JavaScript, in print and with the site-wide *Pause animations* toggle.
- **Request a demo** (`demo.html`) is the one form. It posts to the Shop Cloud inbox (`shopInbox` in `business.json`) as a website message; a signed-in app on that Shop Cloud turns it into a customer tagged *Website* with the request in **Messages**. If the inbox can't be reached it tries `formEndpoint`, then Netlify Forms, and otherwise offers a pre-filled email when `business.json` has an address. Nothing typed is lost.
- **Sample shop and sign-in.** *Try the sample shop* opens `app/` (on a device with no saved shop that is Main Street Auto Service, a made-up sample shop, with a banner offering *Request a demo* and *Start over*), and *Sign in* goes to `app/signin`. Links into the app are relative and marked so they're never prefetched or prerendered (that would boot the app and seed the sample shop on a hover).
- **Hosting.** `npm run build:pages` (`scripts/pages.mjs`) builds the app into `dist/app/` and copies the website to `dist/`. GitHub Pages serves one `404.html` for every missing path; it is the app shell, so deep links into the app load directly, and a small script forwards pages of the old shop website (`services/…`, `appointment`, `contact`, `fleet` and the rest, to the matching product page), links from before the app moved under `app/` (e.g. `/automotive/orders`) and `/site`, and sends unknown pages to the website's not-found page. Netlify gets the old-page forwards as real 301s (`netlify.toml`). Website pages and folders never use an app route's name (`integrations`, `book`, …), because hosts serve `<name>.html` for `/<name>` ahead of the forwarder. A self-removing `sw.js` at the root retires the service worker from the old layout.
- **Own domain.** Point the domain at the site, set `siteUrl` and `basePath` (`"/"` at a domain root) in `business.json`, run the sync script, and build with that base (`node scripts/pages.mjs /`).

## Getting service records onto CARFAX

CARFAX doesn’t accept uploads from individual shops. Records reach CARFAX Reports through a data connection set up when a shop enrolls in the free CARFAX Car Care service-shop program ([carfaxserviceshops.com](https://www.carfaxserviceshops.com/)); integrated shop systems then send each closed RO automatically. **Integrations → Vehicle history** explains the steps and exports a service-history CSV (VIN, year/make/model, date, odometer, RO number, service performed, shop name/address/phone) for any date range to hand to CARFAX’s onboarding team. ROs without a 17-character VIN are skipped and counted so they can be fixed.

## Design

The WPI Driveline logo in light hues: navy "WPI" over a blue and a green bar, with DRIVELINE beneath. The logo's navy is the ink, its blue is the accent for actions, links and the current page, and its two-tone bar is the signature line — on tabs, section labels, the Today card, customer page headers, PDFs and emails. Surfaces stay light: a pale blue-grey canvas, white cards, a near-white sidebar and a faint blue-green wash at the top of each page. A few cool hues (blue, periwinkle, cyan, green) tell the sidebar sections and icon tiles apart, only as light tints and hairlines, never large blocks. Green / amber / red are reserved for status and appear only as dots and small pills. Monospaced section labels, chart colors checked for color-blind separation, San Francisco on Apple devices with Inter elsewhere, light appearance by default with an optional dark mode, a ⌘K / Ctrl+K command palette, and layouts that work from phone to desktop.

The logo lives in `src/brand/artwork.js` as outlined glyphs (the in-app `<Logo>` draws from it); `node scripts/brand-assets.mjs` regenerates the website's logo files, every app and website icon, the favicons, the link-preview image and the iOS launch screens from it.

Every page loads on demand, so the first screen appears quickly on a shop tablet; the pages used all day are fetched in the background right after, and React lives in its own long-cached file so an update only downloads the app's own code. The sample shop (Main Street Auto Service, made up) loads only on a device with no saved shop.

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

Links to suppliers and OEM sites open their own pages; nothing is scraped. The sample shop's customers, phone numbers (555-01xx) and emails (`.example`) are fictitious. Always confirm part fitment by VIN.

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

Deploys to GitHub Pages via `.github/workflows/deploy.yml` (`npm run build:pages`). Netlify serves the same site (`netlify.toml`): it runs the same build, and `scripts/netlify.mjs` places it under `/automotive/`, where its pages link. The bare domain forwards there, and deep links into the app open the app.

### Tests

```bash
npm run test:unit        # app logic (sync merging, pay periods, PDFs)
npm run test:functions   # every Supabase Edge Function, with Supabase, Twilio, Anthropic, Stripe, Resend, Intuit and Smartcar mocked
npm run build:pages && npm run test:e2e   # browser suites against the built site
npm test                 # all of it
```

- **Browser suites** (`tests/e2e/`) drive the real built app in Chromium against an in-memory stand-in for the shop's Supabase project (`tests/support/fakecloud.mjs`), so they need no accounts or network. They cover every area of the app, including a light, dark and phone-size visual tour of each screen.
- Run one or a few by name, e.g. `node tests/run.mjs --e2e online-payments phone-texting`. Screenshots, downloads and logs land in `test-results/`.
- Chromium comes from `CHROMIUM_PATH`, a `PLAYWRIGHT_BROWSERS_PATH` folder, or `npx playwright-core install chromium`.
- **CI** (`.github/workflows/ci.yml`) runs lint, the build, the logic and server-function tests, and the browser suites in four parallel groups on every pull request; screenshots and logs from a failed group are attached to the run.
