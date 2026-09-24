# Flexible attendance lines: designation, 8/12 hours, reliever, delete/edit

## What you'll get
On every attendance sheet that is still open (not approved/locked):

1. **Add Employee asks three things**
   - **Designation** — dropdown of the posts on this unit's contract (e.g. Security Guard, Supervisor). Only this unit's posts show first; others are listed under "not on contract".
   - **Duty length 8h / 12h** — shown only when that post exists at both 8 and 12 hours on this unit's contract.
   - **Regular or Reliever.**
2. **Same person on more than one line** — one person can be added again as a separate line, e.g.
   - Security Guard 8h (regular) and Security Guard 12h (regular), or
   - Security Guard 12h (regular) and Security Guard 12h (reliever / Extra Duty).
   Each line has its own day boxes, totals, billing rate and pay rate. Adding the exact same combination twice is blocked.
3. **Edit a line** — pencil on the row: change designation, 8/12 hours or regular/reliever. Saved days move with the line.
4. **Delete a line** — bin on the row, with a confirm box. Removes that line and its days for this period only. Other lines for the same person and other months stay.
5. **Locked sheets** — when attendance is approved, add/edit/delete are hidden.
6. Field Officers still only see and add people who report to them. Every add/edit/delete is written to System Logs.

## Rules kept
- A guard still has one main (primary) unit for payroll home. Extra lines at the same unit don't change that.
- Reliever lines record Extra Duty only.
- Invoice, Payroll and MIS pick the rate from each line's designation + 8/12 hours.

## Technical details
- Migration in `db/prod-migrations/`:
  - `candidate_units`: replace unique `(candidate_id, unit_id)` with unique `(candidate_id, unit_id, designation_id, shift_hours, is_reliever)` (NULLS NOT DISTINCT). Keep single-primary trigger working per candidate.
  - `attendance_entries`: add `shift_hours smallint` + `is_reliever boolean default false`; backfill from current postings; unique becomes `(unit_id, candidate_id, designation_id, shift_hours, is_reliever, entry_date)` NULLS NOT DISTINCT.
  - Update `enforce_reliever_extra_duty_only` to check `NEW.is_reliever` instead of looking up the posting.
  - Self-punch sync trigger writes the posting's shift/reliever flag.
- Attendance sheet: row key becomes `candidate|designation|shift|reliever`; rows built from `candidate_units` lines + existing entries; upsert `onConflict` updated; new edit/delete actions gated on sheet status + attendance edit permission; `logActivity` on each.
- Invoice / Payroll / MIS / FinanceCharter: rate lookup uses the entry's own `shift_hours` (falls back to posting, then designation default).
- `bunx tsgo --noEmit` must pass.
