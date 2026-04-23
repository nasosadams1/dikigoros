alter table public.partner_applications
  add column if not exists preferred_plan_id text not null default 'basic';

alter table public.partner_applications
  drop constraint if exists partner_applications_preferred_plan_id_check;

alter table public.partner_applications
  add constraint partner_applications_preferred_plan_id_check
  check (preferred_plan_id in ('basic','pro','premium','firms'));

drop function if exists public.submit_partner_application(uuid,text,text,text,text,text,text,text,text,text,text,text[],text,jsonb);

create or replace function public.submit_partner_application(
  p_application_id uuid,
  p_reference_id text,
  p_full_name text,
  p_work_email text,
  p_phone text,
  p_city text,
  p_law_firm_name text,
  p_website_or_linkedin text,
  p_bar_association text,
  p_registration_number text,
  p_years_of_experience text,
  p_specialties text[],
  p_professional_bio text,
  p_document_metadata jsonb,
  p_preferred_plan_id text default 'basic'
)
returns public.partner_applications
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_application public.partner_applications;
  persisted_application public.partner_applications;
  normalized_email text := lower(trim(p_work_email));
  normalized_preferred_plan_id text := case
    when lower(trim(coalesce(p_preferred_plan_id, 'basic'))) in ('basic','pro','premium','firms')
      then lower(trim(coalesce(p_preferred_plan_id, 'basic')))
    else 'basic'
  end;
begin
  if normalized_email = '' or normalized_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'INVALID_PARTNER_APPLICATION_EMAIL' using errcode = '22023';
  end if;

  select * into existing_application
  from public.partner_applications
  where lower(work_email) = normalized_email
    and status in ('under_review','approved')
  order by created_at desc
  limit 1;

  if existing_application.id is not null then
    return existing_application;
  end if;

  select * into existing_application
  from public.partner_applications
  where lower(work_email) = normalized_email
    and status = 'needs_more_info'
  order by created_at desc
  limit 1;

  if existing_application.id is not null then
    update public.partner_applications
    set full_name = trim(p_full_name),
        phone = trim(p_phone),
        city = trim(p_city),
        law_firm_name = nullif(trim(coalesce(p_law_firm_name,'')), ''),
        website_or_linkedin = nullif(trim(coalesce(p_website_or_linkedin,'')), ''),
        bar_association = trim(p_bar_association),
        registration_number = trim(p_registration_number),
        years_of_experience = trim(p_years_of_experience),
        specialties = coalesce(p_specialties, '{}'),
        professional_bio = trim(p_professional_bio),
        preferred_plan_id = normalized_preferred_plan_id,
        document_metadata = coalesce(p_document_metadata, '[]'::jsonb),
        status = 'under_review',
        reviewed_at = null
    where id = existing_application.id
    returning * into persisted_application;

    return persisted_application;
  end if;

  insert into public.partner_applications (
    id,reference_id,full_name,work_email,phone,city,law_firm_name,website_or_linkedin,
    bar_association,registration_number,years_of_experience,specialties,professional_bio,preferred_plan_id,document_metadata,status,created_at
  )
  values (
    p_application_id,p_reference_id,trim(p_full_name),normalized_email,trim(p_phone),trim(p_city),
    nullif(trim(coalesce(p_law_firm_name,'')), ''),nullif(trim(coalesce(p_website_or_linkedin,'')), ''),
    trim(p_bar_association),trim(p_registration_number),trim(p_years_of_experience),
    coalesce(p_specialties, '{}'),trim(p_professional_bio),normalized_preferred_plan_id,coalesce(p_document_metadata, '[]'::jsonb),'under_review',now()
  )
  returning * into persisted_application;

  return persisted_application;
exception
  when unique_violation then
    select * into existing_application
    from public.partner_applications
    where lower(work_email) = normalized_email
      and status in ('under_review','needs_more_info','approved')
    order by created_at desc
    limit 1;

    if existing_application.id is not null then
      return existing_application;
    end if;

    raise;
end;
$$;

grant execute on function public.submit_partner_application(uuid,text,text,text,text,text,text,text,text,text,text,text[],text,jsonb,text) to anon, authenticated;

notify pgrst, 'reload schema';
