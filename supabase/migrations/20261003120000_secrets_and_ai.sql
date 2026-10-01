-- Integration keys (Anthropic for the AI assistant; later Twilio, Stripe, QuickBooks, Smartcar)
-- live in Supabase Vault, encrypted at rest. Only the service role — the shop's Edge Functions —
-- can read or write them; the app never gets a value back, only whether it's set and its last 4.

create or replace function public.shop_secret_set(p_name text, p_value text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_name !~ '^[a-z][a-z0-9_]{1,60}$' then
    raise exception 'Invalid secret name';
  end if;
  select id into v_id from vault.secrets where name = 'autoshop:' || p_name;
  if v_id is null then
    perform vault.create_secret(coalesce(p_value, ''), 'autoshop:' || p_name, 'AutoShop Pro integration key');
  else
    perform vault.update_secret(v_id, coalesce(p_value, ''), 'autoshop:' || p_name, 'AutoShop Pro integration key');
  end if;
end;
$$;

create or replace function public.shop_secret_get(p_name text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select nullif(s.decrypted_secret, '') from vault.decrypted_secrets s where s.name = 'autoshop:' || p_name limit 1;
$$;

create or replace function public.shop_secret_list()
returns table (name text, is_set boolean, hint text, updated_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select substr(s.name, 10),
         coalesce(s.decrypted_secret, '') <> '',
         case when length(coalesce(s.decrypted_secret, '')) >= 8 then right(s.decrypted_secret, 4) end,
         s.updated_at
  from vault.decrypted_secrets s
  where s.name like 'autoshop:%'
  order by 1;
$$;

revoke all on function public.shop_secret_set(text, text) from public, anon, authenticated;
revoke all on function public.shop_secret_get(text) from public, anon, authenticated;
revoke all on function public.shop_secret_list() from public, anon, authenticated;
grant execute on function public.shop_secret_set(text, text) to service_role;
grant execute on function public.shop_secret_get(text) to service_role;
grant execute on function public.shop_secret_list() to service_role;

-- AI assistant usage per month, for the owner's monthly request cap. Staff can read it; only the
-- shop-ai Edge Function (service role) writes it.
create table if not exists public.shop_ai_usage (
  month text primary key,
  requests integer not null default 0,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.shop_ai_usage enable row level security;
create policy "Staff can read AI usage" on public.shop_ai_usage for select to authenticated using ((select public.is_shop_staff()));

create or replace function public.shop_ai_record(p_in integer, p_out integer)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.shop_ai_usage as u (month, requests, input_tokens, output_tokens)
  values (to_char(now() at time zone 'America/Chicago', 'YYYY-MM'), 1, greatest(p_in, 0), greatest(p_out, 0))
  on conflict (month) do update
    set requests = u.requests + 1,
        input_tokens = u.input_tokens + excluded.input_tokens,
        output_tokens = u.output_tokens + excluded.output_tokens,
        updated_at = now();
$$;
revoke all on function public.shop_ai_record(integer, integer) from public, anon, authenticated;
grant execute on function public.shop_ai_record(integer, integer) to service_role;
