-- Email from the shop's own address (through the shop's Resend account), with delivery tracking
-- and a daily summary email for the owner.

-- Delivery events from Resend's webhook (delivered, bounced, complained, opened, delayed). Devices
-- pick them up (Realtime, polling as a fallback), mark the message in the conversation and delete
-- the row.
create table if not exists public.shop_email_events (
  id bigserial primary key,
  email_id text not null,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (email_id, kind)
);
alter table public.shop_email_events enable row level security;
create policy "Staff read email events" on public.shop_email_events for select to authenticated using ((select public.is_shop_staff()));
create policy "Staff clear email events" on public.shop_email_events for delete to authenticated using ((select public.is_shop_staff()));
alter publication supabase_realtime add table public.shop_email_events;

-- The daily summary: when and to whom, plus the latest numbers (a signed-in device keeps them
-- current, because the shop's figures are worked out in the app from its records).
create table if not exists public.shop_digest (
  id smallint primary key default 1 check (id = 1),
  enabled boolean not null default false,
  hour smallint not null default 18 check (hour between 0 and 23),
  tz text not null default 'America/Chicago',
  recipients text[] not null default '{}',
  snapshot jsonb,
  snapshot_day date,
  snapshot_at timestamptz,
  last_sent date,
  updated_by text
);
insert into public.shop_digest (id) values (1) on conflict (id) do nothing;
alter table public.shop_digest enable row level security;
create policy "Staff read digest settings" on public.shop_digest for select to authenticated using ((select public.is_shop_staff()));

/** Owner or manager: turn the daily summary on/off, its hour (shop's local time) and recipients. */
create or replace function public.shop_digest_save(p_enabled boolean, p_hour int, p_tz text, p_recipients text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_shop_staff() or (auth.jwt() -> 'app_metadata' ->> 'autoshop_role') not in ('owner', 'manager') then
    raise exception 'Only the owner or a manager can change this' using errcode = '42501';
  end if;
  if p_tz is null or not exists (select 1 from pg_catalog.pg_timezone_names where name = p_tz) then
    raise exception 'Unknown time zone' using errcode = '22023';
  end if;
  update public.shop_digest
     set enabled = coalesce(p_enabled, false),
         hour = greatest(0, least(23, coalesce(p_hour, 18))),
         tz = p_tz,
         recipients = (select coalesce(array_agg(distinct x), '{}') from (select lower(trim(r)) as x from unnest(p_recipients) r) t where x ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
         updated_by = auth.jwt() ->> 'email'
   where id = 1;
end;
$$;
revoke all on function public.shop_digest_save(boolean, int, text, text[]) from public;
grant execute on function public.shop_digest_save(boolean, int, text, text[]) to authenticated;

/** Any signed-in staff device: today's numbers for the summary. */
create or replace function public.shop_digest_snapshot(p_day date, p_data jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_shop_staff() then
    raise exception 'Shop staff only' using errcode = '42501';
  end if;
  if octet_length(p_data::text) > 20000 then
    raise exception 'Summary too large' using errcode = '22023';
  end if;
  update public.shop_digest set snapshot = p_data, snapshot_day = p_day, snapshot_at = now() where id = 1;
end;
$$;
revoke all on function public.shop_digest_snapshot(date, jsonb) from public;
grant execute on function public.shop_digest_snapshot(date, jsonb) to authenticated;

-- Supabase also grants the anon role directly; these are for signed-in staff only (they refuse
-- anyone else anyway). The same goes for the two-step policy functions.
revoke execute on function public.shop_digest_save(boolean, int, text, text[]) from anon;
revoke execute on function public.shop_digest_snapshot(date, jsonb) from anon;
revoke execute on function public.shop_mfa_policy() from anon;
revoke execute on function public.shop_mfa_policy_set(text[]) from anon;

-- Each hour, call the email function only if the summary is due in the shop's own time zone.
select cron.schedule('autoshop-daily-summary', '7 * * * *', $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'autoshop:project_url') || '/functions/v1/shop-email',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-dispatch-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'autoshop:dispatch_secret')),
    body := '{"action":"digest"}'::jsonb
  )
  where exists (
    select 1 from public.shop_digest d
     where d.id = 1 and d.enabled and cardinality(d.recipients) > 0
       and extract(hour from now() at time zone d.tz) = d.hour
       and (d.last_sent is null or d.last_sent < (now() at time zone d.tz)::date)
  )
  and exists (select 1 from vault.decrypted_secrets where name = 'autoshop:project_url' and decrypted_secret like 'https://%');
$cron$);
