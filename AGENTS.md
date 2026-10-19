
- Training files (`training/<role_key>/`) and attendance selfies (420px JPEG) live in private storage with short-lived signed links.
- Mixed-window charter statuses load via `batch_period_statuses(jsonb)` in one request — no per-window fan-out.
- Approvals (payroll, onboarding, `approval_requests`) follow `workflow_steps` via `workflow_step_matches` (named people/department override role); sensitive employee fields change only through `approval_decide` — approvers stay configurable.
- Login OTP SMS is sent and verified by the MSG91 OTP Widget in the browser — server sends get held (211).
- CRM: `crm_*` gated by `current_user_can_crm()`; prospects convert via `OrgUnitChain` into a pending contract draft — Client Contracts holds contracts only.
- "View as user" mints the target session server-side (`startImpersonation`, super-admin verified), admin session kept in localStorage `radiant.impersonator`, sign-out `scope: "local"` — real RLS views.
- Recruitment: `rec_*` gated by `current_user_can_recruit()`; `rec_onboard_candidate` inserts into `candidates` so one employee ID series is used.
- Dashboard profitability is unit-level: invoice minus earned gross and employer contribution, posted values overriding computed ones.
- Effective permissions resolve employee > designation-in-dept > designation > department (`access_overrides`) > role_permissions via `current_user_effective_permissions()`; `prevent_hr_contract_mutation` enforces contracts sub-modules — nothing role-hardcoded.
- Attendance/payroll/invoice actions (mark, upload, submit, approve, reopen, amend, process, finalise, upload_tally) are RBAC sub-modules via `canAction` / `current_user_explicit_permission`; explicit action row wins, else module grant (payroll approve/process also accept Workflow Manager approvers).
- Master-data tables carry an `rbac_guard` trigger (`enforce_rbac_table_permission(module, sub)`) that refuses writes only when Access Control explicitly withholds Edit/Delete — new master tables should get the same trigger.
- RLS helper functions for modules (inventory, organizations, recruitment, CRM) must read Access Control via `current_user_module_access()`, never a fixed role list or the raw role matrix.
- Unit reach for attendance is the `attendance::all_units` switch, else the person's unit/customer/site mapping; admin = admin/super_admin role only (no hard-coded phones) — scope and admin status stay data-driven.
- Dashboard widgets are `dashboard::w_*` sub-modules checked via `canWidget`; no row = visible (still gated by the data module), an explicit role/department/designation/employee row decides — new dashboard sections should get a widget key.
- Server privileged DB access uses `supabaseAdmin` from `@/lib/radiant-admin.server`, not generated `client.server` — deploy build can bake preview env.
- Contract expiry alerts run daily via cron `contract-expiry-alerts` (`send_contract_expiry_alerts()`), recipients decided by `contracts::expiry_alerts` (no row = Contracts view).
- Exports gated by `<module>::export` via `canExport` (ExportChooser) — one switch per module.
- Console users land on their dashboard without module grants; team cards gated by dashboard::w_team_clients.
- Audit trigger `zz_audit` (`audit_row_change(module)`) logs to `system_logs` (actor filled by `system_logs_fill_actor`) — add it to new important tables.

<!-- LOVABLE:BEGIN -->
- Shared dashboard values use TileNumber to fit complete numbers to measured width; all dashboards reuse one TasksSummaryTile to keep summaries consistent.
- Pay-item displays/grouping use `pay-item-names`; preserve raw rate/formula lines so naming cannot change calculations.
<!-- LOVABLE:END -->
- Access Control/Workflow Manager: Super Admin + `GOVERNANCE_ROLES` only — governance stays with leadership.
- Payroll day base edits re-shape recent unprocessed attendance (trigger `zz_contract_resources_rebalance_attendance`, limit-made ED flagged `ed_from_cap`).
- Case Desk: `legal_*` tables + private `legal-docs` gated by `current_user_module_access('legal_cases',…)`; sub-features are `legal_cases::<key>` switches via `canSwitch` (row wins, else View) — access stays configurable.
- Never add high-volume tables (attendance_entries, punches) to realtime or page-wide invalidation — listen to status tables (attendance_sheets, payroll_runs) — per-row streams overloaded the database.
- Non-billable staff may hold billable secondary postings (non-reliever `candidate_units` row, billable designation) → on that unit's attendance/payroll/invoice; FO-designation lines hidden at client units; access = union via `current_user_effective_permissions`.
- Data queries wait for a real session (`useHasSupabaseSession`/`supabaseSessionReady`); root refetches all on `onSessionRecovered` — gap queries return zeros.
- List/picker search uses `matchesSearch` / `serverSearchWords` from `src/lib/search-match.ts` (any word order, case-insensitive, phone digits) with `useDeferredValue` on large lists — one consistent search behaviour.
- Subdirectories (`src/lib/`, `src/routes/`, `src/components/`) have their own `AGENTS.md` — read before changing files there.
- Root restores cache and clears old identities before mounting pages (details in src/lib/AGENTS.md) — no cross-session data bleed.
