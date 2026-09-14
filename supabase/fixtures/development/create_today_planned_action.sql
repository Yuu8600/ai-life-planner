-- Opt-in development fixture for manually checking the Today screen without AI planning.
-- This file is intentionally not part of supabase/seed.sql.
--
-- Before running it, replace the all-zero UUID below with an existing auth user's profile id.
-- The guard aborts before writing anything when the placeholder is left unchanged.
-- The fixture is idempotent for the same user, local date, and fixture time.

begin;

do $fixture$
declare
  fixture_user_id constant uuid := 'da7707c1-ac7f-4a6e-bf64-df3f35819853';
  placeholder_user_id constant uuid := '00000000-0000-0000-0000-000000000000';
  fixture_timezone text;
  fixture_plan_date date;
  fixture_plan_id uuid;
  fixture_task_id uuid;
  fixture_title text;
  fixture_start_at timestamptz;
  fixture_end_at timestamptz;
begin
  if fixture_user_id = placeholder_user_id then
    raise exception 'Replace fixture_user_id with an existing public.profiles.id before running this fixture';
  end if;

  select profile.timezone
  into fixture_timezone
  from public.profiles as profile
  where profile.id = fixture_user_id;

  if fixture_timezone is null then
    raise exception 'No profile exists for fixture user %', fixture_user_id;
  end if;

  if not exists (
    select 1
    from pg_timezone_names
    where name = fixture_timezone
  ) then
    raise exception 'Profile % has an invalid timezone: %', fixture_user_id, fixture_timezone;
  end if;

  fixture_plan_date := (current_timestamp at time zone fixture_timezone)::date;
  fixture_start_at := (fixture_plan_date + time '18:00') at time zone fixture_timezone;
  fixture_end_at := (fixture_plan_date + time '18:30') at time zone fixture_timezone;

  insert into public.daily_plans (user_id, plan_date, summary)
  values (fixture_user_id, fixture_plan_date, 'Today画面の開発確認用プラン')
  on conflict (user_id, plan_date) do nothing;

  select daily_plan.id
  into strict fixture_plan_id
  from public.daily_plans as daily_plan
  where daily_plan.user_id = fixture_user_id
    and daily_plan.plan_date = fixture_plan_date;

  select task.id, task.title
  into fixture_task_id, fixture_title
  from public.tasks as task
  where task.user_id = fixture_user_id
  order by task.created_at, task.id
  limit 1;

  fixture_title := coalesce(fixture_title, 'Today画面の開発確認');

  insert into public.planned_actions (
    user_id,
    daily_plan_id,
    task_id,
    title,
    start_at,
    end_at,
    reason
  )
  select
    fixture_user_id,
    fixture_plan_id,
    fixture_task_id,
    fixture_title,
    fixture_start_at,
    fixture_end_at,
    'Milestone 2B-4 development fixture'
  where not exists (
    select 1
    from public.planned_actions as action
    where action.user_id = fixture_user_id
      and action.daily_plan_id = fixture_plan_id
      and action.start_at = fixture_start_at
      and action.end_at = fixture_end_at
      and action.reason = 'Milestone 2B-4 development fixture'
  );
end;
$fixture$;

commit;
