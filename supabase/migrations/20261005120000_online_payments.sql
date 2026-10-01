-- Online payments through the shop's own Stripe account.
--
-- A pay link is a short random id the customer opens (/app/pay/<id>): it shows the shop, the
-- repair order and the amount, then hands off to Stripe Checkout (cards, Apple Pay, Google Pay,
-- Link, bank transfer, and Affirm / Klarna / Afterpay when the shop has them turned on in Stripe).
-- Stripe tells the stripe-webhook function when it's paid; the payment lands in shop_pay_events for
-- the shop's devices to record on the repair order.

create table if not exists public.shop_pay_links (
  id text primary key,
  order_id text not null,
  ro_number integer,
  amount_cents integer not null check (amount_cents >= 50),
  currency text not null default 'usd',
  title text not null default '',
  shop_name text not null default '',
  shop_phone text not null default '',
  customer_email text,
  return_url text not null,
  status text not null default 'open' check (status in ('open', 'paid', 'void')),
  session_id text,
  payment_intent text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists shop_pay_links_order on public.shop_pay_links (order_id);
alter table public.shop_pay_links enable row level security;
create policy "Staff read pay links" on public.shop_pay_links for select to authenticated using ((select public.is_shop_staff()));

-- payment: a pay link was paid (card, wallet, bank, or buy-now-pay-later); refund: money returned.
create table if not exists public.shop_pay_events (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('payment', 'refund')),
  ref text not null unique,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.shop_pay_events enable row level security;
create policy "Staff read pay events" on public.shop_pay_events for select to authenticated using ((select public.is_shop_staff()));
create policy "Staff clear pay events" on public.shop_pay_events for delete to authenticated using ((select public.is_shop_staff()));
alter publication supabase_realtime add table public.shop_pay_events;
