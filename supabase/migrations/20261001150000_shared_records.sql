-- AutoShop Pro: shared shop data (applied to the AutoShop Pro project on 2026-10-01).
-- Every record (repair order, customer, vehicle …) is a row with a version number. Devices write
-- through push_records(), which rejects stale versions so concurrent edits are merged on the device
-- instead of silently overwritten. Every version is kept in shop_record_history; snapshot_shop()
-- backs the whole shop up nightly into 14 rotating slots.

create or replace function public.shop_role()
returns text language sql stable set search_path = '' as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'autoshop_role', '')
$$;

create sequence if not exists public.shop_records_seq;

create table public.shop_records (
  collection text not null check (collection ~ '^[A-Za-z][A-Za-z0-9]{0,39}$'),
  id text not null check (char_length(id) between 1 and 100),
  data jsonb,
  deleted boolean not null default false,
  version bigint not null default 1,
  seq bigint not null default nextval('public.shop_records_seq'),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  actor text,
  device text,
  primary key (collection, id)
);
create index shop_records_seq_idx on public.shop_records (seq);
alter table public.shop_records enable row level security;
create policy "Staff read shop data" on public.shop_records for select to authenticated using ((select public.is_shop_staff()));
revoke all on public.shop_records from anon, authenticated;
grant select on public.shop_records to authenticated;

create table public.shop_record_history (
  hid bigint generated always as identity primary key,
  collection text not null,
  id text not null,
  version bigint not null,
  data jsonb,
  deleted boolean not null,
  changed_at timestamptz not null default now(),
  changed_by uuid,
  actor text,
  device text
);
create index shop_record_history_rec_idx on public.shop_record_history (collection, id, version desc);
create index shop_record_history_time_idx on public.shop_record_history (changed_at);
alter table public.shop_record_history enable row level security;
create policy "Staff read history" on public.shop_record_history for select to authenticated using ((select public.is_shop_staff()));
revoke all on public.shop_record_history from anon, authenticated;
grant select on public.shop_record_history to authenticated;

create table public.shop_backups (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  note text,
  records integer not null,
  data jsonb not null,
  slot smallint unique check (slot between 1 and 14)
);
alter table public.shop_backups enable row level security;
create policy "Staff read backups" on public.shop_backups for select to authenticated using ((select public.is_shop_staff()));
revoke all on public.shop_backups from anon, authenticated;
grant select on public.shop_backups to authenticated;

-- Every version of every record (except the activity feed) goes to the history, whoever wrote it.
create or replace function public.record_history()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.shop_record_history (collection, id, version, data, deleted, changed_at, changed_by, actor, device)
  values (new.collection, new.id, new.version, new.data, new.deleted, new.updated_at, new.updated_by, new.actor, new.device);
  return null;
end
$$;
revoke all on function public.record_history() from public, anon, authenticated;
create trigger shop_records_history after insert or update on public.shop_records
for each row when (new.collection <> 'activity') execute function public.record_history();

