-- Per-day attendance rows are high-volume; streaming them through realtime made
-- the database decode and access-check every write for every open session.
ALTER PUBLICATION supabase_realtime DROP TABLE public.attendance_entries;
