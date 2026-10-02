-- Two-step sign-in (TOTP authenticator codes) for shop staff.
--
-- Supabase Auth issues an "aal2" session once someone enters the code from their authenticator app.
-- From here on, anyone who has turned two-step sign-in on must use such a session to reach the
-- shop's data: a stolen password alone (an "aal1" session) is no longer enough. The owner can also
-- require it for whole roles (e.g. owner and manager), who then can't reach the data until they set
-- it up.

create table if not exists public.shop_security (
  id smallint primary key default 1 check (id = 1),
  mfa_roles text[] not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by text
);
insert into public.shop_security (id) values (1) on conflict (id) do nothing;
alter table public.shop_security enable row level security;
-- Read and changed only through the functions below.

/** Whether this session has the assurance level its user needs. */
create or replace function public.shop_mfa_ok()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or (
        not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified')
        and not coalesce(
          (select s.mfa_roles from public.shop_security s where s.id = 1) @> array[auth.jwt() -> 'app_metadata' ->> 'autoshop_role'],
          false
        )
      );
$$;
-- Callable by anyone (it only answers for the caller), so policies that use it never error for
-- anonymous requests — is_shop_staff() is still false for them.

create or replace function public.is_shop_staff()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'autoshop_staff')::boolean, false)
     and public.shop_mfa_ok();
$$;

/** The roles that must use two-step sign-in (any staff member can see the policy). */
create or replace function public.shop_mfa_policy()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select s.mfa_roles from public.shop_security s
   where s.id = 1 and coalesce((auth.jwt() -> 'app_metadata' ->> 'autoshop_staff')::boolean, false);
$$;
revoke all on function public.shop_mfa_policy() from public;
grant execute on function public.shop_mfa_policy() to authenticated;

/** Owner only, from a two-step session: which roles must use two-step sign-in. */
create or replace function public.shop_mfa_policy_set(roles text[])
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean text[];
begin
  if not public.is_shop_staff() or (auth.jwt() -> 'app_metadata' ->> 'autoshop_role') is distinct from 'owner' then
    raise exception 'Only the owner can change this' using errcode = '42501';
  end if;
  -- Requiring it for your own role only works once you use it yourself.
  if 'owner' = any (roles) and coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'Turn on two-step sign-in for yourself first' using errcode = '42501';
  end if;
  select coalesce(array_agg(distinct r order by r), '{}') into clean
    from unnest(roles) r where r in ('owner', 'manager', 'advisor', 'tech');
  update public.shop_security
     set mfa_roles = clean, updated_at = now(), updated_by = auth.jwt() ->> 'email'
   where id = 1;
  return clean;
end;
$$;
revoke all on function public.shop_mfa_policy_set(text[]) from public;
grant execute on function public.shop_mfa_policy_set(text[]) to authenticated;

-- Evaluate the staff check once per query rather than once per row (it now looks up the user's
-- authenticator apps).
alter policy "Staff can read" on public.shop_inbox using ((select public.is_shop_staff()));
alter policy "Staff can clear" on public.shop_inbox using ((select public.is_shop_staff()));
alter policy "AutoShop staff read" on storage.objects using (bucket_id = 'autoshop-media' and (select public.is_shop_staff()));
alter policy "AutoShop staff replace" on storage.objects using (bucket_id = 'autoshop-media' and (select public.is_shop_staff()));
alter policy "AutoShop staff delete" on storage.objects using (bucket_id = 'autoshop-media' and (select public.is_shop_staff()));
alter policy "AutoShop staff upload" on storage.objects with check (bucket_id = 'autoshop-media' and (select public.is_shop_staff()));