-- Write changes. Each change: {collection, id, data, deleted, base, force}. `base` is the version the
-- device last saw (null for a record it created). A mismatch comes back as a conflict carrying the
-- current row so the device can merge and retry.
create or replace function public.push_records(changes jsonb, who text default null, from_device text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  c jsonb;
  cur public.shop_records%rowtype;
  col text;
  rid text;
  base bigint;
  del boolean;
  body jsonb;
  nv bigint;
  ns bigint;
  applied jsonb := '[]'::jsonb;
  conflicts jsonb := '[]'::jsonb;
begin
  if not public.is_shop_staff() then
    raise exception 'Only shop staff can change shop data' using errcode = '42501';
  end if;
  if jsonb_typeof(changes) is distinct from 'array' or jsonb_array_length(changes) > 500 then
    raise exception 'Send between 1 and 500 changes at a time' using errcode = '22023';
  end if;
  for c in select value from jsonb_array_elements(changes) loop
    col := c ->> 'collection';
    rid := c ->> 'id';
    base := nullif(c ->> 'base', '')::bigint;
    del := coalesce((c ->> 'deleted')::boolean, false);
    body := case when del then null else c -> 'data' end;
    if not del and (body is null or jsonb_typeof(body) <> 'object') then
      raise exception 'Record %/% has no data', col, rid using errcode = '22023';
    end if;
    select * into cur from public.shop_records r where r.collection = col and r.id = rid for update;
    if not found then
      insert into public.shop_records (collection, id, data, deleted, version, updated_by, actor, device)
      values (col, rid, body, del, 1, auth.uid(), left(who, 120), left(from_device, 120))
      returning version, seq into nv, ns;
    elsif coalesce((c ->> 'force')::boolean, false) or base = cur.version then
      update public.shop_records r
         set data = body, deleted = del, version = cur.version + 1, seq = nextval('public.shop_records_seq'),
             updated_at = now(), updated_by = auth.uid(), actor = left(who, 120), device = left(from_device, 120)
       where r.collection = col and r.id = rid
      returning r.version, r.seq into nv, ns;
    else
      conflicts := conflicts || jsonb_build_object('collection', col, 'id', rid, 'version', cur.version, 'deleted', cur.deleted,
        'data', cur.data, 'updated_at', cur.updated_at, 'actor', cur.actor);
      continue;
    end if;
    applied := applied || jsonb_build_object('collection', col, 'id', rid, 'version', nv, 'seq', ns);
  end loop;
  return jsonb_build_object('applied', applied, 'conflicts', conflicts);
end
$$;

-- Changes after a sequence cursor, oldest first.
create or replace function public.pull_records(since bigint default 0, max_rows integer default 1000)
returns jsonb language sql stable set search_path = '' as $$
  with page as (
    select r.collection, r.id, r.data, r.deleted, r.version, r.seq, r.updated_at, r.actor
      from public.shop_records r
     where r.seq > coalesce(since, 0)
     order by r.seq
     limit least(greatest(coalesce(max_rows, 1000), 1), 2000)
  )
  select jsonb_build_object(
    'rows', coalesce((select jsonb_agg(to_jsonb(page) order by page.seq) from page), '[]'::jsonb),
    'last_seq', coalesce((select max(page.seq) from page), since),
    'head', (select coalesce(max(r.seq), 0) from public.shop_records r)
  )
$$;

-- Every record's version, to find anything a device missed.
create or replace function public.shop_manifest()
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'records', coalesce(jsonb_agg(jsonb_build_array(r.collection, r.id, r.version) order by r.seq), '[]'::jsonb),
    'live', count(*) filter (where not r.deleted),
    'head', coalesce(max(r.seq), 0)
  )
  from public.shop_records r
$$;

-- Specific records by key: keys = [[collection, id], …].
create or replace function public.get_records(keys jsonb)
returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
  from (
    select r.collection, r.id, r.data, r.deleted, r.version, r.seq, r.updated_at, r.actor
      from public.shop_records r
      join jsonb_array_elements(keys) k on r.collection = k ->> 0 and r.id = k ->> 1
  ) x
$$;

-- Back the whole shop up into the oldest of 14 rotating slots (nightly, or by the owner).
create or replace function public.snapshot_shop(note text default 'Nightly backup')
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  target smallint;
  new_id bigint;
begin
  if auth.role() = 'authenticated' and public.shop_role() <> 'owner' then
    raise exception 'Only the owner can make a backup' using errcode = '42501';
  end if;
  select s.n into target
    from generate_series(1, 14) as s(n)
    left join public.shop_backups b on b.slot = s.n
   order by b.created_at nulls first, s.n
   limit 1;
  insert into public.shop_backups as b (slot, note, records, data)
  select target, left(snapshot_shop.note, 200), count(*), coalesce(jsonb_agg(jsonb_build_array(r.collection, r.id, r.data)), '[]'::jsonb)
    from public.shop_records r
   where not r.deleted
  on conflict (slot) do update
     set created_at = now(), note = excluded.note, records = excluded.records, data = excluded.data
  returning b.id into new_id;
  return new_id;
