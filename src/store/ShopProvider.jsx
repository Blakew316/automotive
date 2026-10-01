import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { produce, setAutoFreeze, isDraft, current } from 'immer';
import { ShopContext, SyncContext } from './context';
import { createSeed, CANNED_JOBS } from '../data/seed';
import { migrate } from './defaults';
import { newTireQuote, tireLabel } from '../lib/tires';
import { priceFromMatrix, orderTotals } from '../lib/pricing';
import { STATUS } from '../lib/workflow';
import { BLANK_ACCOUNT, dueDate, termsLabel } from '../lib/accounts';
import { matchCustomer, matchVehicle, parseVehicle, TRANSPORT } from '../lib/operations';
import { decodeOffline } from '../lib/vin';
import { shopAt, stampFor } from '../lib/locations';
import { uid, fullName, vehicleName } from '../lib/format';
import { loadSaved, createSaver } from '../lib/persist';
import { diffStates, applyToDraft } from '../lib/sync/records';
import { useShopSync } from '../lib/sync/useShopSync';
import { useUI } from './hooks';
import { Spinner } from '../components/ui';

// State is replaced, never mutated in place, and unchanged records keep their identity between
// versions — that is what lets saving and syncing touch only what changed.
setAutoFreeze(false);

const LEGACY_KEY = 'autoshop-pro:v2';

/** Shop data on this device: IndexedDB, or the older localStorage copy (moved over on first load). */
async function loadStore() {
  let saved = { state: null, sync: null };
  let idb = true;
  try {
    saved = await loadSaved();
  } catch {
    idb = false;
  }
  let stored = saved.state;
  let legacy = false;
  if (!stored) {
    try {
      const raw = localStorage.getItem(LEGACY_KEY);
      const data = raw && JSON.parse(raw);
      if (data?.version === 2) {
        stored = data;
        legacy = true;
      }
    } catch {
      // Unreadable: start from demo data.
    }
  }
  return { state: migrate(stored || createSeed()), sync: saved.sync, idb, legacy, fromIdb: Boolean(saved.state) };
}

const now = () => new Date().toISOString();

/** Every repair order keeps a log of when its status changed (for the customer's live status page). */
function stampStatusChanges(base, next) {
  if (next.orders === base.orders) return next;
  const before = new Map(base.orders.map((o) => [o.id, o]));
  const changed = next.orders.filter((o) => {
    const b = before.get(o.id);
    return b !== o && (!b || b.status !== o.status);
  });
  if (!changed.length) return next;
  const at = now();
  const ids = new Set(changed.map((o) => o.id));
  return produce(next, (d) => {
    for (const o of d.orders) if (ids.has(o.id)) o.statusLog = [...(o.statusLog || []), { status: o.status, at }].slice(-40);
  });
}

function persistLocal(data) {
  try {
    localStorage.setItem(LEGACY_KEY, JSON.stringify(data));
  } catch {
    // Quota exceeded or storage blocked — the session keeps working in memory.
  }
}

export default function ShopProvider({ children }) {
  const [boot, setBoot] = useState(null);
  useEffect(() => {
    let alive = true;
    loadStore().then((b) => alive && setBoot(b));
    return () => {
      alive = false;
    };
  }, []);
  if (!boot) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-canvas text-ink-3">
        <Spinner size={22} />
      </div>
    );
  }
  return <ShopStore boot={boot}>{children}</ShopStore>;
}

