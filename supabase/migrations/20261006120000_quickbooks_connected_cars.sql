-- QuickBooks Online sync and connected cars (Smartcar).
--
-- Both use OAuth: the owner (QuickBooks) or the vehicle's owner (Smartcar) signs in with the other
-- service, which sends them back to the oauth-callback Edge Function with a one-time code. The
-- "state" value ties that return trip to the request that started it. Tokens are kept where only the
-- service role (the shop's Edge Functions) can read them: QuickBooks' in Vault, each car's here.

create table if not exists public.shop_oauth_states (
  state text primary key,
  provider text not null check (provider in ('quickbooks', 'smartcar')),
  return_url text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.shop_oauth_states enable row level security;
-- No policies: service role only.

create table if not exists public.shop_connected_cars (
  vehicle_id text primary key,
  smartcar_id text not null,
  vin text,
  make text,
  model text,
  year integer,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  reading jsonb,
  read_at timestamptz,
  connected_at timestamptz not null default now()
);
alter table public.shop_connected_cars enable row level security;
-- No policies: the shop reads cars through the shop-cars function, which never returns tokens.
