-- Lock the public marketplace taxonomy to the 5 active practice areas and 5 selectable cities.

update public.lawyer_profiles
set city = case
  when lower(city) in ('athens', 'athina') or city ilike 'Αθήνα' or city ilike 'Αθηνα' then 'Αθήνα'
  when lower(city) = 'thessaloniki' or city ilike 'Θεσσαλονίκη' or city ilike 'Θεσσαλονικη' then 'Θεσσαλονίκη'
  when lower(city) in ('piraeus', 'pireas') or city ilike 'Πειραιάς' or city ilike 'Πειραιας' then 'Πειραιάς'
  when lower(city) in ('heraklion', 'iraklio') or city ilike 'Ηράκλειο' or city ilike 'Ηρακλειο' then 'Ηράκλειο'
  when lower(city) in ('patra', 'patras') or city ilike 'Πάτρα' or city ilike 'Πατρα' then 'Πάτρα'
  else city
end;

update public.lawyer_profiles
set specialty = case
  when specialty ilike '%οικογεν%' or lower(specialty) like '%family%' or lower(specialty) like '%divorce%' then 'Οικογενειακό δίκαιο'
  when specialty ilike '%εργατ%' or lower(specialty) like '%employment%' then 'Εργατικό δίκαιο'
  when specialty ilike '%τροχ%' or specialty ilike '%αποζημ%' or specialty ilike '%αυτοκιν%' or lower(specialty) like '%traffic%' then 'Τροχαία / αποζημιώσεις / αυτοκίνητα'
  when specialty ilike '%μισθ%' or specialty ilike '%ενοικ%' or specialty ilike '%ακιν%' or lower(specialty) like '%lease%' or lower(specialty) like '%real estate%' then 'Μισθώσεις / ενοίκια / αποδόσεις μισθίου'
  when specialty ilike '%ενοχ%' or specialty ilike '%οφει%' or specialty ilike '%συμβ%' or specialty ilike '%διαταγ%' or specialty ilike '%κληρονομ%' or specialty ilike '%εμπορ%' or lower(specialty) like '%commercial%' or lower(specialty) like '%inheritance%' or lower(specialty) like '%contract%' then 'Ενοχικό / οφειλές / συμβάσεις / διαταγές πληρωμής'
  else specialty
end;

update public.lawyer_profiles
set
  specialty_short = case specialty
    when 'Ενοχικό / οφειλές / συμβάσεις / διαταγές πληρωμής' then 'Ενοχικό / οφειλές'
    when 'Οικογενειακό δίκαιο' then 'Οικογενειακό'
    when 'Τροχαία / αποζημιώσεις / αυτοκίνητα' then 'Τροχαία / αποζημιώσεις'
    when 'Εργατικό δίκαιο' then 'Εργατικό'
    when 'Μισθώσεις / ενοίκια / αποδόσεις μισθίου' then 'Μισθώσεις'
    else specialty_short
  end,
  specialties = case
    when specialty in (
      'Ενοχικό / οφειλές / συμβάσεις / διαταγές πληρωμής',
      'Οικογενειακό δίκαιο',
      'Τροχαία / αποζημιώσεις / αυτοκίνητα',
      'Εργατικό δίκαιο',
      'Μισθώσεις / ενοίκια / αποδόσεις μισθίου'
    ) then array[specialty]
    else specialties
  end,
  specialty_keywords = case specialty
    when 'Ενοχικό / οφειλές / συμβάσεις / διαταγές πληρωμής' then array['ενοχικό','οφειλή','σύμβαση','διαταγή πληρωμής','εξώδικο','απαίτηση']
    when 'Οικογενειακό δίκαιο' then array['οικογενειακό','διαζύγιο','επιμέλεια','διατροφή','γονική μέριμνα']
    when 'Τροχαία / αποζημιώσεις / αυτοκίνητα' then array['τροχαίο','ατύχημα','αποζημίωση','αυτοκίνητο','ασφάλεια']
    when 'Εργατικό δίκαιο' then array['εργατικό','απόλυση','μισθός','σύμβαση εργασίας']
    when 'Μισθώσεις / ενοίκια / αποδόσεις μισθίου' then array['μίσθωση','ενοίκιο','απόδοση μισθίου','έξωση']
    else specialty_keywords
  end;