function ShopStore({ boot, children }) {
  const [state, setState] = useState(boot.state);
  // Authoritative copy for synchronous reads inside actions (so e.g. createOrder can return the new RO).
  const stateRef = useRef(state);
  const syncRef = useRef(null);
  const saveTimer = useRef();
  // What IndexedDB already holds: nothing yet on a new device (or one moving from localStorage), so
  // the first save writes everything.
  const [saver] = useState(() => (boot.idb ? createSaver(boot.fromIdb ? boot.state : null) : null));
  const syncMetaRef = useRef(null);

  const flush = useCallback(() => {
    clearTimeout(saveTimer.current);
    if (!saver) return persistLocal(stateRef.current);
    saver.flush(stateRef.current).then(() => {
      if (boot.legacy) {
        try {
          localStorage.removeItem(LEGACY_KEY);
        } catch {
          // Harmless: the IndexedDB copy is used from now on.
        }
      }
    });
  }, [saver, boot]);

  useEffect(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flush, 250);
    return () => clearTimeout(saveTimer.current);
  }, [state, flush]);

  // A closing or hidden tab saves synchronously too, so the last edits are never lost.
  useEffect(() => {
    const hide = () => {
      clearTimeout(saveTimer.current);
      if (!saver) return persistLocal(stateRef.current);
      const meta = syncMetaRef.current?.();
      saver.journal(stateRef.current, meta ? { sync: meta } : {});
    };
    const onVisibility = () => document.visibilityState === 'hidden' && hide();
    window.addEventListener('pagehide', hide);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', hide);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [saver]);

  /** Replace the state. Local edits are reported to sync; changes that came from the cloud are not. */
  const commit = useCallback((next, { remote = false } = {}) => {
    const prev = stateRef.current;
    if (next === prev) return;
    stateRef.current = next;
    setState(next);
    if (!remote) syncRef.current?.noteLocal(diffStates(prev, next));
  }, []);

  /** Apply a mutation to a draft of the state (Immer). Keeps action code short and readable. */
  const update = useCallback(
    (mutator) => {
      let result;
      const base = stateRef.current;
      let next = produce(base, (draft) => {
        result = mutator(draft);
        if (isDraft(result)) result = current(result);
      });
      next = stampStatusChanges(base, next);
      commit(next);
      return result;
    },
    [commit],
  );

  /** Records from the cloud: [[collection, id, data|null], …]. */
  const applyRemote = useCallback(
    (changes) => commit(produce(stateRef.current, (d) => applyToDraft(d, changes)), { remote: true }),
    [commit],
  );

  // Who made a change, for the change history: the person using this device.
  const { userId, siteId } = useUI();
  // The location this device is working at, for new records (read inside actions without re-creating them).
  const siteRef = useRef(siteId);
  siteRef.current = siteId;
  const staffList = state.shop.staff;
  const actor = useMemo(() => {
    const list = staffList || [];
    return (list.find((p) => p.id === userId) || list.find((p) => p.role === 'owner') || list[0])?.name || '';
  }, [staffList, userId]);
  const sync = useShopSync({ stateRef, cloud: state.shop.cloud, commit, update, applyRemote, syncRef, syncMetaRef, bootSync: boot.sync, migrate, actor });

  const actions = useMemo(() => {
    const log = (s, text, ref) => {
      s.activity.unshift({ id: uid('act'), at: now(), text, ref });
      s.activity = s.activity.slice(0, 60);
    };
    const findOrder = (s, id) => s.orders.find((o) => o.id === id);
    const findService = (o, sid) => o?.services.find((x) => x.id === sid);
    const here = (s) => stampFor(s.shop, siteRef.current);
    const at = (rec) => (rec ? { locationId: rec } : {});
    const materialize = (s, items, laborRate = s.shop.laborRate) =>
      items.map((i) => {
        const base = { ...i, id: uid('itm') };
        if (i.type === 'labor') return { rate: laborRate, ...base };
        if (i.type === 'part') return { partStatus: 'needed', price: i.price ?? priceFromMatrix(i.cost, s.shop.matrix), ...base };
        return base;
      });
    const makeOrder = (s, { customerId, vehicleId, concern = '', jobIds = [], appointmentId = null, status = 'estimate', id = null, locationId }) => {
      s.counters.order += 1;
      const v = s.vehicles.find((x) => x.id === vehicleId);
      const appt = appointmentId && s.appointments.find((x) => x.id === appointmentId);
      const loc = locationId !== undefined ? locationId : appt?.locationId || here(s);
      const rate = shopAt(s.shop, loc).laborRate;
      const owner = s.customers.find((c) => c.id === (customerId || v?.customerId));
      const o = {
        id: id || uid('ro'),
        number: s.counters.order,
        status,
        ...at(loc),
        ...(owner?.account?.taxExempt ? { taxExempt: true } : {}),
        customerId: customerId || v?.customerId || null,
        vehicleId: vehicleId || null,
        techId: null,
        advisor: '',
        concern,
        mileageIn: v?.mileage || null,
        mileageOut: null,
        services: jobIds.map((jid) => {
          const job = s.cannedJobs.find((j) => j.id === jid);
          return { id: uid('svc'), title: job.title, status: 'pending', techId: null, done: false, items: materialize(s, job.items, rate), ...(job.tires ? { tires: newTireQuote() } : {}) };
        }),
        inspection: {},
        notes: [],
        payments: [],
        discount: { type: 'amt', value: 0 },
        createdAt: now(),
        updatedAt: now(),
        promisedAt: null,
        authorizedAt: null,
        invoicedAt: null,
        closedAt: null,
      };
      s.orders.push(o);
      if (appointmentId) {
        const a = s.appointments.find((x) => x.id === appointmentId);
        if (a) {
          Object.assign(a, { orderId: o.id, status: 'arrived' });
          o.source = a.source === 'online' ? 'online' : 'phone';
        }
      } else o.source = 'walk-in';
      log(s, `Repair order #${o.number} opened${v ? ` — ${vehicleName(v)}` : ''}`, o.id);
      return o;
    };

    return {
      updateShop: (patch) => update((s) => void Object.assign(s.shop, patch)),

      saveCustomer: (c) =>
        update((s) => {
          if (c.id) {
            Object.assign(s.customers.find((x) => x.id === c.id), c);
            return c.id;
          }
          const rec = { tags: [], notes: '', textOptIn: true, ...c, id: uid('cus'), createdAt: now() };
          s.customers.unshift(rec);
          log(s, `New customer: ${fullName(rec)}`);
          return rec.id;
        }),
      deleteCustomer: (id) =>
        update((s) => {
          s.customers = s.customers.filter((c) => c.id !== id);
          s.vehicles.forEach((v) => v.customerId === id && (v.customerId = null));
        }),

      saveVehicle: (v) =>
        update((s) => {
          if (v.id) {
            Object.assign(s.vehicles.find((x) => x.id === v.id), v);
            return v.id;
          }
          const rec = { notes: '', ...v, id: uid('veh'), createdAt: now() };
          s.vehicles.unshift(rec);
          log(s, `Vehicle added: ${vehicleName(rec)}`);
          return rec.id;
        }),
      deleteVehicle: (id) => update((s) => void (s.vehicles = s.vehicles.filter((v) => v.id !== id))),

      createOrder: (args) => update((s) => makeOrder(s, args)),


      updateOrder: (id, patch) =>
        update((s) => {
          const o = findOrder(s, id);
          Object.assign(o, typeof patch === 'function' ? patch(o) : patch, { updatedAt: now() });
        }),

      setOrderStatus: (id, status) =>
        update((s) => {
          const o = findOrder(s, id);
          if (!o || o.status === status) return;
          if (o.status === 'closed' && o.charge) delete o.charge;
          o.status = status;
          o.updatedAt = now();
          if (status === 'approved' && !o.authorizedAt) {
            o.authorizedAt = now();
            o.services.forEach((x) => x.status === 'pending' && (x.status = 'approved'));
          }
          if (status === 'ready' && !o.invoicedAt) o.invoicedAt = now();
          if (status === 'closed' && !o.closedAt) o.closedAt = now();
          if (status === 'ready' || status === 'closed') {
            if (o.mileageIn && !o.mileageOut) o.mileageOut = o.mileageIn;
            const v = s.vehicles.find((x) => x.id === o.vehicleId);
            if (v && o.mileageOut && o.mileageOut > (v.mileage || 0)) v.mileage = o.mileageOut;
          }
          log(s, `RO #${o.number} → ${STATUS[status]?.label || status}`, o.id);
        }),

      deleteOrder: (id) => update((s) => void (s.orders = s.orders.filter((o) => o.id !== id))),

      addService: (orderId, { jobId, title, items = [] } = {}) =>
        update((s) => {
          const o = findOrder(s, orderId);
          const job = jobId ? s.cannedJobs.find((j) => j.id === jobId) : null;
          const svc = {
            id: uid('svc'),
            title: job?.title || title || 'New service',
            status: o.status === 'estimate' ? 'pending' : 'approved',
            techId: o.techId,
            done: false,
            items: materialize(s, job ? job.items : items, shopAt(s.shop, o.locationId).laborRate),
            ...(job?.tires ? { tires: newTireQuote() } : {}),
          };
          o.services.push(svc);
          o.updatedAt = now();
          return svc.id;
        }),
      updateService: (orderId, serviceId, patch) =>
        update((s) => {
          Object.assign(findService(findOrder(s, orderId), serviceId), patch);
          findOrder(s, orderId).updatedAt = now();
        }),
      removeService: (orderId, serviceId) =>
        update((s) => {
          const o = findOrder(s, orderId);
          o.services = o.services.filter((x) => x.id !== serviceId);
        }),
      addItem: (orderId, serviceId, item) =>
        update((s) => {
          const [rec] = materialize(s, [item], shopAt(s.shop, findOrder(s, orderId)?.locationId).laborRate);
          findService(findOrder(s, orderId), serviceId).items.push(rec);
          return rec.id;
        }),
      updateItem: (orderId, serviceId, itemId, patch) =>
        update((s) => {
          const item = findService(findOrder(s, orderId), serviceId).items.find((i) => i.id === itemId);
          Object.assign(item, patch);
          if ('cost' in patch && item.type === 'part' && !('price' in patch) && item.autoPrice !== false) {
            item.price = priceFromMatrix(item.cost, s.shop.matrix);
          }
        }),
      // Customer or advisor picks one of the quoted tires: the service's tire line follows it.
      selectTire: (orderId, serviceId, optionId) =>
        update((s) => {
          const svc = findService(findOrder(s, orderId), serviceId);
          const q = svc?.tires;
          const opt = q?.options.find((x) => x.id === optionId);
          if (!opt) return;
          q.selectedId = optionId;
          const fields = { description: tireLabel(opt, q.size), brand: opt.brand, qty: Number(q.qty) || 4, cost: Number(opt.cost) || 0, price: Number(opt.price) || priceFromMatrix(Number(opt.cost) || 0, s.shop.matrix), autoPrice: false };
          const line = svc.items.find((i) => i.tireLine);
          if (line) Object.assign(line, fields);
          else svc.items.push({ id: uid('itm'), type: 'part', partNumber: '', partStatus: 'needed', tireLine: true, ...fields });
          findOrder(s, orderId).updatedAt = now();
        }),
      removeItem: (orderId, serviceId, itemId) =>
        update((s) => {
          const svc = findService(findOrder(s, orderId), serviceId);
          svc.items = svc.items.filter((i) => i.id !== itemId);
        }),

      addPayment: (orderId, payment) =>
        update((s) => {
          const o = findOrder(s, orderId);
          o.payments.push({ id: uid('pay'), at: now(), ...payment });
          const t = orderTotals(o, s.shop);
          log(s, `Payment ${payment.method} $${Number(payment.amount).toFixed(2)} on RO #${o.number}`, o.id);
          if (t.balance <= 0.004 && (o.status === 'ready' || o.status === 'closed')) {
            o.status = 'closed';
            o.closedAt = o.closedAt || now();
          }
          o.updatedAt = now();
        }),
      removePayment: (orderId, paymentId) =>
        update((s) => {
          const o = findOrder(s, orderId);
          o.payments = o.payments.filter((p) => p.id !== paymentId);
          // Invoices charged to an account stay closed (they're on the statement); others reopen for payment.
          if (o.status === 'closed' && !o.charge && orderTotals(o, s.shop).balance > 0.004) o.status = 'ready';
        }),

      // ---- Fleet & business accounts
      saveAccount: (customerId, patch) =>
        update((s) => {
          const c = s.customers.find((x) => x.id === customerId);
          if (!c) return;
          c.account = patch === null ? null : { ...BLANK_ACCOUNT, ...(c.account || {}), ...patch };
        }),
      // Invoice on terms: the vehicle goes home, the balance goes on the account's statement.
      chargeToAccount: (orderId, { po } = {}) =>
        update((s) => {
          const o = findOrder(s, orderId);
          const c = s.customers.find((x) => x.id === o?.customerId);
          if (!o || !c?.account) return;
          if (po != null) o.po = po;
          const at = now();
          o.invoicedAt = o.invoicedAt || at;
          o.charge = { at, terms: c.account.terms, dueAt: dueDate({ ...o, charge: null }, c) };
          o.status = 'closed';
          o.closedAt = o.closedAt || at;
          o.updatedAt = at;
          if (o.mileageIn && !o.mileageOut) o.mileageOut = o.mileageIn;
          log(s, `RO #${o.number} charged to ${c.company || fullName(c)} (${termsLabel(c.account.terms)})`, o.id);
        }),
      // One check or transfer paying several invoices.
      receivePayment: (customerId, { method, ref = '', at, allocations }) =>
        update((s) => {
          const batchId = allocations.length > 1 ? uid('batch') : undefined;
          const when = at || now();
          let total = 0;
          for (const a of allocations) {
            const o = findOrder(s, a.orderId);
            if (!o || o.customerId !== customerId) continue;
            // Never more than what's owed now (another device may have taken a payment meanwhile).
            const amount = Math.round(Math.min(Number(a.amount) || 0, orderTotals(o, s.shop).balance) * 100) / 100;
            if (amount <= 0) continue;
            o.payments.push({ id: uid('pay'), at: when, method, amount, ref, ...(batchId ? { batchId } : {}) });
            total += amount;
            if (orderTotals(o, s.shop).balance <= 0.004 && (o.status === 'ready' || o.status === 'closed')) {
              o.status = 'closed';
              o.closedAt = o.closedAt || when;
            }
            o.updatedAt = now();
          }
          const c = s.customers.find((x) => x.id === customerId);
          log(s, `${method} $${total.toFixed(2)}${ref ? ` (${ref})` : ''} from ${c?.company || fullName(c)} applied to ${allocations.length} invoice${allocations.length === 1 ? '' : 's'}`);
        }),
      // A PM done somewhere else (or before the shop's records start).
      recordPm: (vehicleId, planId, entry) =>
        update((s) => {
          const v = s.vehicles.find((x) => x.id === vehicleId);
          if (!v) return;
          v.pm = { ...(v.pm || {}), [planId]: entry };
          if (entry?.miles && entry.miles > (v.mileage || 0)) v.mileage = entry.miles;
        }),

      addNote: (orderId, text, internal = true) =>
        update((s) => void findOrder(s, orderId).notes.unshift({ id: uid('note'), at: now(), text, internal })),

      addMedia: (orderId, records, afterId) =>
        update((s) => {
          const o = findOrder(s, orderId);
          const list = o.media || [];
          const at = afterId ? list.findIndex((m) => m.id === afterId) + 1 : 0;
          o.media = at > 0 ? [...list.slice(0, at), ...records, ...list.slice(at)] : [...list, ...records];
          o.updatedAt = now();
        }),
      updateMedia: (orderId, mediaId, patch) =>
        update((s) => {
          const m = (findOrder(s, orderId).media || []).find((x) => x.id === mediaId);
          if (m) Object.assign(m, patch);
        }),
      removeMedia: (orderId, mediaIds) =>
        update((s) => {
          const o = findOrder(s, orderId);
          o.media = (o.media || []).filter((m) => !mediaIds.includes(m.id));
        }),
      // ---------------------------------------------------------------- Estimates
      authorize: (orderId, { serviceIds = [], declineIds = [], method = 'in-person', by = '', signature = null, note = '' }) =>
        update((s) => {
          const o = findOrder(s, orderId);
          const approved = o.services.filter((x) => serviceIds.includes(x.id));
          approved.forEach((x) => (x.status = 'approved'));
          o.services.filter((x) => declineIds.includes(x.id)).forEach((x) => (x.status = 'declined'));
          const amount = orderTotals({ ...o, services: approved }, s.shop).total;
          o.authorizations = [...(o.authorizations || []), { id: uid('auth'), at: now(), method, by, serviceIds, declinedIds: declineIds, amount, signature, note }];
          if (approved.length && !o.authorizedAt) o.authorizedAt = now();
          if (o.status === 'estimate' && approved.length && !o.services.some((x) => x.status === 'pending')) o.status = 'approved';
          o.updatedAt = now();
          log(s, `${by || 'Customer'} authorized ${approved.length} service${approved.length === 1 ? '' : 's'} on RO #${o.number}${declineIds.length ? `, declined ${declineIds.length}` : ''}`, o.id);
        }),

      // ---------------------------------------------------------------- Messages
      addMessage: ({ customerId, orderId = null, dir = 'out', channel = 'sms', body, at: when, meta }) =>
        update((s) => {
          s.messages.push({ id: uid('msg'), customerId, orderId, dir, channel, body, at: when || now(), read: dir === 'out', ...(meta ? { meta } : {}) });
        }),
      // Self check-in from the lobby tablet or the key drop: find (or add) the customer and vehicle and
      // open the repair order. Ids come from the inbox row, so two devices handling it agree.
      addCheckin: (row) =>
        update((s) => {
          const p = row.payload || {};
          const ref = String(row.id).replace(/[^\w-]/g, '').slice(0, 64);
          if (!ref || s.orders.some((o) => o.checkin?.remoteId === ref)) return null;
          const at = row.created_at || now();
          const clip = (v, n = 120) => String(v || '').trim().slice(0, n);
          let c = matchCustomer(s, p);
          if (!c) {
            const [firstName = '', ...rest] = clip(p.name).split(/\s+/);
            c = { id: `cus_ci_${ref}`, firstName, lastName: rest.join(' '), company: '', phone: clip(p.phone, 40), email: clip(p.email), address: '', city: '', state: '', zip: '', notes: 'Added at self check-in', tags: [], textOptIn: p.contact !== 'call', createdAt: at };
            s.customers.unshift(c);
          }
          let v = matchVehicle(s, c, p);
          const miles = Math.max(0, Math.round(Number(String(p.mileage || '').replace(/\D/g, '')) || 0));
          if (!v) {
            const d = parseVehicle(p.vehicle);
            const vin = clip(p.vin, 17).toUpperCase();
            // A scanned VIN fills in the year and make when the customer didn't type them.
            if (vin.length === 17) {
              const off = decodeOffline(vin);
              if (off.valid) {
                d.year = d.year || off.year;
                d.make = d.make || off.make || '';
              }
            }
            v = { id: `veh_ci_${ref}`, customerId: c.id, vin: vin.length === 17 ? vin : '', year: d.year, make: clip(d.make, 40), model: clip(d.model, 60), trim: '', engine: '', color: '', plate: clip(p.plate, 12).toUpperCase(), plateState: '', mileage: miles, notes: '', createdAt: at };
            s.vehicles.unshift(v);
          } else if (miles > (v.mileage || 0)) v.mileage = miles;
          const today = new Date().toDateString();
          const appt = s.appointments.find((a) => a.customerId === c.id && !a.orderId && new Date(a.start).toDateString() === today && !['cancelled', 'no_show'].includes(a.status));
          // The check-in link says which location the customer is at (none = the main location).
          const locationId = (s.shop.locations || []).some((l) => l.id === p.locationId) ? p.locationId : null;
          const o = makeOrder(s, { customerId: c.id, vehicleId: v.id, concern: clip(p.concern, 2000), appointmentId: appt?.id, id: `ro_ci_${ref}`, locationId });
          if (!appt) o.source = 'kiosk';
          if (miles) o.mileageIn = miles;
          o.transport = TRANSPORT[p.transport] ? p.transport : 'dropoff';
          if (p.needBy) o.promisedAt = new Date(p.needBy).toISOString();
          const by = clip(p.name) || 'Customer';
          const signature = typeof p.signature === 'string' && p.signature.startsWith('data:image/') ? p.signature : null;
          const limit = Number(p.diagLimit) || 0;
          o.checkin = { remoteId: ref, at, by, keyTag: clip(p.keyTag, 20), dropoff: p.dropoff === 'dropbox' ? 'dropbox' : 'counter', contact: ['text', 'call', 'email'].includes(p.contact) ? p.contact : 'text', loaner: Boolean(p.loaner) };
          if (signature) o.authorizations = [{ id: uid('auth'), at, method: 'kiosk', by, serviceIds: [], declinedIds: [], amount: limit, signature, note: limit ? `Diagnosis authorized at self check-in, up to $${limit}` : 'Signed at self check-in' }];
          const bits = [p.concern && `“${clip(p.concern, 300)}”`, o.checkin.dropoff === 'dropbox' ? `Keys in the drop box${o.checkin.keyTag ? ` (tag ${o.checkin.keyTag})` : ''}` : o.checkin.keyTag ? `Key tag ${o.checkin.keyTag}` : '', TRANSPORT[o.transport], p.needBy && `needs it by ${new Date(p.needBy).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}`].filter(Boolean);
          s.messages.push({ id: uid('msg'), customerId: c.id, orderId: o.id, dir: 'in', channel: 'portal', body: `Checked in ${vehicleName(v)} — ${bits.join(' · ')}`, at, read: false, meta: { remoteId: ref, checkin: true } });
          log(s, `Self check-in: ${fullName(c)} — ${vehicleName(v)}`, o.id);
          return o.id;
        }),

      // Contact and fleet forms on the shop's website: match the customer or add them, then log the message.
      addWebsiteMessage: ({ remoteId, name, phone, email, company, body, at: when }) =>
        update((s) => {
          if (remoteId && s.messages.some((m) => m.meta?.remoteId === remoteId)) return;
          const digits = (p = '') => p.replace(/\D/g, '').slice(-10);
          let c = s.customers.find((x) => (phone && digits(phone).length === 10 && digits(x.phone) === digits(phone)) || (email && x.email && x.email.toLowerCase() === email.toLowerCase()));
          if (!c) {
            const [firstName, ...rest] = (name || 'Website visitor').trim().split(/\s+/);
            c = { id: uid('cus'), firstName, lastName: rest.join(' '), phone: phone || '', email: email || '', address: '', city: '', state: '', zip: '', company: company || '', notes: 'Contacted through the website', tags: ['Website'], textOptIn: false, createdAt: now() };
            s.customers.unshift(c);
            log(s, `New contact from the website: ${fullName(c)}`);
          }
          s.messages.push({ id: uid('msg'), customerId: c.id, orderId: null, dir: 'in', channel: 'web', body, at: when || now(), read: false, meta: { remoteId } });
        }),
      markThreadRead: (customerId) =>
        update((s) => {
          s.messages.forEach((m) => m.customerId === customerId && !m.read && (m.read = true));
        }),
      deleteMessage: (id) => update((s) => void (s.messages = s.messages.filter((m) => m.id !== id))),

      // ---------------------------------------------------------------- Time clock
      clockIn: (techId) =>
        update((s) => {
          if (s.timeEntries.some((e) => e.kind === 'shift' && e.techId === techId && !e.end)) return;
          s.timeEntries.push({ id: uid('time'), kind: 'shift', techId, start: now(), end: null, ...at(here(s)) });
        }),
      clockOut: (techId) =>
        update((s) => {
          const t = now();
          s.timeEntries.forEach((e) => e.techId === techId && !e.end && (e.end = t));
        }),
      startJob: (techId, orderId, serviceId) =>
        update((s) => {
          const t = now();
          s.timeEntries.forEach((e) => e.kind === 'job' && e.techId === techId && !e.end && (e.end = t));
          const jobAt = findOrder(s, orderId)?.locationId || here(s);
          if (!s.timeEntries.some((e) => e.kind === 'shift' && e.techId === techId && !e.end)) s.timeEntries.push({ id: uid('time'), kind: 'shift', techId, start: t, end: null, ...at(jobAt) });
          s.timeEntries.push({ id: uid('time'), kind: 'job', techId, orderId, serviceId, start: t, end: null, ...at(jobAt) });
          const o = findOrder(s, orderId);
          const svc = findService(o, serviceId);
          if (svc && !svc.techId) svc.techId = techId;
          if (o && o.status === 'approved') {
            o.status = 'in_progress';
            log(s, `RO #${o.number} → In Progress`, o.id);
          }
        }),
      stopJob: (entryId) =>
        update((s) => {
          const e = s.timeEntries.find((x) => x.id === entryId);
          if (e && !e.end) e.end = now();
        }),
      saveTimeEntry: (entry) =>
        update((s) => {
          if (entry.id) return void Object.assign(s.timeEntries.find((x) => x.id === entry.id), entry);
          s.timeEntries.push({ ...entry, id: uid('time') });
        }),
      deleteTimeEntry: (id) => update((s) => void (s.timeEntries = s.timeEntries.filter((e) => e.id !== id))),

      // ---------------------------------------------------------------- Purchase orders
      savePO: (po) =>
        update((s) => {
          if (po.id) {
            Object.assign(s.purchaseOrders.find((x) => x.id === po.id), po);
            return po.id;
          }
          s.counters.po = (s.counters.po || 2000) + 1;
          const rec = { status: 'draft', notes: '', lines: [], orderedAt: null, expectedAt: null, receivedAt: null, ...at(here(s)), ...po, id: uid('po'), number: s.counters.po, createdAt: now() };
          s.purchaseOrders.unshift(rec);
          return rec.id;
        }),
      deletePO: (id) => update((s) => void (s.purchaseOrders = s.purchaseOrders.filter((p) => p.id !== id))),
      setPOStatus: (id, status) =>
        update((s) => {
          const po = s.purchaseOrders.find((p) => p.id === id);
          po.status = status;
          if (status === 'ordered') {
            po.orderedAt = po.orderedAt || now();
            // RO parts on this PO are now on order.
            po.lines.forEach((l) => {
              if (!l.orderId) return;
              const it = findService(findOrder(s, l.orderId), l.serviceId)?.items.find((i) => i.id === l.itemId);
              if (it && it.partStatus === 'needed') it.partStatus = 'ordered';
            });
            log(s, `PO #${po.number} sent to ${po.vendor}`);
          }
        }),
      receivePO: (id, receipts) =>
        update((s) => {
          const po = s.purchaseOrders.find((p) => p.id === id);
          let units = 0;
          for (const l of po.lines) {
            const q = Math.max(0, Math.min(Number(receipts[l.id]) || 0, l.qty - l.received));
            if (!q) continue;
            l.received += q;
            units += q;
            const inv = l.inventoryId && s.inventory.find((p) => p.id === l.inventoryId);
            if (inv) {
              inv.qty = (Number(inv.qty) || 0) + q;
              if (l.cost) inv.cost = l.cost;
            }
            if (l.orderId && l.received >= l.qty) {
              const it = findService(findOrder(s, l.orderId), l.serviceId)?.items.find((i) => i.id === l.itemId);
              if (it) it.partStatus = 'received';
            }
          }
          const done = po.lines.every((l) => l.received >= l.qty);
          po.status = done ? 'received' : 'partial';
          if (done) po.receivedAt = now();
          log(s, `Received ${units} item${units === 1 ? '' : 's'} on PO #${po.number}`);
        }),

      // ---------------------------------------------------------------- Expenses
      saveExpense: (e) =>
        update((s) => {
          if (e.id) return void Object.assign(s.expenses.find((x) => x.id === e.id), e);
          s.expenses.unshift({ method: 'Card', memo: '', ...e, id: uid('exp') });
        }),
      deleteExpense: (id) => update((s) => void (s.expenses = s.expenses.filter((e) => e.id !== id))),

      // ---------------------------------------------------------------- Online booking
      addBookingRequests: (list) =>
        update((s) => {
          const have = new Set(s.bookingRequests.map((b) => b.remoteId).filter(Boolean));
          list.filter((b) => !b.remoteId || !have.has(b.remoteId)).forEach((b) => s.bookingRequests.unshift({ status: 'new', ...b, id: uid('book') }));
        }),
      acceptBooking: (id, { start, duration, techId = null, title }) =>
        update((s) => {
          const b = s.bookingRequests.find((x) => x.id === id);
          const digits = (p = '') => p.replace(/\D/g, '').slice(-10);
          let c = (b.customerId && s.customers.find((x) => x.id === b.customerId)) || s.customers.find((x) => (b.phone && digits(x.phone) === digits(b.phone)) || (b.email && x.email && x.email.toLowerCase() === b.email.toLowerCase()));
          if (!c) {
            const [firstName, ...rest] = (b.name || 'New customer').trim().split(/\s+/);
            c = { id: uid('cus'), firstName, lastName: rest.join(' '), phone: b.phone || '', email: b.email || '', address: '', city: '', state: '', zip: '', company: '', notes: 'Booked online', tags: ['Online booking'], textOptIn: true, createdAt: now() };
            s.customers.unshift(c);
            log(s, `New customer from online booking: ${fullName(c)}`);
          }
          const m = (b.vehicle || '').trim().match(/^(\d{4})\s+(\S+)\s+(.+)$/);
          let v = m && s.vehicles.find((x) => x.customerId === c.id && String(x.year) === m[1] && x.make.toLowerCase() === m[2].toLowerCase());
          if (!v && (m || b.vin)) {
            v = { id: uid('veh'), customerId: c.id, vin: b.vin || '', year: m ? Number(m[1]) : '', make: m ? m[2] : '', model: m ? m[3] : b.vehicle || '', trim: '', engine: '', color: '', plate: '', plateState: '', mileage: 0, notes: '', createdAt: now() };
            s.vehicles.unshift(v);
          }
          if (!v) v = s.vehicles.find((x) => x.customerId === c.id);
          const appt = { id: uid('apt'), customerId: c.id, vehicleId: v?.id || null, start, duration, title: title || b.services.join(', ') || 'Online booking', techId, status: 'scheduled', notes: b.notes || '', source: 'online', ...at(here(s)) };
          s.appointments.push(appt);
          Object.assign(b, { status: 'accepted', customerId: c.id, appointmentId: appt.id, decidedAt: now() });
          log(s, `Online booking accepted for ${fullName(c)}`);
          return appt.id;
        }),
      declineBooking: (id) =>
        update((s) => {
          Object.assign(s.bookingRequests.find((x) => x.id === id), { status: 'declined', decidedAt: now() });
        }),

      // ---------------------------------------------------------------- Marketing
      logCampaign: (c) =>
        update((s) => {
          s.campaigns.unshift({ ...c, id: uid('cmp'), at: now() });
        }),

      // ---------------------------------------------------------------- Inspection templates
      saveInspectionTemplate: (t) =>
        update((s) => {
          if (t.id && s.inspectionTemplates.some((x) => x.id === t.id)) return void Object.assign(s.inspectionTemplates.find((x) => x.id === t.id), t);
          s.inspectionTemplates.push({ ...t, id: uid('insp') });
        }),
      deleteInspectionTemplate: (id) =>
        update((s) => {
          if (s.inspectionTemplates.length > 1) s.inspectionTemplates = s.inspectionTemplates.filter((t) => t.id !== id);
        }),

      // ---------------------------------------------------------------- Data import
      importRecords: ({ customers = [], vehicles = [], inventory = [], inventoryUpdates = [], orders = [] }) =>
        update((s) => {
          s.customers.unshift(...customers);
          s.vehicles.unshift(...vehicles);
          s.inventory.unshift(...inventory);
          for (const u of inventoryUpdates) {
            const p = s.inventory.find((x) => x.id === u.id);
            if (p) Object.assign(p, { qty: u.qty, cost: u.cost });
          }
          for (const o of orders) {
            s.counters.order += 1;
            s.orders.push({ ...o, number: o.number || s.counters.order });
          }
          log(s, `Imported ${customers.length} customers, ${vehicles.length} vehicles, ${inventory.length} parts${inventoryUpdates.length ? ` (${inventoryUpdates.length} updated)` : ''}${orders.length ? `, ${orders.length} repair orders` : ''}`);
        }),

      setShare: (orderId, share) =>
        update((s) => {
          findOrder(s, orderId).share = share;
        }),

      setInspection: (orderId, key, patch) =>
        update((s) => {
          const o = findOrder(s, orderId);
          o.inspection[key] = { rating: null, note: '', ...(o.inspection[key] || {}), ...patch };
        }),

      saveAppointment: (a) =>
        update((s) => {
          if (a.id) return void Object.assign(s.appointments.find((x) => x.id === a.id), a);
          const rec = { status: 'scheduled', notes: '', duration: 60, ...at(here(s)), ...a, id: uid('apt') };
          s.appointments.push(rec);
          const c = s.customers.find((x) => x.id === rec.customerId);
          log(s, `Appointment booked${c ? ` for ${fullName(c)}` : ''}`);
          return rec.id;
        }),
      deleteAppointment: (id) => update((s) => void (s.appointments = s.appointments.filter((a) => a.id !== id))),

      saveInventoryItem: (p) =>
        update((s) => {
          if (p.id) return void Object.assign(s.inventory.find((x) => x.id === p.id), p);
          const rec = { qty: 0, min: 0, ...at(here(s)), ...p, id: uid('inv') };
          s.inventory.unshift(rec);
          return rec.id;
        }),
      // Move stock between locations: the same part (by part number or SKU) at the other location gets it.
      transferInventory: (id, toLocation, qty) =>
        update((s) => {
          const p = s.inventory.find((x) => x.id === id);
          const n = Math.min(Number(qty) || 0, Number(p?.qty) || 0);
          if (!p || n <= 0) return null;
          const dest = toLocation === 'main' ? null : toLocation;
          const same = (x) => (x.locationId || null) === dest && ((p.partNumber && x.partNumber === p.partNumber) || (!p.partNumber && p.sku && x.sku === p.sku));
          let target = s.inventory.find(same);
          if (!target) {
            target = { ...p, id: uid('inv'), qty: 0, location: '', ...(dest ? { locationId: dest } : {}) };
            if (!dest) delete target.locationId;
            s.inventory.unshift(target);
          }
          p.qty = (Number(p.qty) || 0) - n;
          target.qty = (Number(target.qty) || 0) + n;
          log(s, `Transferred ${n} × ${p.description} between locations`);
          return target.id;
        }),
      adjustInventory: (id, delta) =>
        update((s) => {
          const p = s.inventory.find((x) => x.id === id);
          p.qty = Math.max(0, (Number(p.qty) || 0) + delta);
        }),
      deleteInventoryItem: (id) => update((s) => void (s.inventory = s.inventory.filter((p) => p.id !== id))),

      saveCannedJob: (j) =>
        update((s) => {
          if (j.id) return void Object.assign(s.cannedJobs.find((x) => x.id === j.id), j);
          s.cannedJobs.push({ items: [], category: 'General', ...j, id: uid('cj') });
        }),
      deleteCannedJob: (id) => update((s) => void (s.cannedJobs = s.cannedJobs.filter((j) => j.id !== id))),

      saveTechnician: (t) =>
        update((s) => {
          if (t.id) return void Object.assign(s.technicians.find((x) => x.id === t.id), t);
          s.technicians.push({ ...t, id: uid('tech') });
        }),

      /** Put a record back to an earlier version (from the change history). */
      restoreRecord: (collection, id, data) =>
        update((s) => {
          if (!Array.isArray(s[collection]) || !data) return;
          const i = s[collection].findIndex((x) => x.id === id);
          if (i >= 0) s[collection][i] = data;
          else s[collection].push(data);
        }),

      resetDemo: () => commit(migrate(createSeed())),
      clearAll: () => {
        const prev = stateRef.current;
        commit({
          ...createSeed(),
          shop: prev.shop,
          customers: [],
          vehicles: [],
          orders: [],
          appointments: [],
          inventory: [],
          activity: [],
          purchaseOrders: [],
          timeEntries: [],
          messages: [],
          expenses: [],
          bookingRequests: [],
          campaigns: [],
          technicians: prev.technicians,
          inspectionTemplates: prev.inspectionTemplates,
          cannedJobs: CANNED_JOBS.map((j) => structuredClone(j)),
          counters: { order: prev.counters.order, po: prev.counters.po || 2000 },
        });
      },
      importData: (data) => {
        if (data?.version !== 2 || !Array.isArray(data.orders)) throw new Error('Not an AutoShop Pro backup file');
        commit(migrate(data));
      },
    };
  }, [update, commit]);

  // Handle for support and automated checks: read the live state or apply a change from the console.
  useEffect(() => {
    window.__autoshop = { state: () => stateRef.current, update, sync: () => syncRef.current, flush };
  }, [update, flush]);

  const value = useMemo(() => ({ state, ...actions }), [state, actions]);
  return (
    <ShopContext.Provider value={value}>
      <SyncContext.Provider value={sync}>{children}</SyncContext.Provider>
    </ShopContext.Provider>
  );
}
