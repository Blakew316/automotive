import { useContext, useMemo } from 'react';
import { ShopContext, UIContext, SyncContext, PhoneContext, PayContext, EmailContext } from './context';
import { totalsCalculator } from '../lib/pricing';
import { canAccess } from '../lib/access';
import { isMulti, siteList, scopeState } from '../lib/locations';

export function useShop() {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error('useShop must be used inside <ShopProvider>');
  return ctx;
}

/** Shared shop data: status and the join / upload / leave actions (see lib/sync/useShopSync). */
export function useSync() {
  return useContext(SyncContext);
}

const NO_LINE = { status: null, connected: false, ready: false, optedOut: () => false, refresh: () => {}, send: null, call: null };
/** The business phone line: texting & calls from the shop's number (components/PhoneLine.jsx). */
export function usePhone() {
  return useContext(PhoneContext) || NO_LINE;
}

const NO_PAY = { status: null, ready: false, refresh: () => {}, ensureLink: null, refund: null, readers: [], reader: null };
/** Online card payments through the shop's Stripe account (components/PayLine.jsx). */
export function usePay() {
  return useContext(PayContext) || NO_PAY;
}

const NO_EMAIL = { status: null, ready: false, refresh: () => {}, send: null };
/** Email from the shop's own address, with PDFs and delivery tracking (components/EmailLine.jsx). */
export function useEmail() {
  return useContext(EmailContext) || NO_EMAIL;
}

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI must be used inside <UIProvider>');
  return ctx;
}

/** Id → record maps for fast joins in lists. */
export function useLookup() {
  const { state } = useShop();
  return useMemo(
    () => ({
      customer: new Map(state.customers.map((c) => [c.id, c])),
      vehicle: new Map(state.vehicles.map((v) => [v.id, v])),
      tech: new Map(state.technicians.map((t) => [t.id, t])),
      order: new Map(state.orders.map((o) => [o.id, o])),
    }),
    [state.customers, state.vehicles, state.technicians, state.orders],
  );
}

/** Returns a memo-friendly totals calculator bound to the shop's current rates. */
export function useTotals() {
  const { state } = useShop();
  return useMemo(() => totalsCalculator(state.shop), [state.shop]);
}

/** Locations: whether the shop has several, the list, and the one this device is working at. */
export function useSite() {
  const { state } = useShop();
  const { siteId, setSiteId } = useUI();
  return useMemo(() => {
    const multi = isMulti(state.shop);
    const sites = siteList(state.shop);
    const current = multi && sites.some((l) => l.id === siteId) ? siteId : 'all';
    return { multi, sites, current, setCurrent: setSiteId, name: current === 'all' ? 'All locations' : sites.find((l) => l.id === current)?.name };
  }, [state.shop, siteId, setSiteId]);
}

/** useShop(), with repair orders, appointments, time, POs and inventory limited to this device's location. */
export function useScopedShop() {
  const ctx = useShop();
  const { current } = useSite();
  const scoped = useMemo(() => scopeState(ctx.state, current), [ctx.state, current]);
  return useMemo(() => (scoped === ctx.state ? ctx : { ...ctx, state: scoped }), [ctx, scoped]);
}

/** The person using this device, their role, and a path check. Defaults to the first owner. */
export function useAccess() {
  const { state } = useShop();
  const { userId, setUserId } = useUI();
  return useMemo(() => {
    const staff = state.shop.staff || [];
    const user = staff.find((s) => s.id === userId) || staff.find((s) => s.role === 'owner') || staff[0] || { id: 'owner', name: 'Owner', role: 'owner' };
    return { user, role: user.role, staff, setUserId, can: (path) => canAccess(user.role, path) };
  }, [state.shop.staff, userId, setUserId]);
}
