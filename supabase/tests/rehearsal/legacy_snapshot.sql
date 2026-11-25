-- Compare this output byte for byte before and after applying the eight migrations.
select 'account', id::text, email from auth.users where id::text like 'fe280001-%'
union all select 'goal', id::text, to_jsonb(g)::text from public.goals g where id::text like 'fe280002-%'
union all select 'task', id::text, (to_jsonb(t) - array['deadline_local','recurrence','recurrence_days'])::text from public.tasks t where id::text like 'fe280003-%'
union all select 'plan', id::text, to_jsonb(p)::text from public.daily_plans p where id::text like 'fe280004-%'
union all select 'action', id::text, to_jsonb(a)::text from public.planned_actions a where id::text like 'fe280005-%'
union all select 'history', id::text, to_jsonb(l)::text from public.activity_logs l where planned_action_id::text like 'fe280005-%'
order by 1, 2;