update public.partner_applications
set
  city = case
    when lower(city) in ('athens', 'athina') or city ilike 'Αθήνα' or city ilike 'Αθηνα' then 'Αθήνα'
    when lower(city) = 'thessaloniki' or city ilike 'Θεσσαλονίκη' or city ilike 'Θεσσαλονικη' then 'Θεσσαλονίκη'
    when lower(city) in ('piraeus', 'pireas') or city ilike 'Πειραιάς' or city ilike 'Πειραιας' then 'Πειραιάς'
    when lower(city) in ('heraklion', 'iraklio') or city ilike 'Ηράκλειο' or city ilike 'Ηρακλειο' then 'Ηράκλειο'
    when lower(city) in ('patra', 'patras') or city ilike 'Πάτρα' or city ilike 'Πατρα' then 'Πάτρα'
    else city
  end,
  specialties = array_remove(array[
    case when exists (select 1 from unnest(specialties) item where item ilike '%οικογεν%' or lower(item) like '%family%' or lower(item) like '%divorce%') then 'Οικογενειακό δίκαιο' end,
    case when exists (select 1 from unnest(specialties) item where item ilike '%εργατ%' or lower(item) like '%employment%') then 'Εργατικό δίκαιο' end,
    case when exists (select 1 from unnest(specialties) item where item ilike '%τροχ%' or item ilike '%αποζημ%' or item ilike '%αυτοκιν%' or lower(item) like '%traffic%') then 'Τροχαία / αποζημιώσεις / αυτοκίνητα' end,
    case when exists (select 1 from unnest(specialties) item where item ilike '%μισθ%' or item ilike '%ενοικ%' or item ilike '%ακιν%' or lower(item) like '%lease%' or lower(item) like '%real estate%') then 'Μισθώσεις / ενοίκια / αποδόσεις μισθίου' end,
    case when exists (select 1 from unnest(specialties) item where item ilike '%ενοχ%' or item ilike '%οφει%' or item ilike '%συμβ%' or item ilike '%διαταγ%' or item ilike '%κληρονομ%' or item ilike '%εμπορ%' or lower(item) like '%commercial%' or lower(item) like '%inheritance%' or lower(item) like '%contract%') then 'Ενοχικό / οφειλές / συμβάσεις / διαταγές πληρωμής' end
  ]::text[], null)
where specialties is not null;

update public.partner_profile_settings
set
  profile = jsonb_set(
    profile,
    '{city}',
    to_jsonb(case
      when lower(profile->>'city') in ('athens', 'athina') or profile->>'city' ilike 'Αθήνα' or profile->>'city' ilike 'Αθηνα' then 'Αθήνα'
      when lower(profile->>'city') = 'thessaloniki' or profile->>'city' ilike 'Θεσσαλονίκη' or profile->>'city' ilike 'Θεσσαλονικη' then 'Θεσσαλονίκη'
      when lower(profile->>'city') in ('piraeus', 'pireas') or profile->>'city' ilike 'Πειραιάς' or profile->>'city' ilike 'Πειραιας' then 'Πειραιάς'
      when lower(profile->>'city') in ('heraklion', 'iraklio') or profile->>'city' ilike 'Ηράκλειο' or profile->>'city' ilike 'Ηρακλειο' then 'Ηράκλειο'
      when lower(profile->>'city') in ('patra', 'patras') or profile->>'city' ilike 'Πάτρα' or profile->>'city' ilike 'Πατρα' then 'Πάτρα'
      else coalesce(profile->>'city', '')
    end)
  ),
  published_profile = case
    when published_profile is null then published_profile
    else jsonb_set(
      published_profile,
      '{city}',
      to_jsonb(case
        when lower(published_profile->>'city') in ('athens', 'athina') or published_profile->>'city' ilike 'Αθήνα' or published_profile->>'city' ilike 'Αθηνα' then 'Αθήνα'
        when lower(published_profile->>'city') = 'thessaloniki' or published_profile->>'city' ilike 'Θεσσαλονίκη' or published_profile->>'city' ilike 'Θεσσαλονικη' then 'Θεσσαλονίκη'
        when lower(published_profile->>'city') in ('piraeus', 'pireas') or published_profile->>'city' ilike 'Πειραιάς' or published_profile->>'city' ilike 'Πειραιας' then 'Πειραιάς'
        when lower(published_profile->>'city') in ('heraklion', 'iraklio') or published_profile->>'city' ilike 'Ηράκλειο' or published_profile->>'city' ilike 'Ηρακλειο' then 'Ηράκλειο'
        when lower(published_profile->>'city') in ('patra', 'patras') or published_profile->>'city' ilike 'Πάτρα' or published_profile->>'city' ilike 'Πατρα' then 'Πάτρα'
        else coalesce(published_profile->>'city', '')
      end)
    )
  end
