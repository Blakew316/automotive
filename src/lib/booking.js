// Online booking: the public page customers use to request an appointment. The page needs the
// shop's hours and services, so they travel with the link (or, with Shop Cloud, are published to
// the shop's storage together with busy times so customers only see open slots).
import { cloudConfig, publicSiteBase } from './cloudShare';
import { isoDate } from './format';

const enc = (obj) => btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const decodeConfig = (s) => JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/')))));

/** Everything the public booking page needs (no customer data). */
export function bookingConfig(state, { includeBusy = false } = {}) {
  const shop = state.shop;
  const b = shop.booking || {};
  const cfg = cloudConfig(shop);
  const services = (b.jobIds || [])
    .map((id) => state.cannedJobs.find((j) => j.id === id))
    .filter(Boolean)
    .map((j) => ({ title: j.title, minutes: Math.max(30, Math.round((j.items.filter((i) => i.type === 'labor').reduce((s, i) => s + (Number(i.hours) || 0), 0) * 60) / 15) * 15) }));
  return {
    v: 1,
    shop: { name: shop.name, phone: shop.phone, email: shop.email, address: shop.address, city: shop.city, state: shop.state, zip: shop.zip },
    hours: shop.hours,
    slot: b.slotMinutes || 30,
    lead: b.leadHours ?? 2,
    days: b.daysAhead || 21,
    cap: b.capacity || 1,
    note: b.note || '',
    services,
    inbox: cfg ? { url: cfg.url, key: cfg.key } : null,
    enabled: Boolean(b.enabled),
    busy: includeBusy ? busyTimes(state) : undefined,
    publishedAt: includeBusy ? new Date().toISOString() : undefined,
  };
}

/**
 * The shop's public website (website/ in this repo): its own address if one is set, otherwise the
 * copy published with the app — the app is served from <site>/app/, so the site is one level up.
 */
export function websiteLink(state) {
  return state.shop.website?.url?.trim() || defaultWebsite();
}

export function defaultWebsite() {
  if (typeof window === 'undefined') return '';
  const base = import.meta.env?.BASE_URL || '/';
  return /\/app\/$/.test(base) ? `${window.location.origin}${base.replace(/app\/$/, '')}` : '';
}

/** A page on the public website, e.g. websitePage(state, 'appointment.html'). */
export function websitePage(state, page) {
  const site = websiteLink(state);
  if (!site) return '';
  return new URL(page, site.endsWith('/') || /\.html?$/.test(site) ? site : `${site}/`).href;
}

/** Scheduled appointment intervals for the booking window (times only — no names). */
export function busyTimes(state, days = 60) {
  const from = Date.now() - 3600000;
  const to = from + days * 86400000;
  return state.appointments
    .filter((a) => a.status !== 'cancelled' && a.status !== 'no_show')
    .map((a) => [new Date(a.start).getTime(), new Date(a.start).getTime() + (a.duration || 60) * 60000])
    .filter(([s, e]) => e > from && s < to);
}

/** Link to the public booking page, or '' if online booking is off. */
export function bookingLink(state) {
  const shop = state.shop;
  if (!shop.booking?.enabled) return '';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const base = `${origin}${import.meta.env?.BASE_URL || '/'}book`;
  const cfg = cloudConfig(shop);
  if (cfg && shop.booking.published) return `${base}?from=${encodeURIComponent(publicSiteBase(cfg))}`;
  return `${base}?c=${enc(bookingConfig(state))}`;
}

const hm = (s) => {
  const [h, m] = String(s).split(':').map(Number);
  return h * 60 + (m || 0);
};

/** Open start times on one day, honoring hours, lead time, capacity and busy times. */
export function slotsForDay(config, day, minutes = 60, now = new Date()) {
  const hours = config.hours?.[day.getDay()];
  if (!hours) return [];
  const [open, close] = hours.map(hm);
  const out = [];
  const earliest = now.getTime() + (config.lead || 0) * 3600000;
  const busy = config.busy || [];
  for (let t = open; t + Math.min(minutes, 60) <= close; t += config.slot || 30) {
    const start = new Date(day);
    start.setHours(Math.floor(t / 60), t % 60, 0, 0);
    const s = start.getTime();
    if (s < earliest) continue;
    // Capacity = bays you're willing to fill from online bookings at once.
    const overlapping = busy.filter(([bs, be]) => bs < s + 30 * 60000 && be > s).length;
    if (overlapping >= (config.cap || 1)) continue;
    out.push(start);
  }
  return out;
}

export function bookableDays(config, now = new Date()) {
  const out = [];
  for (let i = 0; i < (config.days || 21); i++) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + i);
    if (config.hours?.[d.getDay()]) out.push(d);
  }
  return out;
}

export const dayKey = (d) => isoDate(d);
