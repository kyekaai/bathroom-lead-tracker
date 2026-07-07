-- ============================================================
-- DD DAVIS BATHROOM LEAD TRACKER — SUPABASE SCHEMA
-- Run this whole file in: Supabase Dashboard → SQL Editor → New query → Run
-- ============================================================

-- ---------- PROFILES (one row per app user) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  role text not null default 'staff' check (role in ('management','admin','designer','staff')),
  created_at timestamptz not null default now()
);

-- Auto-create a profile whenever a user is created in Supabase Auth.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
    coalesce(new.raw_user_meta_data->>'role', 'staff')
  ) on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- LEADS ----------
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  import_id uuid,

  -- Customer
  customer_name text not null,
  address text,
  postcode text,
  phone text,
  email text,
  lead_source text,
  bathroom_type text,

  -- Pipeline
  stage text not null default 'Survey Complete',
  next_action_override text,

  -- Survey
  survey_completed boolean not null default true,
  survey_completed_date date,
  surveyor text,
  brochures_handed boolean not null default false,
  selection_form_handed boolean not null default false,
  survey_notes text,
  estimated_value numeric,
  estimated_profit numeric,

  -- Selection form
  selection_form_sent boolean not null default false,
  selection_form_sent_date date,
  selection_form_returned boolean not null default false,
  selection_form_returned_date date,
  chase_attempts int not null default 0,
  last_chased_date date,
  next_chase_date date,

  -- CAD
  cad_required text not null default 'unsure' check (cad_required in ('yes','no','unsure')),
  cad_booked_date date,
  cad_designer text,
  cad_status text not null default 'not booked' check (cad_status in
    ('not required','not booked','booked','in progress','sent to customer','revisions requested','approved','rejected')),
  cad_notes text,
  cad_revision_count int not null default 0,
  cad_completed_date date,

  -- Quote
  quote_required boolean not null default true,
  quote_sent boolean not null default false,
  quote_sent_date date,
  quote_value numeric,
  quote_chase_attempts int not null default 0,
  last_quote_chase_date date,
  next_quote_chase_date date,
  quote_outcome text check (quote_outcome in ('accepted','rejected')),

  -- Won / lost
  lost_reason text,
  competitor text,
  deposit_paid boolean not null default false,
  job_booked boolean not null default false,

  notes text
);

create index if not exists leads_stage_idx on public.leads(stage);
create index if not exists leads_phone_idx on public.leads(phone);
create index if not exists leads_email_idx on public.leads(lower(email));
create index if not exists leads_postcode_idx on public.leads(upper(postcode));

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists leads_touch on public.leads;
create trigger leads_touch before update on public.leads
  for each row execute function public.touch_updated_at();

-- ---------- FOLLOW UPS ----------
create table if not exists public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  date date not null default current_date,
  method text not null check (method in ('phone','text','email','whatsapp')),
  staff text,
  notes text,
  outcome text,
  next_follow_up_date date,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists follow_ups_lead_idx on public.follow_ups(lead_id);
create index if not exists follow_ups_next_idx on public.follow_ups(next_follow_up_date);

-- ---------- FILES (metadata; binaries live in Storage) ----------
create table if not exists public.lead_files (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  category text not null default 'other' check (category in
    ('cad drawing','pdf','screenshot','selection form','quote','other')),
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists lead_files_lead_idx on public.lead_files(lead_id);

-- ---------- IMPORT HISTORY ----------
create table if not exists public.import_history (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  imported_by uuid references public.profiles(id),
  imported_at timestamptz not null default now(),
  imported_count int not null default 0,
  updated_count int not null default 0,
  duplicates_skipped int not null default 0,
  error_count int not null default 0,
  errors jsonb
);

-- ---------- ACTIVITY TIMELINE ----------
create table if not exists public.activity (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  type text not null,           -- created / import / survey / follow_up / selection_form / cad / quote / stage / note / file
  message text not null,
  actor text,
  created_at timestamptz not null default now()
);
create index if not exists activity_lead_idx on public.activity(lead_id);

-- ============================================================
-- ROW LEVEL SECURITY — only logged-in DD Davis users, nobody else
-- ============================================================
alter table public.profiles       enable row level security;
alter table public.leads          enable row level security;
alter table public.follow_ups     enable row level security;
alter table public.lead_files     enable row level security;
alter table public.import_history enable row level security;
alter table public.activity       enable row level security;

-- All 4 staff share all data. Anonymous/public users get nothing.
-- helper: is the current user management? (security definer avoids RLS recursion)
create or replace function public.is_management()
returns boolean language sql security definer stable set search_path = public as
$$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'management') $$;

create policy "auth read profiles"   on public.profiles       for select using (auth.role() = 'authenticated');
create policy "profile update"       on public.profiles       for update using (auth.uid() = id or public.is_management());
create policy "auth all leads"       on public.leads          for all    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth all follow_ups"  on public.follow_ups     for all    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth all files"       on public.lead_files     for all    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth all imports"     on public.import_history for all    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth all activity"    on public.activity       for all    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ============================================================
-- STORAGE — private bucket for CAD drawings, forms, quotes, screenshots
-- ============================================================
insert into storage.buckets (id, name, public)
values ('lead-files','lead-files', false)
on conflict (id) do nothing;

create policy "auth read lead files"   on storage.objects for select using (bucket_id = 'lead-files' and auth.role() = 'authenticated');
create policy "auth upload lead files" on storage.objects for insert with check (bucket_id = 'lead-files' and auth.role() = 'authenticated');
create policy "auth delete lead files" on storage.objects for delete using (bucket_id = 'lead-files' and auth.role() = 'authenticated');

-- ============================================================
-- REALTIME — everyone sees updates live
-- ============================================================
alter publication supabase_realtime add table public.leads;
alter publication supabase_realtime add table public.follow_ups;
alter publication supabase_realtime add table public.activity;
