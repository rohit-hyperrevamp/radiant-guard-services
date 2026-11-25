-- PERF: remove high-volume tables from the supabase_realtime publication.
--
-- AGENTS.md: "Never add high-volume tables (attendance_entries, punches) to
-- realtime or page-wide invalidation — listen to status tables
-- (attendance_sheets, payroll_runs) — per-row streams overloaded the database."
-- Every row change on a published table is decoded from WAL and checked against
-- every subscriber's RLS, whether or not anyone listens.
--
-- Publication before: attendance_sheets, branches, candidate_units, candidates,
-- employee_scope_assignments, field_track_points, field_visit_requests,
-- inv_caps, payroll_runs, self_attendance_punches, units.
--
-- Dropped, with the client decision for each (same commit as this file):
--   * field_track_points — GPS breadcrumbs, the highest-volume table. No client
--     code subscribes to it (OfficerDayMap, team, leaderboards, expenses read it
--     on demand / on their own poll). Nothing to switch.
--   * self_attendance_punches — every on-duty beacon updates a row ~every 30 s.
--     Subscribers switched:
--       - LiveFieldOfficersCard: realtime effect removed; useLiveFieldOfficers
--         already polls every 60 s.
--       - subscribeLivePunches (Field Sense "My team"): now a visible-tab poll
--         every 30 s (same cadence as the old throttle; the page also polls 15 s).
--       - Expense manager: punch listener removed, dataQ polls every 60 s
--         (field_visits listener kept).
--   * candidates — ~all HR edits, imports, photo/thumb writes.
--     Subscriber switched: Inventory caps field-officer list polls every 5 min.
--   * candidate_units — postings; bulk imports write thousands of rows.
--     Subscribers switched:
--       - use-fo-unit-scope: candidate_units listener removed, its query polls
--         every 5 min (employee_scope_assignments listener kept).
--       - Field dashboard: listener removed, base query polls every 5 min
--         (scope-assignment and units listeners kept).
--       - ContractDesignationFollowUp: listener removed; counts already poll
--         every 5 min.
--
-- Kept (low volume / status tables): attendance_sheets, payroll_runs, branches,
-- employee_scope_assignments, field_visit_requests, inv_caps, units.
--
-- RISK: LOW. Affected screens refresh on a 30 s – 5 min poll instead of push.
-- Clients still holding a postgres_changes listener on a dropped table simply
-- stop receiving events (no error).
--
-- VERIFY:
--   SELECT tablename FROM pg_publication_tables
--   WHERE pubname = 'supabase_realtime' AND schemaname = 'public' ORDER BY 1;
--   -- expect: attendance_sheets, branches, employee_scope_assignments,
--   --         field_visit_requests, inv_caps, payroll_runs, units
--
-- ROLLBACK (re-adds a table; run per table):
--   ALTER PUBLICATION supabase_realtime ADD TABLE public.self_attendance_punches;
--   ALTER PUBLICATION supabase_realtime ADD TABLE public.candidates;
--   ALTER PUBLICATION supabase_realtime ADD TABLE public.candidate_units;
--   ALTER PUBLICATION supabase_realtime ADD TABLE public.field_track_points;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['field_track_points', 'self_attendance_punches', 'candidates', 'candidate_units'] LOOP
    IF EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
