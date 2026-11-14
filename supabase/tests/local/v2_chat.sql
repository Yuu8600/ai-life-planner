begin;
insert into auth.users (id) values
 ('87210bb9-01d7-4628-9899-29aca81df742'), ('532b30af-b48b-4a67-ac03-4fc8b467fa93');
set local role authenticated;
select set_config('request.jwt.claim.sub', '87210bb9-01d7-4628-9899-29aca81df742', true);
insert into public.v2_threads (title) values ('Fixture');
reset role;
do $$
declare
  owner_id uuid := '87210bb9-01d7-4628-9899-29aca81df742';
  thread uuid := (select id from public.v2_threads where user_id=owner_id);
  request_id uuid := gen_random_uuid();
begin
  if not public.v2_reserve_ai(request_id,owner_id,thread,'mock',400000,'test') then
    raise exception 'Reservation should pass';
  end if;
  begin
    perform public.v2_reserve_ai(gen_random_uuid(),owner_id,thread,'mock',1,'test');
    raise exception 'Concurrent reservation accepted';
  exception when object_not_in_prerequisite_state then null;
  end;
  perform public.v2_finish_ai(request_id,owner_id,thread,'reply',
    '[{"key":"g","kind":"goal","title":"Goal","priority":"medium"},{"key":"t","kind":"task","title":"Task","priority":"high","minutes":30,"goalKey":"g"}]'::jsonb,
    400000,1,1);
  if public.v2_reserve_ai(gen_random_uuid(),owner_id,thread,'mock',100001,'test') then
    raise exception 'Excess budget accepted';
  end if;
end;
$$;
set local role authenticated;
select set_config('request.jwt.claim.sub', '532b30af-b48b-4a67-ac03-4fc8b467fa93', true);
do $$
begin
  if exists (select 1 from public.v2_drafts)
    or exists (select 1 from public.v2_threads)
    or exists (select 1 from public.v2_messages)
    or exists (select 1 from public.v2_ai_usage) then
    raise exception 'Cross-user read accepted';
  end if;
end;
$$;
select set_config('request.jwt.claim.sub', '87210bb9-01d7-4628-9899-29aca81df742', true);
do $$
declare draft public.v2_drafts%rowtype;
begin
  begin
    update public.v2_ai_usage set cost_micros=0;
    raise exception 'Usage bypass accepted';
  exception when insufficient_privilege then null;
  end;
  select * into draft from public.v2_drafts;
  if exists(select 1 from public.goals) or exists(select 1 from public.tasks) then
    raise exception 'Draft wrote domain data before approval';
  end if;
  begin
    perform public.v2_approve_draft(draft.id,gen_random_uuid(),array['g','t']);
    raise exception 'Old draft revision accepted';
  exception when serialization_failure then null;
  end;
  begin
    perform public.v2_approve_draft(draft.id,draft.revision,array['t']);
    raise exception 'Task accepted without required Goal';
  exception when raise_exception then
    if sqlerrm <> 'Select the linked Goal' then raise; end if;
  end;
  if not public.v2_approve_draft(draft.id,draft.revision,array['g','t'])
    or public.v2_approve_draft(draft.id,draft.revision,array['g','t']) then
    raise exception 'Draft is not idempotent';
  end if;
  if (select count(*) from public.tasks t join public.goals g on g.id=t.goal_id) <> 1 then
    raise exception 'Goal Task linkage not saved';
  end if;
end;
$$;
rollback;
