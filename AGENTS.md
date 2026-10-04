
- Training files live in the private `training` storage bucket (path `<role_key>/<file>`); `training_modules` holds metadata only and files open via short-lived signed links — keeps the database small and fast.
- Attendance selfies remain private object-storage files and are compressed client-side to 420px JPEG thumbnails before upload — keeps punch capture fast and storage small.
- Mixed-window charter statuses load via `batch_period_statuses(jsonb)` in one request — no per-window fan-out.
- Site-grain MIS exports group by unit, designation, billing rate — keeps contract lines separate.
- Payroll approval is role-based: workflow_steps.approver_role_key='payroll' (approver_candidate_id only when a step must be a named person) — approvals follow the team, not an individual.
- Login OTP send and verification run server-side through MSG91, with the Lovable deployment as the credentialed relay for the production shell — prevents employee office IPs from being blocked by provider IP controls.
- Sales & Marketing CRM lives in `crm_*` tables gated by `current_user_can_crm()` (Super Admin + `sales_marketing` RBAC module); prospects convert via the org → unit → contract chain (`OrgUnitChain`) into a pending-approval contract draft — Client Contracts holds contracts only.
- Super Admin "View as user" mints the target's session server-side (`startImpersonation`, super-admin verified per call) and stashes the admin session in localStorage `radiant.impersonator`; impersonated sign-out is always `scope: "local"` — so the admin sees real RLS-scoped views without touching the employee's own sessions.
- Recruitment uses `rec_*` tables gated by `current_user_can_recruit()`; `rec_onboard_candidate` (approvers from workflow `recruitment_onboarding`) inserts into `candidates` so `set_employee_code` issues the ID — one ID series.
- Recruitment interview lists include assigned interviews and recruiter-created interviews; HR holds recruitment RBAC, while assigned interviewers get assignment-scoped candidate access and leadership uses a summary RPC — keeps access narrow and auditable.
- Dashboard profitability is unit-level and live: invoice minus earned gross and employer contribution, with posted invoice/payroll values overriding computed attendance values — keeps P&L aligned with operational records.

- Contract rate changes are versioned in `contract_rate_revisions` (new_rate → approved with applicable date → previous expired); payroll/invoice resolve rates per period via `applyRateRevisionsForPeriod`, splitting by calendar days mid-period, and a daily job promotes due rates onto `contract_resources` — past periods keep old rates.
