begin;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  timezone text not null default 'Asia/Tokyo',
  planning_start time not null default '08:00',
  planning_end time not null default '23:00',
  minimum_free_minutes integer not null default 20,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_minimum_free_minutes_positive
    check (minimum_free_minutes > 0)
);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text,
  current_value numeric,
  target_value numeric,
  unit text,
  deadline date,
  priority text not null,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint goals_id_user_id_key unique (id, user_id),
  constraint goals_title_not_blank check (length(btrim(title)) > 0),
  constraint goals_priority_valid check (priority in ('low', 'medium', 'high')),
  constraint goals_status_valid check (status in ('active', 'completed', 'archived'))
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  goal_id uuid,
  title text not null,
  estimated_minutes integer not null,
  deadline timestamptz,
  priority text not null,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_goal_owner_fkey
    foreign key (goal_id, user_id)
    references public.goals (id, user_id)
    on delete set null (goal_id),
  constraint tasks_title_not_blank check (length(btrim(title)) > 0),
  constraint tasks_estimated_minutes_positive check (estimated_minutes > 0),
  constraint tasks_priority_valid check (priority in ('low', 'medium', 'high')),
  constraint tasks_status_valid check (status in ('pending', 'scheduled', 'completed', 'skipped'))
);

create index goals_user_id_idx on public.goals (user_id);
create index tasks_user_id_idx on public.tasks (user_id);
create index tasks_goal_id_idx on public.tasks (goal_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger goals_set_updated_at
before update on public.goals
for each row execute function public.set_updated_at();

create trigger tasks_set_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''))
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger ai_life_planner_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

insert into public.profiles (id, display_name)
select
  id,
  nullif(btrim(raw_user_meta_data ->> 'display_name'), '')
from auth.users
on conflict (id) do nothing;

alter table public.profiles enable row level security;
alter table public.goals enable row level security;
alter table public.tasks enable row level security;

revoke all privileges on table public.profiles from public, anon, authenticated;
revoke all privileges on table public.goals from public, anon, authenticated;
revoke all privileges on table public.tasks from public, anon, authenticated;

grant select, insert, update, delete on table public.profiles to authenticated;
grant select, insert, update, delete on table public.goals to authenticated;
grant select, insert, update, delete on table public.tasks to authenticated;

grant all privileges on table public.profiles to service_role;
grant all privileges on table public.goals to service_role;
grant all privileges on table public.tasks to service_role;

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = id);

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "profiles_delete_own"
on public.profiles
for delete
to authenticated
using ((select auth.uid()) = id);

create policy "goals_select_own"
on public.goals
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "goals_insert_own"
on public.goals
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "goals_update_own"
on public.goals
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "goals_delete_own"
on public.goals
for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "tasks_select_own"
on public.tasks
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "tasks_insert_own"
on public.tasks
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "tasks_update_own"
on public.tasks
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "tasks_delete_own"
on public.tasks
for delete
to authenticated
using ((select auth.uid()) = user_id);

commit;
