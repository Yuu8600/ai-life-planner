begin;

alter table public.tasks
add constraint tasks_id_user_id_key unique (id, user_id);

create table public.daily_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan_date date not null,
  summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_plans_id_user_id_key unique (id, user_id),
  constraint daily_plans_user_id_plan_date_key unique (user_id, plan_date)
);

create table public.planned_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  daily_plan_id uuid not null,
  task_id uuid,
  title text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  reason text,
  status text not null default 'scheduled',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint planned_actions_daily_plan_owner_fkey
    foreign key (daily_plan_id, user_id)
    references public.daily_plans (id, user_id)
    on delete cascade,
  constraint planned_actions_task_owner_fkey
    foreign key (task_id, user_id)
    references public.tasks (id, user_id)
    on delete set null (task_id),
  constraint planned_actions_title_not_blank check (length(btrim(title)) > 0),
  constraint planned_actions_time_range_valid check (end_at > start_at),
  constraint planned_actions_status_valid
    check (status in ('scheduled', 'completed', 'skipped'))
);

create index planned_actions_user_id_start_at_idx
on public.planned_actions (user_id, start_at);
create index planned_actions_daily_plan_id_idx on public.planned_actions (daily_plan_id);
create index planned_actions_task_id_idx on public.planned_actions (task_id);

create trigger daily_plans_set_updated_at
before update on public.daily_plans
for each row execute function public.set_updated_at();

create trigger planned_actions_set_updated_at
before update on public.planned_actions
for each row execute function public.set_updated_at();

alter table public.daily_plans enable row level security;
alter table public.planned_actions enable row level security;

revoke all privileges on table public.daily_plans from public, anon, authenticated;
revoke all privileges on table public.planned_actions from public, anon, authenticated;

grant select, insert, update, delete on table public.daily_plans to authenticated;
grant select, insert, update, delete on table public.planned_actions to authenticated;

grant all privileges on table public.daily_plans to service_role;
grant all privileges on table public.planned_actions to service_role;

create policy "daily_plans_select_own"
on public.daily_plans
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "daily_plans_insert_own"
on public.daily_plans
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "daily_plans_update_own"
on public.daily_plans
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "daily_plans_delete_own"
on public.daily_plans
for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "planned_actions_select_own"
on public.planned_actions
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "planned_actions_insert_own"
on public.planned_actions
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "planned_actions_update_own"
on public.planned_actions
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "planned_actions_delete_own"
on public.planned_actions
for delete
to authenticated
using ((select auth.uid()) = user_id);

commit;
