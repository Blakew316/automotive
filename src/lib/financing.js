// Monthly payment estimates for customer financing (standard amortization).
export function monthlyPayment(amount, aprPct, months) {
  const p = Number(amount) || 0;
  const n = Number(months) || 1;
  const r = (Number(aprPct) || 0) / 100 / 12;
  if (!r) return p / n;
  return (p * r) / (1 - (1 + r) ** -n);
}

/** Lowest monthly payment among the shop's offered terms, or null if financing doesn't apply. */
export function financingOffer(shop, amount) {
  const f = shop?.financing;
  if (!f?.enabled || !amount || amount < (f.minAmount || 0) || !f.terms?.length) return null;
  const longest = Math.max(...f.terms);
  return { monthly: monthlyPayment(amount, f.apr, longest), months: longest, apr: f.apr, provider: f.provider, url: f.url, terms: f.terms.map((n) => ({ months: n, monthly: monthlyPayment(amount, f.apr, n) })) };
}
