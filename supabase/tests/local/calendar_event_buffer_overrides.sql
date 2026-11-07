-- Isolated local DB only; all fixtures roll back.
begin;
insert into auth.users(id,email) values
('88000000-0000-4000-8000-000000000001','overrides-a@example.invalid'),
('88000000-0000-4000-8000-000000000002','overrides-b@example.invalid');
insert into public.calendar_event_buffer_overrides values ('88000000-0000-4000-8000-000000000002','cal','event','2026-11-06T10:00Z',15,30,now(),now());
do $$ begin
if not (select relrowsecurity from pg_class where oid='public.calendar_event_buffer_overrides'::regclass) then raise exception 'No RLS'; end if;
if has_table_privilege('anon','public.calendar_event_buffer_overrides','SELECT') or has_table_privilege('anon','public.calendar_event_buffer_overrides','INSERT') or has_table_privilege('anon','public.calendar_event_buffer_overrides','UPDATE') or has_table_privilege('anon','public.calendar_event_buffer_overrides','DELETE') then raise exception 'Anonymous grants'; end if;
if (not has_table_privilege('authenticated','public.calendar_event_buffer_overrides','SELECT') or not has_table_privilege('authenticated','public.calendar_event_buffer_overrides','INSERT') or not has_table_privilege('authenticated','public.calendar_event_buffer_overrides','UPDATE') or not has_table_privilege('authenticated','public.calendar_event_buffer_overrides','DELETE')) then raise exception 'Missing authenticated grant'; end if;
if (not has_table_privilege('service_role','public.calendar_event_buffer_overrides','SELECT') or not has_table_privilege('service_role','public.calendar_event_buffer_overrides','INSERT') or not has_table_privilege('service_role','public.calendar_event_buffer_overrides','UPDATE') or not has_table_privilege('service_role','public.calendar_event_buffer_overrides','DELETE')) then raise exception 'Missing service grant'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','88000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"88000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$ begin
if exists(select 1 from public.calendar_event_buffer_overrides) then raise exception 'Cross-user SELECT'; end if;
insert into public.calendar_event_buffer_overrides(user_id,calendar_id,event_id,occurrence_start_at,buffer_before_minutes,buffer_after_minutes) values ('88000000-0000-4000-8000-000000000001','cal','event','2026-11-06T10:00Z',0,240);
update public.calendar_event_buffer_overrides set buffer_after_minutes=15 where user_id='88000000-0000-4000-8000-000000000001';
if not exists(select 1 from public.calendar_event_buffer_overrides where buffer_before_minutes=0 and buffer_after_minutes=15) then raise exception 'Own save/read failed'; end if;
update public.calendar_event_buffer_overrides set buffer_after_minutes=0 where user_id='88000000-0000-4000-8000-000000000002';
if found then raise exception 'Cross-user UPDATE'; end if;
delete from public.calendar_event_buffer_overrides where user_id='88000000-0000-4000-8000-000000000002';
if found then raise exception 'Cross-user DELETE'; end if;
begin
insert into public.calendar_event_buffer_overrides(user_id,calendar_id,event_id,occurrence_start_at,buffer_before_minutes,buffer_after_minutes) values ('88000000-0000-4000-8000-000000000002','cal','forged','2026-11-06T10:00Z',0,0);
raise exception 'Forged INSERT'; exception when insufficient_privilege then null; end;
begin
update public.calendar_event_buffer_overrides set user_id='88000000-0000-4000-8000-000000000002';
raise exception 'Owner reassignment'; exception when insufficient_privilege then null; end;
begin
update public.calendar_event_buffer_overrides set buffer_before_minutes=-1;
raise exception 'Negative accepted'; exception when check_violation then null; end;
begin
update public.calendar_event_buffer_overrides set buffer_after_minutes=241;
raise exception 'Range accepted'; exception when check_violation then null; end;
begin
update public.calendar_event_buffer_overrides set buffer_before_minutes=null;
raise exception 'Null accepted'; exception when not_null_violation then null; end;
begin
insert into public.calendar_event_buffer_overrides(user_id,calendar_id,event_id,occurrence_start_at,buffer_before_minutes,buffer_after_minutes) values ('88000000-0000-4000-8000-000000000001','cal','event','2026-11-06T10:00Z',0,0);
raise exception 'Duplicate accepted'; exception when unique_violation then null; end;
-- Same recurring series, different occurrence is independent.
insert into public.calendar_event_buffer_overrides(user_id,calendar_id,event_id,occurrence_start_at,buffer_before_minutes,buffer_after_minutes) values ('88000000-0000-4000-8000-000000000001','cal','event','2026-11-07T10:00Z',0,0);
delete from public.calendar_event_buffer_overrides where occurrence_start_at='2026-11-06T10:00Z';
if (select count(*) from public.calendar_event_buffer_overrides) <> 1 then raise exception 'Own deletion failed'; end if;
end $$;
reset role;
do $$ begin
if not exists(select 1 from public.calendar_event_buffer_overrides where user_id='88000000-0000-4000-8000-000000000002' and buffer_before_minutes=15 and buffer_after_minutes=30) then raise exception 'Other user changed'; end if;
if not exists(select 1 from public.profiles where id='88000000-0000-4000-8000-000000000001' and calendar_buffer_before_minutes=0 and calendar_buffer_after_minutes=0) then raise exception 'Profile changed'; end if;
end $$;
delete from auth.users where id='88000000-0000-4000-8000-000000000001';
do $$ begin
if exists(select 1 from public.calendar_event_buffer_overrides where user_id='88000000-0000-4000-8000-000000000001') then raise exception 'Cascade cleanup failed'; end if;
end $$;
rollback;
