# Components: WPI Driveline Shop Management System website

The shared visual and motion system lives in two files: `assets/css/site.css` and `assets/js/site.js`.
This file is the page builder's reference. Copy the markup exactly. You should not need to read the CSS.

Contents

1. [Ground rules](#1-ground-rules) (brand, honesty, motion budget, numbering)
2. [Foundations](#2-foundations) (tokens, type, layout, sections, buttons, chips)
3. [Site chrome](#3-site-chrome) (header, lane car, mega menu, tab bar and sheet, footer, Pause toggle, CTA road band, head)
4. [Heroes](#4-heroes) (home hero, page hero, Hero entrance, breadcrumbs)
5. [Mock figures](#5-mock-figures) (mock-figure, mock-tag, page-hero-art, Replay)
6. [Mock player](#6-mock-player-data-play--data-seq) (`data-play`, `data-seq`, `data-at`, `data-until`, `data-path`)
7. [Reveal sequence](#7-reveal-sequence-data-reveal-seq) and [Reveal accents](#reveal-accents)
8. [Sequence effects (`data-fx`)](#8-sequence-effects-data-fx)
9. [App card stage](#9-app-card-stage) (tilt, sheen, deal, pair, trio)
10. [Device frames and mock parts](#10-device-frames-and-mock-parts)
11. [Scenes](#11-scenes) (today, board slide, phone thread, checklist and gauge, invoice and reader, timeline, ledger, scan)
12. [Small motion parts](#12-small-motion-parts) (Rolling counters, Slot roll, Stamp, Live dot, Data flow line)
13. [App notification chips](#13-app-notification-chips-float-note-and-data-cycle) (`.float-note`, `data-cycle`)
14. [Scroll reveal](#14-scroll-reveal)
15. [RO journey road](#15-ro-journey-road-roadmap)
16. [Ticker](#16-ticker)
17. [Cards, lists, callouts](#17-cards-lists-callouts) (feature cards, promise grid, Good to know, signal list, ro-card, name rows, pills)
18. [Hover and press](#18-hover-and-press)
19. [Bottleneck finder](#19-bottleneck-finder-featureshtml) (features.html)
20. [Directory and role filter](#20-directory-and-role-filter-featureshtml) (features.html)
21. [Scroll-spy pills](#21-scroll-spy-pills) (directory, security sub-nav, faq topics, privacy contents)
22. [Concern lamps](#22-concern-lamps-featuresdiagnosishtml) (features/diagnosis.html)
23. [Tabs and accordions](#23-tabs-and-accordions)
24. [Forms and the gear shifter](#24-forms-and-the-gear-shifter-demohtml) (demo.html)
25. [Page transitions](#25-page-transitions)
26. [Illustration kit and keyframes](#26-illustration-kit-and-keyframes) (art-* classes, key-tag art, migrated keyframes)
27. [Reduce Motion, Pause, print and no-JS](#27-reduce-motion-pause-print-and-no-js)
28. [JS API and events](#28-js-api-and-events)
29. [Renamed and removed](#29-renamed-and-removed)

---

## 1. Ground rules

**Brand**

- Use the full name **WPI Driveline Shop Management System** in body copy. Use "WPI Driveline" alone only in the © line and short labels.
- Use light hues only. Never add a dark band or a dark device bezel.
- `#1F7AE0` (blue) and `#2DB36A` (green) are for fills, bars, dots and strokes only. **Never use them for text.**
- Text colours:
  - body text: `--ink`, `--ink-2` or `--ink-3`;
  - blue status text and links: `--accent`, or `--accent-ink` on tints;
  - green status text: `--green-ink`.

**Honesty (check.mjs enforces most of this)**

- Example data must sit inside a `figure.mock-figure` that has a visible `<span class="mock-tag">Example · sample shop</span>`. Example data means names, amounts with cents, times, counts, VINs, plates and key suffixes. It may also sit in an `.roadmap` whose `ol` aria-label contains "Example", or in the float-notes inside such a figure.
- Inside a `.mock-figure`:
  - Never put `h1`-`h6`, `a`, `input`, `select`, `textarea` or a `button`. The one exception is `button.mock-replay`.
  - Build mock "buttons" and "headings" as `span`/`div` (`.mock-btn`, `.mock-title`).
- Data-free art goes in a plain `figure.page-hero-art[data-play]` with no tag.
- Never print RO numbers.
- Third parties are text only (`.provider-pill`), never logos.
- Standalone counters (outside a mock) may show only these built-in facts: 435, 4,073, 2027, 725, 37, 14, 6.

**Motion budget per page**

- One sequenced hero scene.
- At most two other Mock-player sequences.
- Everything else uses Scroll reveal, a Reveal sequence or Reveal accents, the RO journey road, Rolling counters (once), tabs and Hover and press.
- Loops stop on their own: `data-loops` is at most 2 (heroes 2, sections 1).

**Step numbering.** The page specs count steps from 1. The markup counts from 0. Spec step 1 is `data-at="0"`, and spec step 4 of 4 is `data-at="3"`.

**Never** write new page-wide keyframes for something in this file. Page-local keyframes are allowed only when they are single-use, inline in the page, and slug-prefixed (e.g. `fleet-convoy-bob`). Every animation name you reference must exist in site.css or in your inline `<style>`.

---

## 2. Foundations

### Tokens (light only; do not redefine)

| Token | Use |
|---|---|
| `--canvas` #F5F9FE | page background |
| `--paper` #FFF | cards |
| `--mist-50` / `-100` / `-200` / `-300` | tints, hairlines, tracks |
| `--blue-50` / `-100`, `--green-50` / `-100` | soft fills |
| `--ink` #0F2B4C, `--ink-2`, `--ink-3` #52637B, `--ink-4` | text (ink-3 is AA on canvas) |
| `--blue` #1F7AE0, `--green` #2DB36A | **fills only** |
| `--accent` #1A6FD6, `--accent-ink`, `--green-ink` #188048 | blue / green **text** |
| `--warn`, `--stop`, `--ok` (+ `-soft`) | status text on soft fills |
| `--dot-ok` / `--dot-warn` / `--dot-stop` / `--dot-info` | status dots (fills) |
| `--bar` / `--bar-v` | the two-tone signature bar (horizontal / vertical) |
| `--wash` | pale blue→green panel gradient |
| `--shadow-1/2/3`, `--r-xs…--r-xl`, `--pill` | depth and radii |
| `--ease`, `--ease-in-out`, `--spring`, `--dur-1/2/3` | motion |
| `--header-offset`, `--edge-left/right`, `--gutter` | layout and safe areas |

### Type

```html
<p class="eyebrow">One car, one day</p>          <!-- uppercase, the two-tone bar in front -->
<h2>Heading <span class="accent-text">accent phrase</span></h2>   <!-- one accent phrase, bar draws under it -->
<p class="lead">Lead paragraph.</p>
<p class="fine-print">Uses <a href="works-with.html#shop-cloud">Shop Cloud</a>.</p>
<div class="prose">…long text…</div>
<span class="mono">P0301</span>  <span class="kbd">⌘K</span>
```

An eyebrow that starts with an `.icon` or an `.icon-tile` drops the bar. The feature hero eyebrow uses this.

### Layout and sections

```html
<section class="section" id="…" aria-labelledby="…-title">           <!-- canvas -->
<section class="section section-tint" …>  <!-- mist-50 -->    <section class="section section-paper" …>  <!-- white -->
<section class="section section-wash" …>  <!-- pale wash -->  <section class="section-sm" …> <!-- less padding -->
  <div class="container">            <!-- add .container-narrow for 820px text columns -->
    <div class="section-head" data-reveal>
      <p class="eyebrow">…</p><h2 id="…-title">…</h2><p class="lead">…</p>
    </div>
    …
  </div>
</section>
```

- Head with a link on the right: `<div class="section-head-row" data-reveal><div class="section-head">…</div><a class="link-arrow" href="…">All features <svg class="icon" aria-hidden="true"><use href="#i-arrow-right"/></svg></a></div>`.
- Split (copy + mock): `<div class="container split">…copy…, …figure…</div>`.
  - `split-reverse` puts the second child on the left at 900px and up. Keep the copy first in the source.
  - `split-wide-left` and `split-wide-right` set 1.15 : .85 widths.
- Copy column: `<div class="section-copy" data-reveal="left">` stacks eyebrow, h2, paragraphs, `.fine-print` and a `.link-arrow` with the right gaps.
- Grids: `.grid.grid-2`, `.grid.grid-3` (an odd last card spans at 640–959px) and `.grid.grid-4`.
- Utilities: `.stack` (`--stack` gap), `.cluster` (`--cluster` gap), `.mt-0…mt-5`, `.divider`, `.center`, `.muted`, `.nowrap`, `.visually-hidden`.
- Sections with a road need no extra work: `.section-tint`, `.section-paper` and `.section-wash` set `--roadmap-bg` for you. Set it inline only on a custom background.

### Buttons and links

```html
<a class="btn btn-primary btn-lg" href="demo.html">Request a demo</a>
<a class="btn btn-secondary btn-lg" href="{{root}}app/" data-no-prerender>Try the sample shop</a>
<button class="btn btn-soft btn-sm" type="button">…</button>   <!-- also .btn-ghost, .btn-block -->
<a class="link-arrow" href="…">Learn more <svg class="icon" aria-hidden="true"><use href="#i-arrow-right"/></svg></a>
<button class="icon-btn" type="button" aria-label="Close"><svg class="icon" aria-hidden="true"><use href="#i-close"/></svg></button>
```

- Groups: `<div class="hero-actions">` (full width below 480px), then an optional `<p class="hero-note">…</p>`.
- Busy state: JS adds `.is-loading` to a `.btn` and shows a spinner.
- **Every link into `app/` carries `data-no-prerender`.**

### Chips, badges, pills, dots

```html
<span class="chip"><svg class="icon" aria-hidden="true"><use href="#i-check"/></svg>Works offline</span>
<span class="chip chip-soft">WPI Driveline Shop Management System</span>
<span class="badge">Owner-only</span>  <span class="badge badge-green">Included</span>
<div class="pill-cloud" data-reveal-stagger> …chips or provider pills… </div>
<span class="provider-pill"><span class="provider-dot"></span>Stripe</span>              <!-- grey dot -->
<span class="provider-pill is-on"><span class="provider-dot"></span>Twilio</span>        <!-- green dot -->
<span class="provider-pill is-builtin"><span class="provider-dot is-on"></span>NHTSA data (built in)</span>
<span class="status-dot is-ok"></span>  <!-- .is-ok .is-stop .is-info .is-idle; default amber -->
```

---

## 3. Site chrome

The chrome comes from partials (`header`, `tabbar`, `footer`, `cta`, `head`, `icons`). Don't hand-edit it in pages. The notes below cover what the CSS and JS expect.

### Partial markers and tokens (sync.mjs)

Every page is a complete HTML document. A region between `<!-- @partial NAME -->` and `<!-- @end NAME -->` is regenerated on every `node scripts/sync.mjs`; write the pair empty (`<!-- @partial related --> <!-- @end related -->`) and run sync. Then run `node scripts/check.mjs` (it also runs before every build and fails it on errors).

| Marker | Where | What it renders |
|---|---|---|
| `head` | every page, after `<title>` and `<meta name="description">` | metas, icons, site.css, site.js, speculation rules, canonical, og:* (from the page's own title and description) |
| `jsonld` | every page, in `<head>` | Organization + SoftwareApplication + WebSite JSON-LD |
| `icons` | first thing in `<body>` | the sprite (`#i-*` symbols, `#art-tint`, gauge gradients, arrow markers) |
| `header`, `tabbar`, `footer` | every page | the chrome; sync marks the current nav entry |
| `cta` | every page except demo, privacy and 404, just before the footer | the CTA road band |
| `breadcrumbs` | `features/*.html`, first in the hero copy | `nav.breadcrumb` + BreadcrumbList JSON-LD |
| `related` | `features/*.html`, in the `#related` section | `div.grid.grid-3.related[data-related]` of three feature cards |
| `featuresCards` | index, inside `#features-grid` | `div.grid.grid-3[data-reveal-stagger]`: twelve feature cards plus a "See every feature" card |
| `finderChips`, `finderData` | features.html `#finder` | the pain chips and the finder JSON (§19) |
| `roleChips`, `featuresDirectory` | features.html `#directory` | the role chips and the directory (§20) |
| `featuresInterests` | demo.html, step "What to see" | twelve interest checkbox cards (§24) |
| `contact-email` | demo.html aside | a `.contact-email` mailto link when business.json has an email, otherwise nothing |

An unknown marker name stops sync. Tokens work in page content as well as partials: `{{root}}` (relative path to the site root), `{{appLink}}` (= `{{root}}app/`; always add `data-no-prerender`), `{{signInLink}}` (a whole `<a>`), `{{name}}`, `{{shortName}}`, `{{company}}`, `{{tagline}}`, `{{email}}`, `{{siteUrl}}`, `{{basePath}}`, `{{year}}`. An unknown token is left in place and check.mjs fails on it. Body keys: `<body data-page="…" id="top">`; feature pages use `data-page="features" data-tab="features"`.

### Header (partials/header.html)

- `a.brand` holds `{{logoInline}}` and `span.brand-tagline`. The tagline always wraps to two lines ("SHOP MANAGEMENT / SYSTEM") and is never hidden.
- Primary nav appears from 1080px. `li.has-menu[data-menu]` holds `a.nav-link`, `button.nav-caret[aria-controls=mega-features]` and `div.mega#mega-features`.
- Header actions:
  - `a.header-signin` (`i-key` icon plus `span.header-signin-text`). It goes icon-only below 600px and from 1080 to 1279px; the accessible name stays.
  - `a.btn.btn-primary.btn-sm.header-book` appears from 1080px.
- `.road-progress` holds `.road-progress-lane` and `svg.road-progress-car`. JS sets `--progress` and `.is-scrolled`.

**Header lane car on home (automatic).** Give each chapter section `data-stage="Check-in"` (and so on, from features.json stages[], in order). site.js then adds:

- one `.lane-tick` per stage;
- a `.road-progress-label` pill showing the current stage's name.

You add nothing else. Ticks and label hide below 600px, under Reduce Motion and in print.

### Mega menu (sync generates `{{featuresMega}}`)

```html
<div class="mega-grid">            <!-- 4 columns, positioned against .header-inner -->
  <div class="mega-col">
    <p class="mega-label">Before the car arrives</p>
    <a class="mega-item" href="{{root}}features/booking.html"><span class="icon-tile icon-tile-sm"><svg class="icon" aria-hidden="true"><use href="#i-calendar-check"/></svg></span><span class="mega-text"><strong>Booking &amp; check-in</strong><small>Real open times, key-drop check-in</small></span></a>
  </div>
  …
</div>
<div class="mega-foot"><p class="mega-note">…Want to click around first? <a href="{{root}}app/" data-no-prerender>Try the sample shop</a></p><div class="mega-actions">…</div></div>
```

Behaviour (site.js):

- the caret toggles it;
- hover opens after 70ms and closes after 200ms;
- Escape closes it and returns focus;
- it closes on focus-out, outside click, pageswap and pagehide;
- it is `inert` when closed;
- without JS it still opens on hover and on keyboard focus (`:focus-within`).

### Tab bar and More sheet (partials/tabbar.html)

- The tab bar shows below 1080px: Home, Features, the raised `.tab-book` / `.tab-book-dot` "Get a demo", iPhone, and More.
- More is `button[data-open-sheet="more-sheet"]`. The sheet is `dialog.sheet#more-sheet > .sheet-panel`, with:
  - `.sheet-grabber`;
  - `.sheet-head`, with h2 `{{name}}` and `button.icon-btn[data-close-sheet]`;
  - `.sheet-quick > a.quick-action` (the first gets `.is-primary`);
  - `.sheet-label`;
  - `ul.sheet-grid`;
  - `ul.sheet-list`;
  - `.sheet-foot` holding the Pause toggle.
- The sheet closes on Escape, a backdrop click or any `[data-close-sheet]`. It closes instantly under Reduce Motion or Pause.

### Footer (partials/footer.html)

- `.footer-grid` holds `.footer-brand` (`a.footer-card` with the logo img and `.footer-card-tagline`, `.footer-blurb`, `p.footer-pill`) and three `.footer-col`s.
- "Talk to us" is `{{contactRow}}`, rendered as `p.footer-talk > a.footer-contact`.
- `.footer-bottom` holds the © paragraph, `p.footer-links` and the Pause toggle.

### Motion pause toggle (WCAG 2.2.2)

sync renders it as `{{motionToggle}}`. Never hand-write a second copy in a page.

```html
<button class="motion-toggle" type="button" aria-pressed="false"><svg class="icon mt-pause" aria-hidden="true"><use href="#i-pause"/></svg><svg class="icon mt-play" aria-hidden="true"><use href="#i-play"/></svg><span class="motion-toggle-label">Pause animations</span></button>
```

- Any `.motion-toggle` toggles the state. All of them update together: `aria-pressed`, and the label "Pause animations" / "Play animations".
- The state persists in `localStorage["wpi-site:motion"] = "paused"`.
- The head partial's inline script adds `html.motion-paused motion-parked` before first paint.
- While paused:
  - loops freeze in place: ticker, CTA road, glow, sheen, live dots, chip float, orbit, gauge idle;
  - one-shot entrances jump to their end frame;
  - Mock player and `data-cycle` timers stop;
  - SMIL arts in `[data-play]` figures pause;
  - tilt is off.
- If the page loads already paused (`motion-parked`), sequences rest on their final frame and the CTA car parks mid-road on "Paid".
- Without JS the toggle is hidden (it needs site.js).

### CTA road band (partials/cta.html; omitted on demo, privacy and 404)

```html
<div class="road" aria-hidden="true">
  <span class="road-status"><span class="road-status-wip">In progress</span><span class="road-status-paid">Paid &middot; RO closed</span></span>
  <div class="road-surface"><span class="road-dashes"></span></div>
  <svg class="road-car" viewBox="0 0 32 14"><use href="#i-car-mini"/></svg>
</div>
```

- `car-drive` runs 14s: the car drives in, pauses mid-screen and exits.
- `road-status` is synced to it and shows "Paid · RO closed" (green dot, `--green-ink` text) during 40–62% of the cycle.
- **Reduce Motion:** the car is parked mid-road, the dashes are static, and the chip reads "Paid".
- **Pause:** frozen in place.

### Head (partials/head.html)

- The speculationrules exclude `{{basePath}}app/*` and `[data-no-prerender]`.
- The site.js hover-prefetch fallback also skips `[data-no-prerender]` and any URL with `/app/`.
- So: **`data-no-prerender` on every app link, always.**

---

## 4. Heroes

### Home hero

```html
<section class="hero" aria-labelledby="hero-title">
  <div class="hero-bg" aria-hidden="true"></div>                    <!-- dot grid + drifting glow -->
  <div class="container hero-grid">
    <div class="hero-in">                                             <!-- Hero entrance: children rise in -->
      <p class="chip chip-soft">WPI Driveline Shop Management System</p>
      <h1 id="hero-title">Every car, from check-in to paid, <span class="accent-text">in one system.</span></h1>
      <p class="lead">…</p>
      <div class="hero-actions">…two buttons…</div>
      <p class="hero-note">Opens Main Street Auto Service, a made-up sample shop, in your browser. No sign-up.</p>
      <div class="hero-trust"><span class="chip">…</span>…</div>
    </div>
    <figure class="hero-visual mock-figure" data-tilt-scope data-play data-seq="4" data-loops="2" data-step="3" data-reached="0 1 2 3" aria-label="Example: the Today screen of the sample shop">
      … see App card stage (§9) and scene-today (§11) …
    </figure>
  </div>
</section>
```

`.hero-visual .float-note` hides below 980px.

### Page hero (every inner page; the feature template)

```html
<section class="page-hero" aria-labelledby="hero-title">
  <div class="page-hero-bg" aria-hidden="true"></div>
  <div class="container page-hero-grid">
    <div class="hero-in">
      <!-- @partial breadcrumbs --> <!-- @end breadcrumbs -->            (features/* only)
      <p class="eyebrow"><span class="icon-tile" style="view-transition-name: ft-inspections"><svg class="icon" aria-hidden="true"><use href="#i-inspection"/></svg></span>Inspections &amp; approvals</p>
      <h1 id="hero-title">Show them what you found, <span class="accent-text">get the yes by phone.</span></h1>
      <p class="lead">…</p>
      <div class="hero-actions">
        <a class="btn btn-primary btn-lg" href="../demo.html?interest=inspections">Request a demo</a>
        <a class="btn btn-secondary btn-lg" href="{{root}}app/orders" data-no-prerender>Open repair orders in the sample shop</a>
      </div>
      <div class="hero-trust"><span class="chip"><svg class="icon" aria-hidden="true"><use href="#i-check"/></svg>…</span> ×3</div>
    </div>
    <figure class="page-hero-art mock-figure" data-play data-seq="5" data-loops="2" data-step="4" data-reached="0 1 2 3 4" aria-label="Example: …final state…">
      … tag, stage, Replay, two float-notes (§5, §13) …
    </figure>
  </div>
</section>
```

- **Hero entrance:** `.hero-in > *` rise in with a 60ms stagger. `.accent-text` draws its bar, and `.hero-bg` / `.page-hero-bg` glow-float.
- `.hero-in` and the first hero's `.card-deal` are exempt from the Mock player gate, so they paint at once.
- The `ft-<slug>` name on the eyebrow icon tile is the **only** static `view-transition-name` on a page. It goes on feature pages only (see §25).
- The breadcrumbs partial emits `nav.breadcrumb > ol > li` (links, then `span[aria-current=page]`). It is styled already.

---

## 5. Mock figures

```html
<figure class="mock-figure" data-reveal="right" data-play data-seq="6" data-loops="1" data-step="5" data-reached="0 1 2 3 4 5"
        aria-label="Example: an inspection checklist and the customer's approval">
  <span class="mock-tag">Example · sample shop</span>
  <div class="mock-stage" aria-hidden="true">
    … the mock (device frame, scene, chips) …
  </div>
  <button class="mock-replay" type="button"><svg class="icon" aria-hidden="true"><use href="#i-replay"/></svg>Replay</button>
  <!-- optional: up to two .float-note chips (§13) -->
</figure>
```

- **`.mock-tag`** sits top-left and **`.mock-replay`** top-right. Both are positioned for you; the figure reserves 42px at the top.
  - The tag is required on every `.mock-figure`. It is visible in every state and in print.
  - The Replay button is only for `[data-seq]` figures. It is hidden without JS, under Reduce Motion and while paused.
- **`.mock-stage`** is always `aria-hidden="true"`. The figure's `aria-label` describes the **final** state and contains "Example".
- Text inside `.mock-stage` defaults to 13px. Never go below 12px; the only exception is the 11px tag.
- **Data-free art:** use `<figure class="page-hero-art" data-play aria-label="Illustration of …">` with an inline SVG or a mock. Add no tag. Add a Replay button only if it has `data-seq`.
- **Small inline mock in a card or tab panel:** `<figure class="mock-figure is-inline" data-reveal-seq aria-label="Example: …">`. The tag sits in flow above the content and no space is reserved.
- Below the stage you may add `<p class="mock-caption">…</p>`.
- Figures never nest.

**Do:**

- put example values only here;
- use spans for buttons and headings;
- keep one sequenced hero per page.

**Don't:**

- put links, real buttons or headings inside;
- use RO numbers;
- show the Stripe or Smartcar test modes as live;
- use a dark bezel.

---

## 6. Mock player (`data-play` + `data-seq`)

### `[data-play]`

`[data-play]` goes on a `figure.mock-figure` or `figure.page-hero-art`.

- One IntersectionObserver (threshold 0.15) adds `.is-playing` while the figure is on screen.
- Until then, **every CSS animation inside the figure is paused**. That includes loops, chip floats, `card-deal` (except in the first hero) and SMIL.
- SMIL (`<animate>`, `<animateMotion>`…) inside the figure is paused and unpaused automatically.
- Give the `<svg>` a `data-smil-rest="4.6"` to choose the frozen frame used under Reduce Motion.

### `[data-seq=N]` (a sequence of N steps)

| Attribute | Default | Meaning |
|---|---|---|
| `data-seq` | required | number of steps N |
| `data-step` | **ship `N-1`** | current step (JS resets to 0 only when it will play) |
| `data-reached` | **ship `"0 1 … N-1"`** | cumulative reached steps (CSS hook) |
| `data-loops` | 1 | heroes 2, sections 1 |
| `data-seq-ms` | 1400 | time per step |
| `data-seq-hold` | 2600 | hold on the last step before looping |

How a run goes:

- Each step reveals its elements.
- After the last step, the player holds. If loops remain, the stage fades out for 300ms, resets to step 0 and plays again.
- After the last loop it **rests on the final step**. It does not replay on scroll.
- The Replay button runs one more pass.
- Timers stop when the tab is hidden, when the figure is off screen, while paused and while prerendering. Print shows the final step.

### Inside the figure

| Markup | Effect |
|---|---|
| `data-at="k"` | element appears (plays its `data-fx`) when step k is reached; hidden before |
| `data-until="k"` | element is visible before step k and gone from step k (pair it with a `data-at="k"` sibling to swap text) |
| `data-fx="…"` | which entrance effect (see §8); default `rise` |
| `data-path="a b b c"` on a `.mock-card` | Board slide: the card moves to the `.mock-col[data-col]` named for each step (§11) |
| `.odometer` / `.slot-roll` with (or inside) `data-at="k"` | rolls when step k is reached, resets on loop |
| CSS `[data-reached~="3"] .thing { … }` | any other step-driven change you need (write it inline, slug-prefixed) |

Example (spec: "1. rows tick, 2. needle settles, 3. stamp lands"):

```html
<figure class="mock-figure" data-play data-seq="3" data-loops="1" data-step="2" data-reached="0 1 2" aria-label="Example: …">
  <span class="mock-tag">Example · sample shop</span>
  <div class="mock-stage" aria-hidden="true">
    <div class="mock-checklist" data-at="0" data-fx="stagger" style="--fx: tick-pop"> …rows… </div>
    <svg class="mock-gauge" …><line class="needle" data-at="1" data-fx="sweep" style="--from:-90deg; --to:-16deg; transform-origin: 60px 60px" …/></svg>
    <span class="stamp" data-at="2">Approved</span>
  </div>
  <button class="mock-replay" type="button"><svg class="icon" aria-hidden="true"><use href="#i-replay"/></svg>Replay</button>
</figure>
```

Steps go up to `data-at="11"`. Keep sequences at 6 steps or fewer.

**Reduce Motion, no-JS and IntersectionObserver missing:** the figure gets `.is-playing.is-final`, shows step N-1 and runs no timers. Without JS, what you shipped (`data-step=N-1`, full `data-reached`) is what shows. So **the markup must always ship the final frame**:

- counters hold their final value;
- `data-until` elements are hidden by the full `data-reached`;
- a `data-path` card sits in its final column.

---

## 7. Reveal sequence (`data-reveal-seq`)

This is the lightweight alternative to the Mock player:

- CSS only, no timers;
- one pass of 5s or less, no loop;
- the final state is the resting state.

```html
<figure class="mock-figure" data-reveal="right" data-reveal-seq aria-label="Example: a key-drop self check-in">
  <span class="mock-tag">Example · sample shop</span>
  <div class="mock-stage" aria-hidden="true">
    <span class="mock-field"><span data-seq-i="0" data-fx="type" style="--chars:10">Sofia C.</span></span>
    <span class="mock-field mock-mono" data-seq-i="1" data-fx="fade"><span class="slot-roll" data-slots="2T3P1RFV7LC159666" data-charset="vin" data-check="8">2T3P1RFV7LC159666</span></span>
    <svg viewBox="0 0 200 50"><path data-seq-i="5" data-fx="draw" pathLength="1" d="…signature…" fill="none" stroke="#0F2B4C" stroke-width="2.2"/></svg>
    <span class="mock-chip is-ok" data-seq-i="7" data-fx="pop">Repair order opened · key tag 14</span>
    <strong data-seq-out="6">$482.01</strong>   <!-- leaves at beat 6 -->
  </div>
</figure>
```

- When the figure gets `.is-in` from Scroll reveal, each `[data-seq-i="k"]` plays its `data-fx` after **k × 450ms**. Use k from 0 to 10.
- `data-seq-out="k"` hides an element at beat k. Without JS it is hidden, matching the final frame.
- Counters and slots inside run once, delayed to their own beat.
- **Tab panels:** a `[data-reveal-seq]` inside a `[role=tabpanel]` replays each time the panel is shown.
- **Reduce Motion, no-JS and print:** every `data-seq-i` element shows in its final state.

<a id="reveal-accents"></a>**Reveal accent** = one single effect on a card. Two ways to do it:

- a `[data-reveal-seq]` wrapper with one `data-seq-i="0"` child;
- just `data-reveal`.

Examples:

```html
<div class="card" data-reveal data-reveal-seq><svg …><path data-seq-i="0" data-fx="draw" pathLength="1" d="…"/></svg> …</div>
<div class="mock-bars" data-reveal-seq><span data-seq-i="0" data-fx="grow-y" style="--h:.4"></span><span data-seq-i="0" data-fx="grow-y" style="--h:.7"></span>…</div>
<ul class="checklist pop-list" data-reveal>…</ul>   <!-- check badges pop in sequence (--n) -->
```

---

## 8. Sequence effects (`data-fx`)

Works on `[data-at]` (Mock player) and `[data-seq-i]` (Reveal sequence). Each effect's start state lives in its keyframe, and the element's own style is the end state.

| `data-fx` | Effect | Notes |
|---|---|---|
| *(none)* / `rise` | fade + rise 10px | default |
| `fade` / `swap` | fade in | `swap`: pair with a `data-until` / `data-seq-out` element |
| `pop` | scale .6 → 1, spring | chips, badges |
| `tick` | `tick-pop` (scale 0 → 1.18 → 1) | check boxes |
| `bubble` | `bubble-in` | message bubbles |
| `left` / `right` | slide in from the left / right | |
| `drop` | drop from above, spring | |
| `draw` | stroke draws (`fx-draw`) | the path needs `pathLength="1"`, solid strokes only |
| `wipe` / `wipe-down` | clip-path reveal left→right / top→bottom | dashed lines, text blocks |
| `grow-x` | scaleX 0 → 1 from the left | progress bars |
| `grow-y` | `bar-grow` (scaleY from 0), with an `--i` × 40ms stagger | chart bars |
| `type` | typed in with steps | set `style="--chars:N"`; optional `<span class="caret"></span>` after |
| `stamp` | `stamp-in` | automatic for `.stamp[data-at]` |
| `press` | dips like a tapped button | visible before |
| `flash` | blinks twice | visible before |
| `pulse` | scales up and fades twice | visible before |
| `ring` | `ring-pulse` × 3 | add class `ring`; rests at size 0 |
| `sweep` | `meter-sweep` | needles: `style="--from:-90deg; --to:30deg; transform-origin: Xpx Ypx"` + class `needle` |
| `feed` | `paper-feed` (clip-path from the top) | invoices, timecards |
| `scan` | `scan-line` sweeps once | on a `.scanline` |
| `flip` | rotateX flip-in | header text change (ESTIMATE → INVOICE) |
| `deal` | `card-deal` | thumbnails dealing in |
| `spin` | rotates −360° once | a restore arrow |
| `shake` | field-error shake | a PO field |
| `flow` | `dash-flow`: a dash travels a path once | on a `.flow-dot` (§12) |
| `toast` | `toast-life` (in, hold 1.2s, out) | on a `.mock-toast` |
| `stagger` | each **child** plays `--fx` (default rise) at `--i` × 90ms | `style="--fx: tick-pop"` or `--fx: bar-grow`, `--fx-stagger: 60ms` |
| `none` | appears without animation | |

Fine-tune timing per element:

- `--fx-dur` (duration);
- `--fx-ease`;
- `--fx-delay`;
- `--fx-n` (iterations).

---

## 9. App card stage

Used on the index hero, index `#customer-pages` and the mobile hero.

```html
<figure class="hero-visual mock-figure" data-tilt-scope data-play data-seq="4" data-loops="2" data-step="3" data-reached="0 1 2 3" aria-label="Example: …">
  <span class="mock-tag">Example · sample shop</span>
  <div class="card-stage mock-stage" aria-hidden="true">     <!-- the stage doubles as the aria-hidden mock-stage -->
    <div class="card-deal">                                  <!-- deals in on load (first hero) or on .is-playing -->
      <div class="app-card" data-tilt="12">                  <!-- light card face; 3D rest tilt; cursor light -->
        <div class="mock-screen"> …app screen content… </div>
        <span class="app-card-sheen"></span>                 <!-- pale blue→green sweep, 6.5s -->
      </div>
    </div>
    <div class="app-card-shadow"></div>
  </div>
  <button class="mock-replay" type="button"><svg class="icon" aria-hidden="true"><use href="#i-replay"/></svg>Replay</button>
  <div class="float-note note-1" aria-hidden="true">…</div>
  <div class="float-note note-2" aria-hidden="true">…</div>
</figure>
```

- **Tilt:**
  - `data-tilt="N"` sets the maximum degrees;
  - it tracks the pointer over `[data-tilt-scope]`;
  - it works on fine pointers only, from 600px up;
  - it is off under Reduce Motion and Pause.
- Device frames tilt too: add class `tilt` and `data-tilt` (e.g. `<div class="mock-phone tilt" data-tilt="8">`).
- **Several cards:** up to three `.card-deal`s, each with `style="--deal-delay: 0ms|120ms|240ms"`. Deeper cards get a smaller `data-tilt`.
  - `.card-stage.is-trio`: three phones; only the centre phone shows below 600px.
  - `.card-stage.is-pair`: a tablet (first `.card-deal`) and a phone (second) that overlaps the bottom-right corner. Use `.mock-tablet.is-auto` so the tablet's height fits its content.
- A data-free stage (mobile hero) uses `figure.page-hero-art[data-play][data-tilt-scope]` with the same inside and no tag.

**Reduce Motion:** the card is flat-ish at rest, with no deal, no sheen movement and no tilt.

The about page keeps `.biz-card` (logo plus `.biz-card-tagline`, `.biz-card-sheen`, `.biz-card-shadow`, inside `.biz-card-stage`). It works exactly as before. The orbit SVG stays inline on about.

---

## 10. Device frames and mock parts

All frames are light: white or mist-100 bezels with a hairline. Put content in a `.mock-screen`.

```html
<div class="mock-window"><div class="mock-screen">…</div></div>        <!-- desktop window, three light dots -->
<div class="mock-window has-sidebar"><div class="mock-screen"><div class="mock-sidebar"><b>Shop floor</b><span>Workflow</span>…</div><div>…</div></div></div>
<div class="mock-phone"><div class="mock-screen">…</div></div>         <!-- 9:18, island; .is-auto = height by content -->
<div class="mock-tablet"><div class="mock-screen">…</div></div>        <!-- 4:3; .is-auto -->
<div class="mock-tv"><div class="mock-screen">…</div></div>            <!-- lobby screen, with a stand -->
```

| Part | Markup |
|---|---|
| App bar | `<div class="mock-appbar"><svg class="mock-logo">…</svg>Today · Main Street Auto Service<small>Kim P.</small></div>` |
| Title / sub / label | `<div class="mock-title">…</div>` `<div class="mock-sub">…</div>` `<span class="mock-label">…</span>` |
| KPI tiles | `<div class="mock-tiles"><div class="mock-tile"><span class="mock-label">Billed today</span><strong>$699</strong><small>2 invoices</small></div>…</div>` (`.mock-tile.is-wash`) |
| Rows | `<div class="mock-rows"><div class="mock-row"><span class="mock-dot is-stop"></span><span>2018 Ford F-150 is past its promise time</span><span class="mock-chip is-stop">Late</span></div></div>` (the label span wraps to 2 lines; a trailing `.mock-chip` / `.mock-value` / `.mock-btn` sits right) |
| Dots | `.mock-dot` (blue) `.is-ok` `.is-warn` `.is-stop` `.is-idle` |
| Status chip | `<span class="mock-chip is-ok">Received</span>` `.is-warn` `.is-stop` `.is-idle`, default blue |
| Button (span!) | `<span class="mock-btn">Send all</span>` `.is-soft` `.is-ghost` `.is-green` |
| Field | `<span class="mock-field">Sofia C.</span>` (`.is-focus`) |
| Toggle | `<span class="mock-toggle is-on"></span>` |
| Segmented control | `<div class="mock-seg" style="--segs:4; --seg:1"><span>After hours</span><span>No answer</span>…</div>` (change `--seg` with `[data-reached~="k"] .x-seg { --seg: 2 }`; it slides with a spring) |
| Meter | `<div class="mock-meter" style="--fill:.6; --limit:.85"></div>` (`.is-solid`, `.is-warn`) |
| Bars | `<div class="mock-bars"><span style="--h:.4"></span>…<span class="is-hi" style="--h:.74"></span></div>` (`.is-green`; add `data-at="k" data-fx="grow-y"` per bar, or `data-fx="stagger" style="--fx: bar-grow"` on the container) |
| Avatar | `<span class="mock-avatar">KP</span>` (`.is-green`) |
| Toast | `<div class="mock-toast">Moved to <b data-toast-col>In Progress</b> · Undo</div>` (Board slide fills and shows it; elsewhere use `data-at="k" data-fx="toast"`) |
| Section title | `<div class="mock-section-title">Needs attention <span>…</span></div>` |
| Hairline | `<hr class="mock-hr">` |
| Mono | `.mock-mono` |

---

## 11. Scenes

These are shared compositions. Pick one and fill it with your page's data. Don't write new keyframes for the same idea.

### scene-today (index hero, workflow #today)

```html
<div class="mock-screen">
  <div class="mock-appbar">…Today · Main Street Auto Service</div>
  <div class="mock-today">
    <div class="mock-tiles">
      <div class="mock-tile"><span class="mock-label">In the shop</span><strong><span class="odometer is-plain" data-odometer="5" data-at="0">5</span></strong><small>7 on the lot</small></div>
      <div class="mock-tile"><span class="mock-label">Awaiting approval</span><strong><span class="odometer is-plain" data-odometer="1899" data-group="," data-prefix="$" data-at="0">$1,899</span></strong><small>3 open estimates</small></div>
      …
    </div>
    <div class="mock-section-title">Needs attention</div>
    <div class="mock-rows" data-at="1" data-fx="stagger"> …2 rows… </div>
    <div class="mock-rows" data-at="2" data-fx="stagger"> …2 rows… </div>
    <div class="mock-section-title">Invoiced, last 14 days</div>
    <div class="mock-bars" data-at="3" data-fx="stagger" style="--fx: bar-grow; --fx-stagger: 40ms"> …14 spans… </div>
  </div>
</div>
```

### scene-board: Board slide (index #ch-work, workflow hero)

```html
<div class="mock-window board-frame"><div class="mock-screen">
  <div class="mock-board">
    <div class="mock-col is-optional" data-col="estimate"><div class="mock-col-head"><span>Estimate</span><span class="mock-count">3</span></div> …cards… </div>
    <div class="mock-col" data-col="approved"><div class="mock-col-head"><span>Approved</span><span class="mock-count">1</span></div> …</div>
    <div class="mock-col" data-col="progress"><div class="mock-col-head"><span>In Progress</span><span class="mock-count">2</span></div> …</div>
    <div class="mock-col is-optional" data-col="parts"><div class="mock-col-head"><span>Waiting on Parts</span><span class="mock-count">1</span></div>
      <div class="mock-card">
        <div class="mock-card-top"><strong>2020 Silverado 1500</strong><span class="mock-avatar">MR</span></div>
        <div class="mock-card-meta"><span>Jordan M.</span></div>
        <div class="mock-card-foot"><span>Services 0/2</span><span class="mock-chip is-warn" data-until="2">Parts on order 1</span><span class="mock-chip is-ok" data-at="2" data-fx="pop">Received</span></div>
      </div>
    </div>
    <div class="mock-col" data-col="ready"><div class="mock-col-head"><span>Ready for Pickup</span><span class="mock-count">3</span></div>
      <!-- The moving card ships in its FINAL column; JS moves it to path[0] when the sequence arms. -->
      <div class="mock-card" data-path="approved progress progress ready ready">
        <span class="mock-done-dot" data-at="4" data-fx="pop"></span>
        <div class="mock-card-top"><strong>2021 Camry SE</strong><span class="mock-avatar">KP</span></div>
        <div class="mock-card-meta"><span>Priya R.</span><span class="mock-chip">10:30 AM</span></div>
        <div class="mock-card-foot"><span>Timer <span class="odometer is-plain" data-odometer="01:12" data-from="00:00" data-duration=".4" data-at="1">01:12</span></span></div>
      </div>
      …
    </div>
  </div>
</div></div>
<div class="mock-toast">Moved to <b data-toast-col>In Progress</b> · Undo</div>   <!-- inside .mock-stage -->
```

How the board behaves:

- **`data-path`:** one column key per step (the last key repeats). At each step the card lifts (scale 1.04, rotate 2°, `--shadow-3`) and springs into the new column over 520ms.
- The column `.mock-count`s update and pop.
- The toast pops with the column's name.
- **Layout:**
  - full width from 900px;
  - from 900 to 1179px, `.mock-col.is-optional` (Estimate, Waiting on Parts) hide;
  - below 700px the frame becomes a light phone showing **one column**, and it pages to the moving card's column.
- **Reduce Motion:** the final layout with no toast.
- Cards show the vehicle, first name and last initial, tech initials, a promised-time `.mock-chip` and services x/y. No RO numbers.

### scene-phone-thread (messaging, AI, ch-approve phone)

```html
<div class="mock-phone"><div class="mock-screen">
  <div class="mock-thread">
    <div class="mock-thread-meta">Today 7:41 AM</div>
    <div class="mock-typing" data-at="0" data-until="1"><i></i><i></i><i></i></div>
    <div class="mock-bubble out" data-at="1" data-fx="bubble">Hi Priya, your Camry is checked in.<span class="mock-linkcard"><b>Main Street Auto Service</b><span>Live status</span></span></div>
    <div class="mock-bubble in" data-at="2" data-fx="bubble">Thanks!</div>
    <div class="mock-bubble out is-draft" data-at="3" data-fx="bubble">Draft: …</div>     <!-- dashed, waiting for review -->
    <div class="mock-callcard" data-at="4" data-fx="drop"><span class="mock-avatar">AT<span class="ring" data-at="4" data-fx="ring"></span></span><span><strong>Avery Thompson</strong>2020 Honda Accord · RO open</span></div>
  </div>
</div></div>
```

### scene-checklist and gauge (inspections, ch-approve)

```html
<div class="mock-checklist" data-at="0" data-fx="stagger" style="--fx: tick-pop">
  <div class="mock-check"><span class="mock-tickbox"><i></i></span><span>Engine oil</span><span class="mock-rating">Good</span></div>
  <div class="mock-check"><span class="mock-tickbox"><i></i></span><span>Front pads</span><span class="mock-rating is-soon">3 mm</span></div>  <!-- .is-soon amber, .is-now red -->
</div>
<svg class="mock-gauge" viewBox="0 0 120 84">
  <path class="g-track" d="M15 60a45 45 0 0 1 90 0"/>
  <path class="g-band is-stop" d="M15 60a45 45 0 0 1 8.2-25.9"/>
  <path class="g-band is-warn" d="M23.2 34.1a45 45 0 0 1 22.6-16.8"/>
  <path class="g-band is-ok" d="M45.8 17.3a45 45 0 0 1 59.2 42.7"/>
  <line class="needle" data-at="1" data-fx="sweep" x1="60" y1="60" x2="60" y2="24" style="--from:-90deg; --to:-16deg; transform-origin: 60px 60px"/>
  <circle class="g-hub" cx="60" cy="60" r="4"/>
  <text x="60" y="80" text-anchor="middle">Tread 6/32</text>
</svg>
```

- The needle points up at 0°, left at −90° and right at 90°. `--to` is the final angle.
- The sprite also defines the `#gauge-pad` and `#gauge-tread` gradients if you want a gradient band (`stroke="url(#gauge-pad)"`).
- Make the tick box itself pop: put `data-at` / `data-fx="tick"` on the `.mock-tickbox > i`, or stagger the rows as shown.

### scene-invoice-reader (payments, repair-orders, ch-pay)

```html
<div class="scene" style="grid-template-columns: minmax(0,1fr) auto; align-items: end">
  <div class="mock-paper" data-seq-i="0" data-fx="feed">
    <div class="mock-paper-head"><strong>INVOICE</strong><span>2021 Camry SE</span></div>
    <div class="mock-line"><span>Full synthetic oil &amp; filter</span><span>…</span></div>
    <div class="mock-line is-muted"><span>Shop supplies</span><span>…</span></div>
    <div class="mock-total"><span>Total</span><span class="odometer is-plain" data-odometer="482.01" data-decimals="2" data-prefix="$">$482.01</span></div>
  </div>
  <div class="mock-reader">                                           <!-- generic, light, no brand marks -->
    <div class="mock-reader-screen">
      <strong data-seq-out="6">$482.01</strong>
      <span class="is-approved" data-seq-i="6" data-fx="fade" style="display:grid;place-items:center;width:100%;height:100%">Approved</span>
    </div>
    <svg class="mock-reader-arcs" viewBox="0 0 46 30" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
      <path class="ring" data-seq-i="4" data-fx="ring" d="M15 8a10 10 0 0 1 0 14"/><path class="ring" data-seq-i="4" data-fx="ring" d="M22 4a16 16 0 0 1 0 22"/><path class="ring" data-seq-i="4" data-fx="ring" d="M29 1a22 22 0 0 1 0 28"/>
    </svg>
  </div>
</div>
```

Below 600px, stack the two parts with an inline `@media` or a `.split`. The Stamp goes inside `.mock-paper` (§12).

### scene-timeline (live status, history, customer pages)

```html
<ol class="mock-timeline">
  <li><span class="mock-tl-dot is-done" data-at="0" data-fx="pop"></span><span>Checked in</span><span class="mock-time">7:30 AM</span></li>
  <li><span class="mock-tl-dot is-done" data-at="1" data-fx="pop"></span><span>Approved</span><span class="mock-time" data-at="1" data-fx="fade">7:35 AM</span></li>
  <li><span class="mock-tl-dot is-late" data-at="3" data-fx="pop"></span><span>Ready</span><span class="mock-time">…</span></li>  <!-- .is-late = green dot -->
</ol>
<span class="live-pill"><span class="live-dot"></span>Updated just now</span>
```

### scene-ledger (QuickBooks journal, receivables)

```html
<div class="mock-ledger">
  <div class="mock-ledger-head">Debit</div><div class="mock-ledger-head">Credit</div>
  <div class="mock-ledger-col" data-at="0" data-fx="stagger"><div class="mock-line"><span>Undeposited funds</span><span>…</span></div>…</div>
  <div class="mock-ledger-col" data-at="0" data-fx="stagger" style="--fx: fx-right"><div class="mock-line"><span>Labor income</span><span>…</span></div>…</div>
  <div class="mock-ledger-total"><span>Total</span><span class="odometer is-plain" data-odometer="…" data-decimals="2" data-group="," data-prefix="$" data-at="1">…</span></div>
  <div class="mock-ledger-total"><span>Total</span><span class="odometer is-plain" … data-at="1">…</span></div>
</div>
<span class="stamp is-green" data-at="2">Balanced</span>
```

### scene-scan (parts scanning, check-in VIN)

```html
<div class="mock-viewfinder">
  <span class="mock-barcode"></span>
  <span class="scanline" data-at="0" data-fx="scan"></span>
</div>
<span class="slot-roll is-boxed" data-slots="1HGCM82633A004352" data-charset="vin" data-check="8" data-at="1">1HGCM82633A004352</span>
```

---

## 12. Small motion parts

### Rolling counters (`.odometer[data-odometer]`)

```html
<!-- Standalone product fact (drums; role=img + aria-label added by JS) -->
<span class="odometer" data-odometer="4073" data-group="," data-label="4,073 vehicle models built in">4,073</span>
<!-- Inside a mock (plain: inherits the font; aria-hidden added by JS) -->
<span class="odometer is-plain" data-odometer="254.52" data-from="0" data-decimals="2" data-prefix="$" data-at="2">$254.52</span>
```

| Attribute | Meaning |
|---|---|
| `data-odometer` | final value; **also write it as the element's text** (no-JS / Reduce Motion show the text) |
| `data-decimals` | 0–2 fixed decimals |
| `data-group=","` | thousands separators (off by default, so 2027 never gets a comma) |
| `data-prefix` / `data-suffix` | static characters (`$`, `×`, ` h`) |
| `data-from` | start value; strips roll forward from it (balance to 0.00, 34,870 → 35,120). Keep the same digit-group layout |
| `data-duration` | seconds (default 2.2; timers use .4) |
| `data-tenth` | adds a green tenths drum that turns while visible (customers hero mileage) |
| `data-label` | the accessible text for standalone counters |

- A non-numeric value such as `01:12` rolls character by character.
- **When it rolls:**
  - once on first view (standalone);
  - at its step (in a `[data-seq]`, via its own or an ancestor's `data-at`);
  - at its beat (in a `[data-reveal-seq]`, via an ancestor's `data-seq-i`).
- Use only two kinds of counter: example values inside a mock-figure, or the built-in facts (435, 4,073, 2027, 725, 37, 14, 6).

### Slot roll (`.slot-roll[data-slots]`)

```html
<span class="slot-roll is-boxed" data-slots="2T3P1RFV7LC159666" data-charset="vin" data-check="8">2T3P1RFV7LC159666</span>
<span class="slot-roll" data-slots="482 913" data-charset="digits">482 913</span>               <!-- two-step code -->
<span class="slot-roll" data-slots="••••4f2a" data-charset="key">••••4f2a</span>              <!-- masked key -->
```

- Character sets:
  - `vin`: the 33 VIN characters (A–Z without I, O, Q, plus 0–9);
  - `digits`;
  - `hex`;
  - `key` (• and hex);
  - or a literal string.
- Characters outside the set stay static.
- Each cell rolls for 1.6s, with a 60ms stagger.
- `data-check="i"` paints that cell `--green-ink` (the VIN check digit is index 8).
- `.is-boxed` gives each character its own cell.
- JS sets `--slots-done` on the element, the time the last slot lands. Use it to delay brackets or labels, e.g. `animation-delay: var(--slots-done)` in your inline CSS.
- Use only the two validated VINs: 1HGCM82633A004352 and 2T3P1RFV7LC159666.

### Stamp

```html
<span class="stamp" data-at="5">Approved</span>            <!-- --accent ink: APPROVED, PDF -->
<span class="stamp is-green" data-at="3">Paid</span>       <!-- --green-ink: PAID, BALANCED -->
```

- The text is uppercase mono, rotated −8°.
- It plays `stamp-in` (scale 1.6 → 1 with an ink spread) when reached. In a Reveal sequence, use `data-seq-i`.
- `.stamp.is-lg` is a bigger size.
- Place it with inline `position:absolute` inside its paper or phone.

### Live dot

```html
<span class="live-dot"></span>                                   <!-- green dot with a pulsing ring -->
<span class="live-pill"><span class="live-dot"></span>Updated just now</span>
```

It stops on Pause and is static under Reduce Motion. Use it in mocks, on On-the-clock avatars, on Lobby Ready rows and on the sample-shop chip.

### Data flow line

```html
<svg viewBox="0 0 220 40">
  <path class="flow-line is-blue" d="M10 20H210"/>                                      <!-- dashed path; .is-broken = offline gap -->
  <path class="flow-dot" pathLength="100" d="M10 20H210" data-at="2" data-fx="flow"/>   <!-- a short dash runs it once -->
  <path class="flow-dot is-green flow-run" pathLength="100" d="…"/>                    <!-- or loops while its [data-play] figure plays -->
</svg>
```

- No CSS `offset-path`. To draw a dashed line in, use `data-fx="wipe"` on the `.flow-line`.
- **Reduce Motion:** a static line.

---

## 13. App notification chips (`.float-note`) and `data-cycle`

```html
<div class="float-note note-a" aria-hidden="true">
  <span class="dot is-ok"></span>                     <!-- default amber; .is-ok green; .is-stop red; .is-info blue -->
  <span><strong>PO received</strong><small>4 parts</small></span>
</div>
<div class="float-note note-b" aria-hidden="true">
  <span class="icon-tile icon-tile-sm"><svg class="icon"><use href="#i-chat"/></svg></span>
  <span class="note-msgs" data-cycle>                <!-- 2-3 messages cross-fade every 4.5s -->
    <span class="is-active"><strong>Text sent to Avery T.</strong><small>Your Accord is ready · live status link</small></span>
    <span><strong>Marcus R. started a job</strong><small>Water pump · 2020 Ram 1500</small></span>
  </span>
</div>
```

- Put float-notes inside the figure, after the stage. They are always `aria-hidden`.
- **Default positions:**
  - `.note-a` / `.note-1`: upper-left, 56px from the top;
  - `.note-b` / `.note-2`: lower-right.
  - Nudge them inline (`style="top:30%; left:-4%"`).
- **Motion:** `note-in` (0.9s delay), then `art-float` 5.5s alternate. The second chip is delayed further.
- **Hidden** below 600px, and below 980px in the index hero.
- **Example data rule:** a chip with a name, amount, count, time, plate or key suffix must sit in a `.mock-figure`. Data-free chips ("Installed · opens full screen") may sit in a plain `page-hero-art`.
- **`data-cycle`:**
  - mark the first message `.is-active`;
  - it runs only while visible and stops after 3 cycles (`data-cycle-count`), resting on the first message;
  - set the interval with `data-cycle-ms`;
  - it stops on Pause and shows the first message under Reduce Motion;
  - the element gets `data-index`, and a `cycle` event fires on each change.
  - You can use it on any wrapper of 2–3 children, e.g. term chips. Style `.is-active` inline.

---

## 14. Scroll reveal

```html
<div data-reveal>…</div>                 <!-- rise 26px -->
<div data-reveal="left">…</div>          <!-- from the left (upward below 900px); also "right", "scale", "fade" -->
<div class="grid grid-3" data-reveal-stagger>…children reveal in turn (70ms × index % 8)…</div>
<div class="pill-cloud" data-reveal-stagger="fade">…</div>
```

- `.is-in` is added once, at 12% visible.
- Apply it to every section head, card grid, mock and callout.
- `.signal-list`, `.pop-list`, `.ro-card` and `.name-row` also get `.is-in` on view (no attribute needed) for their own small effects.
- **Reduce Motion, no-JS, print:** everything shows at once.

---

## 15. RO journey road (`.roadmap`)

```html
<div class="roadmap" style="--steps:4" data-reveal>
  <svg class="roadmap-car" viewBox="0 0 32 14" aria-hidden="true"><use href="#i-car-mini"/></svg>
  <div class="roadmap-road" aria-hidden="true"></div>
  <ol class="roadmap-steps" aria-label="How it works">     <!-- contains "Example" when chips hold times, names or amounts -->
    <li class="roadmap-step">
      <span class="roadmap-marker" aria-hidden="true">1</span>          <!-- or an <svg class="icon"> -->
      <h3>Check in</h3>                                                  <!-- may be <h3><a href="#ch-checkin">…</a></h3> -->
      <p>One sentence.</p>
      <span class="roadmap-chip">7:30 AM · Checked in</span>             <!-- optional, ≤ 22 characters, mono -->
    </li>
    …
  </ol>
</div>
<p class="roadmap-caption">Times, names and amounts are an example from the sample shop.</p>   <!-- with example chips; AFTER the .roadmap, never inside it -->
```

- Scroll drives it: `--p` fills the road and the car drives.
- Steps get `.is-reached`. Steps in the second half get `.is-late`, so they reach green: with 5 steps, steps 3–5; with 4 steps, steps 3–4.
- Chips spring in when their step is reached.
- **Layout:** vertical below 900px (4 steps or fewer) or below 1180px (5 or more); horizontal above.
- **Reduce Motion and no-JS:** fully filled, all chips shown.

---

## 16. Ticker

Use one only: the home feature ticker. Other places use a static `.pill-cloud` with `data-reveal-stagger`.

```html
<h2 class="visually-hidden">What's inside</h2>
<ul class="visually-hidden"><li>Repair orders</li>…</ul>
<div class="ticker" aria-hidden="true">
  <div class="ticker-track">
    <div class="ticker-group"><span class="ticker-item"><svg class="icon"><use href="#i-document"/></svg>Repair orders</span>…</div>
    <div class="ticker-group">…exact copy of the first group…</div>
  </div>
</div>
```

- It runs 48s linear and pauses on hover and on Pause.
- **Reduce Motion:** a static, centred, wrapped pill row. The second group hides.

---

## 17. Cards, lists, callouts

```html
<!-- feature card: sync's featuresCards (index #features-grid) and related (features/*) render exactly this; never hand-write those grids -->
<a class="card card-link feature-card" href="features/workflow.html"><span class="icon-tile"><svg class="icon" aria-hidden="true"><use href="#i-board"/></svg></span><h3>Workflow board, Today &amp; tech clock</h3><p>Every car by stage. One-tap job timers.</p><span class="link-arrow">Learn more <svg class="icon" aria-hidden="true"><use href="#i-arrow-right"/></svg></span></a>
<!-- plain card with icon; becomes a compact row on phones inside .grid-3 -->
<div class="card"><span class="icon-tile"><svg class="icon" aria-hidden="true"><use href="#i-lock"/></svg></span><h3 class="mt-2">Two-step sign-in</h3><p>…</p></div>
<!-- promise grid (index #built-in) -->
<div class="promise-grid" data-reveal-stagger><div class="promise"><span class="icon-tile"><svg class="icon" aria-hidden="true"><use href="#i-wifi-off"/></svg></span><h3>Works offline</h3><p>…</p></div>…</div>
<!-- a stat / fact beside a counter -->
<div class="fact"><span class="odometer" data-odometer="4073" data-group="," data-label="…">4,073</span><p class="fact-caption"><strong>vehicle models built in</strong>, from 435 makes…</p></div>
```

- Icon tiles: `.icon-tile`, `-sm`, `-lg`, `-green`.
- Use `.card-soft` for a quieter card, and `.panel-wash` for the one wash feature panel per page.

**Good to know (every page's needs and limits; the one repeated heading)**

```html
<section class="section-sm" id="needs" aria-labelledby="needs-title">
  <div class="container">
    <aside class="callout good-to-know" data-reveal="fade">
      <svg class="icon" aria-hidden="true"><use href="#i-info"/></svg>
      <div>
        <h2 class="callout-title" id="needs-title">Good to know</h2>
        <ul class="callout-list">
          <li><strong>Needs:</strong> <a href="../works-with.html#shop-cloud">Shop Cloud</a> and your Stripe account.</li>
          <li>Payments land on your signed-in shop devices; a device checks about every minute while it is open.</li>
        </ul>
      </div>
    </aside>
  </div>
</section>
```

Other callouts:

- answer callout: `<div class="callout"><svg class="icon" aria-hidden="true"><use href="#i-check-circle"/></svg><div><p class="callout-title">…</p><p>…</p></div></div>`;
- `.callout-warn` for a caution.

**Lists**

```html
<ul class="checklist">…</ul>                      <!-- blue check badges -->
<ul class="checklist pop-list" data-reveal>…</ul> <!-- badges pop in sequence on view -->
<ul class="signal-list" data-reveal><li>Cars get lost between bays</li><li class="is-critical">…</li></ul>  <!-- amber / red dots; pulse once -->
```

**Repair-order card** (about #built, AI guardrails, demo #switching)

```html
<div class="ro-card" data-reveal>
  <div class="ro-head"><span class="icon-tile icon-tile-sm"><svg class="icon" aria-hidden="true"><use href="#i-document"/></svg></span><div><strong>Title</strong><small>Subtitle</small></div><span class="badge">Label</span></div>
  <ul class="checklist ro-list"><li><div><h3>Point</h3><p>Detail</p></div></li>…</ul>   <!-- badges pop in sequence -->
  <p class="ro-foot"><svg class="icon" aria-hidden="true"><use href="#i-info"/></svg>Footnote</p>
</div>
```

**Numbered name rows** (about #name, mobile install steps): the bar draws on reveal.

```html
<div class="name-rows"><div class="name-row" style="--i:0"><span class="name-num">01</span><h3>…</h3><p>…</p></div>…</div>
```

---

## 18. Hover and press

These need no extra markup:

- `.btn` gets a headlight sheen, a −1px lift and a .98 press.
- `.card-link` lifts −4px with a shadow.
- `.feature-card`, `.dir-card`, `.promise` and `.value-card` turn their `.icon-tile` −8°, scale it 1.06 on the wash and wiggle the icon.
- `.link-arrow` nudges its arrow 4px.
- `.footer-card` rotates −2°, and the brand logo scales 1.04.
- On touch devices every tappable component has an `:active` press state.

To give a custom card the icon wiggle, add the class `value-card` to it.

---

## 19. Bottleneck finder (features.html)

```html
<section class="section section-paper" id="finder" aria-labelledby="finder-title">
  <div class="container finder">
    <div>
      <div class="section-head" data-reveal><p class="eyebrow">Bottleneck finder</p><h2 id="finder-title">What's slowing your shop down?</h2></div>
      <p class="finder-label">Pick any that sound familiar</p>
      <!-- @partial finderChips --> <!-- @end finderChips -->
    </div>
    <aside class="finder-panel" aria-labelledby="finder-results-title" data-reveal="right">
      <div class="finder-panel-head"><h3 id="finder-results-title">Matches</h3><button class="btn btn-ghost btn-sm" type="button" data-finder-clear hidden>Clear</button></div>
      <p class="finder-status" role="status" data-finder-status>Pick what's slowing your shop down.</p>
      <div class="finder-empty" data-finder-empty>
        <svg class="finder-gauge" viewBox="0 0 176 120" aria-hidden="true">
          <path class="g-track" d="M24 92a64 64 0 0 1 128 0"/><path class="g-band" d="M24 92a64 64 0 0 1 128 0"/>
          <line class="g-tick" x1="88" y1="20" x2="88" y2="34"/>
          <g class="g-needle"><line x1="88" y1="92" x2="88" y2="42"/></g>
          <circle class="g-hub" cx="88" cy="92" r="7"/><circle class="g-hub-in" cx="88" cy="92" r="2.5"/>
          <text x="88" y="114" text-anchor="middle"><tspan class="g-count">0</tspan> matches</text>
        </svg>
      </div>
      <ul class="finder-results" data-finder-results></ul>
      <p class="finder-note"><svg class="icon" aria-hidden="true"><use href="#i-info"/></svg>Each match jumps to its card below.</p>
    </aside>
    <!-- @partial finderData --> <!-- @end finderData -->
  </div>
  <button class="finder-jump" type="button" data-finder-jump hidden><svg class="icon" aria-hidden="true"><use href="#i-arrow-up-right"/></svg><span data-finder-jump-text>See matches</span></button>
</section>
```

**Generated parts.** Never hand-write the chips or the data; sync fills both markers from features.json `pains[]`:

- `finderChips` emits `<div class="finder-chips" role="group" aria-label="What’s slowing your shop down?" data-reveal-stagger="fade">` with one chip per pain, in features.json order:
  `<button class="finder-chip" type="button" data-pain="lost-cars" aria-pressed="false"><svg class="icon i-off" …(the first matching feature's icon)…/><svg class="icon i-on" …#i-check/>Cars get lost between bays</button>`.
  The pain slugs are `lost-cars`, `approval-callbacks`, `status-calls`, `phone-tag`, `counter-line`, `paper-hours`, `pricing`, `parts-orders`, `card-payments`, `month-end`, `no-return`, `fleet-billing`, `check-engine` and `writing`.
- `finderData` emits the JSON below.
- You add everything else shown above: the `[data-finder-status]` live region, `[data-finder-results]`, `[data-finder-empty]` with the gauge, `[data-finder-clear]` and the `.finder-jump` pill.

**Data.** site.js reads `<script type="application/json" id="finder-data">`:

```json
{"pains":[{"slug":"lost-cars","label":"Cars get lost between bays","features":["workflow"]}],"features":[{"slug":"workflow","title":"…","short":"…","icon":"i-board","href":"features/workflow.html"}]}
```

A plain `{"pain-slug": ["feature", …]}` map also works.

**Behaviour:**

- The chips toggle `aria-pressed` and their icon pops.
- The results list compact links (icon plus title, taken from the directory card `#dir-<slug>`). They rise in, with a same-document View Transition (`html.vt-finder`, `fx-in` / `fx-out`).
- A result link smooth-scrolls to its `.dir-card`, pulses the `.is-match` ring once and moves focus to the card's "Learn more" link.
- The live region reads "3 features match".
- The gauge idles with `g-sweep` until there are matches. Then it springs to an angle proportional to the count (`.is-set`) and shows the count. It is labelled "matches", not a score.
- `.finder-jump` springs in on phones when there are matches but the panel is off-screen.

---

## 20. Directory and role filter (features.html)

The directory is generated by sync (`<!-- @partial featuresDirectory -->`): `.dir > nav.dir-nav[data-dir-nav] + .dir-groups > section.dir-group#grp-* > .dir-cards > article.dir-card#dir-<slug>[data-slug][data-roles]`. The Everywhere cards carry no `data-roles` and are never filtered.

Put the role chips above it. sync fills `roleChips` from features.json `roles[]`: a `div.role-chips[role=group][aria-label="Show features for"]` holding `button.role-chip[data-role]` for `all` (pressed), `owner`, `manager`, `advisor` and `tech` ("All", "Owner", "Shop manager", "Service advisor", "Technician"). You add the note and the live region:

```html
<div class="role-bar">
  <!-- @partial roleChips --> <!-- @end roleChips -->
  <p class="role-note">Roles decide which pages each person sees in the app on that device. Accounting, QuickBooks setup and payroll are owner-only. <a class="text-link" href="security.html#roles">What each role can open</a></p>
  <p class="visually-hidden" role="status" data-role-status></p>
</div>
<!-- @partial featuresDirectory --> <!-- @end featuresDirectory -->
```

- Each generated card: `.dir-card-head` (icon tile, `h4` title, `.dir-card-kicker` line), the blurb, `p.dir-card-needs` ("Needs:" or "Optional:", with a linked Shop Cloud), an optional `p.dir-card-note`, and `.dir-card-foot` with "Learn more" and the sample-shop link (`data-no-prerender`). The Auto Diagnosis card is `.is-feature` (the wash card, full width from 640px).
- The pressed chip is a light blue fill with an accent ring.
- Cards whose `data-roles` lack the role get `hidden`.
- Groups with no visible cards collapse (`.is-empty`), together with their nav chip. The nav counts update, and the scroll-spy pill re-measures.
- The live region reads "Showing 6 of 12 features".
- The URL keeps `?role=` (`?role=tech` preselects).
- With `startViewTransition`, cards animate (`html.vt-roles`, `rt-in` / `rt-out`); otherwise the filter is instant.

---

## 21. Scroll-spy pills

**Directory variant** (generated): `nav.dir-nav[data-dir-nav]`, with `li.dir-nav-pill` as the last list item.

- At 1080px and up, the white pill slides between links (translateY plus a height spring).
- Below 1080px it becomes a sticky, swipeable chip bar (`.is-stuck` adds a hairline) that keeps the active chip in view.
- The active link gets `aria-current="location"`.

**Sticky sub-nav** (security):

```html
<nav class="subnav" aria-label="On this page" data-spy>
  <div class="container"><ul class="subnav-list">
    <li><a class="subnav-link" href="#where"><svg class="icon" aria-hidden="true"><use href="#i-cloud"/></svg>Where it lives</a></li>
    …
  </ul></div>
</nav>
```

- Add `class="has-subnav"` on `<main>`, so `[id]` targets land below the bar.
- Any other list of in-page links can use `data-spy`: the faq topic chips or the privacy `.toc`.
  - `data-spy` alone gives `aria-current="location"`.
  - `data-spy="true"` gives `aria-current="true"`, which keeps the privacy TOC's existing CSS working.
  - `data-spy-scope="#section-id"` clears the highlight after that section.
- Add an element `.spy-pill` inside the list if you want a sliding pill.

---

## 22. Concern lamps (features/diagnosis.html)

```html
<div class="split">
  <div class="dash" data-reveal="left">
    <div class="dash-head"><span>Concerns</span><span>Tap one</span></div>
    <div class="dash-grid" data-lamps="concern-details">                <!-- value = id of the details container -->
      <button class="lamp" type="button" data-lamp="check-engine" data-color="amber" aria-pressed="false">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><use href="#i-engine"/></svg>
        <span class="lamp-label">Check engine</span>
      </button>
      … 16 lamps; data-color = red | amber | green | blue …
    </div>
  </div>
  <div class="lamp-details" id="concern-details" aria-live="polite">
    <div class="lamp-detail is-active" data-lamp-panel="check-engine"><h3>Check engine light</h3><p class="muted">Sources: …</p></div>
    … one panel per lamp …
  </div>
</div>
```

- Clicking a lamp sets `aria-pressed` (one at a time), flickers its glow (`lamp-flicker` with a coloured drop-shadow) and shows its panel, which rises in.
- Arrow keys, Home and End move between lamps like a grid.
- On first reveal, one bulb-check wave lights every lamp in 40ms steps. Skipped under Reduce Motion and Pause.
- An optional `<button data-bulb-check>` inside the details container replays the wave.
- A `lampselect` event fires on the grid.
- **No-JS:** every panel is listed.

---

## 23. Tabs and accordions

```html
<div data-tabs>
  <div class="tabs-list" role="tablist" aria-label="Report views">
    <span class="tabs-thumb" aria-hidden="true"></span>                <!-- optional: the white pill slides with a spring -->
    <button role="tab" id="t-sales" aria-controls="p-sales" aria-selected="true" type="button">Sales</button>
    <button role="tab" id="t-tech" aria-controls="p-tech" aria-selected="false" type="button">Technicians</button>
  </div>
  <div role="tabpanel" id="p-sales" aria-labelledby="t-sales"> … may hold a [data-reveal-seq] mock that plays when shown … </div>
  <div role="tabpanel" id="p-tech" aria-labelledby="t-tech" hidden> … </div>
</div>

<div class="faq-list">
  <details class="faq" name="feat-faq"><summary>Do I have to use all of it?</summary><div class="faq-body"><p>…</p></div></details>
</div>
```

- Tabs follow the WAI-ARIA pattern: arrow keys, Home and End. Panels rise in.
- `details.faq` animates its height and the + rotates 135°.
- Use one `name` per group, which makes the group exclusive.
- No FAQPage JSON-LD outside faq.html.

---

## 24. Forms and the gear shifter (demo.html)

**Fields**

```html
<div class="field">
  <label class="field-label" for="d-name">Your name <span class="req" aria-hidden="true">*</span></label>
  <input class="input" id="d-name" name="name" autocomplete="name" required enterkeyhint="next" aria-describedby="d-name-err">
  <p class="field-error" id="d-name-err"><svg class="icon" aria-hidden="true"><use href="#i-alert"/></svg><span>Please enter your name.</span></p>
</div>
<label class="field-label" for="d-role">Role <span class="opt">(optional)</span></label>   <!-- every optional field says "(optional)" -->
<select class="select" …></select>  <textarea class="textarea" maxlength="1200" …></textarea>
<p class="field-hint">…</p>
```

- `validateFields` (window.CCA) adds `.is-invalid`, `aria-invalid` and `aria-describedby`. The error shakes, and the page scrolls and focuses the first bad field.
- A fieldset group: `<fieldset class="field" data-required-group data-error="…"><legend class="field-label">…</legend>…</fieldset>`.

**Choices**

```html
<div class="choice-grid is-compact" role="radiogroup" aria-labelledby="bays-l">             <!-- pills: 1-2 / 3-5 / … -->
  <label class="choice"><input type="radio" name="bays" value="3–5"><span class="choice-card choice-pill">3–5</span></label>
</div>
<div class="choice-grid">                                                                    <!-- tiles: icon on top, badge in the corner -->
  <label class="choice"><input type="radio" name="contact_method" value="Email"><span class="choice-card choice-tile"><svg class="icon" aria-hidden="true"><use href="#i-mail"/></svg><span class="choice-text">Email<small>We reply by email</small></span></span></label>
</div>
<fieldset class="field"><legend class="field-label">What do you want to see?</legend>
  <!-- @partial featuresInterests --> <!-- @end featuresInterests -->                         <!-- 12 checkbox cards (.interest-grid) -->
</fieldset>
<div class="quick-chips"><span class="quick-chips-label">Add:</span><button class="quick-chip" type="button"><svg class="icon" aria-hidden="true"><use href="#i-plus"/></svg>Cars get lost between bays</button>…</div>
```

- `featuresInterests` renders `div.choice-grid.interest-grid` with one `label.choice > input[type=checkbox][name=interests][value][data-slug][data-title]` + `span.choice-card` (icon, `.choice-name`, `small` line) per feature. For `?interest=<slug>`, the page script checks `input[name="interests"][data-slug="<slug>"]`. The inbox payload reads each checked box's `data-title`.
- A checked `choice-card` pops its badge and makes its icon hop.
- Quick chips get `.is-added` (solid border and a check icon) when the page script appends their text.

**Status, success, privacy note**

```html
<div class="callout callout-warn form-status" data-form-error role="alert" hidden></div>
<p class="form-legal">We use these details only to reply. <a class="text-link" href="privacy.html">Privacy</a></p>
<div class="form-success" id="demo-success" hidden tabindex="-1">
  <svg class="success-mark" viewBox="0 0 84 84" aria-hidden="true"><circle cx="42" cy="42" r="42"/><path d="M26 43l11 11 21-23"/></svg>
  <h2>Request received. Thanks, we&rsquo;ll be in touch.</h2>
  <div class="cluster"><a class="btn btn-secondary" href="{{root}}app/" data-no-prerender>Try the sample shop while you wait</a></div>
</div>
```

`showError` fills `[data-form-error]` with "We couldn't send that online.", then one of:

- a mailto link with subject and body, if the page has any mailto link (the contact-email partial);
- otherwise "Please try again in a few minutes. Your answers are still here."

It adds a tel link only if one exists.

**Transport (site.js, unchanged API):**

- `INBOX_FORMS = { demo: 'message' }`, with a 3-second minimum fill time before the inbox POST.
- The payload is `{source:'website', form:'demo', name, phone, email, company, text}`, where `text` is:
  - the topic first;
  - then Shop, Role, Locations, Bays, Current system, "Interested in: …" (from the checked `interests` inputs' `data-title`), "Contact by", "Best time";
  - then a blank line and the message, capped at 2,000 characters.
- Fallbacks, in order: honeypot (silent), inbox, then the form-endpoint meta, then a urlencoded POST to `action`, then `showError`.

**Gear shifter**

```html
<div class="booking-layout">
  <div class="card booking-card">
    <form class="form booking-form" id="demo-form" name="demo" method="POST" action="/" data-netlify="true" netlify-honeypot="bot-field" data-form="manual" data-success="#demo-success" data-subject="Demo request · WPI Driveline Shop Management System" novalidate>
      <input type="hidden" name="form-name" value="demo"><p class="hp-field"><label>Leave this empty <input name="bot-field" tabindex="-1" autocomplete="off"></label></p>
      <div class="shifter">
        <svg class="shifter-gate" viewBox="0 0 200 150" aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id="shift-trail-grad" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1F7AE0"/><stop offset="1" stop-color="#2DB36A"/></linearGradient>
            <radialGradient id="shift-knob-grad" cx=".36" cy=".3" r=".8"><stop offset="0" stop-color="#3B8CEB"/><stop offset="1" stop-color="#1662C2"/></radialGradient>
            <radialGradient id="shift-boot-grad" cx=".5" cy=".4" r=".7"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#DCE5F0"/></radialGradient>
          </defs>
          <rect class="gate-plate" x="1" y="1" width="198" height="148" rx="24"/>
          <circle class="gate-screw" cx="22" cy="75" r="3"/><circle class="gate-screw" cx="178" cy="75" r="3"/>
          <path class="gate-slot" d="M64 28V122M136 28V122M64 75H136"/>
          <path class="gate-groove" d="M64 28V122M136 28V122M64 75H136"/>
          <path class="gate-trail" d="M64 28L64 122L64 75L136 75L136 28L136 122"/>
          <g class="gear is-current" data-gear="1"><circle cx="24" cy="28" r="11"/><text x="24" y="28" text-anchor="middle" dominant-baseline="central">1</text></g>
          <g class="gear" data-gear="2"><circle cx="24" cy="122" r="11"/><text x="24" y="122" text-anchor="middle" dominant-baseline="central">2</text></g>
          <g class="gear" data-gear="3"><circle cx="176" cy="28" r="11"/><text x="176" y="28" text-anchor="middle" dominant-baseline="central">3</text></g>
          <g class="gear" data-gear="4"><circle cx="176" cy="122" r="11"/><text x="176" y="122" text-anchor="middle" dominant-baseline="central">4</text></g>
          <g class="knob" style="transform: translate(64px, 75px)"><ellipse class="knob-shadow" cx="2" cy="5" rx="22" ry="20"/><g class="knob-body"><circle class="knob-boot" r="22"/><circle class="knob-stitch" r="17.5"/><circle class="knob-top" r="13"/><circle class="knob-rim" r="10"/><ellipse class="knob-shine" cx="-4.5" cy="-5.5" rx="4.6" ry="3.2" transform="rotate(-35 -4.5 -5.5)"/></g></g>
        </svg>
        <p class="shift-now"><span class="shift-count">Step <span data-shift-num>1</span> of <span data-shift-total>4</span></span><span class="shift-name" data-shift-name>Your shop</span></p>
        <ol class="shift-steps">
          <li><button class="shift-step is-current" type="button" data-go="1" aria-current="step"><span class="num">1</span>Shop</button></li>
          <li><button class="shift-step" type="button" data-go="2" disabled><span class="num">2</span>See</button></li>
          <li><button class="shift-step" type="button" data-go="3" disabled><span class="num">3</span>Contact</button></li>
          <li><button class="shift-step" type="button" data-go="4" disabled><span class="num">4</span>Review</button></li>
        </ol>
      </div>
      <div class="steps">
        <section class="step-panel" data-name="Your shop" aria-labelledby="s1-title"><div class="step-head"><h2 class="step-title" id="s1-title" tabindex="-1">Your shop</h2><p class="step-lead">…</p></div> …fields… <div class="step-nav"><button class="btn btn-primary" type="button" data-next>Next: What to see</button></div></section>
        <section class="step-panel" data-name="What to see" …> … <div class="step-nav"><button class="btn btn-secondary" type="button" data-back>Back</button><button class="btn btn-primary" type="button" data-next>Next: Contact</button></div></section>
        <section class="step-panel" data-name="Contact" …>…</section>
        <section class="step-panel" data-name="Review" …>
          <div class="review"><div class="review-head">…<span class="badge">Demo request</span></div><dl class="review-list"><div class="review-row"><dt>Shop</dt><dd><span class="review-val">…</span><button class="review-edit" type="button" data-go="1">Edit</button></dd></div>…</dl></div>
          <div class="step-nav"><button class="btn btn-secondary" type="button" data-back>Back</button><button class="btn btn-primary" type="submit">Send request</button></div>
        </section>
      </div>
      <div class="callout callout-warn form-status" data-form-error role="alert" hidden></div>
    </form>
    <div class="form-success" id="demo-success" hidden>…</div>
  </div>
  <aside class="card aside-card booking-aside" data-reveal="right">…<a class="aside-row" href="{{root}}app/" data-no-prerender><span class="live-dot"></span><span><small>Sample shop</small><strong>Main Street Auto Service</strong></span><svg class="icon chev" aria-hidden="true"><use href="#i-chevron-right"/></svg></a></aside>
</div>
```

The page script drives the steps with `window.CCA` and the shifter helper:

```js
const gear = WPI.shifter(form);   // { shiftTo(from, to), paint(n, { reached, skip: [2] }) }
gear.shiftTo(0 /* neutral */, 1); // on load: out of neutral into first (pass 1 → 1 if the knob already sits in 1)
// on each step change:
gear.shiftTo(current, next);
gear.paint(next, { reached, skip: topic === "Demo request" ? [] : [2] });
```

- `shiftTo` glides the knob through neutral (280ms + length × 2.4, at most 950ms), moves the trail and seats the knob.
- `paint` sets `.is-current` / `.is-done` / `.is-skipped` on gears and pills, disables unreached or skipped pills, and sets `aria-current="step"`.
- Skipping gear 2 drives 1 → 3 → 4. Update `[data-shift-total]` to 3.
- Panel swap: the old panel slides out 26px and fades (170ms). The `.steps` height animates (420ms, add `.is-animating` while it runs). The new panel slides in from 30px (460ms), and focus moves to `.step-title`.
- Copy the panel-swap and validation logic from the old appointment page script (`git show HEAD:website/appointment.html`, the last `<script>`). It already calls `CCA.validateFields`, `nextField`, `summarize`, `submitForm`, `showSuccess` and `showError`.
- Without JS, `html:not(.js)` hides the shifter, Back/Next and the review, and every panel shows.

---

## 25. Page transitions

These are automatic:

- cross-document View Transitions;
- the header, tab bar and `main` names;
- the sliding `nav-pill`.

**Feature-icon morph:**

- On each `features/<slug>.html`, the hero eyebrow's icon tile carries `style="view-transition-name: ft-<slug>"`. That is the only static ft-* name anywhere.
- On index and features.html, grids carry **no** names. site.js names only the clicked `.feature-card` / `.dir-card` icon tile at `pageswap`, so it flies into the feature hero (0.45s, `--ease-in-out`).
- The mega menu, sheet, footer and `.related` grids never morph.
- Disabled under Reduce Motion.

---

## 26. Illustration kit and keyframes

**SVG classes**

- `.art-ink` (navy stroke 2), `.art-thin`, `.art-accent` (blue stroke), `.art-green` (green stroke);
- `.art-tint` (fill `url(#art-tint)`), `.art-soft` (blue-100), `.art-lilac` (green-100), `.art-paper`, `.art-blue-fill`, `.art-green-fill`;
- motion: `.art-spin`, `.art-spin-rev` (6s), `.art-float`, `.art-pulse`, `.art-draw` (with `style="--len:NNN"`).

The sprite's `<defs>` hold:

- `#art-tint`;
- `#gauge-tint`, `#gauge-pad`, `#gauge-tread`;
- the markers `#arrow-head`, `#arrow-head-accent`, `#arrow-head-green`.

Never redefine these ids. Give page gradients slug-prefixed ids (e.g. `fleet-road-grad`).

**Shared keyframes in site.css** (reference them freely):

- **Entrances:** rise-in, fade-in, fade-out, reveal-shift, reveal-scale, bar-draw, card-deal, note-in, pop, hop, shake, tick-pop, bubble-in, stamp-in, jump-in, gear-pop, knob-seat.
- **Strokes and bars:** art-draw, tag-check, bar-grow, paper-feed, dash-flow, scan-line, ring-pulse, meter-sweep, type-caret.
- **Loops:** art-spin, art-spin-rev, art-float, art-pulse, glow-float, card-sheen, status-pulse, ticker, road-move, car-drive, road-status-a/-b, g-sweep, odo-tenth, typing, tag-swing, tag-sway, lamp-flicker.
- **Blueprint:** bp-ping, bp-tag, bp-scan (set `--scan-h` for the travel distance).
- **Same-document VT:** fx-in, fx-out, rt-in, rt-out.
- **Sequence effects:** fx-rise, fx-fade, fx-pop, fx-left, fx-right, fx-drop, fx-draw, fx-wipe, fx-wipe-down, fx-grow-x, fx-type, fx-press, fx-flash, fx-pulse, fx-flip, fx-spin-back, fx-hide, toast-life, signal-pulse, match-ring.
- **Chrome:** sheet-up, sheet-down, vt-in, vt-out, btn-sheen, icon-wiggle.

Copy these inline with a slug prefix, single-use only:

- convoy and status-blink → `fleet-*`;
- spd-drive and cluster gauges → `reports-*`;
- pk-click → `security-pk-click`;
- the pk-* keyframes stay on privacy.

**Key-tag art** (booking hero, demo hero; its motion lives in site.css)

The `.tag-text` can read SERVICE, DEMO and so on.

```html
<svg class="keytag-art" viewBox="-40 0 440 320" aria-hidden="true">
  <path class="art-ink art-thin" d="M70 32h300" stroke-opacity=".28"/>
  <g class="art-ink art-thin" stroke-opacity=".45">
    <rect class="art-paper" x="96" y="23" width="30" height="18" rx="7"/><path d="M111 41v9"/>
    <rect class="art-paper" x="314" y="23" width="30" height="18" rx="7"/><path d="M329 41v9"/>
  </g>
  <rect class="art-ink art-paper" x="188" y="18" width="64" height="28" rx="11"/>
  <circle class="art-ink art-thin art-soft" cx="202" cy="32" r="3.5"/>
  <circle class="art-ink art-thin art-soft" cx="238" cy="32" r="3.5"/>
  <path class="art-ink" d="M220 46v12" stroke-width="5"/>
  <g class="swing">
    <circle class="art-ink" cx="220" cy="82" r="24" stroke-width="3"/>
    <path class="art-ink art-thin" d="M199.6 70.4a24 24 0 0 1 12-11" stroke-opacity=".55"/>
    <g class="fob">
      <path class="art-ink" d="M206 101c-4 4-8 9-10 15"/>
      <rect class="art-ink art-lilac" x="150" y="116" width="62" height="100" rx="26"/>
      <circle class="art-ink art-paper" cx="181" cy="142" r="10"/>
      <path class="art-ink art-thin" d="M177.6 143h6.8v4.6h-6.8zM179 143v-2a2 2 0 0 1 4 0v2"/>
      <circle class="art-ink art-paper" cx="181" cy="168" r="10"/>
      <path class="art-ink art-thin" d="M177.6 169h6.8v4.6h-6.8zM179 169v-2a2 2 0 0 1 4-.6"/>
      <circle class="art-ink art-soft" cx="181" cy="194" r="6"/>
      <rect class="art-ink art-paper" x="172" y="214" width="18" height="12" rx="3"/>
      <path class="art-ink art-paper" d="M175 226h12v56l-6 9-6-9z"/>
      <path class="art-ink art-thin" d="M187 238h-4v6h4M187 254h-4v6h4M187 268h-4v5h4" stroke-opacity=".7"/>
      <path class="art-ink art-thin" d="M181 232v44" stroke-opacity=".35"/>
    </g>
    <g class="tag">
      <path class="art-ink art-paper" d="M258 126h50l16 16v130a8 8 0 0 1-8 8h-66a8 8 0 0 1-8-8V142z"/>
      <circle class="art-tint" cx="283" cy="145" r="11"/>
      <circle class="art-ink art-thin art-paper" cx="283" cy="145" r="5.5"/>
      <path class="art-ink art-thin" d="M236 101c15 10 31 24 47 41" stroke-opacity=".8"/>
      <rect class="art-tint" x="243" y="166" width="80" height="24"/>
      <text class="tag-text" x="283" y="182.5" text-anchor="middle">DEMO</text>
      <rect class="art-ink art-thin art-paper" x="255" y="204" width="14" height="14" rx="4"/>
      <path class="tag-check art-ink art-accent" d="M257 210l5 5 11-13" stroke-width="2.6"/>
      <path class="art-ink art-thin" d="M277 211h34M256 234h55M256 250h40" stroke-opacity=".32"/>
    </g>
  </g>
</svg>
```

---

## 27. Reduce Motion, Pause, print and no-JS

| | Reduce Motion | Pause toggle | Print | No JS |
|---|---|---|---|---|
| Scroll reveal | everything shown | entrances end at once | shown | shown |
| Mock player | step N-1, no timers, no Replay | timers stop where they are; loaded paused → step N-1 | final step (beforeprint) with tags | shipped final markup |
| Reveal sequence | final state | final state | final state | final state |
| Counters / slots | final value, no roll | finish their roll | final | text in markup |
| Floats, sheen, glow, live dot, ticker, orbit, SMIL | static / paused | frozen in place | hidden or static | not paused (no gate) |
| CTA road | car parked mid-road, "Paid" | frozen; loaded paused → parked "Paid" | hidden | animates (CSS only) |
| Ticker | static wrapped pills | frozen | one static row | animates |
| Roadmap | full, all chips | scroll-driven (no animation) | as scrolled | full, all chips |
| Header ticks / label | hidden | static | hidden | not created |
| Pause toggle | shown | pressed, "Play animations" | hidden | hidden |
| Tilt | off | off | — | off |
| Page transitions | off | on | — | on |

**Print hides:**

- header, tab bar, sheet;
- CTA road;
- lane;
- float-notes, Replay, Pause toggle, finder jump, toasts.

**Your inline CSS must follow the same rules:**

- Every start state of a page-local animation must be scoped under `.js` or come from the keyframe's `from` (with `both`).
- The element's own style must be the end state.
- A page-local one-shot entrance that starts hidden needs the class `fx-once`, so Pause shows its end frame.
- Page-local loops go inside a `[data-play]` figure, so they pause off-screen and on Pause.

---

## 28. JS API and events

- `window.CCA = { validateFields(scope), submitForm(form), showSuccess(form), showError(form), summarize(form), nextField(scope, from) }`.
- `window.WPI`:
  - `motionOK()`: no Reduce Motion and not paused;
  - `isPaused()`;
  - `onMotion(fn(paused))`;
  - `shifter(scope)`;
  - `replay(figure)`.
- Events:
  - `seqstep` on a `[data-seq]` figure: `{ step, final }`;
  - `cycle` on a `[data-cycle]` element: `{ index }`;
  - `lampselect` on a `[data-lamps]` grid: `{ lamp, fromUser }`.
- `site.js` is deferred: it runs after the HTML is parsed, just before `DOMContentLoaded`. A plain inline `<script>` in the body runs **before** it, so wrap page code in `document.addEventListener("DOMContentLoaded", () => { … })`; by then `window.CCA` and `window.WPI` exist. (`defer` has no effect on inline scripts.)

---

## 29. Renamed and removed

| Old | Now |
|---|---|
| `.header-call`, `.header-call-num` | `.header-signin` + `.header-signin-text` |
| `.open-status`, `[data-open-status]`, hours table/list, `.is-today`, Apple Maps rewrite | removed (use `.live-dot` / `.live-pill` in mocks) |
| `.sheet-status`, `.footer-visit`, address/map blocks | removed |
| `.service-card` | `.feature-card` (old name still styled) |
| `.symptom` (services finder chip) | `.finder-chip` (`button[data-pain]`) |
| `.symptom` (appointment quick-add chip) | `.quick-chip` |
| `.finder-card` (copied blurbs) | `.finder-result` (compact link; generated) |
| `#mega-services`, `.mega-grid` 3 cols | `#mega-features`, 4 columns of `.mega-col` + `.mega-label` |
| `.roadmap-step:nth-child(n+3)` green | `.is-late` (computed) |
| `.make-tile`, `.make-chip`, coupon / small-engine styles, `mk-in/out`, `stub-off` | removed; `fx-in/out` (finder) and `rt-in/out` (roles) |
| inline `.keytag-art`, finder, shifter, lamp, sub-nav, ro-card, name-row, promise-grid CSS | now in site.css |
| `INBOX_FORMS` appointment/contact/fleet | `{ demo: "message" }` |
