-- Isolated local DB only. All fixtures and writes roll back.
begin;
insert into auth.users(id,email) values ('89000000-0000-4000-8000-000000000001','overnight-a@example.invalid'),('89000000-0000-4000-8000-000000000002','overnight-b@example.invalid');
-- Reproduce a legacy Plan without a saved window and verify the migration backfill preserves Actions.
insert into public.daily_plans(id,user_id,plan_date,timezone,summary) values ('89000000-0000-4000-8000-000000000010','89000000-0000-4000-8000-000000000001','2000-01-01','Asia/Tokyo','legacy');
insert into public.planned_actions(user_id,daily_plan_id,title,start_at,end_at,reason,status) values ('89000000-0000-4000-8000-000000000001','89000000-0000-4000-8000-000000000010','legacy Action','2000-01-01T14:00Z','2000-01-01T14:30Z','legacy','scheduled');
update public.daily_plans set window_start_at=plan_date::timestamp at time zone timezone, window_end_at=(plan_date+1)::timestamp at time zone timezone where window_start_at is null and window_end_at is null;
do $$ begin
if not exists(select 1 from public.daily_plans where id='89000000-0000-4000-8000-000000000010' and window_start_at='1999-12-31T15:00Z'::timestamptz and window_end_at='2000-01-01T15:00Z'::timestamptz) then raise exception 'Legacy backfill wrong'; end if;
if not exists(select 1 from public.planned_actions where daily_plan_id='89000000-0000-4000-8000-000000000010' and start_at='2000-01-01T14:00Z'::timestamptz and end_at='2000-01-01T14:30Z'::timestamptz) then raise exception 'Legacy Action changed'; end if;
if not exists(select 1 from public.profiles where id='89000000-0000-4000-8000-000000000001' and planning_end_day_offset=0 and planning_start='08:00' and planning_end='23:00') then raise exception 'Legacy defaults changed'; end if;
end $$;
do $$ begin
if public.planning_date('2026-11-07T16:59Z','Asia/Tokyo','09:00','02:00',1) <> '2026-11-07'::date then raise exception 'Pre-end planning date'; end if;
if public.planning_date('2026-11-07T17:00Z','Asia/Tokyo','09:00','02:00',1) <> '2026-11-08'::date then raise exception 'End planning date'; end if;
if public.planning_date('2026-12-31T16:00Z','Asia/Tokyo','09:00','02:00',1) <> '2026-12-31'::date then raise exception 'Year boundary'; end if;
if public.planning_date('2026-11-07T16:00Z','Asia/Tokyo','09:00','23:00',0) <> '2026-11-08'::date then raise exception 'Offset zero compatibility'; end if;
if public.planning_instant('2026-11-08 01:00','Asia/Tokyo') <> '2026-11-07T16:00Z'::timestamptz then raise exception 'UTC instant mismatch'; end if;
begin perform public.planning_instant('2026-03-08 02:30','America/New_York'); raise exception 'DST gap accepted'; exception when invalid_parameter_value then null; end;
begin perform public.planning_instant('2026-11-01 01:30','America/New_York'); raise exception 'DST fold accepted'; exception when invalid_parameter_value then null; end;
if has_function_privilege('anon','public.replace_daily_plan(date,text,text,jsonb,jsonb)','execute') then raise exception 'Anonymous new RPC'; end if;
if has_function_privilege('anon','public.replace_daily_plan_if_current(date,text,text,jsonb,jsonb,jsonb)','execute') then raise exception 'Anonymous guarded RPC'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','89000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"89000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
update public.profiles set timezone='UTC',planning_start='12:00',planning_end='11:00',planning_end_day_offset=1 where id=auth.uid();
do $$
declare date_value date; start_value timestamptz; end_value timestamptz; window_value jsonb; actions_value jsonb; saved_id uuid; first_id uuid; second_id uuid; snapshot_value jsonb;
begin
 date_value:=public.planning_date(clock_timestamp(),'UTC','12:00','11:00',1);
 start_value:=public.planning_instant(date_value+'12:00'::time,'UTC');
 end_value:=public.planning_instant((date_value+1)+'11:00'::time,'UTC');
 window_value:=jsonb_build_object('startAt',start_value,'endAt',end_value);
 actions_value:=jsonb_build_array(jsonb_build_object('task_id',null,'title','overnight complete','start_at',end_value-interval '2 hours','end_at',end_value-interval '90 minutes','reason','night'),jsonb_build_object('task_id',null,'title','overnight skip','start_at',end_value-interval '1 hour','end_at',end_value-interval '30 minutes','reason','night'));
 select daily_plan_id into saved_id from public.replace_daily_plan(date_value,'UTC','overnight',actions_value,window_value);
 if not exists(select 1 from public.daily_plans where id=saved_id and window_start_at=start_value and window_end_at=end_value) then raise exception 'Saved snapshot missing'; end if;
 if (select count(*) from public.planned_actions where daily_plan_id=saved_id) <> 2 then raise exception 'Actions missing'; end if;
 select id into first_id from public.planned_actions where daily_plan_id=saved_id and title='overnight complete';
 select id into second_id from public.planned_actions where daily_plan_id=saved_id and title='overnight skip';
 perform public.update_planned_action_status(first_id,'completed');
 perform public.update_planned_action_status(second_id,'skipped');
 if (select count(*) from public.activity_logs where plan_date=date_value) <> 2 then raise exception 'Log date incorrect'; end if;
 snapshot_value:=public.get_daily_plan_snapshot(date_value);
 begin perform * from public.replace_daily_plan(date_value+1,'UTC','bad date','[]',window_value); raise exception 'Wrong planning date accepted'; exception when invalid_parameter_value then null; end;
 begin perform * from public.replace_daily_plan(date_value,'Asia/Tokyo','bad timezone','[]',window_value); raise exception 'Wrong timezone accepted'; exception when invalid_parameter_value then null; end;
 begin perform * from public.replace_daily_plan(date_value,'UTC','wrong window','[]',jsonb_build_object('startAt',start_value,'endAt',end_value+interval '1 hour')); raise exception 'Wrong window accepted'; exception when invalid_parameter_value then null; end;
 begin perform * from public.replace_daily_plan(date_value,'UTC','out of bounds',jsonb_build_array(jsonb_build_object('task_id',null,'title','bad','start_at',end_value,'end_at',end_value+interval '1 hour','reason','bad')),window_value); raise exception 'Out of window accepted'; exception when invalid_parameter_value then null; end;
 -- Settings edits do not alter the already saved window or actions.
 update public.profiles set planning_start='13:00' where id=auth.uid();
 if not exists(select 1 from public.daily_plans where id=saved_id and window_start_at=start_value and window_end_at=end_value) then raise exception 'Saved Plan changed with Settings'; end if;
 begin perform * from public.replace_daily_plan(date_value,'UTC','stale window','[]',window_value); raise exception 'Stale window accepted'; exception when invalid_parameter_value then null; end;
 update public.profiles set planning_start='12:00' where id=auth.uid();
 perform * from public.replace_daily_plan_if_current(date_value,'UTC','replan','[]',snapshot_value,window_value);
 if (select count(*) from public.activity_logs where plan_date=date_value) <> 2 then raise exception 'Replan lost history'; end if;
 begin perform * from public.replace_daily_plan_if_current(date_value,'UTC','stale','[]',snapshot_value,window_value); raise exception 'Stale token accepted'; exception when sqlstate 'P5C01' then null; end;
 -- Both legacy signatures still resolve under the same owner guards.
 perform * from public.replace_daily_plan(date_value,'UTC','legacy','[]');
 begin update public.profiles set planning_end_day_offset=2 where id=auth.uid(); raise exception 'Invalid offset accepted'; exception when check_violation then null; end;
 begin update public.profiles set planning_start='09:00',planning_end='10:00',planning_end_day_offset=1 where id=auth.uid(); raise exception 'Over 24h accepted'; exception when check_violation then null; end;
 begin update public.profiles set planning_start='09:00',planning_end='09:00',planning_end_day_offset=0 where id=auth.uid(); raise exception 'Zero duration accepted'; exception when check_violation then null; end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','89000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"89000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$ begin
if exists(select 1 from public.daily_plans where user_id='89000000-0000-4000-8000-000000000001') then raise exception 'Cross-owner SELECT'; end if;
update public.daily_plans set summary='forged' where user_id='89000000-0000-4000-8000-000000000001';
if found then raise exception 'Cross-owner UPDATE'; end if;
end $$;
rollback;
