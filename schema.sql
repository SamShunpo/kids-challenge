-- Create tables
create table public.children (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  avatar_url text
);

create table public.objectives (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  title text not null,
  description text,
  child_id uuid references public.children(id) on delete set null -- null = for everyone
);

-- MIGRATION COMMAND (Run this if table already exists)
-- alter table public.objectives add column child_id uuid references public.children(id) on delete set null;

create table public.daily_logs (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  date date not null,
  is_completed boolean default false,
  child_id uuid references public.children(id) on delete cascade not null,
  objective_id uuid references public.objectives(id) on delete cascade not null,
  unique(date, child_id, objective_id)
);

-- RLS Policies (Allowing public access for MVP - USER MUST ENABLE IF NEEDED)
alter table public.children enable row level security;
alter table public.objectives enable row level security;
alter table public.daily_logs enable row level security;

-- Policy helper for public access
create policy "Public Select" on public.children for select using (true);
create policy "Public Insert" on public.children for insert with check (true);
create policy "Public Update" on public.children for update using (true);
create policy "Public Delete" on public.children for delete using (true);

create policy "Public Select" on public.objectives for select using (true);
create policy "Public Insert" on public.objectives for insert with check (true);
create policy "Public Update" on public.objectives for update using (true);
create policy "Public Delete" on public.objectives for delete using (true);

create policy "Public Select" on public.daily_logs for select using (true);
create policy "Public Insert" on public.daily_logs for insert with check (true);
create policy "Public Update" on public.daily_logs for update using (true);
create policy "Public Delete" on public.daily_logs for delete using (true);
