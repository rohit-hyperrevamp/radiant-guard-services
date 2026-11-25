# Review fixes, 25 Nov 2026: SQL migrations (written, NOT applied)

These migrations come from the security review (`Radiant-system-review-2026-11-25.md`, S1–S19) and the live test log (L1–L4, L18, L23, L31, plus A1/A2 and P4). None of them has been run against any database.

Every file follows the same rules:
- It is idempotent and wrapped in `BEGIN`/`COMMIT`.
- Its header says what it closes, which screens and roles it affects, a pre-check where one is needed, and how to verify it.
- A commented ROLLBACK block sits at the bottom.

Where a file changes policies or grants chosen at run time, it first saves the **live** state into the private schema `review_fix_202611`. Its rollback then restores exactly that state. This matters because the live database has drifted from the repo. Where a static repo definition exists, it is also quoted in the rollback.

Run the files in the SQL editor as `postgres`, in the order below, which is also filename order. Verify each one before moving to the next.

| # | File | Risk | Closes | Gate before applying |
|---|------|------|--------|----------------------|
| 1 | `20261125000000_review_fix_shared_helpers.sql` | LOW | Shared helpers: snapshot schema, `current_user_candidate_ids()`, `current_user_can_strict()` | none |
| 2 | `20261125000100_lock_backup_tables.sql` | LOW | L1 / S7: `_bkp_*` and `backup_*` tables readable by anon | none (apply now) |
| 3 | `20261125000200_revoke_anon_units_inventory.sql` | LOW | L2 / L3: anon can read units, inv_issuances, inv_goods_receipts | none. No public page reads them, so no view is needed |
| 4 | `20261125000300_next_contract_code.sql` | LOW | L31: contract approval broken | none. The app already calls `rpc('next_contract_code')` |
| 5 | `20261125000400_dirty_finance_totals_scoped.sql` | LOW | L23 root cause, L14 class of bug | none |
| 6 | `20261125000500_secdef_function_exposure.sql` | LOW-MEDIUM | S14 | Smoke-test the Aadhaar rehire lookup, the Unit manager field-officer picker and the Uniform Caps reminders |
| 7 | `20261125000600_notifications_insert_guard.sql` | LOW | S11 (partly) | none |
| 8 | `20261125000700_payroll_snapshots_runs_rls.sql` | MEDIUM | S6 / L18: payroll | Run the role pre-check in the header |
| 9 | `20261125000800_master_tables_wages_write_rls.sql` | MEDIUM | S8, employee_wages | Pre-check Access Control grants: anyone editing masters without a grant loses access |
| 10 | `20261125000900_payroll_posting_additions_unit.sql` | LOW-MEDIUM | P4: additions lose unit_id | The app build that sends `unit_id` on every additions line must be deployed first |
| 11 | `20261125001000_self_punch_guardrails.sql` | MEDIUM | A1 / A2 | Test check-in/out with a day guard and a night guard |
| 12 | `20261125001100_candidate_files_private.sql` | HIGH (data) | S4 | Pre-check must return 0 stored public URLs (run `backfill-signed-urls` first) |
| 13 | `20261125001200_candidates_pii_column_revoke.sql` | HIGH (app) | S9 / L18: PII | **App changes below must be deployed first.** The file refuses to run without `SET radiant.confirm_pii_column_revoke = 'yes';` |

**LOW** = safe to apply now. **MEDIUM** = apply after the stated check. **HIGH** = needs an app or data change first.

## Important finding (check before anything else)

`dirty_finance_totals()` (from `20261124024500`) runs `UPDATE public.finance_period_totals ...` with **no WHERE** in two places. Live, that raised "UPDATE requires a WHERE clause", which means a safe-update guard is active. If so, every write to these tables currently fails, not just writes to `customers`:
- `payroll_run_snapshots` and `pt_site_allocations`, which payroll posting writes;
- every master table that falls into the ELSE branch (PT slabs, LWF, allowance types, cost components, day bases, attendance codes, public holidays, pincode ranges, addition types, contract rate revisions, final invoices).

File 5 fixes this. Please confirm live whether payroll posting has failed since 24 Nov.

The same bug remains in `dirty_finance_settings()`. It is not changed here because it was out of scope: toggling `payroll_esi_round_up` in `inv_settings` will fail the same way. The follow-up fix is to add `WHERE true` to its UPDATE.

## What to verify after each file

1. **Helpers:** `review_fix_202611` exists and `authenticated` has no USAGE on it.
2. **Backup tables:** the verification query in the header returns 0 rows. An anon REST call to a `_bkp_` table is denied.
3. **Anon revoke:** `has_table_privilege('anon','public.units','SELECT')` is false. Signed-in Clients and Uniform pages still load.
4. **Contract code:** `SELECT next_contract_code()` returns one above the live max. Approving PROS-0003/0004 now works.
5. **Finance totals:** the dry-run in the header bumps only windows that overlap the run. Creating an organisation works. Over the following days, finance "Pending" counts fall.
6. **SECURITY DEFINER functions:** the ACL query in the header matches. The cron jobs `promote-contract-rates` and `task-due-reminders` still succeed. The HR rehire prompt still appears.
7. **Notifications:** an insert with `actor_id` NULL is denied. Approvers still get onboarding and rehire notifications.
8. **Payroll RLS:** "View as" a guard shows only their own snapshots. A payroll user can still process. The dashboard still shows period badges.
9. **Master tables:** no write policy with `true` remains on the listed tables. A guard cannot update PT slabs. HR can still save wages.
10. **Payroll posting:** after processing an amendment, `additions.unit_id` is filled.
11. **Self punches:** a back-dated or foreign-unit punch is denied. A night guard can check out after midnight. A 12-hour guard gets P with 0 ED. Approved sheets are untouched.
12. **Storage:** the bucket is private. A guard cannot list files. HR documents still render through signed URLs. A guard can still upload their own profile photo.
13. **PII:** see the header. Guards get 42501 on the PII columns. HR gets values through `get_candidate_pii`.

