-- Business texting & calling through the shop's own Twilio number.
--
-- Twilio posts incoming texts, delivery receipts and calls to the twilio-webhook Edge Function. It
-- answers calls on its own (rings the shop's phones, takes voicemail, runs the AI receptionist and
-- sends the missed-call text) and records what happened here, where the shop's signed-in devices
-- pick it up — live over Realtime — and file it into the customer's conversation.

-- ---------------------------------------------------------------- Phone events
-- kind: sms_in (a customer's text), sms_status (delivered / failed), sms_out (a text the server
-- sent on its own: scheduled reminders, missed-call and after-hours replies), call (one inbound
-- call, updated as it rings, is answered or goes to voicemail; final once it has ended).
create table if not exists public.shop_phone_events (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('sms_in', 'sms_status', 'sms_out', 'call')),
  sid text not null,
  payload jsonb not null default '{}'::jsonb,
  final boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kind, sid)
);
alter table public.shop_phone_events enable row level security;
create policy "Staff read phone events" on public.shop_phone_events for select to authenticated using ((select public.is_shop_staff()));
create policy "Staff clear phone events" on public.shop_phone_events for delete to authenticated using ((select public.is_shop_staff()));
alter publication supabase_realtime add table public.shop_phone_events;

-- Atomic shallow merge, so two webhooks for the same call can't overwrite each other's fields.
create or replace function public.shop_phone_event_merge(p_kind text, p_sid text, p_patch jsonb, p_final boolean)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  insert into public.shop_phone_events as e (kind, sid, payload, final)
  values (p_kind, p_sid, coalesce(p_patch, '{}'::jsonb), coalesce(p_final, true))
  on conflict (kind, sid) do update
    set payload = e.payload || excluded.payload,
        final = e.final or excluded.final,
        updated_at = now()
  returning payload;
$$;
revoke all on function public.shop_phone_event_merge(text, text, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.shop_phone_event_merge(text, text, jsonb, boolean) to service_role;

-- ---------------------------------------------------------------- Text opt-outs
-- Numbers that replied STOP (or that carriers report as unsubscribed). Nothing is sent to them
-- until they reply START.
create table if not exists public.shop_sms_optouts (
  phone text primary key,
  opted_out_at timestamptz not null default now(),
  source text
);
alter table public.shop_sms_optouts enable row level security;
create policy "Staff read text opt-outs" on public.shop_sms_optouts for select to authenticated using ((select public.is_shop_staff()));

-- ---------------------------------------------------------------- Scheduled texts
-- Appointment confirmations and day-before reminders, queued by the shop's devices and sent by the
-- dispatcher below even when no device is open. The key (e.g. appt-reminder:<appointment id>)
-- makes queuing idempotent: every device queues the same rows.
create table if not exists public.shop_sms_outbox (
  key text primary key,
  to_phone text not null,
  body text not null,
  send_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed', 'cancelled', 'skipped')),
  meta jsonb not null default '{}'::jsonb,
  sid text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.shop_sms_outbox enable row level security;
create policy "Staff read scheduled texts" on public.shop_sms_outbox for select to authenticated using ((select public.is_shop_staff()));
create index if not exists shop_sms_outbox_due on public.shop_sms_outbox (send_at) where status = 'pending';

-- Queue or reschedule texts. Rows already sent (or being sent) are left alone.
create or replace function public.shop_outbox_schedule(items jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  if not public.is_shop_staff() then
    raise exception 'Shop staff only';
  end if;
  insert into public.shop_sms_outbox as o (key, to_phone, body, send_at, meta)
  select left(x.key, 200), left(x.to_phone, 20), left(x.body, 1600), x.send_at, coalesce(x.meta, '{}'::jsonb)
  from jsonb_to_recordset(coalesce(items, '[]'::jsonb)) as x(key text, to_phone text, body text, send_at timestamptz, meta jsonb)
  where x.key is not null and x.to_phone ~ '^\+[1-9][0-9]{7,14}$' and length(coalesce(x.body, '')) > 0 and x.send_at is not null
  on conflict (key) do update
    set to_phone = excluded.to_phone, body = excluded.body, send_at = excluded.send_at, meta = excluded.meta,
        status = 'pending', error = null, updated_at = now()
    where o.status in ('pending', 'cancelled', 'skipped');
  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function public.shop_outbox_cancel(keys text[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  if not public.is_shop_staff() then
    raise exception 'Shop staff only';
  end if;
  update public.shop_sms_outbox set status = 'cancelled', updated_at = now()
  where key = any(keys) and status = 'pending';
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.shop_outbox_schedule(jsonb) from public, anon;
revoke all on function public.shop_outbox_cancel(text[]) from public, anon;
grant execute on function public.shop_outbox_schedule(jsonb) to authenticated, service_role;
grant execute on function public.shop_outbox_cancel(text[]) to authenticated, service_role;

-- The dispatcher claims due rows so two runs can't send the same text twice.
create or replace function public.shop_outbox_claim(n integer)
returns setof public.shop_sms_outbox
language sql
security definer
set search_path = ''
as $$
  update public.shop_sms_outbox o set status = 'sending', updated_at = now()
  where o.key in (
    select key from public.shop_sms_outbox
    where status = 'pending' and send_at <= now()
    order by send_at
    limit greatest(1, least(n, 50))
    for update skip locked
  )
  returning o.*;
$$;
revoke all on function public.shop_outbox_claim(integer) from public, anon, authenticated;
grant execute on function public.shop_outbox_claim(integer) to service_role;

-- ---------------------------------------------------------------- Dispatcher
-- A random secret the cron job presents to the webhook function (stored in Vault, never in code).
-- The project URL is saved to Vault by the shop-phone function when the owner connects the number.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'autoshop:dispatch_secret') then
    perform vault.create_secret(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 'autoshop:dispatch_secret', 'AutoShop Pro scheduled texts');
  end if;
end;
$$;

-- Every minute, only when something is due (no request at all otherwise).
select cron.schedule('autoshop-text-dispatch', '* * * * *', $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'autoshop:project_url') || '/functions/v1/twilio-webhook?t=dispatch',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-dispatch-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'autoshop:dispatch_secret')),
    body := '{}'::jsonb
  )
  where exists (select 1 from public.shop_sms_outbox where status = 'pending' and send_at <= now())
    and exists (select 1 from vault.decrypted_secrets where name = 'autoshop:project_url' and decrypted_secret like 'https://%');
$cron$);
