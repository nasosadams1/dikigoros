drop function if exists public.get_partner_workspace_as_partner(text,text);
create or replace function public.get_partner_workspace_as_partner(
  p_partner_email text,
  p_session_token text
)
returns table (
  partner_email text,
  lawyer_id text,
  profile jsonb,
  availability jsonb,
  reviews jsonb,
  notifications jsonb,
  published_profile jsonb,
  published_availability jsonb,
  is_public boolean,
  updated_at timestamptz
)
language sql
security definer
set search_path = public, extensions
as $$
  select
    lower(pa.email) as partner_email,
    pa.lawyer_id,
    coalesce(pps.profile, '{}'::jsonb) as profile,
    coalesce(pps.availability, '[]'::jsonb) as availability,
    coalesce(pps.reviews, '[]'::jsonb) as reviews,
    coalesce(pps.notifications, '{}'::jsonb) as notifications,
    coalesce(pps.published_profile, '{}'::jsonb) as published_profile,
    coalesce(pps.published_availability, '[]'::jsonb) as published_availability,
    coalesce(pps.is_public, true) as is_public,
    pps.updated_at
  from public.partner_accounts pa
  join public.partner_sessions ps on lower(ps.email) = lower(pa.email)
  left join public.partner_profile_settings pps on lower(pps.partner_email) = lower(pa.email)
  where lower(pa.email) = lower(p_partner_email)
    and pa.status = 'approved'
    and pa.lawyer_id is not null
    and ps.revoked_at is null
    and ps.expires_at > now()
    and ps.session_token_hash = crypt(p_session_token, ps.session_token_hash)
  order by ps.created_at desc
  limit 1;
$$;

grant execute on function public.get_partner_workspace_as_partner(text,text) to anon, authenticated;

notify pgrst, 'reload schema';
