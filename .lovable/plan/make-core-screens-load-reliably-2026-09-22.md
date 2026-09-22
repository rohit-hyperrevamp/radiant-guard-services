# Make core screens load reliably

## Outcome
Dashboard, Clients, Contracts, Employees, Attendance, Payroll, and Invoicing will stop waiting indefinitely, avoid duplicate/oversized requests, and recover visibly when production data is temporarily slow.

## Changes
- Make sign-in restoration time-bounded so the app can never remain on the opening spinner forever; use the live signed-in identity as the source of truth and clear stale role data when identity changes.
- Replace the repeated browser-side Field Officer reporting-tree walk with one production database scope summary, shared by managers, branch managers, and Field Officers.
- Add bounded request handling and retry states to shared data loading so a stalled request becomes a clear retry action rather than a blank or permanently loading screen.
- Stabilize query keys and remove the full-cache refresh after sign-in, preventing duplicate bursts and role-dependent refetch loops.
- Make Employees load in controlled pages rather than launching every full-table page together; paginate remaining large lookups instead of relying on silent row limits.
- Optimize the production Attendance charter and dashboard summary functions and add supporting indexes based on measured production query plans.
- Flatten Payroll and Invoice detail waterfalls, share cached master lookups, isolate their cache keys, and show recoverable errors.
- Narrow live-update refreshes to the affected screen and period so one attendance change does not reload unrelated Payroll and Invoice data.
- Preserve all current RBAC, Field Officer scope, payroll-window rules, and existing business calculations.

## Technical details
- Production-only SQL is stored under `db/prod-migrations/` and applied to the Radiant production database.
- No schema writes will be made through sandbox database tools.
- No native push or mobile bridge files will be touched.

## Verification
- Measure the revised production database functions and compare them with the current baselines.
- Run `bunx tsgo --noEmit`.
- Verify the live production URLs for representative admin and scoped-user paths where an authenticated session is available.
