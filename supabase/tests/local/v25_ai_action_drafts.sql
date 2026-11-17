begin;

insert into auth.users(id, email) values
  ('fe250000-0000-4000-8000-000000000010', 'v25-ai-a@example.test'),
  ('fe250000-0000-4000-8000-000000000020', 'v25-ai-b@example.test');
insert into public.goals(id, user_id, title, priority, status) values
  ('fe250003-0000-4000-8000-000000000010', 'fe250000-0000-4000-8000-000000000010', 'Goal', 'medium', 'active');
insert into public.tasks(id, user_id, title, priority, status) values
  ('fe250001-0000-4000-8000-000000000010', 'fe250000-0000-4000-8000-000000000010', 'Parent', 'medium', 'pending'),
  ('fe250001-0000-4000-8000-000000000020', 'fe250000-0000-4000-8000-000000000020', 'Other owner', 'medium', 'pending');
insert into public.v2_threads(id, user_id, title) values
  ('fe250004-0000-4000-8000-000000000010', 'fe250000-0000-4000-8000-000000000010', 'Thread');
insert into public.v2_drafts(id, thread_id, user_id, revision, items)
select 'fe250005-0000-4000-8000-000000000010', 'fe250004-0000-4000-8000-000000000010',
  task.user_id, 'fe250006-0000-4000-8000-000000000010', jsonb_build_array(
    jsonb_build_object('key','step','kind','step','title','Approved step','taskId',task.id,'parentUpdatedAt',task.updated_at,'minutes',15),
    jsonb_build_object('key','optional','kind','step','title','Unselected','taskId',task.id,'parentUpdatedAt',task.updated_at),
    jsonb_build_object('key','task','kind','task','title','Goal action','goalId',goal.id,'parentUpdatedAt',goal.updated_at,'priority','high'),
    jsonb_build_object('key','update','kind','task','title','Renamed parent','targetId',task.id,'expectedUpdatedAt',task.updated_at,'priority','medium',
      'before',jsonb_build_object('title',task.title,'minutes',null,'priority',task.priority,'deadline',null))
  )
from public.tasks task join public.goals goal on goal.user_id=task.user_id
where task.id='fe250001-0000-4000-8000-000000000010';
insert into public.v2_drafts(id, thread_id, user_id, revision, items)
select 'fe250005-0000-4000-8000-000000000020', 'fe250004-0000-4000-8000-000000000010',
  'fe250000-0000-4000-8000-000000000010', 'fe250006-0000-4000-8000-000000000020',
  jsonb_build_array(jsonb_build_object('key','foreign','kind','step','title','Foreign','taskId',id,'parentUpdatedAt',updated_at))
from public.tasks where id='fe250001-0000-4000-8000-000000000020';

set local role authenticated;
select set_config('request.jwt.claim.sub', 'fe250000-0000-4000-8000-000000000010', true);
do $$
declare
  draft uuid := 'fe250005-0000-4000-8000-000000000010';
  rev uuid := 'fe250006-0000-4000-8000-000000000010';
begin
  if exists (select from public.action_steps) then raise exception 'Unapproved action persisted'; end if;
  if not public.v2_approve_draft(draft, rev, array['step','task','update']) then
    raise exception 'Draft not approved';
  end if;
  if public.v2_approve_draft(draft, rev, array['step','task','update']) then
    raise exception 'Draft approved again';
  end if;
  if (select count(*) from public.action_steps) <> 1
    or not exists (select from public.action_steps where title='Approved step' and estimated_minutes=15)
    or not exists (select from public.tasks where title='Goal action' and estimated_minutes is null
      and goal_id='fe250003-0000-4000-8000-000000000010')
    or not exists (select from public.tasks where title='Renamed parent' and estimated_minutes is null) then
    raise exception 'Wrong draft records persisted';
  end if;
  begin
    perform public.v2_approve_draft('fe250005-0000-4000-8000-000000000020',
      'fe250006-0000-4000-8000-000000000020', array['foreign']);
    raise exception 'Foreign parent accepted';
  exception when serialization_failure then null;
  end;
end $$;
rollback;
