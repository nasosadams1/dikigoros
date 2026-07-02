begin;

delete from public.partner_calendar_connections
where provider <> 'google';

alter table public.partner_calendar_connections
  drop constraint if exists partner_calendar_connections_provider_check;

alter table public.partner_calendar_connections
  add constraint partner_calendar_connections_provider_check
  check (provider = 'google');

notify pgrst, 'reload schema';

commit;
