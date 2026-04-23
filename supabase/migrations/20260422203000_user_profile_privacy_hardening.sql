alter table public.booking_reviews
  alter column status set default 'pending_review';

alter table public.user_documents
  alter column visible_to_lawyer set default false;

alter table public.user_documents
  add column if not exists retention_until timestamptz;

alter table public.user_documents
  add column if not exists deletion_status text not null default 'active';

alter table public.user_documents
  add column if not exists access_audit jsonb not null default '[]'::jsonb;

alter table public.user_documents
  add column if not exists visibility_history jsonb not null default '[]'::jsonb;

alter table public.user_documents
  drop constraint if exists user_documents_deletion_status_check;

alter table public.user_documents
  add constraint user_documents_deletion_status_check
  check (deletion_status in ('active','deletion_requested','deleted','retained_for_legal_reason'));

update public.user_documents ud
set visible_to_lawyer = false
where ud.visible_to_lawyer = true
  and (
    ud.malware_scan_status <> 'clean'
    or coalesce(ud.deletion_status,'active') <> 'active'
    or not coalesce((
      select (up.privacy_settings ->> 'allowDocumentAccessByBooking')::boolean
      from public.user_profiles up
      where up.id = ud.user_id
    ), false)
  );

drop function if exists public.submit_booking_review(uuid,text,integer,integer,integer,text);
create or replace function public.submit_booking_review(
  p_booking_id uuid,
  p_lawyer_id text,
  p_rating integer,
  p_clarity_rating integer,
  p_responsiveness_rating integer,
  p_review_text text
)
returns public.booking_reviews
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_booking public.booking_requests;
  saved_review public.booking_reviews;
begin
  if current_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select * into target_booking
  from public.booking_requests
  where id = p_booking_id
    and user_id = current_user_id
    and lawyer_id = p_lawyer_id;

  if target_booking.id is null then
    raise exception 'BOOKING_NOT_FOUND_OR_FORBIDDEN' using errcode = '42501';
  end if;

  if target_booking.status <> 'completed' then
    raise exception 'BOOKING_NOT_COMPLETED' using errcode = 'P0001';
  end if;

  if length(trim(coalesce(p_review_text,''))) = 0 then
    raise exception 'REVIEW_TEXT_REQUIRED' using errcode = '23514';
  end if;

  insert into public.booking_reviews (
    booking_id,
    user_id,
    lawyer_id,
    rating,
    clarity_rating,
    responsiveness_rating,
    review_text,
    status
  )
  values (
    p_booking_id,
    current_user_id,
    p_lawyer_id,
    greatest(1, least(5, p_rating)),
    greatest(1, least(5, p_clarity_rating)),
    greatest(1, least(5, p_responsiveness_rating)),
    trim(p_review_text),
    'pending_review'
  )
  on conflict (booking_id) do update
    set rating = excluded.rating,
        clarity_rating = excluded.clarity_rating,
        responsiveness_rating = excluded.responsiveness_rating,
        review_text = excluded.review_text,
        status = 'pending_review',
        updated_at = now()
    where public.booking_reviews.user_id = current_user_id
  returning * into saved_review;

  if saved_review.id is null then
    raise exception 'REVIEW_NOT_SAVED' using errcode = '42501';
  end if;

  return saved_review;
end;
$$;

drop policy if exists "Users can manage own documents" on public.user_documents;

drop policy if exists "Users can read own documents" on public.user_documents;
create policy "Users can read own documents" on public.user_documents
  for select using (user_id = auth.uid());

drop policy if exists "Users can create private pending documents" on public.user_documents;
create policy "Users can create private pending documents" on public.user_documents
  for insert with check (
    user_id = auth.uid()
    and visible_to_lawyer = false
    and malware_scan_status = 'pending'
    and storage_path like auth.uid()::text || '/%'
    and (
      booking_id is null
      or exists (
        select 1 from public.booking_requests br
        where br.id = user_documents.booking_id
          and br.user_id = auth.uid()
      )
    )
  );

drop policy if exists "Users can update own document privacy requests" on public.user_documents;
create policy "Users can update own document privacy requests" on public.user_documents
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Users can delete own documents" on public.user_documents;
create policy "Users can delete own documents" on public.user_documents
  for delete using (user_id = auth.uid());

drop policy if exists "Partners can read booking documents" on public.user_documents;
create policy "Partners can read booking documents" on public.user_documents
  for select using (
    visible_to_lawyer
    and malware_scan_status = 'clean'
    and coalesce(deletion_status,'active') = 'active'
    and coalesce((
      select (up.privacy_settings ->> 'allowDocumentAccessByBooking')::boolean
      from public.user_profiles up
      where up.id = user_documents.user_id
    ), false)
    and exists (
      select 1 from public.booking_requests br
      where br.id = user_documents.booking_id
        and public.nomos_is_current_partner_for_lawyer(br.lawyer_id)
    )
  );

drop policy if exists "Partners can read own booking document objects" on storage.objects;
create policy "Partners can read own booking document objects" on storage.objects
  for select using (
    bucket_id = 'legal-documents'
    and exists (
      select 1
      from public.user_documents ud
      join public.booking_requests br on br.id = ud.booking_id
      where ud.storage_path = storage.objects.name
        and ud.visible_to_lawyer
        and ud.malware_scan_status = 'clean'
        and coalesce(ud.deletion_status,'active') = 'active'
        and coalesce((
          select (up.privacy_settings ->> 'allowDocumentAccessByBooking')::boolean
          from public.user_profiles up
          where up.id = ud.user_id
        ), false)
        and public.nomos_is_current_partner_for_lawyer(br.lawyer_id)
    )
  );

revoke update on public.user_documents from authenticated;
grant select, insert, delete on public.user_documents to authenticated;
grant update (visible_to_lawyer, deletion_status, visibility_history) on public.user_documents to authenticated;

grant execute on function public.submit_booking_review(uuid,text,integer,integer,integer,text) to authenticated;
