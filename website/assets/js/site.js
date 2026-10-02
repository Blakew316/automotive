/* Clinton Complete Auto Care: shared behaviour for every page.
   No dependencies. Everything degrades gracefully without JS. */
(() => {
  "use strict";
  const d = document;
  const root = d.documentElement;
  root.classList.add("js");

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
  const $ = (sel, scope = d) => scope.querySelector(sel);
  const $$ = (sel, scope = d) => Array.from(scope.querySelectorAll(sel));
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

  // iOS Safari only shows :active (pressed) styles once the page listens for touches.
  d.addEventListener("touchstart", () => {}, { passive: true });

  /* ------------------------------------------------------------------
     Header state + scroll progress car + roadmap progress (one rAF loop)
     ------------------------------------------------------------------ */
  const header = $("[data-header]");
  const roadmaps = $$(".roadmap");
  let ticking = false;

  const measureRoads = () => {
    roadmaps.forEach((rm) => {
      const road = $(".roadmap-road", rm);
      if (road) rm.style.setProperty("--road-w", road.offsetWidth + "px");
    });
  };

  const onScroll = () => {
    ticking = false;
    const y = window.scrollY;
    const max = root.scrollHeight - innerHeight;
    if (header) {
      header.classList.toggle("is-scrolled", y > 6);
      header.style.setProperty("--progress", max > 0 ? clamp(y / max).toFixed(4) : 0);
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
  measureRoads();
  onScroll();

  /* ------------------------------------------------------------------
     Desktop mega menu
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
    if (reduceMotion.matches) return sheet.close();
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
     Scroll reveal + odometers
     ------------------------------------------------------------------ */
  $$("[data-reveal-stagger]").forEach((group) => {
    Array.from(group.children).forEach((child, i) => {
      if (!child.hasAttribute("data-reveal")) child.setAttribute("data-reveal", group.dataset.revealStagger || "");
      child.style.setProperty("--i", i % 8);
    });
  });

  const buildOdometer = (el) => {
    const value = Number(el.dataset.odometer || 0);
    const text = value.toLocaleString("en-US");
    el.setAttribute("role", "img");
    el.setAttribute("aria-label", el.dataset.label || text);
    el.textContent = "";
    const digitCount = text.replace(/\D/g, "").length;
    let idx = 0;
    for (const ch of text) {
      if (!/\d/.test(ch)) {
        const sep = d.createElement("span");
        sep.className = "odo-sep";
        sep.textContent = ch;
        sep.setAttribute("aria-hidden", "true");
        el.append(sep);
        continue;
      }
      const cycles = 1 + Math.min(digitCount - idx, 4);
      const cell = d.createElement("span");
      cell.className = "odo-digit";
      cell.setAttribute("aria-hidden", "true");
      const strip = d.createElement("span");
      strip.className = "odo-strip";
      strip.innerHTML = Array.from({ length: cycles * 10 }, (_, k) => `<span>${k % 10}</span>`).join("");
      strip.dataset.target = String((cycles - 1) * 10 + Number(ch));
      strip.style.setProperty("--d", `${idx * 0.05}s`);
      cell.append(strip);
      el.append(cell);
      idx++;
    }
  };
  const runOdometer = (el) => {
    $$(".odo-strip", el).forEach((s) => {
      s.style.transform = `translateY(calc(-1.28em * ${s.dataset.target}))`;
    });
  };
  $$("[data-odometer]").forEach(buildOdometer);

  const revealTargets = $$("[data-reveal], [data-odometer]");
  if ("IntersectionObserver" in window && !reduceMotion.matches) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          if (el.hasAttribute("data-odometer")) runOdometer(el);
          else el.classList.add("is-in");
          io.unobserve(el);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
    );
    revealTargets.forEach((el) => io.observe(el));
  } else {
    revealTargets.forEach((el) => (el.hasAttribute("data-odometer") ? runOdometer(el) : el.classList.add("is-in")));
  }

  /* ------------------------------------------------------------------
     3D tilt for the brand card (and anything with data-tilt)
     ------------------------------------------------------------------ */
  if (finePointer.matches && !reduceMotion.matches) {
    $$("[data-tilt]").forEach((card) => {
      const scope = card.closest("[data-tilt-scope]") || card.parentElement;
      const max = Number(card.dataset.tilt || 10);
      scope.addEventListener("pointermove", (e) => {
        const r = card.getBoundingClientRect();
        const x = clamp((e.clientX - r.left) / r.width, -0.2, 1.2);
        const y = clamp((e.clientY - r.top) / r.height, -0.2, 1.2);
        card.classList.add("is-tilting");
        card.style.setProperty("--ry", `${((x - 0.5) * max).toFixed(2)}deg`);
        card.style.setProperty("--rx", `${((0.5 - y) * max * 0.8).toFixed(2)}deg`);
        card.style.setProperty("--mx", `${(x * 100).toFixed(1)}%`);
        card.style.setProperty("--my", `${(y * 100).toFixed(1)}%`);
      });
      scope.addEventListener("pointerleave", () => {
        card.classList.remove("is-tilting");
        ["--rx", "--ry", "--mx", "--my"].forEach((p) => card.style.removeProperty(p));
      });
    });
  }

  /* ------------------------------------------------------------------
     Tabs (WAI-ARIA pattern)
     ------------------------------------------------------------------ */
  $$("[data-tabs]").forEach((wrap) => {
    const tabs = $$('[role="tab"]', wrap);
    const select = (tab, focus) => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
        const panel = d.getElementById(t.getAttribute("aria-controls"));
        if (panel) {
          panel.hidden = !on;
          if (!panel.hasAttribute("tabindex")) panel.tabIndex = 0;
        }
      });
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
    select(tabs.find((t) => t.getAttribute("aria-selected") === "true") || tabs[0]);
  });

  /* ------------------------------------------------------------------
     Live "open now" status from the page's JSON-LD hours
     ------------------------------------------------------------------ */
  const CODES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  const NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const toMin = (s) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };
  const fmt = (min) => {
    const h = Math.floor(min / 60), m = min % 60;
    return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
  };
  const readHours = () => {
    const el = d.getElementById("business-data");
    if (!el) return null;
    try {
      const data = JSON.parse(el.textContent);
      const week = Array(7).fill(null);
      (data.openingHoursSpecification || []).forEach((spec) => {
        [].concat(spec.dayOfWeek).forEach((day) => {
          const i = NAMES.indexOf(String(day).replace("https://schema.org/", ""));
          if (i > -1) week[i] = { open: toMin(spec.opens), close: toMin(spec.closes) };
        });
      });
      const tz = data.additionalProperty && data.additionalProperty.name === "timeZone" ? data.additionalProperty.value : "";
      return { week, tz };
    } catch { return null; }
  };
  const nowIn = (tz) => {
    const now = new Date();
    if (!tz) return { day: now.getDay(), min: now.getHours() * 60 + now.getMinutes() };
    try {
      const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(now);
      const get = (t) => parts.find((p) => p.type === t).value;
      return { day: SHORT.indexOf(get("weekday")), min: Number(get("hour")) * 60 + Number(get("minute")) };
    } catch { return { day: now.getDay(), min: now.getHours() * 60 + now.getMinutes() }; }
  };
  const hours = readHours();
  const paintStatus = () => {
    if (!hours) return;
    const { day, min } = nowIn(hours.tz);
    const today = hours.week[day];
    let text, open = false;
    if (today && min >= today.open && min < today.close) {
      open = true;
      text = today.close - min <= 45 ? `Closing soon · ${fmt(today.close)}` : `Open now · until ${fmt(today.close)}`;
    } else if (today && min < today.open) {
      text = `Closed · opens today ${fmt(today.open)}`;
    } else {
      text = "Closed";
      for (let k = 1; k <= 7; k++) {
        const nd = (day + k) % 7;
        if (hours.week[nd]) {
          text = `Closed · opens ${k === 1 ? "tomorrow" : SHORT[nd]} ${fmt(hours.week[nd].open)}`;
          break;
        }
      }
    }
    $$("[data-open-status]").forEach((el) => {
      el.textContent = text;
      el.classList.toggle("is-open", open);
      el.classList.toggle("is-closed", !open);
    });
    const code = CODES[day];
    $$(".hours-table tr[data-day]").forEach((tr) => tr.classList.toggle("is-today", tr.dataset.day === code));
    $$(".hours-list li[data-days]").forEach((li) => li.classList.toggle("is-today", li.dataset.days.split(" ").includes(code)));
  };
  paintStatus();
  setInterval(paintStatus, 60000);

  /* ------------------------------------------------------------------
     Forms: validation + submission (the AutoShop Pro inbox, Netlify Forms,
     or a custom endpoint from business.json), with a mailto fallback.
     ------------------------------------------------------------------ */
  const endpoint = (d.querySelector('meta[name="form-endpoint"]') || {}).content || "";
  // AutoShop Pro inbox: booking, contact and fleet requests go straight to the shop's calendar and messages.
  const inboxUrl = ((d.querySelector('meta[name="shop-inbox-url"]') || {}).content || "").replace(/\/+$/, "");
  const inboxKey = (d.querySelector('meta[name="shop-inbox-key"]') || {}).content || "";
  const INBOX_FORMS = { appointment: "booking", contact: "message", fleet: "message" };
  const WINDOW_HOUR = { Morning: 8, Midday: 12, Afternoon: 15, Flexible: 9 };
  const inboxPayload = (form, fd) => {
    const g = (k) => String(fd.get(k) || "").trim();
    const all = (k) => fd.getAll(k).map((v) => String(v).trim()).filter(Boolean);
    const who = { source: "website", form: form.getAttribute("name"), name: g("name"), phone: g("phone"), email: g("email") };
    if (who.form === "appointment") {
      const small = g("vehicle_type") === "Small engine equipment";
      const vehicle = small
        ? [g("equipment_brand"), g("equipment_model"), g("equipment_type") && `(${g("equipment_type")})`].filter(Boolean).join(" ")
        : [g("vehicle_year"), g("vehicle_make"), g("vehicle_model")].filter(Boolean).join(" ");
      const win = g("time_window");
      const [y, m, day] = g("preferred_date").split("-").map(Number);
      // The customer picks a day and a time of day; the shop confirms the exact time.
      const start = new Date(y, m - 1, day, WINDOW_HOUR[win] ?? 9, 0, 0).toISOString();
      const notes = [
        g("details"),
        win && `Preferred time: ${win === "Flexible" ? "flexible" : win.toLowerCase()}`,
        g("backup_date") && `Backup date: ${g("backup_date")}`,
        g("drop_or_wait") && (g("drop_or_wait") === "Wait" ? "Would like to wait" : "Will drop it off"),
        g("mileage") && `Mileage: ${g("mileage")}`,
        g("contact_method") && `Confirm by ${g("contact_method").toLowerCase()}`,
        g("notes"),
      ].filter(Boolean).join("\n");
      return { kind: "booking", payload: { ...who, vehicle, services: all("services"), start, duration: 60, window: win, notes } };
    }
    const extra = who.form === "fleet"
      ? [g("company") && `Company: ${g("company")}`, g("fleet-size") && `Fleet size: ${g("fleet-size")}`, all("types").length && `Vehicles: ${all("types").join(", ")}`]
      : [g("topic") && `Topic: ${g("topic")}`];
    return { kind: "message", payload: { ...who, company: g("company"), text: [...extra, g("message")].filter(Boolean).join("\n") } };
  };
  const sendToInbox = async (form, fd) => {
    if (!inboxUrl || !inboxKey || !INBOX_FORMS[form.getAttribute("name")]) return false;
    try {
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
      firstBad.scrollIntoView({ behavior: reduceMotion.matches ? "auto" : "smooth", block: "center" });
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
      const label = (node && node.dataset && node.dataset.label) || k.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
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
    target.scrollIntoView({ behavior: reduceMotion.matches ? "auto" : "smooth", block: "center" });
  };
  const showError = (form) => {
    const box = $("[data-form-error]", form);
    if (!box) return;
    const email = (d.querySelector('a[href^="mailto:"]') || {}).href || "mailto:";
    const phoneLink = d.querySelector('.footer-contact[href^="tel:"]') || d.querySelector('a[data-biz-href="tel"]') || d.querySelector('a[href^="tel:"]');
    const subject = encodeURIComponent(form.dataset.subject || "Website request");
    const body = encodeURIComponent(summarize(form));
    box.innerHTML = `<svg class="icon" aria-hidden="true"><use href="#i-alert"/></svg><div><strong>We couldn&rsquo;t send that online.</strong> <span>Your details are still here. You can <a class="text-link" href="${email.split("?")[0]}?subject=${subject}&body=${body}">send them by email</a>${phoneLink ? ` or call us at <a class="text-link" href="${phoneLink.getAttribute("href")}">${phoneLink.textContent.trim()}</a>` : ""}.</span></div>`;
    box.hidden = false;
    box.classList.add("is-visible");
    box.setAttribute("tabindex", "-1");
    box.focus({ preventScroll: true });
    box.scrollIntoView({ behavior: reduceMotion.matches ? "auto" : "smooth", block: "center" });
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

  $$("form[data-form]").forEach((form) => {
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
     Instant navigation fallback: prefetch on intent where the browser
     doesn't support Speculation Rules (Safari, Firefox).
     ------------------------------------------------------------------ */
  const supportsSpec = HTMLScriptElement.supports && HTMLScriptElement.supports("speculationrules");
  if (!supportsSpec && location.protocol !== "file:") {
    const seen = new Set();
    const prefetch = (a) => {
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      let url;
      try { url = new URL(a.href, location.href); } catch { return; }
      if (url.origin !== location.origin || url.pathname === location.pathname || seen.has(url.pathname)) return;
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
     Apple Maps on Apple devices. The HTML links to Google Maps, which works
     everywhere; iPhone, iPad and Mac open Apple Maps instead. (iPadOS
     reports itself as "Macintosh".) target/rel stay as authored.
     ------------------------------------------------------------------ */
  const isApple = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent) || /^(Mac|iPhone|iPad|iPod)/.test(navigator.platform || "");
  if (isApple) {
    let address = "";
    try {
      const a = JSON.parse(d.getElementById("business-data").textContent).address || {};
      const region = [a.addressRegion, a.postalCode].filter(Boolean).join(" ");
      address = [a.streetAddress, a.addressLocality, region].filter(Boolean).join(", ");
    } catch { /* no structured data: fall back to each link's own query */ }
    $$('a[href*="google."][href*="/maps"]').forEach((link) => {
      let url;
      try { url = new URL(link.href); } catch { return; }
      if (!/(^|\.)google\.[a-z.]+$/.test(url.hostname) || !url.pathname.startsWith("/maps")) return;
      const query = url.searchParams.get("query") || url.searchParams.get("q") || address;
      if (!query) return;
      const directions = /\bdirections\b/i.test(link.textContent) || Boolean(link.querySelector('use[href="#i-directions"]'));
      link.href = directions && address
        ? `https://maps.apple.com/?daddr=${encodeURIComponent(address)}`
        : `https://maps.apple.com/?q=${encodeURIComponent(query)}`;
    });
  }

  /* ------------------------------------------------------------------
     Small things
     ------------------------------------------------------------------ */
  $$("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
  $$("[data-scroll-top]").forEach((a) =>
    a.addEventListener("click", (e) => {
      e.preventDefault();
      scrollTo({ top: 0, behavior: reduceMotion.matches ? "auto" : "smooth" });
    })
  );
})();
