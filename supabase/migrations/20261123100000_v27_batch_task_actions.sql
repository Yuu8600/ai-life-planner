begin;

create function public.v27_undo_daily_results(p_date date, p_items jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  item record;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Invalid selections' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) = 0 then
    raise exception 'No selected records' using errcode = '22023';
  end if;

  -- Reuse the single-record lock, local date check and Task/step restoration.
  for item in select * from jsonb_to_recordset(p_items) as selected(kind text, id uuid, expected text)
  loop
    perform public.undo_recommendation_result(p_date, item.kind, item.id, item.expected);
  end loop;
end;
$$;

create function public.v27_delete_completed_tasks(p_ids uuid[])
returns void language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := auth.uid();
  removed integer;
begin
  if uid is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if coalesce(cardinality(p_ids), 0) = 0 then
    raise exception 'No selected tasks' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 25));
  delete from public.tasks where user_id = uid and id = any(p_ids) and status = 'completed';
  get diagnostics removed = row_count;
  if removed <> cardinality(p_ids) then
    raise exception 'Completed task selection changed' using errcode = '40001';
  end if;
end;
$$;

revoke all on function public.v27_undo_daily_results(date, jsonb), public.v27_delete_completed_tasks(uuid[])
  from public, anon, authenticated, service_role;
grant execute on function public.v27_undo_daily_results(date, jsonb), public.v27_delete_completed_tasks(uuid[])
  to authenticated;

commit;
