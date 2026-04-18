-- Nomos marketplace Supabase setup.
-- Paste this into Supabase SQL Editor and run it against the live project.
-- It is intentionally idempotent: it creates missing objects and refreshes PostgREST.

begin;

create extension if not exists pgcrypto;

create or replace function public.nomos_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'User',
  email text not null default '',
  phone text not null default '',
  city text not null default '',
  preferred_language text not null default 'Greek',
  preferred_consultation_mode text not null default 'any',
  preferred_legal_categories text[] not null default '{}',
  budget_range text not null default '',
  urgency_preference text not null default '',
  notification_preferences jsonb not null default '{"email":true,"sms":false,"reminders":true}'::jsonb,
  privacy_settings jsonb not null default '{"sharePhoneWithBookedLawyers":true,"allowDocumentAccessByBooking":true,"productUpdates":false}'::jsonb,
  saved_lawyer_ids text[] not null default '{}',
  compared_lawyer_ids text[] not null default '{}',
  lawyer_notes jsonb not null default '{}'::jsonb,
  payment_preferences jsonb not null default '{"provider":"stripe","status":"not_configured","stripeCustomerId":"","defaultMethodLabel":"","setupRequestedAt":""}'::jsonb,
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

alter table public.user_profiles add column if not exists payment_preferences jsonb not null default '{"provider":"stripe","status":"not_configured","stripeCustomerId":"","defaultMethodLabel":"","setupRequestedAt":""}'::jsonb;
alter table public.user_profiles add column if not exists preferred_language text not null default 'Greek';
alter table public.user_profiles add column if not exists preferred_consultation_mode text not null default 'any';
alter table public.user_profiles add column if not exists preferred_legal_categories text[] not null default '{}';
alter table public.user_profiles add column if not exists budget_range text not null default '';
alter table public.user_profiles add column if not exists urgency_preference text not null default '';
alter table public.user_profiles add column if not exists notification_preferences jsonb not null default '{"email":true,"sms":false,"reminders":true}'::jsonb;
alter table public.user_profiles add column if not exists privacy_settings jsonb not null default '{"sharePhoneWithBookedLawyers":true,"allowDocumentAccessByBooking":true,"productUpdates":false}'::jsonb;
alter table public.user_profiles add column if not exists saved_lawyer_ids text[] not null default '{}';
alter table public.user_profiles add column if not exists compared_lawyer_ids text[] not null default '{}';
alter table public.user_profiles add column if not exists lawyer_notes jsonb not null default '{}'::jsonb;

