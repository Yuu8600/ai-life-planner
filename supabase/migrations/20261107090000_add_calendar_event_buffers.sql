begin;

alter table public.profiles
  add column calendar_buffer_before_minutes integer not null default 0,
  add column calendar_buffer_after_minutes integer not null default 0,
  add constraint profiles_calendar_buffer_before_range
    check (calendar_buffer_before_minutes between 0 and 240),
  add constraint profiles_calendar_buffer_after_range
    check (calendar_buffer_after_minutes between 0 and 240);

-- Existing table-level grants and owner-scoped RLS policies apply to the new columns.
commit;