where profile is not null;

alter table public.lawyer_profiles drop constraint if exists lawyer_profiles_city_allowed;
alter table public.lawyer_profiles
  add constraint lawyer_profiles_city_allowed
  check (city = any (array['Αθήνα','Θεσσαλονίκη','Πειραιάς','Ηράκλειο','Πάτρα']::text[])) not valid;

alter table public.lawyer_profiles drop constraint if exists lawyer_profiles_specialty_allowed;
alter table public.lawyer_profiles
  add constraint lawyer_profiles_specialty_allowed
  check (specialty = any (array[
    'Ενοχικό / οφειλές / συμβάσεις / διαταγές πληρωμής',
    'Οικογενειακό δίκαιο',
    'Τροχαία / αποζημιώσεις / αυτοκίνητα',
    'Εργατικό δίκαιο',
    'Μισθώσεις / ενοίκια / αποδόσεις μισθίου'
  ]::text[])) not valid;

alter table public.lawyer_profiles drop constraint if exists lawyer_profiles_specialties_allowed;
alter table public.lawyer_profiles
  add constraint lawyer_profiles_specialties_allowed
  check (specialties <@ array[
    'Ενοχικό / οφειλές / συμβάσεις / διαταγές πληρωμής',
    'Οικογενειακό δίκαιο',
    'Τροχαία / αποζημιώσεις / αυτοκίνητα',
    'Εργατικό δίκαιο',
    'Μισθώσεις / ενοίκια / αποδόσεις μισθίου'
  ]::text[]) not valid;

alter table public.partner_applications drop constraint if exists partner_applications_city_allowed;
alter table public.partner_applications
  add constraint partner_applications_city_allowed
  check (city = any (array['Αθήνα','Θεσσαλονίκη','Πειραιάς','Ηράκλειο','Πάτρα']::text[])) not valid;

alter table public.partner_applications drop constraint if exists partner_applications_specialties_allowed;
alter table public.partner_applications
  add constraint partner_applications_specialties_allowed
  check (specialties <@ array[
    'Ενοχικό / οφειλές / συμβάσεις / διαταγές πληρωμής',
    'Οικογενειακό δίκαιο',
    'Τροχαία / αποζημιώσεις / αυτοκίνητα',
    'Εργατικό δίκαιο',
    'Μισθώσεις / ενοίκια / αποδόσεις μισθίου'
  ]::text[]) not valid;

alter table public.user_profiles drop constraint if exists user_profiles_city_allowed;
alter table public.user_profiles
  add constraint user_profiles_city_allowed
  check (city = '' or city = any (array['Αθήνα','Θεσσαλονίκη','Πειραιάς','Ηράκλειο','Πάτρα']::text[])) not valid;

alter table public.user_profiles drop constraint if exists user_profiles_preferred_legal_categories_allowed;
alter table public.user_profiles
  add constraint user_profiles_preferred_legal_categories_allowed
  check (preferred_legal_categories <@ array[
    'Ενοχικό / οφειλές / συμβάσεις / διαταγές πληρωμής',
    'Οικογενειακό δίκαιο',
    'Τροχαία / αποζημιώσεις / αυτοκίνητα',
    'Εργατικό δίκαιο',
    'Μισθώσεις / ενοίκια / αποδόσεις μισθίου'
  ]::text[]) not valid;
