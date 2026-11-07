begin;
create table public.calendar_event_buffer_overrides (
  user_id uuid not null references public.profiles(id) on delete cascade,
  calendar_id text not null check (length(calendar_id) > 0),
  event_id text not null check (length(event_id) > 0),
  occurrence_start_at timestamptz not null check (isfinite(occurrence_start_at)),
  buffer_before_minutes integer not null check (buffer_before_minutes between 0 and 240),
  buffer_after_minutes integer not null check (buffer_after_minutes between 0 and 240),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, calendar_id, event_id, occurrence_start_at)
);
create trigger calendar_event_buffers_updated_at before update on public.calendar_event_buffer_overrides
for each row execute function public.set_updated_at();
alter table public.calendar_event_buffer_overrides enable row level security;
revoke all on public.calendar_event_buffer_overrides from public, anon, authenticated;
grant select, insert, update, delete on public.calendar_event_buffer_overrides to authenticated;
grant all on public.calendar_event_buffer_overrides to service_role;
create policy overrides_select_own on public.calendar_event_buffer_overrides for select to authenticated using ((select auth.uid()) = user_id);
create policy overrides_insert_own on public.calendar_event_buffer_overrides for insert to authenticated with check ((select auth.uid()) = user_id);
create policy overrides_update_own on public.calendar_event_buffer_overrides for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy overrides_delete_own on public.calendar_event_buffer_overrides for delete to authenticated using ((select auth.uid()) = user_id);
commit;
