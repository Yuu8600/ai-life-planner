begin;
insert into auth.users(id,email) values
 ('fe2c0000-0000-4000-8000-000000000001','phase2-thread-owner@example.test'),
 ('fe2c0000-0000-4000-8000-000000000002','phase2-thread-other@example.test');
insert into public.v2_threads(id,user_id,title,updated_at) values
 ('fe2c0001-0000-4000-8000-000000000001','fe2c0000-0000-4000-8000-000000000001','Owner','2000-01-01'),
 ('fe2c0001-0000-4000-8000-000000000002','fe2c0000-0000-4000-8000-000000000002','Other','2000-01-01');
insert into public.v2_messages(thread_id,user_id,role,body) values
 ('fe2c0001-0000-4000-8000-000000000001','fe2c0000-0000-4000-8000-000000000001','assistant','Advice');
insert into public.v2_drafts(id,thread_id,user_id,items,approved_at) values
 ('fe2c0002-0000-4000-8000-000000000001','fe2c0001-0000-4000-8000-000000000001','fe2c0000-0000-4000-8000-000000000001','[{"key":"task","kind":"task","title":"Saved task"}]',now());
insert into public.tasks(id,user_id,title,estimated_minutes,priority,status) values
 ('fe2c0003-0000-4000-8000-000000000001','fe2c0000-0000-4000-8000-000000000001','Saved task',10,'medium','pending');
insert into public.recommendation_policies(id,user_id,policy_kind,start_date,end_date,source_draft_id,draft_key) values
 ('fe2c0004-0000-4000-8000-000000000001','fe2c0000-0000-4000-8000-000000000001','prefer_short',current_date,current_date,'fe2c0002-0000-4000-8000-000000000001','policy');
insert into public.v26_task_edit_receipts(draft_id,task_id,user_id,before_values,applied_revision) values
 ('fe2c0002-0000-4000-8000-000000000001','fe2c0003-0000-4000-8000-000000000001','fe2c0000-0000-4000-8000-000000000001','{}',now());
do $$ begin
 if (select updated_at from public.v2_threads where id='fe2c0001-0000-4000-8000-000000000001') <= '2000-01-01' then raise exception 'Message did not advance updated_at'; end if;
 if (select updated_at from public.v2_threads where id='fe2c0001-0000-4000-8000-000000000002') <> '2000-01-01' then raise exception 'Other thread timestamp changed'; end if;
 if has_table_privilege('anon','public.v2_threads','DELETE') or has_column_privilege('authenticated','public.v2_threads','user_id','UPDATE') or has_column_privilege('authenticated','public.v2_threads','updated_at','UPDATE') then raise exception 'Excess thread privileges'; end if;
 if has_function_privilege('authenticated','public.guard_chat_thread_delete()','EXECUTE') or has_function_privilege('anon','public.touch_chat_thread_from_message()','EXECUTE') then raise exception 'Trigger function exposed'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','fe2c0000-0000-4000-8000-000000000001',true);
do $$ declare affected integer; stamp timestamptz; begin
 select updated_at into stamp from public.v2_threads where id='fe2c0001-0000-4000-8000-000000000001';
 update public.v2_threads set title='Renamed' where id='fe2c0001-0000-4000-8000-000000000001';
 get diagnostics affected=row_count;
 if affected<>1 or (select updated_at from public.v2_threads where id='fe2c0001-0000-4000-8000-000000000001') <= stamp then raise exception 'Own rename did not update timestamp'; end if;
 update public.v2_threads set title='Forbidden' where id='fe2c0001-0000-4000-8000-000000000002';
 get diagnostics affected=row_count; if affected<>0 then raise exception 'Cross-user rename accepted'; end if;
 delete from public.v2_threads where id='fe2c0001-0000-4000-8000-000000000002';
 get diagnostics affected=row_count; if affected<>0 then raise exception 'Cross-user deletion accepted'; end if;
 begin update public.v2_threads set user_id='fe2c0000-0000-4000-8000-000000000002' where id='fe2c0001-0000-4000-8000-000000000001'; raise exception 'Owner mutation accepted'; exception when insufficient_privilege then null; end;
 begin update public.v2_threads set updated_at='2000-01-01' where id='fe2c0001-0000-4000-8000-000000000001'; raise exception 'Timestamp mutation accepted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
insert into public.v2_ai_usage(id,user_id,model,month,reserved_micros) values
 ('fe2c0005-0000-4000-8000-000000000001','fe2c0000-0000-4000-8000-000000000001','fixture',date_trunc('month',now())::date,1);
set local role authenticated;
select set_config('request.jwt.claim.sub','fe2c0000-0000-4000-8000-000000000001',true);
do $$ begin
 begin delete from public.v2_threads where id='fe2c0001-0000-4000-8000-000000000001'; raise exception 'In-flight AI deletion accepted'; exception when object_not_in_prerequisite_state then null; end;
 if not exists(select from public.v2_threads where id='fe2c0001-0000-4000-8000-000000000001') then raise exception 'Pending thread lost'; end if;
end $$;
reset role;
update public.v2_ai_usage set result='failed' where id='fe2c0005-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','fe2c0000-0000-4000-8000-000000000001',true);
delete from public.v2_threads where id='fe2c0001-0000-4000-8000-000000000001';
reset role;
do $$ begin
 if exists(select from public.v2_threads where id='fe2c0001-0000-4000-8000-000000000001') or exists(select from public.v2_messages where user_id='fe2c0000-0000-4000-8000-000000000001') or exists(select from public.v2_drafts where id='fe2c0002-0000-4000-8000-000000000001') or exists(select from public.v26_task_edit_receipts where draft_id='fe2c0002-0000-4000-8000-000000000001') then raise exception 'Conversation history not removed'; end if;
 if not exists(select from public.tasks where id='fe2c0003-0000-4000-8000-000000000001') or not exists(select from public.recommendation_policies where id='fe2c0004-0000-4000-8000-000000000001' and source_draft_id is null) then raise exception 'Applied task or policy was lost'; end if;
 if not exists(select from public.v2_threads where id='fe2c0001-0000-4000-8000-000000000002' and title='Other') then raise exception 'Other conversation was lost'; end if;
end $$;
rollback;
