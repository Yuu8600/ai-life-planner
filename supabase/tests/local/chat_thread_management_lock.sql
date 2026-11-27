-- The runner holds this user's reservation lock in another connection.
begin;
set local statement_timeout='750ms';
insert into auth.users(id,email) values ('fe2c0010-0000-4000-8000-000000000001','phase2-thread-lock@example.test');
insert into public.v2_threads(id,user_id,title) values ('fe2c0011-0000-4000-8000-000000000001','fe2c0010-0000-4000-8000-000000000001','Locked');
set local role authenticated;
select set_config('request.jwt.claim.sub','fe2c0010-0000-4000-8000-000000000001',true);
do $$ begin
 begin
  delete from public.v2_threads where id='fe2c0011-0000-4000-8000-000000000001';
  raise exception 'Concurrent reservation lock was ignored';
 exception when object_not_in_prerequisite_state then null;
 end;
 if not exists(select from public.v2_threads where id='fe2c0011-0000-4000-8000-000000000001') then raise exception 'Thread lost during reservation'; end if;
end $$;
rollback;
