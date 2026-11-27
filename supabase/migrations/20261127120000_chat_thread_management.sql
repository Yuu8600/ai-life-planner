begin;

-- Metadata only: existing conversations retain their last message timestamp.
alter table public.v2_threads add column updated_at timestamptz;
update public.v2_threads t set updated_at = greatest(t.created_at,
  coalesce((select max(m.created_at) from public.v2_messages m where m.thread_id=t.id), t.created_at));
alter table public.v2_threads alter column updated_at set default now(),
  alter column updated_at set not null;

create function public.touch_chat_thread() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end $$;
revoke all on function public.touch_chat_thread() from public, anon, authenticated;
create trigger touch_chat_thread before update on public.v2_threads
  for each row execute function public.touch_chat_thread();

create function public.touch_chat_thread_from_message() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.v2_threads set updated_at=clock_timestamp()
    where id=new.thread_id and user_id=new.user_id;
  return new;
end $$;
revoke all on function public.touch_chat_thread_from_message() from public, anon, authenticated;
create trigger touch_chat_thread_from_message after insert on public.v2_messages
  for each row execute function public.touch_chat_thread_from_message();

-- Match the AI reservation lock without waiting while holding the deleted row lock.
create function public.guard_chat_thread_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not pg_try_advisory_xact_lock(hashtextextended(old.user_id::text, 3)) then
    raise exception 'AI request in progress' using errcode='55000';
  end if;
  if exists (select 1 from public.v2_ai_usage where user_id=old.user_id
    and result='pending' and created_at > now()-interval '2 minutes') then
    raise exception 'AI request in progress' using errcode='55000';
  end if;
  return old;
end $$;
revoke all on function public.guard_chat_thread_delete() from public, anon, authenticated;
create trigger guard_chat_thread_delete before delete on public.v2_threads
  for each row execute function public.guard_chat_thread_delete();

grant update (title), delete on public.v2_threads to authenticated;
create policy v2_threads_rename_own on public.v2_threads for update to authenticated
  using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy v2_threads_delete_own on public.v2_threads for delete to authenticated
  using (user_id=(select auth.uid()));

commit;
