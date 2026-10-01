import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ShopContext } from './context';
import { createSeed, CANNED_JOBS } from '../data/seed';
import { priceFromMatrix, orderTotals } from '../lib/pricing';
import { STATUS } from '../lib/workflow';
import { uid, fullName, vehicleName } from '../lib/format';

const STORAGE_KEY = 'autoshop-pro:v2';

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data?.version === 2) return data;
    }
  } catch {
    // Corrupt or unavailable storage: fall back to demo data.
  }
  return createSeed();
}

const now = () => new Date().toISOString();

function persist(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Quota exceeded or storage blocked — the session keeps working in memory.
  }
}

export default function ShopProvider({ children }) {
  const [state, setState] = useState(load);
  // Authoritative copy for synchronous reads inside actions (so e.g. createOrder can return the new RO).
  const stateRef = useRef(state);
  const saveTimer = useRef();

  useEffect(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => persist(state), 250);
    return () => clearTimeout(saveTimer.current);
  }, [state]);

  // Flush immediately when the tab is hidden or closed so a debounced save is never lost.
  useEffect(() => {
    const flush = () => {
      clearTimeout(saveTimer.current);
      persist(stateRef.current);
    };
    const onVisibility = () => document.visibilityState === 'hidden' && flush();
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const commit = useCallback((next) => {
    stateRef.current = next;
    setState(next);
  }, []);

  /** Apply a mutation to a deep copy of state. Keeps action code short and readable. */
  const update = useCallback(
    (mutator) => {
      const draft = structuredClone(stateRef.current);
      const result = mutator(draft);
      commit(draft);
      return result;
    },
    [commit],
  );

  const actions = useMemo(() => {
    const log = (s, text, ref) => {
      s.activity.unshift({ id: uid('act'), at: now(), text, ref });
      s.activity = s.activity.slice(0, 60);
    };
    const findOrder = (s, id) => s.orders.find((o) => o.id === id);
    const findService = (o, sid) => o?.services.find((x) => x.id === sid);
    const materialize = (s, items) =>
      items.map((i) => {
        const base = { ...i, id: uid('itm') };
        if (i.type === 'labor') return { rate: s.shop.laborRate, ...base };
        if (i.type === 'part') return { partStatus: 'needed', price: i.price ?? priceFromMatrix(i.cost, s.shop.matrix), ...base };
        return base;
      });

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

      createOrder: ({ customerId, vehicleId, concern = '', jobIds = [], appointmentId = null, status = 'estimate' }) =>
        update((s) => {
          s.counters.order += 1;
          const v = s.vehicles.find((x) => x.id === vehicleId);
          const o = {
            id: uid('ro'),
            number: s.counters.order,
            status,
            customerId: customerId || v?.customerId || null,
            vehicleId: vehicleId || null,
            techId: null,
            advisor: '',
            concern,
            mileageIn: v?.mileage || null,
            mileageOut: null,
            services: jobIds.map((jid) => {
              const job = s.cannedJobs.find((j) => j.id === jid);
              return { id: uid('svc'), title: job.title, status: 'pending', techId: null, done: false, items: materialize(s, job.items) };
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
            if (a) Object.assign(a, { orderId: o.id, status: 'arrived' });
          }
          log(s, `Repair order #${o.number} opened${v ? ` — ${vehicleName(v)}` : ''}`, o.id);
          return o;
        }),

      updateOrder: (id, patch) =>
        update((s) => {
          const o = findOrder(s, id);
          Object.assign(o, typeof patch === 'function' ? patch(o) : patch, { updatedAt: now() });
        }),

      setOrderStatus: (id, status) =>
        update((s) => {
          const o = findOrder(s, id);
          if (!o || o.status === status) return;
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
            items: materialize(s, job ? job.items : items),
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
          const [rec] = materialize(s, [item]);
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
          if (o.status === 'closed' && orderTotals(o, s.shop).balance > 0.004) o.status = 'ready';
        }),

      addNote: (orderId, text, internal = true) =>
        update((s) => void findOrder(s, orderId).notes.unshift({ id: uid('note'), at: now(), text, internal })),

      addMedia: (orderId, records) =>
        update((s) => {
          const o = findOrder(s, orderId);
          o.media = [...(o.media || []), ...records];
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
          const rec = { status: 'scheduled', notes: '', duration: 60, ...a, id: uid('apt') };
          s.appointments.push(rec);
          const c = s.customers.find((x) => x.id === rec.customerId);
          log(s, `Appointment booked${c ? ` for ${fullName(c)}` : ''}`);
          return rec.id;
        }),
      deleteAppointment: (id) => update((s) => void (s.appointments = s.appointments.filter((a) => a.id !== id))),

      saveInventoryItem: (p) =>
        update((s) => {
          if (p.id) return void Object.assign(s.inventory.find((x) => x.id === p.id), p);
          const rec = { qty: 0, min: 0, ...p, id: uid('inv') };
          s.inventory.unshift(rec);
          return rec.id;
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

      resetDemo: () => commit(createSeed()),
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
          cannedJobs: CANNED_JOBS.map((j) => structuredClone(j)),
          counters: { order: prev.counters.order },
        });
      },
      importData: (data) => {
        if (data?.version !== 2 || !Array.isArray(data.orders)) throw new Error('Not an AutoShop Pro backup file');
        commit(data);
      },
    };
  }, [update, commit]);

  const value = useMemo(() => ({ state, ...actions }), [state, actions]);
  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}