create table if not exists public.lawyer_profiles (
  id text primary key,
  name text not null,
  specialty text not null,
  specialty_short text not null,
  specialties text[] not null default '{}',
  specialty_keywords text[] not null default '{}',
  best_for text not null default '',
  city text not null default '',
  rating numeric(2,1) not null default 0,
  reviews integer not null default 0,
  experience integer not null default 0,
  price integer not null default 0,
  available text not null default '',
  response text not null default '',
  response_minutes integer not null default 9999,
  consultation_modes text[] not null default '{}',
  bio text not null default '',
  education text not null default '',
  languages text[] not null default '{}',
  credentials text[] not null default '{}',
  verification jsonb not null default '{}'::jsonb,
  consultations jsonb not null default '[]'::jsonb,
  image text not null default '',
  status text not null default 'active' check (status in ('active','inactive','under_review')),
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
  status text not null default 'confirmed' check (status in ('confirmed','cancelled','completed')),
  cancelled_at timestamptz,
  cancellation_actor text,
  cancellation_reason text,
  reschedule_requested boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists booking_requests_active_slot_idx on public.booking_requests (lawyer_id,date_label,time) where status = 'confirmed';
create index if not exists booking_requests_user_idx on public.booking_requests (user_id,created_at desc);
create index if not exists booking_requests_lawyer_idx on public.booking_requests (lawyer_id,created_at desc);

create table if not exists public.booking_payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.booking_requests(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  lawyer_id text not null references public.lawyer_profiles(id),
  amount integer not null check (amount >= 0),
  currency text not null default 'EUR',
  status text not null default 'pending' check (status in ('pending','paid','refunded','failed')),
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

create unique index if not exists booking_payments_booking_idx on public.booking_payments (booking_id);
create index if not exists booking_payments_user_idx on public.booking_payments (user_id,created_at desc);
create index if not exists booking_payments_lawyer_idx on public.booking_payments (lawyer_id,created_at desc);
create index if not exists booking_payments_checkout_idx on public.booking_payments (stripe_checkout_session_id) where stripe_checkout_session_id is not null;

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
  status text not null default 'published' check (status in ('published','pending_review','flagged','hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists booking_reviews_lawyer_idx on public.booking_reviews (lawyer_id,created_at desc) where status = 'published';
create index if not exists booking_reviews_user_idx on public.booking_reviews (user_id,created_at desc);

create table if not exists public.user_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  booking_id uuid references public.booking_requests(id) on delete set null,
  name text not null,
  size integer not null check (size >= 0),
  mime_type text,
  category text not null default 'Legal document',
  storage_path text not null unique,
  visible_to_lawyer boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists user_documents_user_idx on public.user_documents (user_id,created_at desc);
create index if not exists user_documents_booking_idx on public.user_documents (booking_id) where visible_to_lawyer = true;

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
  status text not null default 'under_review' check (status in ('under_review','needs_more_info','approved','rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create unique index if not exists partner_applications_open_email_idx on public.partner_applications (lower(work_email)) where status in ('under_review','needs_more_info','approved');

create table if not exists public.partner_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  email text not null unique,
  lawyer_id text references public.lawyer_profiles(id),
  status text not null default 'approved' check (status in ('approved','suspended')),
  approved_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.partner_accounts add column if not exists lawyer_id text references public.lawyer_profiles(id);
create unique index if not exists partner_accounts_email_lower_idx on public.partner_accounts (lower(email));
create index if not exists partner_accounts_lawyer_idx on public.partner_accounts (lawyer_id) where status = 'approved';

create table if not exists public.partner_access_codes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists partner_access_codes_email_idx on public.partner_access_codes (lower(email),expires_at desc);

create table if not exists public.partner_sessions (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  session_token_hash text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists partner_sessions_email_idx on public.partner_sessions (lower(email),expires_at desc);

create table if not exists public.partner_profile_settings (
  partner_email text primary key,
  lawyer_id text references public.lawyer_profiles(id),
  profile jsonb not null default '{}'::jsonb,
  availability jsonb not null default '[]'::jsonb,
  reviews jsonb not null default '[]'::jsonb,
  notifications jsonb not null default '{}'::jsonb,
  published_profile jsonb not null default '{}'::jsonb,
  published_availability jsonb not null default '[]'::jsonb,
  is_public boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.partner_profile_settings add column if not exists lawyer_id text references public.lawyer_profiles(id);
alter table public.partner_profile_settings add column if not exists reviews jsonb not null default '[]'::jsonb;
alter table public.partner_profile_settings add column if not exists published_profile jsonb not null default '{}'::jsonb;
alter table public.partner_profile_settings add column if not exists published_availability jsonb not null default '[]'::jsonb;
alter table public.partner_profile_settings add column if not exists is_public boolean not null default true;
create index if not exists partner_profile_settings_lawyer_idx on public.partner_profile_settings (lawyer_id) where is_public = true;

insert into storage.buckets (id,name,public)
values ('legal-documents','legal-documents',false)
on conflict (id) do update set public = false;

insert into public.lawyer_profiles (
  id,name,specialty,specialty_short,specialties,specialty_keywords,best_for,city,
  rating,reviews,experience,price,available,response,response_minutes,
  consultation_modes,bio,education,languages,credentials,verification,consultations,image,status
)
values
('maria-papadopoulou','Maria Papadopoulou','Family Law','Family',
 array['Divorce','Child custody','Alimony'],array['family','divorce','custody','alimony'],
 'Best for divorce, custody and family property disputes.','Athens',4.9,127,14,60,'Today, 14:00','< 1 hour',55,
 array['video','phone','inPerson'],
 'Family law specialist with clear first-consultation guidance.',
 'University of Athens Law School',array['Greek','English'],array['Athens Bar Association','500+ cases'],
 '{"barAssociation":"Athens Bar Association","registryLabel":"Verified registry","checkedAt":"2026-04-12","evidence":["Identity","License","Professional details"]}'::jsonb,
 '[{"mode":"video","type":"Video call","price":60,"duration":"30 minutes","desc":"Secure video consultation"},{"mode":"phone","type":"Phone call","price":50,"duration":"30 minutes","desc":"Phone consultation"},{"mode":"inPerson","type":"In person","price":80,"duration":"45 minutes","desc":"Office meeting"}]'::jsonb,
 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&h=600&fit=crop&crop=face','active'),
('nikos-antoniou','Nikos Antoniou','Employment Law','Employment',
 array['Dismissals','Compensation','Employment contracts'],array['employment','dismissal','compensation','contract'],
 'Best for dismissals, employment claims and work contracts.','Thessaloniki',4.8,94,18,50,'Tomorrow, 10:00','< 2 hours',110,
 array['video','inPerson'],
 'Employment law counsel for employees and businesses.',
 'Aristotle University Law School',array['Greek','English'],array['Thessaloniki Bar Association','18 years experience'],
 '{"barAssociation":"Thessaloniki Bar Association","registryLabel":"Verified registry","checkedAt":"2026-04-12","evidence":["Identity","License"]}'::jsonb,
 '[{"mode":"video","type":"Video call","price":50,"duration":"30 minutes","desc":"Secure video consultation"},{"mode":"inPerson","type":"In person","price":70,"duration":"45 minutes","desc":"Office meeting"}]'::jsonb,
 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=600&h=600&fit=crop&crop=face','active'),
('eleni-karagianni','Eleni Karagianni','Real Estate & Leases','Real Estate',
 array['Sales','Leases','Title checks'],array['real estate','lease','rent','cadastre','title'],
 'Best for property sales, leases, title checks and cadastre issues.','Athens',4.9,156,21,70,'Today, 16:30','< 30 minutes',30,
 array['video','phone','inPerson'],
 'Real estate lawyer focused on transactions, leases and preventive legal review.',
 'University of Athens Law School',array['Greek','English'],array['Athens Bar Association','21 years experience'],
 '{"barAssociation":"Athens Bar Association","registryLabel":"Verified registry","checkedAt":"2026-04-12","evidence":["Identity","License"]}'::jsonb,
 '[{"mode":"video","type":"Video call","price":70,"duration":"30 minutes","desc":"Secure video consultation"},{"mode":"phone","type":"Phone call","price":60,"duration":"30 minutes","desc":"Phone consultation"},{"mode":"inPerson","type":"In person","price":90,"duration":"45 minutes","desc":"Office meeting"}]'::jsonb,
 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=600&h=600&fit=crop&crop=face','active'),
('konstantinos-panou','Konstantinos Panou','Criminal Law','Criminal',
 array['Criminal defense','Arrests','Complaints'],array['criminal','complaint','arrest','defense','court'],
 'Best for criminal defense, urgent proceedings and court appearances.','Athens',4.7,83,22,80,'Tomorrow, 09:00','< 3 hours',180,
 array['phone','inPerson'],
 'Criminal defense lawyer for urgent matters and risk assessment.',
 'Democritus University Law School',array['Greek','English'],array['Athens Bar Association','22 years experience'],
 '{"barAssociation":"Athens Bar Association","registryLabel":"Verified registry","checkedAt":"2026-04-12","evidence":["Identity","License"]}'::jsonb,
 '[{"mode":"phone","type":"Phone call","price":80,"duration":"30 minutes","desc":"Phone consultation"},{"mode":"inPerson","type":"In person","price":120,"duration":"45 minutes","desc":"Office meeting"}]'::jsonb,
 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&h=600&fit=crop&crop=face','active'),
('sofia-dimitriou','Sofia Dimitriou','Inheritance Law','Inheritance',
 array['Wills','Estate acceptance','Renunciation'],array['inheritance','will','estate','renunciation'],
 'Best for wills, estate acceptance or renunciation and inheritance disputes.','Patras',4.9,112,16,55,'Today, 11:00','< 1 hour',60,
 array['video','phone'],
 'Clear inheritance law advice around deadlines, documents and next steps.',
 'University of Athens Law School',array['Greek','English'],array['Patras Bar Association','16 years experience'],
 '{"barAssociation":"Patras Bar Association","registryLabel":"Verified registry","checkedAt":"2026-04-12","evidence":["Identity","License"]}'::jsonb,
 '[{"mode":"video","type":"Video call","price":55,"duration":"30 minutes","desc":"Secure video consultation"},{"mode":"phone","type":"Phone call","price":45,"duration":"30 minutes","desc":"Phone consultation"}]'::jsonb,
 'https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?w=600&h=600&fit=crop&crop=face','active'),
('andreas-georgiou','Andreas Georgiou','Commercial Law','Commercial',
 array['Companies','Contracts','Commercial disputes'],array['commercial','company','contract','debt','business'],
 'Best for company matters, commercial contracts and business disputes.','Thessaloniki',4.6,67,12,65,'Tomorrow, 13:00','< 2 hours',120,
 array['video','inPerson'],
 'Business legal advice for contracts, company operations and commercial claims.',
 'Aristotle University Law School',array['Greek','English'],array['Thessaloniki Bar Association','12 years experience'],
 '{"barAssociation":"Thessaloniki Bar Association","registryLabel":"Verified registry","checkedAt":"2026-04-12","evidence":["Identity","License"]}'::jsonb,
 '[{"mode":"video","type":"Video call","price":65,"duration":"30 minutes","desc":"Secure video consultation"},{"mode":"inPerson","type":"In person","price":85,"duration":"45 minutes","desc":"Office meeting"}]'::jsonb,
 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=600&h=600&fit=crop&crop=face','active')
on conflict (id) do nothing;

insert into public.partner_accounts (email,lawyer_id,status)
values ('nasoosadamopoylos@gmail.com','maria-papadopoulou','approved')
on conflict (email) do update set lawyer_id = excluded.lawyer_id, status = excluded.status;

insert into public.partner_profile_settings (
  partner_email,lawyer_id,profile,availability,reviews,notifications,published_profile,published_availability,is_public
)
values (
  'nasoosadamopoylos@gmail.com',
  'maria-papadopoulou',
  '{"lawyerId":"maria-papadopoulou","displayName":"Maria Papadopoulou","officeName":"Papadopoulou Law Office","city":"Athens","serviceArea":"Athens and online across Greece","bio":"Family law specialist with clear first-consultation guidance.","specialties":["Family Law","Divorce","Child custody"],"languages":["Greek","English"],"consultationModes":["video","phone","inPerson"],"videoPrice":60,"phonePrice":50,"inPersonPrice":80,"cancellationPolicy":"Free reschedule or cancellation up to 24 hours before the appointment.","autoConfirm":true,"bookingWindowDays":21,"bufferMinutes":15}'::jsonb,
  '[{"day":"Δευτέρα","enabled":true,"start":"09:00","end":"17:00","note":""},{"day":"Τρίτη","enabled":true,"start":"10:00","end":"18:00","note":""},{"day":"Τετάρτη","enabled":true,"start":"12:00","end":"16:00","note":""},{"day":"Πέμπτη","enabled":true,"start":"09:30","end":"16:30","note":""},{"day":"Παρασκευή","enabled":false,"start":"09:00","end":"15:00","note":"Urgent only"}]'::jsonb,
  '[]'::jsonb,
  '{"bookingEmail":true,"bookingSms":true,"weeklyDigest":false}'::jsonb,
  '{"lawyerId":"maria-papadopoulou","displayName":"Maria Papadopoulou","officeName":"Papadopoulou Law Office","city":"Athens","serviceArea":"Athens and online across Greece","bio":"Family law specialist with clear first-consultation guidance.","specialties":["Family Law","Divorce","Child custody"],"languages":["Greek","English"],"consultationModes":["video","phone","inPerson"],"videoPrice":60,"phonePrice":50,"inPersonPrice":80,"cancellationPolicy":"Free reschedule or cancellation up to 24 hours before the appointment.","autoConfirm":true,"bookingWindowDays":21,"bufferMinutes":15}'::jsonb,
  '[{"day":"Δευτέρα","enabled":true,"start":"09:00","end":"17:00","note":""},{"day":"Τρίτη","enabled":true,"start":"10:00","end":"18:00","note":""},{"day":"Τετάρτη","enabled":true,"start":"12:00","end":"16:00","note":""},{"day":"Πέμπτη","enabled":true,"start":"09:30","end":"16:30","note":""},{"day":"Παρασκευή","enabled":false,"start":"09:00","end":"15:00","note":"Urgent only"}]'::jsonb,
  true
)
on conflict (partner_email) do nothing;

create or replace function public.nomos_handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id,name,email,email_verified)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name',''), nullif(new.raw_user_meta_data ->> 'full_name',''), nullif(new.raw_user_meta_data ->> 'username',''), split_part(coalesce(new.email,''),'@',1), 'User'),
    lower(coalesce(new.email,'')),
    new.email_confirmed_at is not null
  )
  on conflict (id) do update
  set email = excluded.email,
      email_verified = excluded.email_verified,
      updated_at = now();
  return new;
end;
$$;

drop trigger if exists nomos_handle_new_user_profile on auth.users;
create trigger nomos_handle_new_user_profile
  after insert on auth.users
  for each row execute function public.nomos_handle_new_user_profile();

drop trigger if exists nomos_user_profiles_updated_at on public.user_profiles;
create trigger nomos_user_profiles_updated_at before update on public.user_profiles
  for each row execute function public.nomos_touch_updated_at();

drop trigger if exists nomos_lawyer_profiles_updated_at on public.lawyer_profiles;
create trigger nomos_lawyer_profiles_updated_at before update on public.lawyer_profiles
  for each row execute function public.nomos_touch_updated_at();

drop trigger if exists nomos_booking_payments_updated_at on public.booking_payments;
create trigger nomos_booking_payments_updated_at before update on public.booking_payments
  for each row execute function public.nomos_touch_updated_at();

drop trigger if exists nomos_booking_reviews_updated_at on public.booking_reviews;
create trigger nomos_booking_reviews_updated_at before update on public.booking_reviews
  for each row execute function public.nomos_touch_updated_at();

drop trigger if exists nomos_partner_profile_settings_updated_at on public.partner_profile_settings;
create trigger nomos_partner_profile_settings_updated_at before update on public.partner_profile_settings
  for each row execute function public.nomos_touch_updated_at();

create or replace function public.is_approved_partner(p_email text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.partner_accounts
    where lower(email) = lower(p_email)
      and status = 'approved'
  );
$$;

create or replace function public.nomos_is_current_partner_email(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.partner_accounts pa
    where lower(pa.email) = lower(p_email)
      and pa.status = 'approved'
      and (
        pa.user_id = auth.uid()
        or lower(pa.email) = lower(coalesce(auth.jwt() ->> 'email',''))
      )
  );
$$;

create or replace function public.nomos_is_current_partner_for_lawyer(p_lawyer_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.partner_accounts pa
    where pa.lawyer_id = p_lawyer_id
      and pa.status = 'approved'
      and (
        pa.user_id = auth.uid()
        or lower(pa.email) = lower(coalesce(auth.jwt() ->> 'email',''))
      )
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
  if p_user_id is not null and auth.uid() is distinct from p_user_id then
    raise exception 'INVALID_BOOKING_USER' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.partner_accounts pa
    where lower(pa.lawyer_id) = lower(p_lawyer_id)
      and pa.status = 'approved'
      and (
        pa.user_id = auth.uid()
        or lower(pa.email) = lower(coalesce(auth.jwt() ->> 'email',''))
      )
  ) then
    raise exception 'SELF_BOOKING_FORBIDDEN' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.booking_requests
    where lawyer_id = p_lawyer_id
      and date_label = p_date_label
      and time = p_time
      and status = 'confirmed'
  ) then
    raise exception 'BOOKING_SLOT_UNAVAILABLE' using errcode = 'P0001';
  end if;

  insert into public.booking_requests (
    id,user_id,reference_id,lawyer_id,lawyer_name,consultation_type,consultation_mode,
    price,duration,date_label,time,client_name,client_email,client_phone,issue_summary,status
  )
  values (
    p_booking_id,p_user_id,p_reference_id,p_lawyer_id,p_lawyer_name,p_consultation_type,p_consultation_mode,
    p_price,p_duration,p_date_label,p_time,p_client_name,lower(p_client_email),p_client_phone,nullif(p_issue_summary,''),'confirmed'
  )
  returning * into inserted_booking;

  insert into public.booking_payments (booking_id,user_id,lawyer_id,amount,currency,status,invoice_number)
  values (
    inserted_booking.id,inserted_booking.user_id,inserted_booking.lawyer_id,inserted_booking.price,
    'EUR','pending','INV-' || regexp_replace(inserted_booking.reference_id,'^BK-','')
  )
  on conflict (booking_id) do nothing;

  return inserted_booking;
exception
  when unique_violation then
    raise exception 'BOOKING_SLOT_UNAVAILABLE' using errcode = 'P0001';
end;
$$;

drop function if exists public.cancel_booking_as_user(uuid);
create or replace function public.cancel_booking_as_user(p_booking_id uuid)
returns public.booking_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  updated_booking public.booking_requests;
begin
  if current_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  update public.booking_requests
  set status = 'cancelled'
  where id = p_booking_id
    and user_id = current_user_id
    and status = 'confirmed'
  returning * into updated_booking;

  if updated_booking.id is null then
    raise exception 'BOOKING_NOT_FOUND_OR_FORBIDDEN' using errcode = '42501';
  end if;

  update public.booking_payments
  set status = case when status = 'pending' then 'failed' else status end,
      provider_payload = case
        when status = 'paid' then provider_payload || jsonb_build_object(
          'refundReviewRequired', true,
          'cancelledAt', now()
        )
        else provider_payload
      end,
      updated_at = now()
  where booking_id = p_booking_id
    and status in ('pending','paid');

  return updated_booking;
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

  return true;
end;
$$;

create or replace function public.create_partner_access_code(p_email text, p_code text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.is_approved_partner(p_email) then
    return false;
  end if;

  delete from public.partner_access_codes
  where lower(email) = lower(p_email)
    and (consumed_at is not null or expires_at < now());

  insert into public.partner_access_codes (email,code_hash,expires_at)
  values (lower(p_email), crypt(p_code, gen_salt('bf')), now() + interval '10 minutes');

  return true;
end;
$$;

drop function if exists public.verify_partner_access_code(text,text);
create or replace function public.verify_partner_access_code(p_email text, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  matching_code uuid;
  partner_session_token text;
  partner_session_expires_at timestamptz;
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
    return jsonb_build_object('ok', false);
  end if;

  update public.partner_access_codes set consumed_at = now() where id = matching_code;

  delete from public.partner_sessions
  where lower(email) = lower(p_email)
    and (revoked_at is not null or expires_at < now());

  partner_session_token := encode(gen_random_bytes(32), 'hex');

  insert into public.partner_sessions (email,session_token_hash,expires_at)
  values (lower(p_email), crypt(partner_session_token, gen_salt('bf')), now() + interval '12 hours')
  returning expires_at into partner_session_expires_at;

  return jsonb_build_object(
    'ok', true,
    'sessionToken', partner_session_token,
    'expiresAt', partner_session_expires_at
  );
end;
$$;

select public.create_partner_access_code('nasoosadamopoylos@gmail.com','742913');

create or replace function public.complete_booking_as_partner(
  p_partner_email text,
  p_session_token text,
  p_booking_id uuid
)
returns public.booking_requests
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  partner_lawyer_id text;
  updated_booking public.booking_requests;
begin
  select pa.lawyer_id into partner_lawyer_id
  from public.partner_accounts pa
  join public.partner_sessions ps on lower(ps.email) = lower(pa.email)
  where lower(pa.email) = lower(p_partner_email)
    and pa.status = 'approved'
    and ps.revoked_at is null
    and ps.expires_at > now()
    and ps.session_token_hash = crypt(p_session_token, ps.session_token_hash)
  order by ps.created_at desc
  limit 1;

  if partner_lawyer_id is null then
    raise exception 'PARTNER_SESSION_INVALID' using errcode = '42501';
  end if;

  update public.booking_requests
  set status = 'completed',
      consultation_status = 'completed_confirmed',
      updated_at = now()
  where id = p_booking_id
    and lawyer_id = partner_lawyer_id
    and status = 'confirmed_paid'
  returning * into updated_booking;

  if updated_booking.id is null then
    raise exception 'BOOKING_NOT_FOUND_OR_NOT_PAID' using errcode = '42501';
  end if;

  return updated_booking;
end;
$$;

create or replace function public.cancel_booking_as_partner(
  p_partner_email text,
  p_session_token text,
  p_booking_id uuid,
  p_reason text default 'lawyer_requested_reschedule'
)
returns public.booking_requests
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  partner_lawyer_id text;
  updated_booking public.booking_requests;
begin
  select pa.lawyer_id into partner_lawyer_id
  from public.partner_accounts pa
  join public.partner_sessions ps on lower(ps.email) = lower(pa.email)
  where lower(pa.email) = lower(p_partner_email)
    and pa.status = 'approved'
    and ps.revoked_at is null
    and ps.expires_at > now()
    and ps.session_token_hash = crypt(p_session_token, ps.session_token_hash)
  order by ps.created_at desc
  limit 1;

  if partner_lawyer_id is null then
    raise exception 'PARTNER_SESSION_INVALID' using errcode = '42501';
  end if;

  update public.booking_requests
  set status = 'cancelled',
      cancelled_at = now(),
      cancellation_actor = 'lawyer',
      cancellation_reason = coalesce(nullif(trim(p_reason), ''), 'lawyer_requested_reschedule'),
      reschedule_requested = true,
      updated_at = now()
  where id = p_booking_id
    and lawyer_id = partner_lawyer_id
    and status in ('pending_confirmation', 'confirmed_unpaid', 'confirmed_paid')
  returning * into updated_booking;

  if updated_booking.id is null then
    raise exception 'BOOKING_NOT_FOUND_OR_ALREADY_CLOSED' using errcode = '42501';
  end if;

  update public.booking_payments
  set status = case
        when status in ('paid', 'refund_requested') then 'refund_requested'
        when status = 'refunded' then 'refunded'
        when status = 'checkout_opened' then 'failed'
        else status
      end,
      provider_payload = coalesce(provider_payload, '{}'::jsonb) || jsonb_build_object(
        'cancelledBy', 'lawyer',
        'cancelledAt', now(),
        'refundReviewRequired', status in ('paid', 'refund_requested'),
        'reason', coalesce(nullif(trim(p_reason), ''), 'lawyer_requested_reschedule')
      ),
      updated_at = now()
  where booking_id = p_booking_id;

  return updated_booking;
end;
$$;

create or replace function public.list_bookings_as_partner(
  p_partner_email text,
  p_session_token text,
  p_lawyer_id text
)
returns setof public.booking_requests
language sql
security definer
set search_path = public, extensions
as $$
  select br.*
  from public.booking_requests br
  where br.lawyer_id = p_lawyer_id
    and exists (
      select 1
      from public.partner_accounts pa
      join public.partner_sessions ps on lower(ps.email) = lower(pa.email)
      where lower(pa.email) = lower(p_partner_email)
        and pa.lawyer_id = p_lawyer_id
        and pa.status = 'approved'
        and ps.revoked_at is null
        and ps.expires_at > now()
        and ps.session_token_hash = crypt(p_session_token, ps.session_token_hash)
    )
  order by br.created_at desc;
$$;

create or replace function public.list_payments_as_partner(
  p_partner_email text,
  p_session_token text,
  p_lawyer_id text
)
returns setof public.booking_payments
language sql
security definer
set search_path = public, extensions
as $$
  select bp.*
  from public.booking_payments bp
  where bp.lawyer_id = p_lawyer_id
    and exists (
      select 1
      from public.partner_accounts pa
      join public.partner_sessions ps on lower(ps.email) = lower(pa.email)
      where lower(pa.email) = lower(p_partner_email)
        and pa.lawyer_id = p_lawyer_id
        and pa.status = 'approved'
        and ps.revoked_at is null
        and ps.expires_at > now()
        and ps.session_token_hash = crypt(p_session_token, ps.session_token_hash)
    )
  order by bp.created_at desc;
$$;

drop function if exists public.list_reviews_as_partner(text,text,text);
create or replace function public.list_reviews_as_partner(
  p_partner_email text,
  p_session_token text,
  p_lawyer_id text
)
returns table (
  id uuid,
  booking_id uuid,
  user_id uuid,
  lawyer_id text,
  rating integer,
  clarity_rating integer,
  responsiveness_rating integer,
  review_text text,
  lawyer_reply text,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  client_name text,
  consultation_type text
)
language sql
security definer
set search_path = public, extensions
as $$
  select
    brv.id,
    brv.booking_id,
    brv.user_id,
    brv.lawyer_id,
    brv.rating,
    brv.clarity_rating,
    brv.responsiveness_rating,
    brv.review_text,
    brv.lawyer_reply,
    brv.status,
    brv.created_at,
    brv.updated_at,
    br.client_name,
    br.consultation_type
  from public.booking_reviews brv
  join public.booking_requests br on br.id = brv.booking_id
  where brv.lawyer_id = p_lawyer_id
    and exists (
      select 1
      from public.partner_accounts pa
      join public.partner_sessions ps on lower(ps.email) = lower(pa.email)
      where lower(pa.email) = lower(p_partner_email)
        and pa.lawyer_id = p_lawyer_id
        and pa.status = 'approved'
        and ps.revoked_at is null
        and ps.expires_at > now()
        and ps.session_token_hash = crypt(p_session_token, ps.session_token_hash)
    )
  order by brv.created_at desc;
$$;

drop function if exists public.list_documents_as_partner(text,text,text);
create or replace function public.list_documents_as_partner(
  p_partner_email text,
  p_session_token text,
  p_lawyer_id text
)
returns table (
  id uuid,
  booking_id uuid,
  name text,
  size integer,
  mime_type text,
  category text,
  storage_path text,
  visible_to_lawyer boolean,
  created_at timestamptz,
  reference_id text,
  client_name text
)
language sql
security definer
set search_path = public, extensions
as $$
  select
    ud.id,
    ud.booking_id,
    ud.name,
    ud.size,
    ud.mime_type,
    ud.category,
    ud.storage_path,
    ud.visible_to_lawyer,
    ud.created_at,
    br.reference_id,
    br.client_name
  from public.user_documents ud
  join public.booking_requests br on br.id = ud.booking_id
  where br.lawyer_id = p_lawyer_id
    and ud.visible_to_lawyer
    and exists (
      select 1
      from public.partner_accounts pa
      join public.partner_sessions ps on lower(ps.email) = lower(pa.email)
      where lower(pa.email) = lower(p_partner_email)
        and pa.lawyer_id = p_lawyer_id
        and pa.status = 'approved'
        and ps.revoked_at is null
        and ps.expires_at > now()
        and ps.session_token_hash = crypt(p_session_token, ps.session_token_hash)
    )
  order by ud.created_at desc;
$$;

drop function if exists public.get_partner_document_storage_path(text,text,uuid);
create or replace function public.get_partner_document_storage_path(
  p_partner_email text,
  p_session_token text,
  p_document_id uuid
)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  document_path text;
begin
  select ud.storage_path into document_path
  from public.user_documents ud
  join public.booking_requests br on br.id = ud.booking_id
  where ud.id = p_document_id
    and ud.visible_to_lawyer
    and exists (
      select 1
      from public.partner_accounts pa
      join public.partner_sessions ps on lower(ps.email) = lower(pa.email)
      where lower(pa.email) = lower(p_partner_email)
        and pa.lawyer_id = br.lawyer_id
        and pa.status = 'approved'
        and ps.revoked_at is null
        and ps.expires_at > now()
        and ps.session_token_hash = crypt(p_session_token, ps.session_token_hash)
    )
  limit 1;

  if document_path is null then
    raise exception 'DOCUMENT_NOT_FOUND_OR_FORBIDDEN' using errcode = '42501';
  end if;

  return document_path;
end;
$$;

drop function if exists public.update_review_as_partner(text,text,uuid,text,text);
create or replace function public.update_review_as_partner(
  p_partner_email text,
  p_session_token text,
  p_review_id uuid,
  p_lawyer_reply text,
  p_status text default null
)
returns public.booking_reviews
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  partner_lawyer_id text;
  updated_review public.booking_reviews;
begin
  select pa.lawyer_id into partner_lawyer_id
  from public.partner_accounts pa
  join public.partner_sessions ps on lower(ps.email) = lower(pa.email)
  where lower(pa.email) = lower(p_partner_email)
    and pa.status = 'approved'
    and ps.revoked_at is null
    and ps.expires_at > now()
    and ps.session_token_hash = crypt(p_session_token, ps.session_token_hash)
  order by ps.created_at desc
  limit 1;

  if partner_lawyer_id is null then
    raise exception 'PARTNER_SESSION_INVALID' using errcode = '42501';
  end if;

  update public.booking_reviews
  set lawyer_reply = coalesce(p_lawyer_reply, lawyer_reply),
      status = case
        when p_status in ('published','flagged','hidden') then p_status
        else status
      end,
      updated_at = now()
  where id = p_review_id
    and lawyer_id = partner_lawyer_id
  returning * into updated_review;

  if updated_review.id is null then
    raise exception 'REVIEW_NOT_FOUND_OR_FORBIDDEN' using errcode = '42501';
  end if;

  return updated_review;
end;
$$;

drop function if exists public.save_partner_workspace_as_partner(text,text,jsonb,jsonb,jsonb,jsonb);
create or replace function public.save_partner_workspace_as_partner(
  p_partner_email text,
  p_session_token text,
  p_profile jsonb,
  p_availability jsonb,
  p_notifications jsonb,
  p_reviews jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  partner_lawyer_id text;
  normalized_profile jsonb := coalesce(p_profile, '{}'::jsonb);
  normalized_availability jsonb := coalesce(p_availability, '[]'::jsonb);
  normalized_notifications jsonb := coalesce(p_notifications, '{}'::jsonb);
  normalized_reviews jsonb := coalesce(p_reviews, '[]'::jsonb);
  profile_specialties text[];
  profile_languages text[];
  profile_modes text[];
  video_price integer := greatest(0, coalesce(nullif(normalized_profile ->> 'videoPrice', '')::integer, 0));
  phone_price integer := greatest(0, coalesce(nullif(normalized_profile ->> 'phonePrice', '')::integer, 0));
  in_person_price integer := greatest(0, coalesce(nullif(normalized_profile ->> 'inPersonPrice', '')::integer, 0));
  selected_price integer;
  profile_consultations jsonb;
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

  select coalesce(array_agg(trim(value)), array[]::text[]) into profile_specialties
  from jsonb_array_elements_text(coalesce(normalized_profile -> 'specialties', '[]'::jsonb)) as items(value)
  where trim(value) <> '';

  if array_length(profile_specialties, 1) is null then
    profile_specialties := array['Legal services'];
  end if;

  select coalesce(array_agg(trim(value)), array[]::text[]) into profile_languages
  from jsonb_array_elements_text(coalesce(normalized_profile -> 'languages', '[]'::jsonb)) as items(value)
  where trim(value) <> '';

  if array_length(profile_languages, 1) is null then
    profile_languages := array['Greek'];
  end if;

  select coalesce(array_agg(trim(value)), array[]::text[]) into profile_modes
  from jsonb_array_elements_text(coalesce(normalized_profile -> 'consultationModes', '[]'::jsonb)) as items(value)
  where trim(value) in ('video', 'phone', 'inPerson');

  if array_length(profile_modes, 1) is null then
    profile_modes := array['video'];
  end if;

  select min(price) into selected_price
  from (
    values
      (case when 'video' = any(profile_modes) then video_price else null end),
      (case when 'phone' = any(profile_modes) then phone_price else null end),
      (case when 'inPerson' = any(profile_modes) then in_person_price else null end)
  ) as prices(price)
  where price is not null;

  selected_price := coalesce(selected_price, 0);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'mode', mode,
        'type', case mode
          when 'phone' then 'Phone consultation'
          when 'inPerson' then 'In-person consultation'
          else 'Video consultation'
        end,
        'price', case mode
          when 'phone' then phone_price
          when 'inPerson' then in_person_price
          else video_price
        end,
        'duration', case mode
          when 'inPerson' then '45 minutes'
          else '30 minutes'
        end,
        'desc', coalesce(nullif(trim(normalized_profile ->> 'serviceArea'), ''), 'Legal consultation')
      )
    ),
    '[]'::jsonb
  ) into profile_consultations
  from unnest(profile_modes) as mode_values(mode);

  insert into public.partner_profile_settings (
    partner_email,
    lawyer_id,
    profile,
    availability,
    reviews,
    notifications,
    published_profile,
    published_availability,
    is_public,
    updated_at
  )
  values (
    lower(p_partner_email),
    partner_lawyer_id,
    normalized_profile || jsonb_build_object('lawyerId', partner_lawyer_id),
    normalized_availability,
    normalized_reviews,
    normalized_notifications,
    normalized_profile || jsonb_build_object('lawyerId', partner_lawyer_id),
    normalized_availability,
    true,
    now()
  )
  on conflict (partner_email) do update
    set lawyer_id = excluded.lawyer_id,
        profile = excluded.profile,
        availability = excluded.availability,
        reviews = excluded.reviews,
        notifications = excluded.notifications,
        published_profile = excluded.published_profile,
        published_availability = excluded.published_availability,
        is_public = true,
        updated_at = now();

  update public.lawyer_profiles
  set name = coalesce(nullif(trim(normalized_profile ->> 'displayName'), ''), name),
      specialty = coalesce(profile_specialties[1], specialty),
      specialty_short = coalesce(profile_specialties[1], specialty_short),
      specialties = profile_specialties,
      specialty_keywords = profile_specialties,
      best_for = coalesce(nullif(trim(normalized_profile ->> 'serviceArea'), ''), best_for),
      city = coalesce(nullif(trim(normalized_profile ->> 'city'), ''), city),
      price = selected_price,
      consultation_modes = profile_modes,
      bio = coalesce(nullif(trim(normalized_profile ->> 'bio'), ''), bio),
      languages = profile_languages,
      consultations = profile_consultations,
      updated_at = now()
  where id = partner_lawyer_id;

  if not found then
    raise exception 'LAWYER_PROFILE_NOT_FOUND' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'ok', true,
    'lawyerId', partner_lawyer_id,
    'updatedAt', now()
  );
end;
$$;

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
    'published'
  )
  on conflict (booking_id) do update
    set rating = excluded.rating,
        clarity_rating = excluded.clarity_rating,
        responsiveness_rating = excluded.responsiveness_rating,
        review_text = excluded.review_text,
        status = 'published',
        updated_at = now()
    where public.booking_reviews.user_id = current_user_id
  returning * into saved_review;

  if saved_review.id is null then
    raise exception 'REVIEW_NOT_SAVED' using errcode = '42501';
  end if;

  return saved_review;
end;
$$;

alter table public.user_profiles enable row level security;
alter table public.lawyer_profiles enable row level security;
alter table public.booking_requests enable row level security;
alter table public.booking_payments enable row level security;
alter table public.booking_reviews enable row level security;
alter table public.user_documents enable row level security;
alter table public.partner_applications enable row level security;
alter table public.partner_accounts enable row level security;
alter table public.partner_access_codes enable row level security;
alter table public.partner_sessions enable row level security;
alter table public.partner_profile_settings enable row level security;

drop policy if exists "Users can read own profile" on public.user_profiles;
create policy "Users can read own profile" on public.user_profiles
  for select using (id = auth.uid());

drop policy if exists "Users can create own profile" on public.user_profiles;
create policy "Users can create own profile" on public.user_profiles
  for insert with check (id = auth.uid());

drop policy if exists "Users can update own profile" on public.user_profiles;
create policy "Users can update own profile" on public.user_profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "Public can read active lawyer profiles" on public.lawyer_profiles;
create policy "Public can read active lawyer profiles" on public.lawyer_profiles
  for select using (status = 'active');

drop policy if exists "Public can create booking requests" on public.booking_requests;

drop policy if exists "Users can read own booking requests" on public.booking_requests;
create policy "Users can read own booking requests" on public.booking_requests
  for select using (user_id = auth.uid());

drop policy if exists "Users can update own booking requests" on public.booking_requests;

drop policy if exists "Partners can read own booking requests" on public.booking_requests;
create policy "Partners can read own booking requests" on public.booking_requests
  for select using (public.nomos_is_current_partner_for_lawyer(lawyer_id));

drop policy if exists "Partners can update own booking requests" on public.booking_requests;

drop policy if exists "Users can read own payments" on public.booking_payments;
create policy "Users can read own payments" on public.booking_payments
  for select using (user_id = auth.uid());

drop policy if exists "Users can create own pending payments" on public.booking_payments;
drop policy if exists "Users can update own pending payments" on public.booking_payments;

drop policy if exists "Partners can read own payments" on public.booking_payments;
create policy "Partners can read own payments" on public.booking_payments
  for select using (public.nomos_is_current_partner_for_lawyer(lawyer_id));

drop policy if exists "Users can read own reviews" on public.booking_reviews;
create policy "Users can read own reviews" on public.booking_reviews
  for select using (user_id = auth.uid());

drop policy if exists "Public can read published reviews" on public.booking_reviews;
create policy "Public can read published reviews" on public.booking_reviews
  for select using (status = 'published');

drop policy if exists "Users can create own reviews" on public.booking_reviews;
drop policy if exists "Users can update own reviews" on public.booking_reviews;

drop policy if exists "Partners can read own reviews" on public.booking_reviews;
create policy "Partners can read own reviews" on public.booking_reviews
  for select using (public.nomos_is_current_partner_for_lawyer(lawyer_id));

drop policy if exists "Partners can update own review replies" on public.booking_reviews;

drop policy if exists "Users can manage own documents" on public.user_documents;
create policy "Users can manage own documents" on public.user_documents
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Partners can read booking documents" on public.user_documents;
create policy "Partners can read booking documents" on public.user_documents
  for select using (
    visible_to_lawyer
    and exists (
      select 1 from public.booking_requests br
      where br.id = user_documents.booking_id
        and public.nomos_is_current_partner_for_lawyer(br.lawyer_id)
    )
  );

drop policy if exists "Users can manage own legal document objects" on storage.objects;
create policy "Users can manage own legal document objects" on storage.objects
  for all using (bucket_id = 'legal-documents' and owner = auth.uid())
  with check (bucket_id = 'legal-documents' and owner = auth.uid());

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
        and public.nomos_is_current_partner_for_lawyer(br.lawyer_id)
    )
  );

drop policy if exists "Public can create partner applications" on public.partner_applications;
create policy "Public can create partner applications" on public.partner_applications
  for insert with check (status = 'under_review');

drop policy if exists "Partners can read own account" on public.partner_accounts;
create policy "Partners can read own account" on public.partner_accounts
  for select using (
    status = 'approved'
    and (
      user_id = auth.uid()
      or lower(email) = lower(coalesce(auth.jwt() ->> 'email',''))
    )
  );

drop policy if exists "Partners can manage own profile settings" on public.partner_profile_settings;

drop policy if exists "Public can read published partner profile settings" on public.partner_profile_settings;
create policy "Public can read published partner profile settings" on public.partner_profile_settings
  for select using (is_public = true and lawyer_id is not null);

grant usage on schema public to anon, authenticated;
revoke all on all tables in schema public from anon, authenticated;
grant select, insert, update on public.user_profiles to authenticated;
grant select on public.lawyer_profiles to anon, authenticated;
grant select on public.booking_requests to anon, authenticated;
grant select on public.booking_payments to authenticated;
grant select on public.booking_reviews to anon, authenticated;
grant select, insert, update, delete on public.user_documents to authenticated;
grant insert on public.partner_applications to anon, authenticated;
grant select on public.partner_profile_settings to anon, authenticated;
grant usage,select on all sequences in schema public to anon, authenticated;
grant select,insert,update,delete on storage.objects to authenticated;

grant execute on function public.is_approved_partner(text) to anon, authenticated;
grant execute on function public.reserve_booking_slot(uuid,uuid,text,text,text,text,text,integer,text,text,text,text,text,text,text) to anon, authenticated;
grant execute on function public.cancel_booking_as_user(uuid) to authenticated;
grant execute on function public.request_partner_access_code(text) to anon, authenticated;
grant execute on function public.verify_partner_access_code(text,text) to anon, authenticated;
grant execute on function public.complete_booking_as_partner(text,text,uuid) to anon, authenticated;
grant execute on function public.cancel_booking_as_partner(text,text,uuid,text) to anon, authenticated;
grant execute on function public.list_bookings_as_partner(text,text,text) to anon, authenticated;
grant execute on function public.list_payments_as_partner(text,text,text) to anon, authenticated;
grant execute on function public.list_reviews_as_partner(text,text,text) to anon, authenticated;
grant execute on function public.list_documents_as_partner(text,text,text) to anon, authenticated;
grant execute on function public.get_partner_document_storage_path(text,text,uuid) to service_role;
grant execute on function public.update_review_as_partner(text,text,uuid,text,text) to anon, authenticated;
grant execute on function public.save_partner_workspace_as_partner(text,text,jsonb,jsonb,jsonb,jsonb) to anon, authenticated;
grant execute on function public.submit_booking_review(uuid,text,integer,integer,integer,text) to authenticated;
grant execute on function public.nomos_is_current_partner_email(text) to authenticated;
grant execute on function public.nomos_is_current_partner_for_lawyer(text) to authenticated;
revoke execute on function public.create_partner_access_code(text,text) from public, anon, authenticated;
grant execute on function public.create_partner_access_code(text,text) to service_role;

create table if not exists public.operational_cases (
  id uuid primary key default gen_random_uuid(),
  reference_id text not null unique,
  area text not null check (area in ('payments','supply','verification','reviews','bookingDisputes','support','privacyDocuments','security')),
  title text not null,
  summary text not null,
  status text not null default 'new' check (status in ('new','assigned','waiting_evidence','in_review','escalated','resolved','rejected','suspended')),
  priority text not null default 'normal' check (priority in ('urgent','high','normal','low')),
  owner text not null default 'Operations lead',
  requester_email text,
  related_reference text,
  evidence jsonb not null default '[]'::jsonb,
  timeline jsonb not null default '[]'::jsonb,
  sla_due_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists operational_cases_area_status_idx on public.operational_cases (area,status,sla_due_at);
create index if not exists operational_cases_requester_idx on public.operational_cases (requester_email,created_at desc) where requester_email is not null;

create table if not exists public.operational_audit_events (
  id uuid primary key default gen_random_uuid(),
  operational_case_id uuid references public.operational_cases (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  actor_label text not null default 'Operations',
  event_type text not null,
  note text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists operational_audit_case_idx on public.operational_audit_events (operational_case_id,created_at desc);

create table if not exists public.booking_payment_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.booking_requests (id) on delete cascade,
  stripe_event_id text not null unique,
  event_type text not null,
  payment_status text,
  provider_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists booking_payment_events_booking_idx on public.booking_payment_events (booking_id,created_at desc);

alter table public.operational_cases enable row level security;
alter table public.operational_audit_events enable row level security;
alter table public.booking_payment_events enable row level security;
drop policy if exists "Users can create own support cases" on public.operational_cases;
create policy "Users can create own support cases" on public.operational_cases
  for insert to authenticated
  with check (
    area in ('payments','bookingDisputes','support','privacyDocuments','security')
    and (
      requester_email is null
      or lower(requester_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );
drop policy if exists "Users can read own support cases" on public.operational_cases;
create policy "Users can read own support cases" on public.operational_cases
  for select to authenticated
  using (
    requester_email is not null
    and lower(requester_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
grant select,insert on public.operational_cases to authenticated;

create or replace function public.is_operations_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('admin', 'ops', 'operations')
    or coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') in ('admin', 'ops', 'operations')
    or lower(coalesce(auth.jwt() ->> 'email', '')) like '%@dikigoros.gr';
$$;

grant execute on function public.is_operations_user() to anon, authenticated;

drop policy if exists "Users can create own support cases" on public.operational_cases;
drop policy if exists "Users can read own support cases" on public.operational_cases;
drop policy if exists "Anyone can create operational support cases" on public.operational_cases;
drop policy if exists "Requesters can read own operational cases" on public.operational_cases;
drop policy if exists "Operations can read all operational cases" on public.operational_cases;
drop policy if exists "Operations can update operational cases" on public.operational_cases;
create policy "Anyone can create operational support cases" on public.operational_cases
  for insert to anon, authenticated
  with check (
    public.is_operations_user()
    or (
      area in ('payments','bookingDisputes','support','privacyDocuments','security','reviews')
      and status in ('new','assigned')
      and requester_email is not null
      and length(trim(requester_email)) > 3
    )
  );
create policy "Requesters can read own operational cases" on public.operational_cases
  for select to authenticated
  using (
    requester_email is not null
    and lower(requester_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
create policy "Operations can read all operational cases" on public.operational_cases
  for select to authenticated
  using (public.is_operations_user());
create policy "Operations can update operational cases" on public.operational_cases
  for update to authenticated
  using (public.is_operations_user())
  with check (public.is_operations_user());

drop policy if exists "Operations can read operational audit events" on public.operational_audit_events;
drop policy if exists "Operations can insert operational audit events" on public.operational_audit_events;
create policy "Operations can read operational audit events" on public.operational_audit_events
  for select to authenticated
  using (public.is_operations_user());
create policy "Operations can insert operational audit events" on public.operational_audit_events
  for insert to authenticated
  with check (public.is_operations_user());

grant insert on public.operational_cases to anon;
grant select,insert,update on public.operational_cases to authenticated;
grant select,insert on public.operational_audit_events to authenticated;

insert into public.operational_cases (reference_id,area,title,summary,status,priority,owner,evidence,timeline,sla_due_at,created_at,updated_at)
values
  ('PAY-LAUNCH-STRIPE','payments','Confirm live Stripe settlement path','Verify live Checkout key, webhook secret, booking payment row, receipt URL, and refund path before national launch.','new','urgent','Payments owner',jsonb_build_array('Checkout Sessions for booking payments','Webhook updates paid, failed, and refunded states'),jsonb_build_array(jsonb_build_object('at',now() - interval '3 hours','actor','Operations','action','Launch gate opened','note','Payment reconciliation must be proven from backend state.')),now() + interval '4 hours',now() - interval '3 hours',now() - interval '3 hours'),
  ('SUPPLY-LAUNCH-DENSITY','supply','Athens and Thessaloniki density check','Track verified bookable lawyer coverage in family, employment, property, inheritance, and criminal categories.','new','high','Marketplace supply lead',jsonb_build_array('Minimum city and category coverage thresholds are calculated from live public profiles'),jsonb_build_array(jsonb_build_object('at',now() - interval '9 hours','actor','Operations','action','Launch gate opened','note','Core supply density must be proven before wider rollout.')),now() + interval '24 hours',now() - interval '9 hours',now() - interval '9 hours'),
  ('VER-LAUNCH-QUEUE','verification','Application review queue','Assign reviewer for identity, license, bar association, professional details, and profile readiness checks.','new','normal','Verification lead',jsonb_build_array('Profiles stay public only after readiness checks pass'),jsonb_build_array(jsonb_build_object('at',now() - interval '26 hours','actor','Operations','action','Launch gate opened','note','Partner verification needs owned review before public activation.')),now() + interval '48 hours',now() - interval '26 hours',now() - interval '26 hours'),
  ('REV-LAUNCH-MODERATION','reviews','Completed-booking review moderation','Hold new reviews for completed-booking proof, case-detail screening, fraud checks, and lawyer reply handling.','new','normal','Trust and reviews lead',jsonb_build_array('Review request opens only after booking completion'),jsonb_build_array(jsonb_build_object('at',now() - interval '18 hours','actor','Operations','action','Launch gate opened','note','Published reviews must depend on completed consultation proof.')),now() + interval '48 hours',now() - interval '18 hours',now() - interval '18 hours'),
  ('DSP-LAUNCH-RESCHEDULE','bookingDisputes','Reschedule and no-show decision path','Confirm cancellation window, payment state, communication history, and refund or reschedule outcome.','new','high','Booking support lead',jsonb_build_array('Free cancellation or reschedule before the 24-hour window'),jsonb_build_array(jsonb_build_object('at',now() - interval '7 hours','actor','Operations','action','Launch gate opened','note','Booking exceptions need a shared queue and closure rule.')),now() + interval '24 hours',now() - interval '7 hours',now() - interval '7 hours'),
  ('PRV-LAUNCH-DOCUMENTS','privacyDocuments','Document retention and deletion workflow','Route access, deletion, visibility, and retention requests with booking/account context.','new','normal','Privacy and documents lead',jsonb_build_array('Documents are visible to the booked lawyer only when user visibility allows it'),jsonb_build_array(jsonb_build_object('at',now() - interval '16 hours','actor','Operations','action','Launch gate opened','note','Document visibility and deletion require audit-friendly handling.')),now() + interval '48 hours',now() - interval '16 hours',now() - interval '16 hours'),
  ('SEC-LAUNCH-RUNBOOK','security','Sensitive legal data incident runbook','Confirm containment, audit context, notification decision, corrective controls, and closure record.','new','urgent','Security and privacy lead',jsonb_build_array('Security and privacy concerns escalate before normal support handling'),jsonb_build_array(jsonb_build_object('at',now() - interval '90 minutes','actor','Operations','action','Launch gate opened','note','Security incidents must bypass normal support triage.')),now() + interval '2 hours',now() - interval '90 minutes',now() - interval '90 minutes')
on conflict (reference_id) do nothing;

-- Production stage-4 hardening overlay: canonical states and backend funnel analytics.
create table if not exists public.funnel_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null check (event_name in (
    'homepage_search',
    'search_profile_opened',
    'profile_booking_start',
    'booking_start',
    'booking_created',
    'payment_opened',
    'payment_completed',
    'consultation_completed',
    'review_submitted',
    'lawyer_application_submitted',
    'lawyer_application_approved',
    'approved_lawyer_first_completed_consultation'
  )),
  occurred_at timestamptz not null default now(),
  session_id text not null,
  user_id uuid references auth.users (id) on delete set null,
  lawyer_id text,
  booking_id uuid references public.booking_requests (id) on delete set null,
  city text,
  category text,
  source text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists funnel_events_name_time_idx on public.funnel_events (event_name, occurred_at desc);
create index if not exists funnel_events_session_idx on public.funnel_events (session_id, occurred_at desc);
create index if not exists funnel_events_lawyer_idx on public.funnel_events (lawyer_id, occurred_at desc) where lawyer_id is not null;
create index if not exists funnel_events_booking_idx on public.funnel_events (booking_id, occurred_at desc) where booking_id is not null;
create index if not exists funnel_events_city_category_idx on public.funnel_events (city, category, occurred_at desc);

alter table public.funnel_events enable row level security;

drop policy if exists "Anyone can create funnel events" on public.funnel_events;
create policy "Anyone can create funnel events" on public.funnel_events for insert
  to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

drop policy if exists "Authenticated users can read funnel events" on public.funnel_events;
create policy "Authenticated users can read funnel events" on public.funnel_events for select
  to authenticated
  using (true);

grant insert on public.funnel_events to anon, authenticated;
grant select on public.funnel_events to authenticated;

alter table public.booking_requests add column if not exists consultation_status text not null default 'scheduled';
alter table public.booking_requests add column if not exists updated_at timestamptz not null default now();
alter table public.booking_requests add column if not exists cancelled_at timestamptz;
alter table public.booking_requests add column if not exists cancellation_actor text;
alter table public.booking_requests add column if not exists cancellation_reason text;
alter table public.booking_requests add column if not exists reschedule_requested boolean not null default false;
alter table public.booking_requests drop constraint if exists booking_requests_status_check;
alter table public.booking_requests alter column status set default 'pending_confirmation';
alter table public.booking_requests add constraint booking_requests_status_check
  check (status in ('pending_confirmation','confirmed_unpaid','confirmed_paid','completed','cancelled'));
alter table public.booking_requests drop constraint if exists booking_requests_consultation_status_check;
alter table public.booking_requests add constraint booking_requests_consultation_status_check
  check (consultation_status in ('scheduled','completed_pending_partner_confirmation','completed_confirmed'));

alter table public.booking_payments drop constraint if exists booking_payments_status_check;
alter table public.booking_payments alter column status set default 'not_opened';
alter table public.booking_payments add constraint booking_payments_status_check
  check (status in ('not_opened','checkout_opened','paid','failed','refund_requested','refunded'));

alter table public.booking_reviews drop constraint if exists booking_reviews_status_check;
alter table public.booking_reviews alter column status set default 'under_moderation';
alter table public.booking_reviews add constraint booking_reviews_status_check
  check (status in ('draft','submitted','under_moderation','published','rejected'));

alter table public.user_documents add column if not exists retention_until timestamptz;
alter table public.user_documents add column if not exists deletion_status text not null default 'active';
alter table public.user_documents add column if not exists access_audit jsonb not null default '[]'::jsonb;
alter table public.user_documents add column if not exists visibility_history jsonb not null default '[]'::jsonb;

notify pgrst, 'reload schema';

commit;

select object_name, exists_in_database
from (
  values
    ('user_profiles', to_regclass('public.user_profiles') is not null),
    ('lawyer_profiles', to_regclass('public.lawyer_profiles') is not null),
    ('booking_requests', to_regclass('public.booking_requests') is not null),
    ('booking_payments', to_regclass('public.booking_payments') is not null),
    ('booking_reviews', to_regclass('public.booking_reviews') is not null),
    ('user_documents', to_regclass('public.user_documents') is not null),
    ('partner_profile_settings', to_regclass('public.partner_profile_settings') is not null),
    ('partner_accounts', to_regclass('public.partner_accounts') is not null),
    ('partner_access_codes', to_regclass('public.partner_access_codes') is not null),
    ('partner_sessions', to_regclass('public.partner_sessions') is not null),
    ('partner_applications', to_regclass('public.partner_applications') is not null),
    ('operational_cases', to_regclass('public.operational_cases') is not null),
    ('booking_payment_events', to_regclass('public.booking_payment_events') is not null),
    ('funnel_events', to_regclass('public.funnel_events') is not null),
    ('submit_booking_review_rpc', to_regprocedure('public.submit_booking_review(uuid,text,integer,integer,integer,text)') is not null),
    ('save_partner_workspace_rpc', to_regprocedure('public.save_partner_workspace_as_partner(text,text,jsonb,jsonb,jsonb,jsonb)') is not null),
    ('cancel_booking_rpc', to_regprocedure('public.cancel_booking_as_user(uuid)') is not null),
    ('partner_document_path_rpc', to_regprocedure('public.get_partner_document_storage_path(text,text,uuid)') is not null)
) as checks(object_name, exists_in_database);