## Rollback

Each file's rollback is at its bottom, commented out. Roll back in **reverse** order. Most rollbacks use the snapshots, through `review_fix_202611.restore_policies(...)` or the ACL loops. Roll back file 1 (the helpers, which drops the snapshot schema) **last**, and only once everything else is rolled back.

## App changes required before 20261125001200 (PII column revoke)

After this migration, any request by a signed-in user (browser, or a server function using the user's JWT) fails with 42501 if it does any of the following on `public.candidates`:
- names `aadhaar_number`, `pan_number`, `bank_account_number` or `bank_ifsc`;
- uses `select("*")`;
- uses `.insert/.update(...).select("*")`.

Writes stay allowed.

Each read below must be removed, or changed to fetch those four fields with `supabase.rpc('get_candidate_pii', { _candidate_ids: [...] })`:

**Explicit column reads:**
- `src/routes/admin.employees.tsx:1445`. This is the main list column string; it includes `aadhaar_number`. It is used for search (2638), the CSV export (2812/2837), the masked Aadhaar display (5861–5862) and entity labels (3019, 3807, 3864, 3950, 3959). **The whole Employees page breaks without this change.**
- `src/routes/admin.employees.tsx:3684`: the post-save refetch includes `aadhaar_number`.
- `src/routes/admin.profile.tsx:336`: own profile. Use the RPC with the user's own id.
- `src/components/StatutoryForms.tsx:47`
- `src/components/ComplianceTemplateEditor.tsx:62`
- `src/components/employee-documents-export-dialog.tsx:235`
- `src/lib/compliance.ts:133`
- `src/lib/company-documents.ts:369`
- `src/lib/employees.functions.ts:36`: a server function using `context.supabase`, which carries the user's JWT.
- `src/lib/payroll-engine.ts:132`: reads `bank_account_number` and `bank_ifsc` for the bank file and payslips.

**`select("*")` on candidates:**
- `src/routes/admin.employees.tsx:2870` (export), `:3117` (reactivation source), `:4003` (open record), `:7452` (pre-save read)
- `src/routes/admin.candidates.$id.details.tsx:191`

**Consumers of the rows above:** these keep working once their data source is changed.
- `src/lib/document-followup.ts:15-16`
- `src/lib/statutory-form-data.ts:26-27`
- `src/lib/compliance-autofill.ts`
- `src/components/EmployeeChangeRequest.tsx`
- `src/components/candidate-extra-sections.tsx:889-891`
- the employee form fields in `admin.employees.tsx` (6514–8387)

**Not affected:** these files read other tables or JSON, or run server-side as service role.
- `recruitment.ts`, `EmployeeDetailsDialog.tsx`, `admin.hr.recruitment.candidates.$recId.tsx`: read `rec_*` employee_details JSON.
- `admin.approvals.tsx`: labels only.
- `admin-data.ts`, `admin.contracts.client-contracts.tsx`, `OrgUnitChain.tsx`: `pan_number` of units/customers.
- `admin.org-settings.tsx`, `admin.invoice.$unitId.tsx`: org bank settings.
- `workflows.ts:160`: queries `rehire_requests`.
- `surepass.functions.ts`: queries `digilocker_sessions`.
- `backfill-signed-urls.functions.ts`: runs as admin.

Also note: columns added to `candidates` in future are not readable by `authenticated` until they are granted.

## Known gaps not closed by these files

- **S1–S3, S10, S12, S13, S15–S19** (login and OTP, email relay, impersonation, Access Control writes, public hooks): these need app changes, not SQL.
- **Signed-in guards still read data through `NOT current_user_has_branch_scope()` policies:**
  - all units;
  - `inv_issuances.otp_code`, and the OTP is checked in the browser (`admin.my-inventory.tsx:144`);
  - attendance, contracts and customers (L18).

  The fix is to replace "no branch scope = everything" with explicit Access Control checks, table by table. That needs a separate review.
- **Notifications:** an active employee can still send any text to any user, now always under their own name. The full fix is a server-side notify RPC, plus `push.functions.ts` only delivering pushes for notifications the caller sent.
- **Stored 10-year signed URLs** in candidate rows are bearer links. The follow-up is to store paths and sign short-lived links on demand.
- **Self punches:**
  - users whose location rule is `anywhere` (field officers by default) can still punch at any unit;
  - a later punch update can still overwrite a supervisor's correction on a draft sheet.
- **`next_contract_code()`** follows the app's prefix rule `^CON(\d+)`, zero-padded to 5 digits, rather than the stricter `^CON[0-9]+$`. That way the RPC and the app's fallback always agree.