end
$$;

-- Put the shop back to a backup (owner). The current state is backed up first; records that didn't
-- exist in the backup are marked removed (they stay in the change history).
create or replace function public.restore_backup(backup_id bigint)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  n integer;
  src jsonb;
begin
  if public.shop_role() <> 'owner' then
    raise exception 'Only the owner can restore a backup' using errcode = '42501';
  end if;
  select b.data into src from public.shop_backups b where b.id = backup_id;
  if src is null then
    raise exception 'Backup % not found', backup_id using errcode = 'P0002';
  end if;
  perform public.snapshot_shop('Before restore');
  with x as (select e ->> 0 as collection, e ->> 1 as id, e -> 2 as data from jsonb_array_elements(src) e)
  update public.shop_records r
     set data = x.data, deleted = false, version = r.version + 1, seq = nextval('public.shop_records_seq'),
         updated_at = now(), updated_by = auth.uid(), actor = 'Restored from backup', device = null
    from x
   where r.collection = x.collection and r.id = x.id and (r.deleted or r.data is distinct from x.data);
  with x as (select e ->> 0 as collection, e ->> 1 as id, e -> 2 as data from jsonb_array_elements(src) e)
  insert into public.shop_records (collection, id, data, deleted, version, updated_by, actor)
  select x.collection, x.id, x.data, false, 1, auth.uid(), 'Restored from backup'
    from x
   where not exists (select 1 from public.shop_records r where r.collection = x.collection and r.id = x.id);
  with x as (select e ->> 0 as collection, e ->> 1 as id from jsonb_array_elements(src) e)
  update public.shop_records r
     set data = null, deleted = true, version = r.version + 1, seq = nextval('public.shop_records_seq'),
         updated_at = now(), updated_by = auth.uid(), actor = 'Restored from backup', device = null
   where not r.deleted
     and not exists (select 1 from x where x.collection = r.collection and x.id = r.id);
  n := jsonb_array_length(src);
  return n;
end
$$;

revoke all on function public.push_records(jsonb, text, text) from public, anon;
revoke all on function public.pull_records(bigint, integer) from public, anon;
revoke all on function public.shop_manifest() from public, anon;
revoke all on function public.get_records(jsonb) from public, anon;
revoke all on function public.snapshot_shop(text) from public, anon;
revoke all on function public.restore_backup(bigint) from public, anon;
grant execute on function public.push_records(jsonb, text, text) to authenticated;
grant execute on function public.pull_records(bigint, integer) to authenticated;
grant execute on function public.shop_manifest() to authenticated;
grant execute on function public.get_records(jsonb) to authenticated;
grant execute on function public.snapshot_shop(text) to authenticated;
grant execute on function public.restore_backup(bigint) to authenticated;

-- Live updates to other devices.
alter publication supabase_realtime add table public.shop_records;

-- Private files (photos, videos) shared between the shop's devices; 50 MB per file on the free plan.
insert into storage.buckets (id, name, public, file_size_limit)
values ('autoshop-files', 'autoshop-files', false, 52428800)
on conflict (id) do nothing;
create policy "AutoShop staff read files" on storage.objects for select to authenticated using (bucket_id = 'autoshop-files' and (select public.is_shop_staff()));
create policy "AutoShop staff add files" on storage.objects for insert to authenticated with check (bucket_id = 'autoshop-files' and (select public.is_shop_staff()));
create policy "AutoShop staff replace files" on storage.objects for update to authenticated using (bucket_id = 'autoshop-files' and (select public.is_shop_staff()));

-- Nightly backup at 3:15 AM US Central (08:15 UTC). History older than six months is trimmed by
-- the shop-admin function (action "prune"), which the app calls once a day.
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule('autoshop-nightly-backup', '15 8 * * *', $cron$select public.snapshot_shop('Nightly backup')$cron$);

-- Staff roles live in app_metadata: autoshop_staff (true), autoshop_role (owner, manager, advisor,
-- tech) and autoshop_staff_id (the staff profile in the app). The shop-admin function manages them.
