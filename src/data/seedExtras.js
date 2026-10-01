// Demo data for the operational modules (time clock, purchase orders, messages, expenses, online
// booking requests). Generated from the core demo shop so names, ROs and dates line up.
import { orderTotals, serviceHours } from '../lib/pricing';
import { DEFAULT_INSPECTION_TEMPLATE, SHOP_DEFAULTS } from '../store/defaults';

export function seedExtras({ shop, orders, customers, vehicles, technicians, inventory, now, rand, id }) {
  const at = (daysAgo, hour, minute = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    d.setHours(hour, minute, 0, 0);
    return d;
  };
  const iso = (d) => d.toISOString();
  const isoDay = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const workday = (d) => d.getDay() !== 0;

  // ---------------------------------------------------------------- Team pay setup
  // The master tech on flat rate (paid per flagged hour), the others hourly — the A-tech with a
  // labor commission, the lube tech part-time.
  const team = technicians.map((t) => ({
    ...t,
    active: true,
    phone: '',
    email: `${t.name.split(' ')[0].toLowerCase()}@mainstreetauto.example`,
    ...{
      t1: { payType: 'flat', laborCommissionPct: 0, partsCommissionPct: 0 },
      t2: { payType: 'hourly', laborCommissionPct: 0, partsCommissionPct: 0 },
      t3: { payType: 'hourly', laborCommissionPct: 3, partsCommissionPct: 0 },
      t4: { payType: 'hourly', laborCommissionPct: 0, partsCommissionPct: 0 },
    }[t.id],
  }));

  // ---------------------------------------------------------------- Time clock
  const timeEntries = [];
  const HISTORY_DAYS = 150;
  // Shifts (today's still open for whoever is in). Outside shop hours nobody is on the clock, so
  // the demo looks right whenever it's opened.
  const hourNow = now.getHours() + now.getMinutes() / 60;
  const shopOpen = hourNow >= 7.75 && hourNow < 16.5 && now.getDay() !== 0;
  const shiftEnd = new Map();
  for (let d = HISTORY_DAYS; d >= 0; d--) {
    const day = at(d, 0);
    if (!workday(day)) continue;
    for (const t of team) {
      if (d > 0 && rand() < 0.04) continue; // a day off now and then
      const saturday = day.getDay() === 6;
      if (saturday && t.id !== 't4' && t.id !== 't3') continue;
      const start = t.id === 't4' ? at(d, 7, 55 + Math.floor(rand() * 8)) : at(d, 7, 22 + Math.floor(rand() * 15));
      const end = saturday ? at(d, 12, 5 + Math.floor(rand() * 20)) : t.id === 't4' ? at(d, 14, 25 + Math.floor(rand() * 15)) : at(d, 16, 30 + Math.floor(rand() * 40));
      if (start > now) continue;
      const open = d === 0 && now < end;
      timeEntries.push({ id: id('time'), kind: 'shift', techId: t.id, start: iso(start), end: open ? null : iso(end) });
      shiftEnd.set(`${t.id}|${isoDay(start)}`, [start, end]);
    }
  }
  // Job clock time for completed work: actual time against flagged hours, packed into each tech's
  // shifts in order (long jobs carry over to the next day).
  const cursor = new Map();
  const nextShift = (techId, from) => {
    for (let i = 0; i < 10; i++) {
      const d = new Date(from);
      d.setDate(d.getDate() + i);
      const sh = shiftEnd.get(`${techId}|${isoDay(d)}`);
      if (!sh) continue;
      const startAt = new Date(Math.max(sh[0].getTime() + 15 * 60000, i === 0 ? from.getTime() : 0));
      if (startAt < sh[1]) return [startAt, sh[1]];
    }
    return null;
  };
  const jobOrders = orders.filter((o) => ['closed', 'ready'].includes(o.status) && o.invoicedAt).sort((a, b) => (a.authorizedAt || a.createdAt).localeCompare(b.authorizedAt || b.createdAt));
  for (const o of jobOrders) {
    const begin = new Date(o.authorizedAt || o.createdAt);
    for (const s of o.services) {
      if (s.status === 'declined' || !s.techId) continue;
      const flagged = serviceHours(s);
      if (!flagged) continue;
      let remaining = flagged * (0.76 + rand() * 0.34) * 3600000;
      let at0 = new Date(Math.max(begin.getTime(), (cursor.get(s.techId) || new Date(0)).getTime()));
      for (let guard = 0; remaining > 0 && guard < 6; guard++) {
        const slot = nextShift(s.techId, at0);
        if (!slot) break;
        const [st, en] = slot;
        const take = Math.min(remaining, en - st);
        const end = new Date(st.getTime() + take);
        timeEntries.push({ id: id('time'), kind: 'job', techId: s.techId, orderId: o.id, serviceId: s.id, start: iso(st), end: iso(end) });
        remaining -= take;
        at0 = new Date(end.getTime() + (8 + rand() * 12) * 60000);
        if (remaining > 0) {
          at0 = new Date(en);
          at0.setDate(at0.getDate() + 1);
          at0.setHours(0, 0, 0, 0);
        }
      }
      cursor.set(s.techId, at0);
    }
  }
  // Jobs on the clock right now.
  const running = shopOpen ? orders.filter((o) => o.status === 'in_progress') : [];
  running.forEach((o, i) => {
    const s = o.services.find((x) => !x.done && x.status === 'approved' && x.techId);
    if (!s) return;
    const start = new Date(now.getTime() - (35 + i * 25) * 60000);
    timeEntries.push({ id: id('time'), kind: 'job', techId: s.techId, orderId: o.id, serviceId: s.id, start: iso(start), end: null });
  });

  // ---------------------------------------------------------------- Authorizations
  for (const o of orders) {
    o.authorizations = [];
    if (!o.authorizedAt) continue;
    const c = customers.find((x) => x.id === o.customerId);
    const approved = o.services.filter((s) => s.status === 'approved');
    if (!approved.length) continue;
    const amount = orderTotals({ ...o, services: approved }, shop).total;
    o.authorizations.push({ id: id('auth'), at: o.authorizedAt, method: pick(['phone', 'text', 'in-person', 'phone']), by: c ? `${c.firstName} ${c.lastName}` : 'Customer', serviceIds: approved.map((s) => s.id), amount, signature: null, note: '' });
  }

  // ---------------------------------------------------------------- Purchase orders
  const inv = (sku) => inventory.find((p) => p.sku === sku);
  const line = (sku, qty, received = 0) => {
    const p = inv(sku);
    return { id: id('pol'), inventoryId: p.id, partNumber: p.partNumber, description: p.description, qty, received, cost: p.cost, orderId: null };
  };
  const waiting = orders.find((o) => o.status === 'waiting_parts');
  const hubLine = waiting?.services.flatMap((s) => s.items.map((it) => ({ s, it }))).find(({ it }) => it.type === 'part' && it.partStatus === 'ordered');
  const purchaseOrders = [
    { id: id('po'), number: 2001, vendor: 'Lubricant distributor', status: 'received', createdAt: iso(at(12, 9)), orderedAt: iso(at(12, 9, 20)), expectedAt: iso(at(10, 10)), receivedAt: iso(at(10, 11, 5)), notes: 'Monthly bulk oil order', lines: [line('OIL-0W20-Q', 110, 110), line('OIL-5W30-Q', 55, 55)] },
    {
      id: id('po'),
      number: 2002,
      vendor: 'GM dealer',
      status: 'ordered',
      createdAt: iso(at(1, 11, 25)),
      orderedAt: iso(at(1, 11, 30)),
      expectedAt: iso(at(-1, 10)),
      receivedAt: null,
      notes: 'Hub for RO in waiting on parts',
      lines: [
        ...(hubLine ? [{ id: id('pol'), inventoryId: null, partNumber: '', description: hubLine.it.description, qty: 1, received: 0, cost: hubLine.it.cost, orderId: waiting.id, serviceId: hubLine.s.id, itemId: hubLine.it.id }] : []),
        line('OF-PF48', 12),
        line('ATF-DEX6', 12),
      ],
    },
    { id: id('po'), number: 2003, vendor: 'Local jobber', status: 'draft', createdAt: iso(at(0, 8, 10)), orderedAt: null, expectedAt: null, receivedAt: null, notes: 'Restock low items', lines: [line('WB-18', 6), line('SUP-GLOVES', 6), line('OIL-5W20-Q', 0)].filter((l) => l.qty > 0) },
  ];

  // ---------------------------------------------------------------- Messages
  const messages = [];
  const msg = (c, dir, channel, body, when, orderId = null) => {
    // Nothing from the future: early in the morning, "today's" messages become just-now ones.
    const w = when > now ? new Date(now.getTime() - (dir === 'in' ? 4 : 9) * 60000) : when;
    messages.push({ id: id('msg'), customerId: c.id, orderId, dir, channel, body, at: iso(w), read: dir === 'out' || w < at(0, 0) });
  };
  const byCustomer = (c) => orders.filter((o) => o.customerId === c.id && o.status !== 'closed');
  customers.forEach((c, i) => {
    const open = byCustomer(c)[0];
    const v = vehicles.find((x) => x.customerId === c.id);
    const vName = v ? `${v.year} ${v.make} ${v.model}` : 'vehicle';
    if (open) {
      const base = new Date(open.createdAt);
      if (open.status === 'estimate') {
        msg(c, 'out', 'sms', `Hi ${c.firstName}, it’s ${shop.name}. Your estimate for the ${vName} is ready — we sent photos of what we found. Reply YES to approve or call with questions.`, new Date(base.getTime() + 40 * 60000), open.id);
        if (i % 2) msg(c, 'in', 'sms', 'Thanks — can you do the control arms first and the alignment next week?', new Date(base.getTime() + 95 * 60000), open.id);
      } else if (open.status === 'ready') {
        msg(c, 'out', 'sms', `Hi ${c.firstName}, your ${vName} is ready for pickup at ${shop.name}.`, new Date(open.invoicedAt), open.id);
        msg(c, 'in', 'sms', 'Great, I’ll be there around 5:15.', new Date(new Date(open.invoicedAt).getTime() + 12 * 60000), open.id);
      } else {
        msg(c, 'out', 'sms', `Hi ${c.firstName}, we’ve started on your ${vName}. We’ll text you as soon as it’s done.`, new Date((open.authorizedAt ? new Date(open.authorizedAt) : base).getTime() + 15 * 60000), open.id);
        if (open.status === 'waiting_parts') msg(c, 'in', 'sms', 'Any update on the part?', at(0, 8, 42), open.id);
      }
    } else if (i % 4 === 0) {
      msg(c, 'out', 'email', `Hi ${c.firstName}, thanks for visiting ${shop.name}! Your next oil service is due in about 3 months.`, at(20 + i, 17, 30));
    }
  });

  // ---------------------------------------------------------------- Expenses (operating, not parts)
  const expenses = [];
  const exp = (date, category, vendor, amount, method = 'ACH', memo = '') => expenses.push({ id: id('exp'), date: iso(date), category, vendor, amount: Math.round(amount * 100) / 100, method, memo });
  for (let m = 0; m < 6; m++) {
    const first = new Date(now.getFullYear(), now.getMonth() - m, 1, 9);
    if (first > now) continue;
    const day = (n) => new Date(first.getFullYear(), first.getMonth(), n, 10);
    const past = (d) => d <= now;
    exp(first, 'Rent', 'Main Street Properties LLC', 6200, 'ACH', 'Building lease');
    if (past(day(5))) exp(day(5), 'Insurance', 'Garage liability & property', 1350, 'ACH');
    if (past(day(8))) exp(day(8), 'Utilities', 'City Water Light & Power', 780 + rand() * 320, 'ACH', 'Electric & water');
    if (past(day(9))) exp(day(9), 'Utilities', 'Ameren gas', 90 + rand() * 180, 'ACH');
    if (past(day(10))) exp(day(10), 'Software', 'Shop software & service info', 649, 'Card');
    if (past(day(12))) exp(day(12), 'Advertising', 'Local search ads', 900 + Math.round(rand() * 400), 'Card');
    if (past(day(14))) exp(day(14), 'Office payroll', 'Service advisors & office payroll', 4200, 'ACH');
    if (past(day(28))) exp(day(28), 'Office payroll', 'Service advisors & office payroll', 4200, 'ACH');
    if (past(day(16))) exp(day(16), 'Shop supplies', 'Local jobber', 300 + rand() * 200, 'Card', 'Rags, cleaners, gloves');
    if (past(day(18))) exp(day(18), 'Bank & card fees', 'Card processor', 2250 + rand() * 400, 'ACH', 'Monthly processing fees');
    if (m % 2 === 0 && past(day(21))) exp(day(21), 'Tools & equipment', pick(['Snap-on', 'Matco', 'Tool distributor']), 180 + rand() * 700, 'Card');
    if (m === 2 && past(day(22))) exp(day(22), 'Repairs & maintenance', 'Lift inspection & service', 640, 'Check');
  }
  expenses.sort((a, b) => b.date.localeCompare(a.date));

  // ---------------------------------------------------------------- Online booking requests
  const slot = (daysAhead, hour, minute = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() + daysAhead);
    if (d.getDay() === 0) d.setDate(d.getDate() + 1);
    d.setHours(hour, minute, 0, 0);
    return iso(d);
  };
  const bookingRequests = [
    { id: id('book'), status: 'new', createdAt: iso(new Date(now.getTime() - 50 * 60000)), source: 'online', name: 'Rachel Kim', phone: '(217) 555-0188', email: 'rachel.kim@example.com', vehicle: '2018 Subaru Forester', vin: '', services: ['Full synthetic oil & filter service', 'Tire rotation & pressure check'], start: slot(2, 9, 30), duration: 60, notes: 'Can I wait in the lobby?', customerId: null },
    { id: id('book'), status: 'new', createdAt: iso(new Date(now.getTime() - 3.2 * 3600000)), source: 'online', name: `${customers[5].firstName} ${customers[5].lastName}`, phone: customers[5].phone, email: customers[5].email, vehicle: '2019 Honda CR-V', vin: '', services: ['A/C performance check & recharge'], start: slot(3, 13, 0), duration: 90, notes: 'A/C smells musty and isn’t very cold.', customerId: customers[5].id },
  ];

  return {
    technicians: team,
    timeEntries,
    purchaseOrders,
    messages: messages.sort((a, b) => a.at.localeCompare(b.at)),
    expenses,
    bookingRequests,
    campaigns: [],
    inspectionTemplates: [DEFAULT_INSPECTION_TEMPLATE],
    shopExtras: {
      ...SHOP_DEFAULTS,
      financing: { ...SHOP_DEFAULTS.financing, enabled: true, provider: 'Our financing partner', apr: 9.99, terms: [6, 12, 24], minAmount: 300 },
    },
  };
}
