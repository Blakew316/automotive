-- Self check-in and key drop submissions arrive in the shop inbox like bookings and approvals.
alter table public.shop_inbox drop constraint if exists shop_inbox_kind_check;
alter table public.shop_inbox add constraint shop_inbox_kind_check check (kind in ('booking', 'approval', 'message', 'checkin'));
