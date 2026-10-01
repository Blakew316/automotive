// Who's using this device and what they can open. Roles keep each person focused on their work;
// PINs keep a shared counter tablet or bay phone on the right profile. (Shop data still lives in
// this browser — this is access control for people, not encryption.)

export const ROLES = {
  owner: { label: 'Owner', desc: 'Everything — accounting, pay, settings and data' },
  manager: { label: 'Shop manager', desc: 'Runs the shop day to day; no accounting or payroll' },
  advisor: { label: 'Service advisor', desc: 'Front counter: repair orders, customers, messages, scheduling, parts' },
  tech: { label: 'Technician', desc: 'Tech clock, workflow, repair orders and technical info' },
};

const SHOP_FLOOR = ['/', '/workflow', '/orders', '/calendar', '/messages', '/customers', '/vehicles', '/marketing', '/tech', '/catalog', '/vin', '/parts', '/library'];
const ALLOW = {
  owner: null, // everything
  manager: [...SHOP_FLOOR, '/team', '/reports', '/integrations', '/import', '/settings'],
  advisor: SHOP_FLOOR,
  tech: ['/tech', '/workflow', '/orders', '/catalog', '/vin', '/parts', '/library'],
};

export function canAccess(role, path) {
  if (role === 'owner') return true;
  const allow = ALLOW[role] || ALLOW.advisor;
  return allow.some((p) => (p === '/' ? path === '/' : path === p || path.startsWith(`${p}/`)));
}

export const homeFor = (role) => (role === 'tech' ? '/tech' : '/');
export const canSeePay = (role) => role === 'owner';

/** Default staff for shops that haven't set any up: an owner, the advisor and each technician. */
export function defaultStaff(technicians = []) {
  return [
    { id: 'staff-owner', name: 'Shop owner', role: 'owner', pin: '' },
    { id: 'staff-advisor', name: 'Jordan Blake', role: 'advisor', pin: '' },
    ...technicians.map((t) => ({ id: `staff-${t.id}`, name: t.name, role: 'tech', techId: t.id, pin: '' })),
  ];
}

/** Small one-way hash for PINs (not a security boundary — the data is on this device). */
export function hashPin(pin) {
  let h = 2166136261;
  for (const ch of `autoshop:${pin}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}
