-- Live field-officer tracking: stream telemetry + track points over realtime.
alter table public.self_attendance_punches replica identity full;
alter table public.field_track_points replica identity full;
do $$
begin
  begin
    alter publication supabase_realtime add table public.field_track_points;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.self_attendance_punches;
  exception when duplicate_object then null;
  end;
end $$;
