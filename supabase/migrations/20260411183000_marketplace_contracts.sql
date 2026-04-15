create extension if not exists pgcrypto;

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  phone text not null default '',
  city text not null default '',
  preferred_language text not null default 'Ελληνικά',
  preferred_consultation_mode text not null default 'any',
  preferred_legal_categories text[] not null default '{}',
  budget_range text not null default '',
  urgency_preference text not null default '',
  notification_preferences jsonb not null default '{"email": true, "sms": false, "reminders": true}'::jsonb,
  privacy_settings jsonb not null default '{"share_phone_with_booked_lawyers": true, "allow_document_access_by_booking": true, "product_updates": false}'::jsonb,
  saved_lawyer_ids text[] not null default '{}',
  compared_lawyer_ids text[] not null default '{}',
  lawyer_notes jsonb not null default '{}'::jsonb,
  coins integer not null default 0,
  total_coins_earned integer not null default 0,
  xp integer not null default 0,
  completed_lessons text[] not null default '{}',
  lifetime_completed_lessons text[] not null default '{}',
  level integer not null default 1,
  hearts integer not null default 5,
  max_hearts integer not null default 5,
  last_heart_reset text not null default '',
  current_avatar text not null default 'default',
  owned_avatars text[] not null default '{default}',
  unlocked_achievements text[] not null default '{}',
  current_streak integer not null default 0,
  last_login_date text not null default '',
  total_lessons_completed integer not null default 0,
  email_verified boolean not null default false,
  xp_boost_multiplier numeric not null default 1,
  xp_boost_expires_at bigint not null default 0,
  unlimited_hearts_expires_at bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lawyer_profiles (
  id text primary key,
  name text not null,
  specialty text not null,
  specialty_short text not null,
  specialties text[] not null default '{}',
  specialty_keywords text[] not null default '{}',
  best_for text not null,
  city text not null,
  rating numeric(2, 1) not null default 0,
  reviews integer not null default 0,
  experience integer not null default 0,
  price integer not null default 0,
  available text not null default '',
  response text not null default '',
  response_minutes integer not null default 9999,
  consultation_modes text[] not null default '{}',
  bio text not null,
  education text not null default '',
  languages text[] not null default '{}',
  credentials text[] not null default '{}',
  verification jsonb not null default '{}'::jsonb,
  consultations jsonb not null default '[]'::jsonb,
  image text not null default '',
  status text not null default 'active' check (status in ('active', 'inactive', 'under_review')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  reference_id text not null unique,
  lawyer_id text not null references public.lawyer_profiles(id),
  lawyer_name text not null,
  consultation_type text not null,
  consultation_mode text not null,
  price integer not null check (price >= 0),
  duration text not null,
  date_label text not null,
  time text not null,
  client_name text not null,
  client_email text not null,
  client_phone text not null,
  issue_summary text,
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled', 'completed')),
  created_at timestamptz not null default now()
);

alter table public.user_profiles add column if not exists phone text not null default '';
alter table public.user_profiles add column if not exists city text not null default '';
alter table public.user_profiles add column if not exists preferred_language text not null default 'Ελληνικά';
alter table public.user_profiles add column if not exists preferred_consultation_mode text not null default 'any';
alter table public.user_profiles add column if not exists preferred_legal_categories text[] not null default '{}';
alter table public.user_profiles add column if not exists budget_range text not null default '';
alter table public.user_profiles add column if not exists urgency_preference text not null default '';
alter table public.user_profiles add column if not exists notification_preferences jsonb not null default '{"email": true, "sms": false, "reminders": true}'::jsonb;
alter table public.user_profiles add column if not exists privacy_settings jsonb not null default '{"share_phone_with_booked_lawyers": true, "allow_document_access_by_booking": true, "product_updates": false}'::jsonb;
alter table public.user_profiles add column if not exists saved_lawyer_ids text[] not null default '{}';
alter table public.user_profiles add column if not exists compared_lawyer_ids text[] not null default '{}';
alter table public.user_profiles add column if not exists lawyer_notes jsonb not null default '{}'::jsonb;
alter table public.user_profiles add column if not exists payment_preferences jsonb not null default '{"provider": "stripe", "status": "not_configured"}'::jsonb;
alter table public.booking_requests add column if not exists user_id uuid references auth.users(id) on delete set null;

create unique index if not exists booking_requests_active_slot_idx
  on public.booking_requests (lawyer_id, date_label, time)
  where status = 'confirmed';

create index if not exists booking_requests_user_idx
  on public.booking_requests (user_id, created_at desc);

create table if not exists public.booking_payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.booking_requests(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  lawyer_id text not null references public.lawyer_profiles(id),
  amount integer not null check (amount >= 0),
  currency text not null default 'EUR',
  status text not null default 'pending' check (status in ('pending', 'paid', 'refunded', 'failed')),
  invoice_number text not null unique,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  checkout_session_url text,
  receipt_url text,
  provider_payload jsonb not null default '{}'::jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.booking_payments add column if not exists stripe_checkout_session_id text;
alter table public.booking_payments add column if not exists stripe_payment_intent_id text;
alter table public.booking_payments add column if not exists checkout_session_url text;
alter table public.booking_payments add column if not exists provider_payload jsonb not null default '{}'::jsonb;
alter table public.booking_payments add column if not exists updated_at timestamptz not null default now();

create index if not exists booking_payments_user_idx
  on public.booking_payments (user_id, created_at desc);

create unique index if not exists booking_payments_booking_idx
  on public.booking_payments (booking_id);

create index if not exists booking_payments_checkout_session_idx
  on public.booking_payments (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create table if not exists public.booking_reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.booking_requests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  lawyer_id text not null references public.lawyer_profiles(id),
  rating integer not null check (rating between 1 and 5),
  clarity_rating integer not null check (clarity_rating between 1 and 5),
  responsiveness_rating integer not null check (responsiveness_rating between 1 and 5),
  review_text text not null,
  lawyer_reply text not null default '',
  status text not null default 'published' check (status in ('published', 'pending_review', 'flagged', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists booking_reviews_lawyer_idx
  on public.booking_reviews (lawyer_id, created_at desc)
  where status = 'published';

create table if not exists public.user_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  booking_id uuid references public.booking_requests(id) on delete set null,
  name text not null,
  size integer not null check (size >= 0),
  mime_type text,
  category text not null default 'Legal document',
  storage_path text not null,
  visible_to_lawyer boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists user_documents_user_idx
  on public.user_documents (user_id, created_at desc);

create index if not exists user_documents_booking_idx
  on public.user_documents (booking_id)
  where visible_to_lawyer = true;

create table if not exists public.partner_profile_settings (
  partner_email text primary key,
  profile jsonb not null default '{}'::jsonb,
  availability jsonb not null default '[]'::jsonb,
  notifications jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.partner_profile_settings add column if not exists lawyer_id text references public.lawyer_profiles(id);
alter table public.partner_profile_settings add column if not exists reviews jsonb not null default '[]'::jsonb;
alter table public.partner_profile_settings add column if not exists published_profile jsonb not null default '{}'::jsonb;
alter table public.partner_profile_settings add column if not exists published_availability jsonb not null default '[]'::jsonb;
alter table public.partner_profile_settings add column if not exists is_public boolean not null default true;

create index if not exists partner_profile_settings_lawyer_idx
  on public.partner_profile_settings (lawyer_id)
  where is_public = true;

create table if not exists public.partner_applications (
  id uuid primary key default gen_random_uuid(),
  reference_id text not null unique,
  full_name text not null,
  work_email text not null,
  phone text not null,
  city text not null,
  law_firm_name text,
  website_or_linkedin text,
  bar_association text not null,
  registration_number text not null,
  years_of_experience text not null,
  specialties text[] not null default '{}',
  professional_bio text not null,
  document_metadata jsonb not null default '[]'::jsonb,
  status text not null default 'under_review' check (status in ('under_review', 'needs_more_info', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create unique index if not exists partner_applications_open_email_idx
  on public.partner_applications (lower(work_email))
  where status in ('under_review', 'needs_more_info', 'approved');

create table if not exists public.partner_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  email text not null unique,
  status text not null default 'approved' check (status in ('approved', 'suspended')),
  approved_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.partner_accounts add column if not exists lawyer_id text references public.lawyer_profiles(id);

create table if not exists public.partner_access_codes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists partner_access_codes_email_idx
  on public.partner_access_codes (lower(email), expires_at desc);

alter table public.user_profiles enable row level security;
alter table public.lawyer_profiles enable row level security;
alter table public.booking_requests enable row level security;
alter table public.booking_payments enable row level security;
alter table public.booking_reviews enable row level security;
alter table public.user_documents enable row level security;
alter table public.partner_applications enable row level security;
alter table public.partner_accounts enable row level security;
alter table public.partner_access_codes enable row level security;
alter table public.partner_profile_settings enable row level security;

insert into storage.buckets (id, name, public)
values ('legal-documents', 'legal-documents', false)
on conflict (id) do update set public = false;

drop policy if exists "Users can read own profile" on public.user_profiles;
create policy "Users can read own profile"
  on public.user_profiles for select
  using (id = auth.uid());

drop policy if exists "Users can create own profile" on public.user_profiles;
create policy "Users can create own profile"
  on public.user_profiles for insert
  with check (id = auth.uid());

drop policy if exists "Users can update own profile" on public.user_profiles;
create policy "Users can update own profile"
  on public.user_profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "Public can read active lawyer profiles" on public.lawyer_profiles;
create policy "Public can read active lawyer profiles"
  on public.lawyer_profiles for select
  using (status = 'active');

drop policy if exists "Public can create booking requests" on public.booking_requests;
create policy "Public can create booking requests"
  on public.booking_requests for insert
  with check (status = 'confirmed' and (user_id is null or user_id = auth.uid()));

drop policy if exists "Users can read own booking requests" on public.booking_requests;
create policy "Users can read own booking requests"
  on public.booking_requests for select
  using (user_id = auth.uid());

drop policy if exists "Users can update own booking requests" on public.booking_requests;
create policy "Users can update own booking requests"
  on public.booking_requests for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users can read own payments" on public.booking_payments;
create policy "Users can read own payments"
  on public.booking_payments for select
  using (user_id = auth.uid());

drop policy if exists "Users can create own pending payments" on public.booking_payments;
create policy "Users can create own pending payments"
  on public.booking_payments for insert
  with check (
    status = 'pending'
    and exists (
      select 1
      from public.booking_requests br
      where br.id = booking_id
        and (br.user_id is null or br.user_id = auth.uid())
        and br.lawyer_id = lawyer_id
        and br.price = amount
    )
  );

drop policy if exists "Partners can read own payments" on public.booking_payments;
create policy "Partners can read own payments"
  on public.booking_payments for select
  using (
    exists (
      select 1
      from public.partner_accounts pa
      where pa.user_id = auth.uid()
        and pa.status = 'approved'
        and pa.lawyer_id = booking_payments.lawyer_id
    )
  );

drop policy if exists "Users can read own reviews" on public.booking_reviews;
create policy "Users can read own reviews"
  on public.booking_reviews for select
  using (user_id = auth.uid());

drop policy if exists "Public can read published reviews" on public.booking_reviews;
create policy "Public can read published reviews"
  on public.booking_reviews for select
  using (status = 'published');

drop policy if exists "Users can create own reviews" on public.booking_reviews;
create policy "Users can create own reviews"
  on public.booking_reviews for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.booking_requests br
      where br.id = booking_id
        and br.user_id = auth.uid()
        and br.status = 'completed'
    )
  );

drop policy if exists "Users can update own reviews" on public.booking_reviews;
create policy "Users can update own reviews"
  on public.booking_reviews for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.booking_requests br
      where br.id = booking_id
        and br.user_id = auth.uid()
        and br.status = 'completed'
    )
  );

drop policy if exists "Partners can read own reviews" on public.booking_reviews;
create policy "Partners can read own reviews"
  on public.booking_reviews for select
  using (
    exists (
      select 1
      from public.partner_accounts pa
      where pa.user_id = auth.uid()
        and pa.status = 'approved'
        and pa.lawyer_id = booking_reviews.lawyer_id
    )
  );

drop policy if exists "Partners can update own review replies" on public.booking_reviews;
create policy "Partners can update own review replies"
  on public.booking_reviews for update
  using (
    exists (
      select 1
      from public.partner_accounts pa
      where pa.user_id = auth.uid()
        and pa.status = 'approved'
        and pa.lawyer_id = booking_reviews.lawyer_id
    )
  )
  with check (
    exists (
      select 1
      from public.partner_accounts pa
      where pa.user_id = auth.uid()
        and pa.status = 'approved'
        and pa.lawyer_id = booking_reviews.lawyer_id
    )
  );

drop policy if exists "Users can manage own documents" on public.user_documents;
create policy "Users can manage own documents"
  on public.user_documents for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Partners can read booking documents" on public.user_documents;
create policy "Partners can read booking documents"
  on public.user_documents for select
  using (
    visible_to_lawyer
    and exists (
      select 1
      from public.booking_requests br
      join public.partner_accounts pa on lower(pa.lawyer_id) = lower(br.lawyer_id)
      where br.id = user_documents.booking_id
        and pa.user_id = auth.uid()
        and pa.status = 'approved'
    )
  );

drop policy if exists "Users can manage own legal document objects" on storage.objects;
create policy "Users can manage own legal document objects"
  on storage.objects for all
  using (bucket_id = 'legal-documents' and owner = auth.uid())
  with check (bucket_id = 'legal-documents' and owner = auth.uid());

drop policy if exists "Partners can read own booking document objects" on storage.objects;
create policy "Partners can read own booking document objects"
  on storage.objects for select
  using (
    bucket_id = 'legal-documents'
    and exists (
      select 1
      from public.user_documents ud
      join public.booking_requests br on br.id = ud.booking_id
      join public.partner_accounts pa on pa.lawyer_id = br.lawyer_id
      where ud.storage_path = storage.objects.name
        and ud.visible_to_lawyer
        and pa.user_id = auth.uid()
        and pa.status = 'approved'
    )
  );

drop policy if exists "Partners can read own booking requests" on public.booking_requests;
create policy "Partners can read own booking requests"
  on public.booking_requests for select
  using (
    exists (
      select 1
      from public.partner_accounts pa
      where pa.user_id = auth.uid()
        and pa.status = 'approved'
        and pa.lawyer_id = booking_requests.lawyer_id
    )
  );

drop policy if exists "Partners can update own booking requests" on public.booking_requests;
create policy "Partners can update own booking requests"
  on public.booking_requests for update
  using (
    exists (
      select 1
      from public.partner_accounts pa
      where pa.user_id = auth.uid()
        and pa.status = 'approved'
        and pa.lawyer_id = booking_requests.lawyer_id
    )
  )
  with check (
    exists (
      select 1
      from public.partner_accounts pa
      where pa.user_id = auth.uid()
        and pa.status = 'approved'
        and pa.lawyer_id = booking_requests.lawyer_id
    )
  );

drop policy if exists "Public can create partner applications" on public.partner_applications;
create policy "Public can create partner applications"
  on public.partner_applications for insert
  with check (status = 'under_review');

drop policy if exists "Partners can read own account" on public.partner_accounts;
create policy "Partners can read own account"
  on public.partner_accounts for select
  using (user_id = auth.uid() and status = 'approved');

drop policy if exists "Partners can manage own profile settings" on public.partner_profile_settings;
create policy "Partners can manage own profile settings"
  on public.partner_profile_settings for all
  using (
    exists (
      select 1
      from public.partner_accounts pa
      where pa.user_id = auth.uid()
        and pa.status = 'approved'
        and lower(pa.email) = lower(partner_email)
        and (partner_profile_settings.lawyer_id is null or pa.lawyer_id = partner_profile_settings.lawyer_id)
    )
  )
  with check (
    exists (
      select 1
      from public.partner_accounts pa
      where pa.user_id = auth.uid()
        and pa.status = 'approved'
        and lower(pa.email) = lower(partner_email)
        and (partner_profile_settings.lawyer_id is null or pa.lawyer_id = partner_profile_settings.lawyer_id)
    )
  );

drop policy if exists "Public can read published partner profile settings" on public.partner_profile_settings;
create policy "Public can read published partner profile settings"
  on public.partner_profile_settings for select
  using (is_public = true and lawyer_id is not null);

create or replace function public.is_approved_partner(p_email text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.partner_accounts
    where lower(email) = lower(p_email)
      and status = 'approved'
  );
$$;

create or replace function public.reserve_booking_slot(
  p_booking_id uuid,
  p_user_id uuid,
  p_reference_id text,
  p_lawyer_id text,
  p_lawyer_name text,
  p_consultation_type text,
  p_consultation_mode text,
  p_price integer,
  p_duration text,
  p_date_label text,
  p_time text,
  p_client_name text,
  p_client_email text,
  p_client_phone text,
  p_issue_summary text default null
)
returns public.booking_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_booking public.booking_requests;
begin
  if exists (
    select 1
    from public.booking_requests
    where lawyer_id = p_lawyer_id
      and date_label = p_date_label
      and time = p_time
      and status = 'confirmed'
  ) then
    raise exception 'BOOKING_SLOT_UNAVAILABLE' using errcode = 'P0001';
  end if;

  insert into public.booking_requests (
    id,
    user_id,
    reference_id,
    lawyer_id,
    lawyer_name,
    consultation_type,
    consultation_mode,
    price,
    duration,
    date_label,
    time,
    client_name,
    client_email,
    client_phone,
    issue_summary,
    status
  )
  values (
    p_booking_id,
    p_user_id,
    p_reference_id,
    p_lawyer_id,
    p_lawyer_name,
    p_consultation_type,
    p_consultation_mode,
    p_price,
    p_duration,
    p_date_label,
    p_time,
    p_client_name,
    lower(p_client_email),
    p_client_phone,
    nullif(p_issue_summary, ''),
    'confirmed'
  )
  returning * into inserted_booking;

  insert into public.booking_payments (
    booking_id,
    user_id,
    lawyer_id,
    amount,
    currency,
    status,
    invoice_number
  )
  values (
    inserted_booking.id,
    inserted_booking.user_id,
    inserted_booking.lawyer_id,
    inserted_booking.price,
    'EUR',
    'pending',
    'INV-' || regexp_replace(inserted_booking.reference_id, '^BK-', '')
  )
  on conflict (booking_id) do nothing;

  return inserted_booking;
exception
  when unique_violation then
    raise exception 'BOOKING_SLOT_UNAVAILABLE' using errcode = 'P0001';
end;
$$;

create or replace function public.request_partner_access_code(p_email text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_approved_partner(p_email) then
    return false;
  end if;

  delete from public.partner_access_codes
  where lower(email) = lower(p_email)
    and (consumed_at is not null or expires_at < now());

  -- The email/edge layer should generate the plain code, hash it, and email it.
  -- This placeholder record proves the backend contract without exposing a code from SQL.
  return true;
end;
$$;

create or replace function public.create_partner_access_code(p_email text, p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_approved_partner(p_email) then
    return false;
  end if;

  delete from public.partner_access_codes
  where lower(email) = lower(p_email)
    and (consumed_at is not null or expires_at < now());

  insert into public.partner_access_codes (email, code_hash, expires_at)
  values (lower(p_email), crypt(p_code, gen_salt('bf')), now() + interval '10 minutes');

  return true;
end;
$$;

create or replace function public.verify_partner_access_code(p_email text, p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  matching_code uuid;
begin
  select id into matching_code
  from public.partner_access_codes
  where lower(email) = lower(p_email)
    and consumed_at is null
    and expires_at > now()
    and code_hash = crypt(p_code, code_hash)
  order by created_at desc
  limit 1;

  if matching_code is null then
    return false;
  end if;

  update public.partner_access_codes
  set consumed_at = now()
  where id = matching_code;

  return true;
end;
$$;
