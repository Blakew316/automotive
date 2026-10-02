/* WPI Driveline Shop Management System: shared behaviour for every marketing page.
   No dependencies. Everything degrades gracefully: without JS every page shows its end state.
   Components and their markup are documented in website/COMPONENTS.md. */
(() => {
  "use strict";
  const d = document;
  const root = d.documentElement;
  root.classList.add("js");

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
  const wideEnough = matchMedia("(min-width: 600px)");
  const $ = (sel, scope = d) => scope.querySelector(sel);
  const $$ = (sel, scope = d) => Array.from(scope.querySelectorAll(sel));
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const hasIO = "IntersectionObserver" in window;
  const reflow = (el) => void el.offsetWidth;

  // iOS Safari only shows :active (pressed) styles once the page listens for touches.
  d.addEventListener("touchstart", () => {}, { passive: true });

  /* ------------------------------------------------------------------
     Motion pause toggle (WCAG 2.2.2). Persisted as wpi-site:motion = "paused".
     ------------------------------------------------------------------ */
  const MOTION_KEY = "wpi-site:motion";
  let paused = false;
  try { paused = localStorage.getItem(MOTION_KEY) === "paused"; } catch { /* storage blocked */ }
  const motionListeners = [];
  const onMotion = (fn) => motionListeners.push(fn);
  /** True when looping and sequenced motion may run: no Reduce Motion and not paused. */
  const motionOK = () => !reduceMotion.matches && !paused;
  const paintToggles = () => {
    $$(".motion-toggle").forEach((btn) => {
      btn.setAttribute("aria-pressed", String(paused));
      const label = $(".motion-toggle-label", btn);
      if (label) label.textContent = paused ? "Play animations" : "Pause animations";
    });
  };
  const setPaused = (on, fromLoad) => {
    paused = on;
    root.classList.toggle("motion-paused", on);
    root.classList.toggle("motion-parked", on && Boolean(fromLoad));
    paintToggles();
    if (!fromLoad) {
      try { if (on) localStorage.setItem(MOTION_KEY, "paused"); else localStorage.removeItem(MOTION_KEY); } catch { /* storage blocked */ }
      motionListeners.forEach((fn) => fn(on));
    }
  };
  setPaused(paused, true);
  d.addEventListener("click", (e) => {
    const btn = e.target.closest && e.target.closest(".motion-toggle");
    if (btn) setPaused(!paused);
  });

  /* ------------------------------------------------------------------
     Header state, lane car (+ home stage ticks and label), RO journey roads: one rAF loop
     ------------------------------------------------------------------ */
  const header = $("[data-header]");
  const lane = header && $(".road-progress", header);
  const roadmaps = $$(".roadmap");
  const stages = $$("[data-stage]");
  let ticks = [];
  let label = null;
  let labelText = "";
  let labelTimer = 0;
  let ticking = false;

  if (lane && stages.length) {
    ticks = stages.map((s, i) => {
      const t = d.createElement("span");
      t.className = "lane-tick" + (i >= Math.floor(stages.length / 2) ? " is-late" : "");
      lane.append(t);
      return t;
    });
    label = d.createElement("span");
    label.className = "road-progress-label";
    lane.append(label);
  }

  // Steps in the second half of a road reach green (5 steps: 3-5; 4 steps: 3-4).
  roadmaps.forEach((rm) => {
    const steps = $$(".roadmap-step", rm);
    steps.forEach((s, i) => s.classList.toggle("is-late", i >= Math.floor(steps.length / 2)));
  });

  const docTop = (el) => el.getBoundingClientRect().top + window.scrollY;
  const measureRoads = () => {
    roadmaps.forEach((rm) => {
      const road = $(".roadmap-road", rm);
      if (road) rm.style.setProperty("--road-w", road.offsetWidth + "px");
    });
    if (ticks.length) {
      const max = root.scrollHeight - innerHeight;
      stages.forEach((s, i) => {
        const t = max > 0 ? clamp((docTop(s) - innerHeight * 0.4) / max) : 0;
        ticks[i].dataset.t = t;
        ticks[i].style.setProperty("--t", t.toFixed(4));
      });
    }
  };

  const setLabel = (text) => {
    if (!label || text === labelText) return;
    labelText = text;
    clearTimeout(labelTimer);
    if (!label.textContent || reduceMotion.matches) {
      label.textContent = text;
      label.classList.toggle("is-shown", Boolean(text));
      return;
    }
    label.classList.add("is-fading");
    labelTimer = setTimeout(() => {
      label.textContent = text;
      label.classList.toggle("is-shown", Boolean(text));
      label.classList.remove("is-fading");
    }, 160);
  };

  const onScroll = () => {
    ticking = false;
    const y = window.scrollY;
    const max = root.scrollHeight - innerHeight;
    const progress = max > 0 ? clamp(y / max) : 0;
    if (header) {
      header.classList.toggle("is-scrolled", y > 6);
      header.style.setProperty("--progress", progress.toFixed(4));
    }
    if (ticks.length) {
      ticks.forEach((t) => t.classList.toggle("is-passed", progress >= Number(t.dataset.t || 0) - 0.0005));
      let current = "";
      const line = innerHeight * 0.4;
      stages.forEach((s) => { if (s.getBoundingClientRect().top <= line) current = s.dataset.stage || ""; });
      setLabel(current);
      label.classList.toggle("is-flipped", progress > 0.8);
    }
    const vh = innerHeight;
    roadmaps.forEach((rm) => {
      const r = rm.getBoundingClientRect();
      const p = reduceMotion.matches ? 1 : clamp((vh * 0.82 - r.top) / (r.height + vh * 0.12));
      rm.style.setProperty("--p", p.toFixed(4));
      const steps = $$(".roadmap-step", rm);
      steps.forEach((s, i) => s.classList.toggle("is-reached", p >= i / steps.length + 0.015));
    });
  };
  const requestScroll = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(onScroll);
    }
  };
  addEventListener("scroll", requestScroll, { passive: true });
  addEventListener("resize", () => { measureRoads(); requestScroll(); }, { passive: true });
  addEventListener("load", () => { measureRoads(); requestScroll(); });
  measureRoads();
  onScroll();

  /* ------------------------------------------------------------------
     Desktop mega menu (#mega-features)
     ------------------------------------------------------------------ */
  $$("[data-menu]").forEach((item) => {
    const caret = $(".nav-caret", item);
    const panel = $(".mega", item);
    if (!caret || !panel) return;
    let timer;
    const set = (open) => {
      clearTimeout(timer);
      item.classList.toggle("is-open", open);
      caret.setAttribute("aria-expanded", String(open));
      panel.inert = !open; // keep the fading-out panel out of the tab order
    };
    panel.inert = true;
    caret.addEventListener("click", () => set(!item.classList.contains("is-open")));
    item.addEventListener("pointerenter", (e) => {
      if (e.pointerType !== "mouse") return;
      clearTimeout(timer);
      timer = setTimeout(() => set(true), 70);
    });
    item.addEventListener("pointerleave", (e) => {
      if (e.pointerType !== "mouse") return;
      clearTimeout(timer);
      timer = setTimeout(() => set(false), 200);
    });
    item.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && item.classList.contains("is-open")) {
        set(false);
        caret.focus();
      }
    });
    item.addEventListener("focusout", (e) => {
      if (!item.contains(e.relatedTarget)) set(false);
    });
    d.addEventListener("click", (e) => {
      if (!item.contains(e.target)) set(false);
    });
    addEventListener("pageswap", () => set(false));
    addEventListener("pagehide", () => set(false));
  });

  /* ------------------------------------------------------------------
     Bottom sheet (mobile "More" menu), built on <dialog>
     ------------------------------------------------------------------ */
  const closeSheet = (sheet) => {
    if (!sheet.open || sheet.classList.contains("is-closing")) return;
    if (!motionOK()) return sheet.close();
    sheet.classList.add("is-closing");
    sheet.addEventListener("animationend", function done(e) {
      if (e.target !== sheet) return;
      sheet.removeEventListener("animationend", done);
      if (!sheet.classList.contains("is-closing")) return;
      sheet.classList.remove("is-closing");
      sheet.close();
    });
  };
  $$("[data-open-sheet]").forEach((btn) => {
    const sheet = d.getElementById(btn.dataset.openSheet);
    if (!sheet || typeof sheet.showModal !== "function") return;
    btn.addEventListener("click", () => {
      sheet.classList.remove("is-closing");
      sheet.showModal();
      btn.setAttribute("aria-expanded", "true");
    });
    sheet.addEventListener("close", () => {
      sheet.classList.remove("is-closing");
      btn.setAttribute("aria-expanded", "false");
    });
    sheet.addEventListener("cancel", (e) => { e.preventDefault(); closeSheet(sheet); });
    sheet.addEventListener("click", (e) => { if (e.target === sheet) closeSheet(sheet); });
    $$("[data-close-sheet]", sheet).forEach((c) => c.addEventListener("click", () => closeSheet(sheet)));
    const reset = () => { sheet.classList.remove("is-closing"); if (sheet.open) sheet.close(); };
    addEventListener("pageswap", reset);
    addEventListener("pagehide", reset);
  });

  /* ------------------------------------------------------------------
     Rolling counters (.odometer[data-odometer]) and Slot roll (.slot-roll[data-slots])
     The final value is in the markup; JS rebuilds it into rolling strips.
     ------------------------------------------------------------------ */
  const isDigit = (c) => c >= "0" && c <= "9";
  const inMock = (el) => Boolean(el.closest(".mock-figure, [aria-hidden='true'], .mock-stage"));
  const seqBase = (el) => {
    const host = el.closest("[data-seq-i]");
    return host && host.closest("[data-reveal-seq]") ? Number(host.dataset.seqI) * 0.45 : 0;
  };
  const fmtValue = (el, raw) => {
    const text = String(raw == null ? "" : raw).trim();
    const clean = text.replace(/,/g, "");
    if (!/^[-+]?\d+(\.\d+)?$/.test(clean)) return text; // a literal such as "01:12" rolls character by character
    const dec = clamp(Math.round(Number(el.dataset.decimals || 0)), 0, 2);
    return Number(clean).toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping: el.dataset.group === "," });
  };
  const cell = (cls, html) => {
    const s = d.createElement("span");
    s.className = cls;
    if (html != null) s.innerHTML = html;
    s.setAttribute("aria-hidden", "true");
    return s;
  };
  const setStrip = (strip, index, instant) => {
    if (instant) strip.classList.add("is-instant");
    strip.style.transform = `translateY(calc(-1.28em * ${index}))`;
    if (instant) { reflow(strip); strip.classList.remove("is-instant"); }
  };

  const buildOdometer = (el) => {
    if (el._roll) return el._roll;
    const target = fmtValue(el, el.dataset.odometer);
    const from = el.dataset.from != null ? fmtValue(el, el.dataset.from) : null;
    const prefix = el.dataset.prefix || "";
    const suffix = el.dataset.suffix || "";
    const len = Math.max(target.length, from ? from.length : 0);
    const t = target.padStart(len, " ");
    const f = from ? from.padStart(len, " ") : null;
    const digitTotal = [...t].filter(isDigit).length;
    const label = el.dataset.label || `${prefix}${target}${suffix}`;
    if (inMock(el)) el.setAttribute("aria-hidden", "true");
    else { el.setAttribute("role", "img"); el.setAttribute("aria-label", label); }
    el.textContent = "";
    if (prefix) el.append(cell("odo-sep", prefix));
    const strips = [];
    let idx = 0;
    for (let j = 0; j < len; j++) {
      const tc = t[j], fc = f ? f[j] : " ";
      if (!isDigit(tc) && !isDigit(fc)) {
        if (tc.trim()) el.append(cell("odo-sep", tc));
        continue;
      }
      // Each strip is [blank, 0-9 × cycles]; index 0 is a blank cell (for digits the other value lacks).
      let cycles, start, end;
      if (f) {
        cycles = 2;
        start = isDigit(fc) ? 1 + Number(fc) : 0;
        end = isDigit(tc) ? 1 + Number(tc) + (isDigit(fc) && Number(tc) < Number(fc) ? 10 : 0) : 0;
        if (isDigit(tc) && !isDigit(fc)) end = 1 + Number(tc);
      } else {
        cycles = 1 + Math.min(digitTotal - idx, 4);
        start = 1;
        end = isDigit(tc) ? 1 + (cycles - 1) * 10 + Number(tc) : 0;
      }
      const c = cell("odo-digit");
      const strip = d.createElement("span");
      strip.className = "odo-strip";
      strip.innerHTML = "<span>&nbsp;</span>" + Array.from({ length: cycles * 10 }, (_, k) => `<span>${k % 10}</span>`).join("");
      strip.style.setProperty("--d", `${idx * 0.05}s`);
      c.append(strip);
      el.append(c);
      strips.push({ strip, start, end });
      idx++;
    }
    if (el.hasAttribute("data-tenth")) {
      el.append(cell("odo-sep", "."));
      const c = cell("odo-digit is-tenth");
      const strip = d.createElement("span");
      strip.className = "odo-strip";
      strip.innerHTML = Array.from({ length: 11 }, (_, k) => `<span>${k % 10}</span>`).join("");
      c.append(strip);
      el.append(c);
      el._tenth = strip;
    }
    if (suffix) el.append(cell("odo-sep", suffix));
    if (el.dataset.duration) el.style.setProperty("--odo-dur", `${Number(el.dataset.duration)}s`);
    const base = seqBase(el);
    if (base) el.style.setProperty("--odo-base", `${base}s`);
    el._roll = {
      run: (instant) => { strips.forEach((s) => setStrip(s.strip, s.end, instant)); if (el._tenth) el._tenth.classList.toggle("is-running", !instant && motionOK()); },
      reset: () => { strips.forEach((s) => setStrip(s.strip, s.start, true)); if (el._tenth) el._tenth.classList.remove("is-running"); },
    };
    el._roll.reset();
    return el._roll;
  };

  const CHARSETS = {
    vin: "ABCDEFGHJKLMNPRSTUVWXYZ0123456789",
    digits: "0123456789",
    hex: "0123456789abcdef",
    key: "•0123456789abcdef",
  };
  const buildSlots = (el) => {
    if (el._roll) return el._roll;
    const target = String(el.dataset.slots || el.textContent).trim();
    const set = CHARSETS[el.dataset.charset || "vin"] || el.dataset.charset || CHARSETS.vin;
    const checkAt = el.dataset.check != null ? Number(el.dataset.check) : -1;
    if (inMock(el)) el.setAttribute("aria-hidden", "true");
    else { el.setAttribute("role", "img"); el.setAttribute("aria-label", el.dataset.label || target); }
    el.textContent = "";
    const strips = [];
    let n = 0;
    [...target].forEach((ch, i) => {
      const at = set.indexOf(ch);
      if (at < 0) { el.append(cell("slot-sep", ch === " " ? "&nbsp;" : ch)); return; }
      const c = cell("slot-cell" + (i === checkAt ? " is-check" : ""));
      const strip = d.createElement("span");
      strip.className = "slot-strip";
      strip.innerHTML = [...set, ...set].map((x) => `<span>${x}</span>`).join("");
      strip.style.setProperty("--d", `${n * 0.06}s`);
      c.append(strip);
      el.append(c);
      strips.push({ strip, start: (n * 7 + 3) % set.length, end: set.length + at });
      n++;
    });
    const base = seqBase(el);
    if (base) el.style.setProperty("--slot-base", `${base}s`);
    el.style.setProperty("--slots-done", `${(base + 1.6 + n * 0.06).toFixed(2)}s`);
    el._roll = {
      run: (instant) => strips.forEach((s) => setStrip(s.strip, s.end, instant)),
      reset: () => strips.forEach((s) => setStrip(s.strip, s.start, true)),
    };
    el._roll.reset();
    return el._roll;
  };
  const rollers = [...$$("[data-odometer]").map((el) => [el, buildOdometer(el)]), ...$$("[data-slots]").map((el) => [el, buildSlots(el)])];

  /* ------------------------------------------------------------------
     Scroll reveal (+ stagger) and Reveal sequence. One observer adds .is-in once.
     ------------------------------------------------------------------ */
  $$("[data-reveal-stagger]").forEach((group) => {
    Array.from(group.children).forEach((child, i) => {
      if (!child.hasAttribute("data-reveal")) child.setAttribute("data-reveal", group.dataset.revealStagger || "");
      child.style.setProperty("--i", i % 8);
    });
  });
  $$(".pop-list, .ro-list, .signal-list").forEach((list) => {
    Array.from(list.children).forEach((li, i) => { li.style.setProperty("--n", i); li.style.setProperty("--i", i); });
  });

  // Counters and slots run on their own when they are not part of a Mock player or a Reveal sequence.
  const looseRollers = rollers.filter(([el]) => !el.closest("[data-seq], [data-reveal-seq]"));
  const runRollersIn = (scope, instant) => rollers.forEach(([el, r]) => { if (scope.contains(el) && !el.closest("[data-seq]")) r.run(instant); });
  const resetRollersIn = (scope) => rollers.forEach(([el, r]) => { if (scope.contains(el) && !el.closest("[data-seq]")) r.reset(); });

  const revealIn = (el, instant) => {
    el.classList.add("is-in");
    if (el.matches("[data-reveal-seq]")) runRollersIn(el, instant);
    if (el._roll) el._roll.run(instant);
    if (el._onReveal) el._onReveal();
  };
  const revealTargets = $$("[data-reveal], [data-reveal-seq], .pop-list, .ro-card, .signal-list, .name-row, [data-lamps]");
  looseRollers.forEach(([el]) => revealTargets.push(el));
  if (hasIO && !reduceMotion.matches) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          revealIn(entry.target, false);
          io.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
    );
    revealTargets.forEach((el) => io.observe(el));
  } else {
    revealTargets.forEach((el) => revealIn(el, true));
  }
  /** Replay the Reveal sequences inside a scope (a tab panel that was just shown). */
  const replayRevealSeq = (scope) => {
    const seqs = scope.matches("[data-reveal-seq]") ? [scope] : $$("[data-reveal-seq]", scope);
    seqs.forEach((s) => {
      if (!reduceMotion.matches) {
        s.classList.remove("is-in");
        resetRollersIn(s);
        reflow(s);
      }
      revealIn(s, reduceMotion.matches);
    });
  };

  /* ------------------------------------------------------------------
     3D tilt for the brand card and App card stage (anything with data-tilt)
     ------------------------------------------------------------------ */
  if (finePointer.matches && !reduceMotion.matches) {
    $$("[data-tilt]").forEach((card) => {
      const scope = card.closest("[data-tilt-scope]") || card.parentElement;
      const max = Number(card.dataset.tilt || 10);
      const clear = () => {
        card.classList.remove("is-tilting");
        ["--rx", "--ry", "--mx", "--my"].forEach((p) => card.style.removeProperty(p));
      };
      scope.addEventListener("pointermove", (e) => {
        if (!wideEnough.matches || paused) return clear();
        const r = card.getBoundingClientRect();
        const x = clamp((e.clientX - r.left) / r.width, -0.2, 1.2);
        const y = clamp((e.clientY - r.top) / r.height, -0.2, 1.2);
        card.classList.add("is-tilting");
        card.style.setProperty("--ry", `${((x - 0.5) * max).toFixed(2)}deg`);
        card.style.setProperty("--rx", `${((0.5 - y) * max * 0.8).toFixed(2)}deg`);
        card.style.setProperty("--mx", `${(x * 100).toFixed(1)}%`);
        card.style.setProperty("--my", `${(y * 100).toFixed(1)}%`);
      });
      scope.addEventListener("pointerleave", clear);
    });
  }

  /* ------------------------------------------------------------------
     Tabs (WAI-ARIA pattern). A .tabs-thumb slides under the selected tab;
     Reveal sequences inside a panel replay when the panel is shown.
     ------------------------------------------------------------------ */
  $$("[data-tabs]").forEach((wrap) => {
    const tabs = $$('[role="tab"]', wrap);
    const thumb = $(".tabs-thumb", wrap);
    const placeThumb = (tab) => {
      if (!thumb || !tab || !tab.offsetParent) return;
      thumb.style.width = tab.offsetWidth + "px";
      thumb.style.translate = `${tab.offsetLeft}px 0`;
      thumb.classList.add("is-on");
    };
    let current = null;
    const select = (tab, focus, initial) => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
        const panel = d.getElementById(t.getAttribute("aria-controls"));
        if (panel) {
          panel.hidden = !on;
          if (!panel.hasAttribute("tabindex")) panel.tabIndex = 0;
          if (on && !initial && current !== tab) replayRevealSeq(panel);
        }
      });
      current = tab;
      placeThumb(tab);
      if (focus) tab.focus();
    };
    tabs.forEach((t, i) => {
      t.addEventListener("click", () => select(t));
      t.addEventListener("keydown", (e) => {
        const map = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 };
        if (!(e.key in map)) return;
        e.preventDefault();
        select(tabs[(map[e.key] + tabs.length) % tabs.length], true);
      });
    });
    select(tabs.find((t) => t.getAttribute("aria-selected") === "true") || tabs[0], false, true);
    addEventListener("resize", () => placeThumb(current), { passive: true });
  });

  /* ------------------------------------------------------------------
     Mock player: [data-play] figures play only while on screen; [data-seq] steps through
     cumulative states (data-step, data-reached), with loops, a hold, Replay, and pauses on
     hidden tabs, the Pause toggle, prerendering and print.
     ------------------------------------------------------------------ */
  const playFigures = $$("[data-play]");
  const players = [];
  const smilIn = (fig) => $$("svg", fig).filter((s) => typeof s.pauseAnimations === "function" && s.querySelector("animate, animateMotion, animateTransform, set"));
  const setSmil = (fig, run) => smilIn(fig).forEach((svg) => {
    if (run) svg.unpauseAnimations();
    else {
      svg.pauseAnimations();
      const rest = svg.getAttribute("data-smil-rest");
      if (rest != null && !fig._smilStarted) { try { svg.setCurrentTime(Number(rest)); } catch { /* not supported */ } }
    }
  });

  /* Board slide: a card with data-path="approved progress ready" moves to the column for each step. */
  const updateCounts = (board, bump) => {
    $$(".mock-col", board).forEach((col) => {
      const count = $(".mock-count", col);
      if (!count) return;
      const n = String($$(".mock-card:not(.is-ghost)", col).length);
      if (count.textContent !== n) {
        count.textContent = n;
        if (bump && motionOK()) { count.classList.remove("is-bump"); reflow(count); count.classList.add("is-bump"); }
      }
    });
  };
  const setPage = (board, col) => {
    const cols = $$(".mock-col", board).filter((c) => c.offsetParent !== null || getComputedStyle(c).display !== "none");
    board.style.setProperty("--page", String(Math.max(0, cols.indexOf(col))));
  };
  const showToast = (board, col) => {
    const fig = board.closest("[data-seq]") || board;
    const toast = $(".mock-toast", fig);
    if (!toast || !motionOK()) return;
    const name = col.dataset.label || ($(".mock-col-head > span", col) || {}).textContent || "";
    const slot = $("[data-toast-col]", toast);
    if (slot) slot.textContent = name.trim();
    toast.classList.remove("is-live");
    reflow(toast);
    toast.classList.add("is-live");
  };
  const moveCard = (card, key, instant) => {
    const board = card.closest(".mock-board");
    if (!board || !key) return;
    const col = $(`.mock-col[data-col="${key}"]`, board);
    if (!col) return;
    if (card.parentElement === col) { setPage(board, col); return; }
    const head = $(".mock-col-head", col);
    const place = () => (head ? head.after(card) : col.prepend(card));
    const paged = getComputedStyle(board).display === "flex";
    if (instant || !motionOK() || !card.animate) {
      place();
      updateCounts(board, false);
      setPage(board, col);
      return;
    }
    if (paged) {
      place();
      updateCounts(board, true);
      setPage(board, col);
      card.animate([{ transform: "scale(1.04) rotate(2deg)", boxShadow: "var(--shadow-3)" }, { transform: "none" }], { duration: 520, easing: "cubic-bezier(.34, 1.56, .64, 1)" });
      showToast(board, col);
      return;
    }
    const first = card.getBoundingClientRect();
    place();
    updateCounts(board, true);
    setPage(board, col);
    const last = card.getBoundingClientRect();
    const dx = first.left - last.left, dy = first.top - last.top;
    card.classList.add("is-moving");
    const anim = card.animate([
      { transform: `translate(${dx}px, ${dy}px)` },
      { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 12}px) scale(1.04) rotate(2deg)`, offset: 0.45 },
      { transform: "none" },
    ], { duration: 520, easing: "cubic-bezier(.34, 1.56, .64, 1)" });
    const done = () => card.classList.remove("is-moving");
    anim.onfinish = done;
    anim.oncancel = done;
    showToast(board, col);
  };

  const makePlayer = (fig) => {
    const N = Math.max(1, parseInt(fig.dataset.seq, 10) || 1);
    const ms = Number(fig.dataset.seqMs) || 1400;
    const hold = Number(fig.dataset.seqHold) || 2600;
    const loops = Math.max(1, parseInt(fig.dataset.loops, 10) || 1);
    const atOf = (el) => { const host = el.closest("[data-at]"); return host && fig.contains(host) ? Number(host.dataset.at) || 0 : 0; };
    const counters = rollers.filter(([el]) => fig.contains(el)).map(([el, r]) => ({ at: atOf(el), r }));
    const movers = $$("[data-path]", fig).map((el) => ({ el, path: el.dataset.path.trim().split(/[\s,]+/) }));
    const p = { fig, N, step: N - 1, loop: 0, runLoops: loops, timer: 0, armed: false, playing: false, done: true, live: true };
    const apply = (k, instant) => {
      p.step = k;
      fig.dataset.step = String(k);
      fig.dataset.reached = Array.from({ length: k + 1 }, (_, i) => i).join(" ");
      counters.forEach((c) => {
        if (k < c.at || (c.at === 0 && !p.live)) c.r.reset(); // step-0 counters wait until the figure plays
        else c.r.run(instant);
      });
      movers.forEach((m) => moveCard(m.el, m.path[Math.min(k, m.path.length - 1)], instant));
      fig.dispatchEvent(new CustomEvent("seqstep", { detail: { step: k, final: k === N - 1 } }));
    };
    const clear = () => { clearTimeout(p.timer); p.timer = 0; };
    const canRun = () => p.armed && p.playing && !paused && !reduceMotion.matches && !d.hidden && !d.prerendering && !p.done;
    const schedule = () => {
      clear();
      if (!canRun()) return;
      if (!p.live) { p.live = true; counters.forEach((c) => { if (c.at === 0) c.r.run(false); }); }
      if (p.step < N - 1) {
        p.timer = setTimeout(() => { apply(p.step + 1, false); schedule(); }, ms);
      } else {
        p.timer = setTimeout(() => {
          p.loop++;
          if (p.loop >= p.runLoops) { p.done = true; return; }
          restart(true);
        }, hold);
      }
    };
    const toStart = () => {
      p.live = false;
      fig.dataset.reached = "";
      fig.dataset.step = "";
      reflow(fig);
      apply(0, true);
    };
    const restart = (fade) => {
      clear();
      if (fade) {
        fig.classList.add("is-resetting");
        p.timer = setTimeout(() => {
          toStart();
          fig.classList.remove("is-resetting");
          schedule();
        }, 300);
      } else {
        toStart();
        schedule();
      }
    };
    p.arm = () => {
      if (p.armed) return;
      p.armed = true;
      p.done = false;
      p.loop = 0;
      p.runLoops = loops;
      fig.classList.add("is-armed");
      toStart();
      schedule();
    };
    p.finalize = () => {
      clear();
      p.live = true;
      fig.classList.remove("is-resetting");
      apply(N - 1, true);
      p.done = true;
    };
    p.replay = () => {
      if (!motionOK()) return;
      if (!p.armed) { p.armed = true; fig.classList.add("is-armed"); }
      p.done = false;
      p.loop = 0;
      p.runLoops = 1;
      restart(true);
    };
    p.schedule = schedule;
    p.clear = clear;
    return p;
  };

  const setPlaying = (fig, on) => {
    fig.classList.toggle("is-playing", on);
    if (on) fig._smilStarted = fig._smilStarted || motionOK();
    setSmil(fig, on && motionOK());
    const p = fig._player;
    if (!p) return;
    p.playing = on;
    if (on) p.schedule(); else p.clear();
  };

  playFigures.forEach((fig) => {
    if (fig.hasAttribute("data-seq")) {
      fig._player = makePlayer(fig);
      players.push(fig._player);
    }
    const replay = $(".mock-replay", fig);
    if (replay) replay.addEventListener("click", () => fig._player && fig._player.replay());
  });

  if (!hasIO || reduceMotion.matches) {
    // Everything rests on its final frame: no timers, no loops.
    playFigures.forEach((fig) => {
      fig.classList.add("is-playing", "is-final");
      if (fig._player) fig._player.finalize();
      setSmil(fig, false);
    });
  } else {
    if (paused) players.forEach((p) => p.finalize());
    else players.forEach((p) => p.arm());
    const playIO = new IntersectionObserver(
      (entries) => entries.forEach((e) => setPlaying(e.target, e.isIntersecting)),
      { threshold: 0.15 }
    );
    playFigures.forEach((fig) => playIO.observe(fig));
    onMotion((nowPaused) => {
      playFigures.forEach((fig) => setSmil(fig, !nowPaused && fig.classList.contains("is-playing")));
      players.forEach((p) => {
        if (nowPaused) p.clear();
        else if (!p.armed) p.arm();
        else p.schedule();
      });
    });
    d.addEventListener("visibilitychange", () => players.forEach((p) => (d.hidden ? p.clear() : p.schedule())));
    if (d.prerendering) d.addEventListener("prerenderingchange", () => players.forEach((p) => p.schedule()), { once: true });
  }
  // Print every sequence on its final frame (with its Example tag), then put it back.
  const printState = new Map();
  addEventListener("beforeprint", () => players.forEach((p) => {
    printState.set(p, p.step);
    p.clear();
    p.fig.classList.remove("is-resetting");
    p.fig.dataset.step = String(p.N - 1);
    p.fig.dataset.reached = Array.from({ length: p.N }, (_, i) => i).join(" ");
  }));
  addEventListener("afterprint", () => players.forEach((p) => {
    const k = printState.has(p) ? printState.get(p) : p.N - 1;
    p.fig.dataset.step = String(k);
    p.fig.dataset.reached = Array.from({ length: k + 1 }, (_, i) => i).join(" ");
    p.schedule();
  }));

  /* ------------------------------------------------------------------
     data-cycle: cross-fade the children every 4.5s while visible; 3 cycles, then rest on the first.
     ------------------------------------------------------------------ */
  $$("[data-cycle]").forEach((box) => {
    const items = Array.from(box.children);
    if (items.length < 2) return;
    const max = Number(box.dataset.cycleCount) || 3;
    const ms = Number(box.dataset.cycleMs) || 4500;
    let idx = 0, rounds = 0, timer = 0, visible = !hasIO;
    const show = (i) => {
      idx = i;
      items.forEach((it, k) => it.classList.toggle("is-active", k === i));
      box.dataset.index = String(i);
      box.dispatchEvent(new CustomEvent("cycle", { detail: { index: i } }));
    };
    const schedule = () => {
      clearTimeout(timer);
      timer = 0;
      if (!visible || !motionOK() || d.hidden || rounds >= max) return;
      timer = setTimeout(() => {
        const next = (idx + 1) % items.length;
        if (next === 0) rounds++;
        show(next);
        schedule();
      }, ms);
    };
    show(0);
    if (hasIO) {
      new IntersectionObserver((entries) => {
        visible = entries[0].isIntersecting;
        schedule();
      }, { threshold: 0.15 }).observe(box.closest("[data-play]") || box);
    }
    onMotion(schedule);
    d.addEventListener("visibilitychange", schedule);
    schedule();
  });

  /* ------------------------------------------------------------------
     Same-document View Transition helper (finder results, role filter)
     ------------------------------------------------------------------ */
  let vtRunning = 0;
  const withTransition = (cls, name, els, update) => {
    if (typeof d.startViewTransition !== "function" || !motionOK()) return update();
    vtRunning++;
    root.classList.add(cls);
    const tag = () => els().forEach((el) => {
      if (!el.dataset.vtName) return;
      el.style.viewTransitionName = el.dataset.vtName;
      el.style.viewTransitionClass = name;
    });
    const untag = () => $$("[data-vt-name]").forEach((el) => { el.style.viewTransitionName = ""; el.style.viewTransitionClass = ""; });
    tag();
    let vt;
    try {
      vt = d.startViewTransition(() => { update(); tag(); });
    } catch {
      vtRunning--; untag(); root.classList.remove(cls); update(); return undefined;
    }
    vt.finished.finally(() => { untag(); if (--vtRunning === 0) root.classList.remove(cls); });
    return vt;
  };

  /* ------------------------------------------------------------------
     Bottleneck finder (features.html #finder): pain chips → matching directory cards
     ------------------------------------------------------------------ */
  const finderData = (() => {
    const el = d.getElementById("finder-data");
    if (!el) return null;
    try { return JSON.parse(el.textContent); } catch { return null; }
  })();
  const painChips = $$("button[data-pain]");
  if (painChips.length) {
    const map = {};
    const info = {};
    const raw = finderData || {};
    const pains = raw.pains || raw;
    if (Array.isArray(pains)) pains.forEach((p) => { if (p) map[p.slug || p.id || p.pain] = p.features || p.slugs || p.matches || []; });
    else if (pains && typeof pains === "object") Object.entries(pains).forEach(([k, v]) => { if (Array.isArray(v)) map[k] = v; });
    const feats = raw.features;
    if (Array.isArray(feats)) feats.forEach((f) => { if (f && f.slug) info[f.slug] = f; });
    else if (feats && typeof feats === "object") Object.assign(info, feats);
    // Fall back to data-features="a b" on each chip
    painChips.forEach((c) => { if (!map[c.dataset.pain] && c.dataset.features) map[c.dataset.pain] = c.dataset.features.split(/[\s,]+/); });

    const results = $("[data-finder-results]");
    const status = $("[data-finder-status]");
    const empty = $("[data-finder-empty]");
    const clearBtn = $("[data-finder-clear]");
    const gauge = $(".finder-gauge");
    const gaugeCount = gauge && $(".g-count", gauge);
    const panel = $(".finder-panel");
    const jump = $("[data-finder-jump]");
    const jumpText = $("[data-finder-jump-text]");
    const finderSec = (painChips[0] && painChips[0].closest("section")) || null;
    const total = Math.max(1, $$(".dir-card[data-slug]").length || Object.keys(info).length || 12);
    let order = [];
    let panelVisible = true, finderVisible = false, count = 0;
    const cardFor = (slug) => $(`.dir-card[data-slug="${slug}"]`) || d.getElementById(`dir-${slug}`);
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    const updateJump = () => {
      if (!jump) return;
      if (jumpText) jumpText.textContent = count === 1 ? "See 1 match" : `See ${count} matches`;
      jump.hidden = !(count > 0 && !panelVisible && finderVisible);
    };
    const paint = () => {
      const slugs = [];
      order.forEach((id) => (map[id] || []).forEach((s) => { if (!slugs.includes(s)) slugs.push(s); }));
      count = slugs.length;
      if (results) {
        results.innerHTML = slugs.map((slug, i) => {
          const card = cardFor(slug);
          const meta = info[slug] || {};
          const title = (card && ($("h3, h4", card) || {}).textContent) || meta.title || meta.short || slug;
          const iconUse = card && $(".icon-tile use", card);
          const icon = (iconUse && iconUse.getAttribute("href")) || (meta.icon ? `#${String(meta.icon).replace(/^#/, "")}` : "#i-arrow-right");
          const href = card && card.id ? `#${card.id}` : meta.href || `features/${slug}.html`;
          return `<li data-vt-name="fx-${esc(slug)}" style="--i:${i}"><a class="finder-result" href="${esc(href)}" data-match="${esc(slug)}">` +
            `<span class="icon-tile icon-tile-sm" aria-hidden="true"><svg class="icon"><use href="${esc(icon)}"/></svg></span>` +
            `<span>${esc(title.trim())}</span><svg class="icon chev" aria-hidden="true"><use href="#i-chevron-right"/></svg></a></li>`;
        }).join("");
      }
      if (empty) empty.hidden = count > 0;
      if (clearBtn) clearBtn.hidden = order.length === 0;
      if (status) status.textContent = order.length === 0 ? "Pick what’s slowing your shop down." : count === 1 ? "1 feature matches" : `${count} features match`;
      if (gauge) {
        gauge.classList.toggle("is-set", count > 0);
        gauge.style.setProperty("--angle", `${(-58 + 116 * clamp(count / Math.min(total, 6))).toFixed(1)}deg`);
        if (gaugeCount) gaugeCount.textContent = String(count);
      }
      updateJump();
    };
    const update = () => withTransition("vt-finder", "fx", () => (results ? Array.from(results.children) : []), paint);
    painChips.forEach((chip) => chip.addEventListener("click", () => {
      const id = chip.dataset.pain;
      const on = chip.getAttribute("aria-pressed") !== "true";
      chip.setAttribute("aria-pressed", String(on));
      order = on ? order.concat(id) : order.filter((x) => x !== id);
      update();
    }));
    if (clearBtn) clearBtn.addEventListener("click", () => {
      painChips.forEach((c) => c.setAttribute("aria-pressed", "false"));
      order = [];
      update();
      painChips[0].focus();
    });
    if (results) results.addEventListener("click", (e) => {
      const a = e.target.closest("a[data-match]");
      if (!a) return;
      const card = cardFor(a.dataset.match);
      if (!card) return;
      e.preventDefault();
      card.hidden = false;
      card.scrollIntoView({ behavior: motionOK() ? "smooth" : "auto", block: "center" });
      card.classList.remove("is-match");
      reflow(card);
      card.classList.add("is-match");
      // Focus the card's "Learn more" link (not the Shop Cloud link inside its Needs line).
      const link = $(".dir-card-foot a[href]", card) || $("a[href]", card);
      if (link) setTimeout(() => link.focus({ preventScroll: true }), motionOK() ? 450 : 0);
    });
    if (hasIO && panel) {
      new IntersectionObserver((entries) => { panelVisible = entries[0].isIntersecting; updateJump(); }, { rootMargin: "0px 0px -140px 0px" }).observe(panel);
    }
    if (hasIO && finderSec) {
      new IntersectionObserver((entries) => { finderVisible = entries[0].isIntersecting; updateJump(); }).observe(finderSec);
    }
    if (jump) jump.addEventListener("click", (e) => {
      e.preventDefault();
      panel.scrollIntoView({ behavior: motionOK() ? "smooth" : "auto", block: "start" });
      const h = $("h2, h3", panel);
      if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
    });
    paint();
  }

  // Scroll-spy navs register a refresh here, so layout changes (the role filter) re-place their pill.
  const spyRefreshers = [];
  const refreshSpies = () => spyRefreshers.forEach((fn) => fn());

  /* ------------------------------------------------------------------
     Role filter (features.html directory): chips filter .dir-card[data-roles]; supports ?role=
     ------------------------------------------------------------------ */
  const roleChips = $$("button[data-role]");
  const roleCards = $$(".dir-card[data-roles]");
  if (roleChips.length && roleCards.length) {
    const roleStatus = $("[data-role-status]");
    const roles = roleChips.map((c) => c.dataset.role);
    roleCards.forEach((c) => { c.dataset.vtName = `rt-${c.dataset.slug || c.id || Math.random().toString(36).slice(2)}`; });
    const paint = (role) => {
      let shown = 0;
      roleChips.forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.role === role)));
      roleCards.forEach((card) => {
        const list = card.dataset.roles.split(/[\s,]+/);
        const on = role === "all" || list.includes(role) || list.includes("all");
        card.hidden = !on;
        if (on) shown++;
      });
      $$(".dir-group").forEach((g) => {
        const visible = $$(".dir-card", g).filter((c) => !c.hidden).length;
        g.classList.toggle("is-empty", visible === 0);
        const navLink = $(`[data-dir-nav] a[href="#${g.id}"]`);
        if (navLink) {
          navLink.parentElement.classList.toggle("is-empty", visible === 0);
          const n = $(".count", navLink);
          if (n) n.textContent = String(visible);
        }
      });
      if (roleStatus) roleStatus.textContent = `Showing ${shown} of ${roleCards.length} features`;
      refreshSpies();
    };
    const setRole = (role, animate) => {
      if (!roles.includes(role)) role = "all";
      if (animate) withTransition("vt-roles", "rt", () => roleCards.filter((c) => !c.hidden), () => paint(role));
      else paint(role);
      try {
        const url = new URL(location.href);
        if (role === "all") url.searchParams.delete("role"); else url.searchParams.set("role", role);
        history.replaceState(history.state, "", url);
      } catch { /* file: or sandboxed */ }
    };
    roleChips.forEach((c) => c.addEventListener("click", () => setRole(c.dataset.role, true)));
    let initial = "all";
    try { initial = new URL(location.href).searchParams.get("role") || "all"; } catch { /* ignore */ }
    if (roles.includes(initial) && initial !== "all") setRole(initial, false);
    else paint(roles.includes("all") ? "all" : roles[0]);
  }

  /* ------------------------------------------------------------------
     Scroll-spy pills: nav[data-spy] (or [data-dir-nav]) marks the section in view with
     aria-current, slides a .dir-nav-pill / .spy-pill, and keeps a sideways chip row in view.
     ------------------------------------------------------------------ */
  $$("[data-spy], [data-dir-nav]").forEach((nav) => {
    const links = $$('a[href^="#"]', nav);
    const targets = links.map((a) => d.getElementById(decodeURIComponent(a.hash.slice(1))));
    if (!targets.some(Boolean)) return;
    const pill = $(".dir-nav-pill, .spy-pill", nav);
    const row = $("ol, ul", nav);
    const value = nav.dataset.spy || "location";
    const scope = nav.dataset.spyScope ? d.querySelector(nav.dataset.spyScope) : null;
    let current;
    const placePill = (active) => {
      if (!pill) return;
      if (active && pill.offsetParent && active.offsetParent) {
        pill.style.transform = `translateY(${active.parentElement.offsetTop}px)`;
        pill.style.height = active.offsetHeight + "px";
        pill.classList.add("is-on");
      } else pill.classList.remove("is-on");
    };
    const setActive = (i) => {
      // The pill is re-placed on every pass: the links above it can change height (role filter, resize).
      placePill(links[i]);
      if (i === current) return;
      current = i;
      links.forEach((a, k) => (k === i ? a.setAttribute("aria-current", value) : a.removeAttribute("aria-current")));
      const active = links[i];
      if (active && row && row.scrollWidth > row.clientWidth + 1) {
        const li = active.parentElement;
        row.scrollTo({ left: li.offsetLeft - (row.clientWidth - li.offsetWidth) / 2, behavior: motionOK() ? "smooth" : "auto" });
      }
    };
    let queued = false;
    const spy = () => {
      queued = false;
      const headerH = header ? header.offsetHeight : 0;
      const line = Math.max(headerH + 64, innerHeight * 0.3);
      let idx = -1;
      targets.forEach((t, k) => { if (t && t.offsetParent !== null && t.getBoundingClientRect().top <= line) idx = k; });
      if (idx === -1 && targets[0] && targets[0].getBoundingClientRect().top < innerHeight) idx = 0;
      if (innerHeight + window.scrollY >= root.scrollHeight - 2) {
        for (let k = targets.length - 1; k >= 0; k--) if (targets[k] && targets[k].offsetParent !== null) { idx = k; break; }
      }
      if (scope && scope.getBoundingClientRect().bottom < line) idx = -1;
      setActive(idx);
      const top = parseFloat(getComputedStyle(nav).top);
      nav.classList.toggle("is-stuck", getComputedStyle(nav).position === "sticky" && Number.isFinite(top) && nav.getBoundingClientRect().top <= top + 0.5 && idx > -1);
    };
    const request = () => { if (!queued) { queued = true; requestAnimationFrame(spy); } };
    addEventListener("scroll", request, { passive: true });
    addEventListener("resize", () => { current = undefined; request(); }, { passive: true });
    spyRefreshers.push(() => { current = undefined; request(); });
    spy();
  });

  /* ------------------------------------------------------------------
     Concern lamps: [data-lamps] grid of .lamp[data-lamp][aria-pressed] buttons; the matching
     [data-lamp-panel] shows; arrow keys move like a grid; a one-pass bulb check on first reveal.
     ------------------------------------------------------------------ */
  $$("[data-lamps]").forEach((grid) => {
    const lamps = $$(".lamp[data-lamp]", grid);
    if (!lamps.length) return;
    const host = grid.dataset.lamps ? d.getElementById(grid.dataset.lamps) : null;
    const panels = host ? $$("[data-lamp-panel]", host) : [];
    const select = (lamp, fromUser) => {
      lamps.forEach((b) => b.setAttribute("aria-pressed", String(b === lamp)));
      panels.forEach((p) => p.classList.toggle("is-active", p.dataset.lampPanel === lamp.dataset.lamp));
      grid.dispatchEvent(new CustomEvent("lampselect", { detail: { lamp: lamp.dataset.lamp, fromUser } }));
    };
    lamps.forEach((b) => b.addEventListener("click", () => select(b, true)));
    const pressed = lamps.find((b) => b.getAttribute("aria-pressed") === "true");
    const activePanel = panels.find((p) => p.classList.contains("is-active")) || panels[0];
    if (pressed) select(pressed, false);
    else if (activePanel) panels.forEach((p) => p.classList.toggle("is-active", p === activePanel));
    grid.addEventListener("keydown", (e) => {
      const i = lamps.indexOf(e.target);
      if (i < 0) return;
      const cols = getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean).length || 4;
      const map = { ArrowRight: i + 1, ArrowLeft: i - 1, ArrowDown: i + cols, ArrowUp: i - cols, Home: 0, End: lamps.length - 1 };
      if (!(e.key in map)) return;
      e.preventDefault();
      lamps[clamp(map[e.key], 0, lamps.length - 1)].focus();
    });
    let running = false;
    const bulbCheck = () => {
      if (running || !motionOK()) return;
      running = true;
      const step = 40, holdMs = 600;
      lamps.forEach((b, i) => setTimeout(() => b.classList.add("is-check"), i * step));
      lamps.forEach((b, i) => setTimeout(() => b.classList.remove("is-check"), lamps.length * step + holdMs + i * step));
      setTimeout(() => { running = false; }, lamps.length * step * 2 + holdMs + 50);
    };
    let checked = false;
    grid._onReveal = () => { if (!checked) { checked = true; setTimeout(bulbCheck, 350); } };
    const btn = host ? $("[data-bulb-check]", host.parentElement || host) : $("[data-bulb-check]");
    if (btn) btn.addEventListener("click", bulbCheck);
  });

  /* ------------------------------------------------------------------
     Gear shifter helper for the demo form (the page script drives the steps and window.CCA).
     WPI.shifter(scope) → { shiftTo(from, to), paint(n, { reached, skip }) }
     ------------------------------------------------------------------ */
  const shifter = (scope) => {
    const knob = $(".knob", scope);
    const trail = $(".gate-trail", scope);
    const gears = $$(".gear", scope);
    const pills = $$(".shift-step", scope);
    const POS = { 0: [64, 75], 1: [64, 28], 2: [64, 122], 3: [136, 28], 4: [136, 122] }; // 0 = neutral
    const NEUTRAL = 75;
    const TRAIL = { 0: 0, 1: 0, 2: 94, 3: 260, 4: 354 };
    const place = (pt) => `translate(${pt[0]}px, ${pt[1]}px)`;
    const shiftTo = (a, b) => {
      if (!knob || !POS[a] || !POS[b]) return;
      const pts = [POS[a]];
      if (POS[a][0] !== POS[b][0]) pts.push([POS[a][0], NEUTRAL], [POS[b][0], NEUTRAL]);
      pts.push(POS[b]);
      const lens = pts.slice(1).map((pt, i) => Math.hypot(pt[0] - pts[i][0], pt[1] - pts[i][1]));
      const len = lens.reduce((s, v) => s + v, 0);
      const dur = Math.min(950, 280 + len * 2.4);
      if (trail) {
        trail.style.transitionDuration = motionOK() ? `${dur}ms` : "0s";
        trail.style.strokeDashoffset = String(354 - TRAIL[b]);
      }
      knob.style.transform = place(POS[b]);
      knob.classList.remove("is-seated");
      if (!motionOK() || !knob.animate || !len) return;
      let acc = 0;
      const frames = pts.map((pt, i) => { if (i) acc += lens[i - 1]; return { transform: place(pt), offset: acc / len }; });
      knob.animate(frames, { duration: dur, easing: "cubic-bezier(.65, 0, .35, 1)" }).onfinish = () => knob.classList.add("is-seated");
    };
    const paint = (n, opts = {}) => {
      const reached = opts.reached || n;
      const skip = opts.skip || [];
      gears.forEach((g) => {
        const k = Number(g.dataset.gear);
        g.classList.toggle("is-current", k === n);
        g.classList.toggle("is-done", k < n && !skip.includes(k));
        g.classList.toggle("is-skipped", skip.includes(k));
      });
      pills.forEach((p) => {
        const k = Number(p.dataset.go);
        p.classList.toggle("is-current", k === n);
        p.classList.toggle("is-done", k < n && !skip.includes(k));
        p.classList.toggle("is-skipped", skip.includes(k));
        p.disabled = k > reached || skip.includes(k);
        if (k === n) p.setAttribute("aria-current", "step"); else p.removeAttribute("aria-current");
      });
    };
    return { shiftTo, paint };
  };

  /* ------------------------------------------------------------------
     Forms: validation + submission. The demo form posts to the Shop Cloud inbox as a
     'message' (kind), then a form endpoint, then Netlify Forms; on failure, a mailto
     fallback only when the page has a mailto link, otherwise "try again".
     ------------------------------------------------------------------ */
  const endpoint = (d.querySelector('meta[name="form-endpoint"]') || {}).content || "";
  const inboxUrl = ((d.querySelector('meta[name="shop-inbox-url"]') || {}).content || "").replace(/\/+$/, "");
  const inboxKey = (d.querySelector('meta[name="shop-inbox-key"]') || {}).content || "";
  const INBOX_FORMS = { demo: "message" };
  const MAX_TEXT = 2000;
  const MIN_FILL_MS = 3000;
  const formStart = new WeakMap();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const checkedTitles = (form, name) => $$(`input[name="${name}"]:checked`, form).map((input) => {
    const choice = input.closest(".choice, label");
    const text = choice ? ($(".choice-name, .choice-title, strong", choice) || choice).textContent : "";
    return (input.dataset.title || input.dataset.label || text || input.value).replace(/\s+/g, " ").trim();
  });
  const inboxPayload = (form, fd) => {
    const g = (k) => String(fd.get(k) || "").trim();
    const who = { source: "website", form: form.getAttribute("name"), name: g("name"), phone: g("phone"), email: g("email"), company: g("company") };
    if (who.form === "demo") {
      const interests = checkedTitles(form, "interests[]").concat(checkedTitles(form, "interests"));
      const head = [
        g("topic") || "Demo request",
        g("company") && `Shop: ${g("company")}`,
        g("role") && `Role: ${g("role")}`,
        g("locations") && `Locations: ${g("locations")}`,
        g("bays") && `Bays: ${g("bays")}`,
        g("current_system") && `Current system: ${g("current_system")}`,
        interests.length && `Interested in: ${interests.join(", ")}`,
        g("contact_method") && `Contact by: ${g("contact_method")}`,
        g("best_time") && `Best time: ${g("best_time")}`,
      ].filter(Boolean).join("\n").slice(0, MAX_TEXT);
      const message = g("message");
      const room = MAX_TEXT - head.length - 2;
      const text = message && room > 0 ? `${head}\n\n${message.slice(0, room)}` : head;
      return { kind: "message", payload: { ...who, text } };
    }
    return { kind: "message", payload: { ...who, text: [g("topic"), g("message")].filter(Boolean).join("\n").slice(0, MAX_TEXT) } };
  };
  const sendToInbox = async (form, fd) => {
    if (!inboxUrl || !inboxKey || !INBOX_FORMS[form.getAttribute("name")]) return false;
    try {
      const wait = MIN_FILL_MS - (Date.now() - (formStart.get(form) || 0));
      if (wait > 0) await sleep(wait);
      const { kind, payload } = inboxPayload(form, fd);
      const res = await fetch(`${inboxUrl}/rest/v1/shop_inbox`, {
        method: "POST",
        headers: { apikey: inboxKey, Authorization: `Bearer ${inboxKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ kind, ref: null, payload }),
      });
      return res.ok;
    } catch {
      return false;
    }
  };
  const MESSAGES = {
    valueMissing: "This field is required.",
    typeMismatch: "Please check the format.",
    patternMismatch: "Please check the format.",
    tooShort: "Please add a bit more detail.",
  };
  const fieldError = (field, msg) => {
    field.classList.toggle("is-invalid", Boolean(msg));
    const ctrl = $("input, select, textarea", field);
    const err = $(".field-error", field);
    if (ctrl && !ctrl.closest(".choice-grid")) ctrl.setAttribute("aria-invalid", msg ? "true" : "false");
    if (err) {
      const span = $("span", err) || err;
      if (msg && !err.dataset.fixed) span.textContent = msg;
      if (ctrl && err.id) {
        // Keep any hint ids the author set; reference the error only while it shows.
        if (!("describedby" in ctrl.dataset)) {
          ctrl.dataset.describedby = (ctrl.getAttribute("aria-describedby") || "").split(/\s+/).filter((id) => id && id !== err.id).join(" ");
        }
        const ids = [ctrl.dataset.describedby, msg ? err.id : ""].filter(Boolean).join(" ");
        if (ids) ctrl.setAttribute("aria-describedby", ids);
        else ctrl.removeAttribute("aria-describedby");
      }
    }
  };
  const validateFields = (scope) => {
    let firstBad = null;
    $$(".field", scope).forEach((field) => {
      if (field.closest("[hidden]")) return;
      let msg = "";
      const group = field.hasAttribute("data-required-group");
      if (group) {
        if (!$$("input:checked", field).length) msg = field.dataset.error || "Please choose at least one option.";
      } else {
        const ctrl = $("input:not([type=hidden]), select, textarea", field);
        if (!ctrl || ctrl.disabled) return;
        if (ctrl.type === "tel" && ctrl.value && ctrl.value.replace(/\D/g, "").length < 10) msg = "Please enter a 10-digit phone number.";
        else if (!ctrl.checkValidity()) {
          const v = ctrl.validity;
          const key = Object.keys(MESSAGES).find((k) => v[k]);
          msg = ctrl.dataset.error || (ctrl.type === "email" && v.typeMismatch ? "Please enter a valid email address." : MESSAGES[key] || "Please check this field.");
        }
      }
      fieldError(field, msg);
      if (msg && !firstBad) firstBad = field;
    });
    if (firstBad) {
      const ctrl = $("input:not([type=hidden]), select, textarea", firstBad);
      firstBad.scrollIntoView({ behavior: motionOK() ? "smooth" : "auto", block: "center" });
      if (ctrl) setTimeout(() => ctrl.focus({ preventScroll: true }), 250);
    }
    return !firstBad;
  };
  const summarize = (form) => {
    const lines = [];
    const fd = new FormData(form);
    const seen = new Set();
    for (const [k, v] of fd.entries()) {
      if (["form-name", "bot-field"].includes(k) || !String(v).trim()) continue;
      const ctrl = form.elements[k];
      const node = ctrl && (ctrl.length && !ctrl.tagName ? ctrl[0] : ctrl);
      const label = (node && node.dataset && node.dataset.label) || k.replace(/\[\]$/, "").replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      if (seen.has(k)) lines[lines.length - 1] += `, ${v}`;
      else lines.push(`${label}: ${v}`);
      seen.add(k);
    }
    return lines.join("\n");
  };
  const submitForm = async (form) => {
    const fd = new FormData(form);
    if (fd.get("bot-field")) return true;
    if (await sendToInbox(form, fd)) return true;
    let res;
    if (endpoint) {
      res = await fetch(endpoint, { method: "POST", body: fd, headers: { Accept: "application/json" } });
    } else {
      if (location.protocol === "file:") throw new Error("offline preview");
      res = await fetch(form.getAttribute("action") || "/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(fd).toString(),
      });
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return true;
  };
  const showSuccess = (form) => {
    const target = form.dataset.success ? $(form.dataset.success) : null;
    if (!target) return;
    form.hidden = true;
    target.hidden = false;
    target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
    target.scrollIntoView({ behavior: motionOK() ? "smooth" : "auto", block: "center" });
  };
  const showError = (form) => {
    const box = $("[data-form-error]", form);
    if (!box) return;
    const mailLink = $$('a[href^="mailto:"]').find((a) => !box.contains(a));
    const telLink = $$('a[href^="tel:"]').find((a) => !box.contains(a));
    const subject = encodeURIComponent(form.dataset.subject || "Website request");
    const body = encodeURIComponent(summarize(form));
    let html = '<svg class="icon" aria-hidden="true"><use href="#i-alert"/></svg><div><strong>We couldn&rsquo;t send that online.</strong> <span>';
    if (mailLink) {
      const addr = mailLink.getAttribute("href").split("?")[0];
      html += `Your answers are still here. You can <a class="text-link" href="${addr}?subject=${subject}&amp;body=${body}">send them by email</a>`;
      html += telLink ? ` or call <a class="text-link" href="${telLink.getAttribute("href")}">${telLink.textContent.trim()}</a>.` : ".";
    } else {
      html += "Please try again in a few minutes. Your answers are still here.";
      if (telLink) html += ` Or call <a class="text-link" href="${telLink.getAttribute("href")}">${telLink.textContent.trim()}</a>.`;
    }
    box.innerHTML = `${html}</span></div>`;
    box.hidden = false;
    box.classList.add("is-visible");
    box.setAttribute("tabindex", "-1");
    box.focus({ preventScroll: true });
    box.scrollIntoView({ behavior: motionOK() ? "smooth" : "auto", block: "center" });
  };
  // Return moves to the next field, like a native form (the fields say enterkeyhint="next");
  // after the last one the form's normal Enter behaviour applies. Textareas keep their newlines.
  const TEXT_ENTRY = /^(text|tel|email|number|url|password)$/;
  const nextField = (scope, from) => {
    if (!(from instanceof HTMLInputElement) || !TEXT_ENTRY.test(from.type)) return null;
    const fields = $$("input, select, textarea", scope).filter(
      (el) => !el.disabled && !el.closest("[hidden], .hp-field") && el.getClientRects().length &&
        (!(el instanceof HTMLInputElement) || TEXT_ENTRY.test(el.type) || /^(date|time|datetime-local|month)$/.test(el.type))
    );
    const i = fields.indexOf(from);
    return i > -1 ? fields[i + 1] || null : null;
  };

  window.CCA = { validateFields, submitForm, showSuccess, showError, summarize, nextField };
  window.WPI = { motionOK, isPaused: () => paused, onMotion, shifter, replay: (fig) => fig && fig._player && fig._player.replay() };

  $$("form[data-form]").forEach((form) => {
    formStart.set(form, Date.now());
    form.setAttribute("novalidate", "");
    if (form.dataset.form !== "manual") {
      form.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" || e.isComposing || e.shiftKey || e.defaultPrevented) return;
        const next = nextField(form, e.target);
        if (!next) return;
        e.preventDefault();
        next.focus();
      });
    }
    form.addEventListener("input", (e) => {
      const field = e.target.closest(".field");
      if (field && field.classList.contains("is-invalid")) fieldError(field, "");
    });
    form.addEventListener("change", (e) => {
      const field = e.target.closest(".field");
      if (field && field.classList.contains("is-invalid")) fieldError(field, "");
    });
    if (form.dataset.form === "manual") return;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const errBox = $("[data-form-error]", form);
      if (errBox) errBox.hidden = true;
      if (!validateFields(form)) return;
      const btn = $('[type="submit"]', form);
      if (btn) { btn.classList.add("is-loading"); btn.disabled = true; }
      try {
        await submitForm(form);
        showSuccess(form);
      } catch {
        showError(form);
      } finally {
        if (btn) { btn.classList.remove("is-loading"); btn.disabled = false; }
      }
    });
  });

  /* ------------------------------------------------------------------
     Instant navigation fallback: prefetch on intent where the browser doesn't support
     Speculation Rules (Safari, Firefox). Never the app (it would boot, register its
     service worker and seed the sample shop): skips [data-no-prerender] and /app/ URLs.
     ------------------------------------------------------------------ */
  const supportsSpec = HTMLScriptElement.supports && HTMLScriptElement.supports("speculationrules");
  if (!supportsSpec && location.protocol !== "file:") {
    const seen = new Set();
    const prefetch = (a) => {
      if (!a || a.target === "_blank" || a.hasAttribute("download") || a.closest("[data-no-prerender]")) return;
      let url;
      try { url = new URL(a.href, location.href); } catch { return; }
      if (url.origin !== location.origin || url.pathname === location.pathname || seen.has(url.pathname)) return;
      if (url.pathname.includes("/app/") || /\/app$/.test(url.pathname) || /\.pdf$/i.test(url.pathname)) return;
      seen.add(url.pathname);
      const link = d.createElement("link");
      link.rel = "prefetch";
      link.href = url.pathname;
      d.head.append(link);
    };
    const handler = (e) => prefetch(e.target.closest && e.target.closest("a[href]"));
    d.addEventListener("pointerover", handler, { passive: true });
    d.addEventListener("touchstart", handler, { passive: true });
    d.addEventListener("focusin", handler);
  }

  /* ------------------------------------------------------------------
     Feature-icon morph: on index and features.html, name only the clicked card's icon tile
     ft-<slug> at pageswap, so it flies into that feature page's hero eyebrow tile.
     ------------------------------------------------------------------ */
  let ftNamed = null;
  const clearFt = () => { if (ftNamed) { ftNamed.style.viewTransitionName = ""; ftNamed = null; } };
  addEventListener("pageswap", (e) => {
    clearFt();
    const entry = e.activation && e.activation.entry;
    if (!e.viewTransition || !entry || !entry.url) return;
    const m = /\/features\/([a-z0-9-]+)\.html(?:[?#].*)?$/.exec(entry.url);
    if (!m || /\/features\/[^/]+\.html$/.test(location.pathname)) return;
    const slug = m[1];
    if (d.querySelector(`[style*="ft-${slug}"]`)) return;
    const link = $$(`main a[href$="features/${slug}.html"]`).find((a) => a.closest(".feature-card, .dir-card") && !a.closest("#related, .related, [data-related]"));
    const card = link && link.closest(".feature-card, .dir-card");
    const tile = card && $(".icon-tile", card);
    if (!tile) return;
    tile.style.viewTransitionName = `ft-${slug}`;
    ftNamed = tile;
  });
  addEventListener("pagehide", clearFt);
  addEventListener("pagereveal", clearFt);
  addEventListener("pageshow", clearFt);

  /* ------------------------------------------------------------------
     Small things
     ------------------------------------------------------------------ */
  $$("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
  $$("[data-scroll-top]").forEach((a) =>
    a.addEventListener("click", (e) => {
      e.preventDefault();
      scrollTo({ top: 0, behavior: motionOK() ? "smooth" : "auto" });
    })
  );
})();
