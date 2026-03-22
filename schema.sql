-- ╔═════════════════════════════════════════════════════════════╗
-- ║   TimetableAI — Supabase PostgreSQL Schema                  ║
-- ║   Run this in: Supabase Dashboard → SQL Editor → Run        ║
-- ╚═════════════════════════════════════════════════════════════╝

create extension if not exists "pgcrypto";

-- ─── STAFF ────────────────────────────────────────────────────
create table if not exists public.staff (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  subject         text not null,
  dept            text default '',
  email           text default '',
  availability    text[] default array['Monday','Tuesday','Wednesday','Thursday','Friday'],
  max_hrs_day     integer default 4,
  prefer_morning  boolean default false,
  created_at      timestamptz default now()
);

-- ─── CLASSES ──────────────────────────────────────────────────
create table if not exists public.classes (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  year        integer default 1,
  section     text default '',
  dept        text default '',
  capacity    integer default 60,
  created_at  timestamptz default now()
);

-- ─── SUBJECTS ─────────────────────────────────────────────────
create table if not exists public.subjects (
  id              uuid primary key default gen_random_uuid(),
  class_id        uuid references public.classes(id) on delete cascade,
  teacher_id      uuid references public.staff(id) on delete cascade,
  name            text not null,
  hours_per_week  integer default 3,
  is_lab          boolean default false,
  prefer_morning  boolean default false,
  created_at      timestamptz default now()
);

-- ─── ROOMS ────────────────────────────────────────────────────
create table if not exists public.rooms (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  capacity    integer default 60,
  is_lab      boolean default false,
  created_at  timestamptz default now()
);

-- ─── TIMETABLES ───────────────────────────────────────────────
create table if not exists public.timetables (
  id              uuid primary key default gen_random_uuid(),
  timetable_data  jsonb,
  teacher_view    jsonb,
  utilization     jsonb default '{}'::jsonb,
  violations      jsonb default '[]'::jsonb,
  conflicts       integer default 0,
  algorithm       text default 'csp',
  fitness_history jsonb,
  generated_at    timestamptz default now(),
  last_edited     timestamptz
);

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────
alter table public.staff      enable row level security;
alter table public.classes     enable row level security;
alter table public.subjects    enable row level security;
alter table public.rooms       enable row level security;
alter table public.timetables  enable row level security;

create policy "auth_all_staff"      on public.staff      for all to authenticated using (true) with check (true);
create policy "auth_all_classes"    on public.classes     for all to authenticated using (true) with check (true);
create policy "auth_all_subjects"   on public.subjects    for all to authenticated using (true) with check (true);
create policy "auth_all_rooms"      on public.rooms       for all to authenticated using (true) with check (true);
create policy "auth_all_timetables" on public.timetables  for all to authenticated using (true) with check (true);

-- ─── INDEXES ──────────────────────────────────────────────────
create index if not exists idx_subjects_class_id    on public.subjects(class_id);
create index if not exists idx_subjects_teacher_id  on public.subjects(teacher_id);
create index if not exists idx_timetables_generated on public.timetables(generated_at desc);

-- Done! Create your first user via Authentication → Users in Supabase Dashboard,
-- or use the Sign Up form in the app.
