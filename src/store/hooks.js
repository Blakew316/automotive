import { useContext, useMemo } from 'react';
import { ShopContext, UIContext } from './context';
import { totalsCalculator } from '../lib/pricing';

export function useShop() {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error('useShop must be used inside <ShopProvider>');
  return ctx;
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
