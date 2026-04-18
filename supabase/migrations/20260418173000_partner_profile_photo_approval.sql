-- Partner profile photos are submitted by the lawyer but only become public after operations approval.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lawyer-profile-photos',
  'lawyer-profile-photos',
  true,
  5242880,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.partner_profile_photo_submissions (
  id uuid primary key default gen_random_uuid(),
  partner_email text not null,
  lawyer_id text not null references public.lawyer_profiles(id) on delete cascade,
  storage_path text not null unique,
  candidate_public_url text not null,
  file_name text not null,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  size integer not null check (size > 0 and size <= 5242880),
  status text not null default 'pending' check (status in ('pending','approved','rejected','superseded')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text,
  review_reason text,
  approved_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists partner_profile_photo_submissions_lawyer_status_idx
  on public.partner_profile_photo_submissions (lawyer_id, status, submitted_at desc);

create index if not exists partner_profile_photo_submissions_partner_idx
  on public.partner_profile_photo_submissions (lower(partner_email), submitted_at desc);

alter table public.partner_profile_photo_submissions enable row level security;

drop policy if exists "Operations can read profile photo submissions" on public.partner_profile_photo_submissions;
create policy "Operations can read profile photo submissions"
  on public.partner_profile_photo_submissions for select
  to authenticated
  using (public.is_operations_user());

drop policy if exists "Operations can update profile photo submissions" on public.partner_profile_photo_submissions;
create policy "Operations can update profile photo submissions"
  on public.partner_profile_photo_submissions for update
  to authenticated
  using (public.is_operations_user())
  with check (public.is_operations_user());

revoke all on public.partner_profile_photo_submissions from anon, authenticated;
grant select, update on public.partner_profile_photo_submissions to authenticated;

drop function if exists public.get_partner_profile_photo_state(text,text);
create or replace function public.get_partner_profile_photo_state(
  p_partner_email text,
  p_session_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  partner_lawyer_id text;
  approved_image_url text;
  pending_submission public.partner_profile_photo_submissions%rowtype;
  rejected_submission public.partner_profile_photo_submissions%rowtype;
begin
  select pa.lawyer_id into partner_lawyer_id
  from public.partner_accounts pa
  join public.partner_sessions ps on lower(ps.email) = lower(pa.email)
  where lower(pa.email) = lower(p_partner_email)
    and pa.status = 'approved'
    and pa.lawyer_id is not null
    and ps.revoked_at is null
    and ps.expires_at > now()
    and ps.session_token_hash = crypt(p_session_token, ps.session_token_hash)
  order by ps.created_at desc
  limit 1;

  if partner_lawyer_id is null then
    raise exception 'PARTNER_SESSION_INVALID' using errcode = '42501';
  end if;

  select coalesce(image, '') into approved_image_url
  from public.lawyer_profiles
  where id = partner_lawyer_id;

  select * into pending_submission
  from public.partner_profile_photo_submissions
  where lawyer_id = partner_lawyer_id
    and status = 'pending'
  order by submitted_at desc
  limit 1;

  select * into rejected_submission
  from public.partner_profile_photo_submissions
  where lawyer_id = partner_lawyer_id
    and status = 'rejected'
  order by reviewed_at desc nulls last, submitted_at desc
  limit 1;

  return jsonb_build_object(
    'lawyerId', partner_lawyer_id,
    'approvedImageUrl', coalesce(approved_image_url, ''),
    'pendingSubmission', case when pending_submission.id is null then null else jsonb_build_object(
      'id', pending_submission.id,
      'status', pending_submission.status,
      'fileName', pending_submission.file_name,
      'mimeType', pending_submission.mime_type,
      'size', pending_submission.size,
      'submittedAt', pending_submission.submitted_at,
      'reviewedAt', pending_submission.reviewed_at,
      'reviewReason', pending_submission.review_reason
    ) end,
    'latestRejectedSubmission', case when rejected_submission.id is null then null else jsonb_build_object(
      'id', rejected_submission.id,
      'status', rejected_submission.status,
      'fileName', rejected_submission.file_name,
      'mimeType', rejected_submission.mime_type,
      'size', rejected_submission.size,
      'submittedAt', rejected_submission.submitted_at,
      'reviewedAt', rejected_submission.reviewed_at,
      'reviewReason', rejected_submission.review_reason
    ) end
  );
end;
$$;

drop function if exists public.submit_partner_profile_photo(text,text,text,text,integer,text,text);
create or replace function public.submit_partner_profile_photo(
  p_partner_email text,
  p_session_token text,
  p_file_name text,
  p_mime_type text,
  p_size integer,
  p_storage_path text,
  p_candidate_public_url text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  partner_lawyer_id text;
  submission_id uuid;
  case_reference text := 'VER-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
begin
  select pa.lawyer_id into partner_lawyer_id
  from public.partner_accounts pa
  join public.partner_sessions ps on lower(ps.email) = lower(pa.email)
  where lower(pa.email) = lower(p_partner_email)
    and pa.status = 'approved'
    and pa.lawyer_id is not null
    and ps.revoked_at is null
    and ps.expires_at > now()
    and ps.session_token_hash = crypt(p_session_token, ps.session_token_hash)
  order by ps.created_at desc
  limit 1;

  if partner_lawyer_id is null then
    raise exception 'PARTNER_SESSION_INVALID' using errcode = '42501';
  end if;

  if p_mime_type not in ('image/jpeg','image/png','image/webp') then
    raise exception 'PROFILE_PHOTO_UNSUPPORTED_TYPE' using errcode = '22023';
  end if;

  if p_size <= 0 or p_size > 5242880 then
    raise exception 'PROFILE_PHOTO_TOO_LARGE' using errcode = '22023';
  end if;

  update public.partner_profile_photo_submissions
  set status = 'superseded',
      reviewed_at = now(),
      reviewed_by = 'σύστημα',
      review_reason = 'Νεότερη φωτογραφία υποβλήθηκε πριν ολοκληρωθεί ο έλεγχος.',
      updated_at = now()
  where lawyer_id = partner_lawyer_id
    and status = 'pending';

  insert into public.partner_profile_photo_submissions (
    partner_email,
    lawyer_id,
    storage_path,
    candidate_public_url,
    file_name,
    mime_type,
    size
  )
  values (
    lower(p_partner_email),
    partner_lawyer_id,
    p_storage_path,
    p_candidate_public_url,
    p_file_name,
    p_mime_type,
    p_size
  )
  returning id into submission_id;

  insert into operational_cases (
    reference_id,
    area,
    title,
    summary,
    status,
    priority,
    owner,
    requester_email,
    related_reference,
    evidence,
    timeline,
    sla_due_at
  )
  values (
    case_reference,
    'verification',
    'Έγκριση φωτογραφίας προφίλ δικηγόρου',
    'Υποβλήθηκε νέα φωτογραφία προφίλ και πρέπει να εγκριθεί πριν εμφανιστεί δημόσια.',
    'new',
    'normal',
    'Υπεύθυνος επαλήθευσης',
    lower(p_partner_email),
    partner_lawyer_id,
    jsonb_build_array(
      'Υποβολή φωτογραφίας προφίλ',
      'Αναγνωριστικό υποβολής: ' || submission_id::text,
      'Διαδρομή αποθήκευσης: ' || p_storage_path,
      'MIME: ' || p_mime_type
    ),
    jsonb_build_array(jsonb_build_object(
      'at', now(),
      'actor', 'Σύστημα',
      'action', 'Άνοιγμα υπόθεσης',
      'note', 'Η φωτογραφία μένει σε αναμονή και δεν αλλάζει το δημόσιο προφίλ πριν την έγκριση.'
    )),
    now() + interval '48 hours'
  );

  return public.get_partner_profile_photo_state(p_partner_email, p_session_token);
end;
$$;

drop function if exists public.review_partner_profile_photo_submission(uuid,text,text,text);
create or replace function public.review_partner_profile_photo_submission(
  p_submission_id uuid,
  p_status text,
  p_actor_email text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  target_submission public.partner_profile_photo_submissions%rowtype;
begin
  if not public.is_operations_user() then
    raise exception 'OPERATIONS_ROLE_REQUIRED' using errcode = '42501';
  end if;

  if p_status not in ('approved','rejected') then
    raise exception 'PROFILE_PHOTO_REVIEW_STATUS_INVALID' using errcode = '22023';
  end if;

  select * into target_submission
  from public.partner_profile_photo_submissions
  where id = p_submission_id
  for update;

  if target_submission.id is null then
    raise exception 'PROFILE_PHOTO_SUBMISSION_NOT_FOUND' using errcode = '02000';
  end if;

  update public.partner_profile_photo_submissions
  set status = p_status,
      reviewed_at = now(),
      reviewed_by = lower(coalesce(nullif(trim(p_actor_email), ''), 'operations')),
      review_reason = p_reason,
      approved_image_url = case when p_status = 'approved' then target_submission.candidate_public_url else approved_image_url end,
      updated_at = now()
  where id = p_submission_id;

  if p_status = 'approved' then
    update public.lawyer_profiles
    set image = target_submission.candidate_public_url,
        updated_at = now()
    where id = target_submission.lawyer_id;
  end if;

  insert into public.operational_audit_events (
    actor_label,
    event_type,
    note,
    payload
  )
  values (
    lower(coalesce(nullif(trim(p_actor_email), ''), 'operations')),
    case when p_status = 'approved' then 'profile_photo_approved' else 'profile_photo_rejected' end,
    p_reason,
    jsonb_build_object(
      'submissionId', p_submission_id,
      'lawyerId', target_submission.lawyer_id,
      'storagePath', target_submission.storage_path
    )
  );

  return jsonb_build_object(
    'ok', true,
    'submissionId', p_submission_id,
    'status', p_status,
    'lawyerId', target_submission.lawyer_id
  );
end;
$$;

grant execute on function public.get_partner_profile_photo_state(text,text) to anon, authenticated;
grant execute on function public.submit_partner_profile_photo(text,text,text,text,integer,text,text) to anon, authenticated;
grant execute on function public.review_partner_profile_photo_submission(uuid,text,text,text) to authenticated;

notify pgrst, 'reload schema';
