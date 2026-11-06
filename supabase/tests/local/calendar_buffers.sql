-- Run only against an isolated local database after all migrations. Fixtures roll back.
begin;
insert into auth.users (id, email) values
  ('87000000-0000-4000-8000-000000000001', 'buffer-a@example.invalid'),
  ('87000000-0000-4000-8000-000000000002', 'buffer-b@example.invalid');

do $$
begin
  if (select count(*) from public.profiles where id in ('87000000-0000-4000-8000-000000000001','87000000-0000-4000-8000-000000000002') and calendar_buffer_before_minutes = 0 and calendar_buffer_after_minutes = 0) <> 2 then
    raise exception 'Expected zero defaults';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass) then raise exception 'RLS missing'; end if;
  if has_table_privilege('anon','public.profiles','SELECT') then raise exception 'Anonymous access'; end if;
  if not has_column_privilege('authenticated','public.profiles','calendar_buffer_before_minutes','UPDATE') then raise exception 'Missing authenticated grant'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub', '87000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"87000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$
begin
  if (select count(*) from public.profiles) <> 1 then raise exception 'Owner select isolation failed'; end if;
  update public.profiles set calendar_buffer_before_minutes=240, calendar_buffer_after_minutes=15 where id='87000000-0000-4000-8000-000000000001';
  if not exists (select 1 from public.profiles where calendar_buffer_before_minutes=240 and calendar_buffer_after_minutes=15) then raise exception 'Save/read failed'; end if;
  update public.profiles set calendar_buffer_after_minutes=90 where id='87000000-0000-4000-8000-000000000002';
  if found then raise exception 'Cross-user update allowed'; end if;
  begin
    update public.profiles set calendar_buffer_before_minutes=-1;
    raise exception 'Negative buffer accepted';
  exception when check_violation then null; end;
  begin
    update public.profiles set calendar_buffer_after_minutes=241;
    raise exception 'Out-of-range buffer accepted';
  exception when check_violation then null; end;
  begin
    update public.profiles set calendar_buffer_before_minutes=null;
    raise exception 'Null buffer accepted';
  exception when not_null_violation then null; end;
end $$;
reset role;
do $$
begin
  if not exists (select 1 from public.profiles where id='87000000-0000-4000-8000-000000000002' and calendar_buffer_before_minutes=0 and calendar_buffer_after_minutes=0) then raise exception 'Other owner settings changed'; end if;
end $$;
rollback;
