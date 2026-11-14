begin;
insert into auth.users (id) values
 ('87210bb9-01d7-4628-9899-29aca81df742'), ('532b30af-b48b-4a67-ac03-4fc8b467fa93');
set local role authenticated;
select set_config('request.jwt.claim.sub', '87210bb9-01d7-4628-9899-29aca81df742', true);
do $$
declare
  day date := (now() at time zone 'Asia/Tokyo')::date + 1;
  first_start timestamptz;
  first_end timestamptz;
  task uuid;
  today date := public.planning_date(clock_timestamp(),'Asia/Tokyo',time '08:00',time '23:00',0);
  today_revision uuid;
  source text;
  plan_revision uuid;
  state jsonb;
begin
  insert into public.tasks(user_id,title,estimated_minutes,priority,status)
    values(auth.uid(),'V2 SQL fixture',30,'high','pending') returning id into task;
  first_start := public.planning_instant(day + time '08:00', 'Asia/Tokyo');
  first_end := public.planning_instant(day + time '23:00', 'Asia/Tokyo');
  source := public.v2_plan_source(day);
  state := jsonb_build_object('date',day,'timezone','Asia/Tokyo','window',
    jsonb_build_object('startAt',first_start,'endAt',first_end),'leisure','[]'::jsonb,'lifestyle','[]'::jsonb,'unplaced','[]'::jsonb,'warnings','[]'::jsonb,'limited',false,'sessions',
    jsonb_build_array(jsonb_build_object('id','one','taskId',task,'title','Fixture','reason','Fixture',
      'startAt',first_start,'endAt',first_start + interval '30 minutes','status','scheduled','locked',false)));
  plan_revision := public.v2_save_plan(day,null,source,state);
  begin
    perform public.v2_save_plan(day,null,source,state);
    raise exception 'Duplicate creation accepted';
  exception when serialization_failure then null;
  end;
  update public.tasks set title = 'Changed' where id = task;
  begin
    perform public.v2_save_plan(day,plan_revision,source,state);
    raise exception 'Stale source accepted';
  exception when serialization_failure then null;
  end;
  begin
    update public.v2_plans set state = '{}'::jsonb where plan_date = day;
    raise exception 'Direct plan update accepted';
  exception when insufficient_privilege then null;
  end;
  today_revision := public.v2_save_plan(today,null,public.v2_plan_source(today),
    state || jsonb_build_object('date',today,'sessions','[]'::jsonb,'window',
      jsonb_build_object('startAt',public.planning_instant(today + time '08:00','Asia/Tokyo'),
        'endAt',public.planning_instant(today + time '23:00','Asia/Tokyo'))));
  perform public.replace_daily_plan(today,'Asia/Tokyo','V1 local fixture','[]'::jsonb);
  if not exists (select 1 from public.v2_plans where plan_date=today and v2_plans.revision=today_revision) then
    raise exception 'V1 save affected V2';
  end if;
  insert into public.v2_events (plan_date,title,kind,start_at,end_at)
    values(day,'Fixture','fixed',first_start,first_end);
end;
$$;
select set_config('request.jwt.claim.sub', '532b30af-b48b-4a67-ac03-4fc8b467fa93', true);
do $$
begin
  if exists (select 1 from public.v2_plans) or exists (select 1 from public.v2_events) then
    raise exception 'Cross-user read accepted';
  end if;
end;
$$;
set local role anon;
do $$
begin
  begin
    perform * from public.v2_plans;
    raise exception 'Anonymous plan read accepted';
  exception when insufficient_privilege then null;
  end;
end;
$$;
rollback;
