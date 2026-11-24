# Payroll balancing-adjustment flow sweep

## Rule
Payroll must not include artificial additions or deductions created only to match another system. Contract/attendance calculations and genuine employee payroll items remain valid. Do not alter unrelated paid records, invoices, permissions, settings or the read-only historical archive.

## Checked consumers

| Place | Code read | Result |
| --- | --- | --- |
| Payroll detail and wage-slip PDF | `admin.payroll.$unitId.tsx`, `payroll-engine.ts` | Detail and slips use shared computed rows; synthetic inputs are excluded before day or cash calculations. |
| Payroll register, employee drill-down and CSV | `admin.payroll.index.tsx`, `FinanceCharter.tsx`, `payroll-engine.ts` | Uses shared payroll engine and latest corrected saved totals, not independent balancing entries. |
| Invoice detail, register and finance invoice totals | `admin.invoice.$unitId.tsx`, `admin.invoice.index.tsx`, `invoice-engine.ts`, `dashboard-finance.ts` | Shared invoice calculation excludes synthetic cash/day inputs. Final invoices were not changed. |
| Dashboard saved figures and finance totals | `finance-summary-read.ts`, `finance-posted-totals.ts` | Version-current saved values and latest posted snapshots; no summing all amendment versions. Source removal was followed by a production refresh. |
| Payroll processing and amendments | `payroll-process.ts`; production `save_payroll_posting_atomic` | Current rows form atomic ledger/snapshot payloads. The database rejects synthetic additions, deductions or snapshot earning lines; attempts cannot partially post. Normal amendments retain their existing delta rules. |
| Additions and deductions managers | `admin.additions.tsx`, `admin.deductions.tsx` | Read the cleaned ledgers; create/edit passes through the same database rejection guards. Genuine items and permissions remain unchanged. |
| Unapplied-deduction transfer | `UnappliedDeductionsBanner.tsx` | Reads cleaned deductions; moving a record remains an update subject to the guard. |
| Employer-contribution register | `admin.employer-contributions.tsx` | Reads actual contribution ledger. Production query found zero reconciliation contribution copies; no unrelated fee-display change made. |
| Compliance monthly ledgers and statutory source | `compliance-month.ts` | Reads cleaned deduction/contribution rows with original payroll-site mapping. Genuine statutory amounts retained. |
| Cross-site Professional Tax | `pt-cross-site.ts` | Uses processed latest saved gross/deductions, which were corrected only for the explicitly requested balancing copies. No changes to tax policy. |
| Historical Pages archive | `admin.payroll.history.tsx` | Separate read-only source; never feeds current payroll calculations. Historical archive left intact. |
| Finance recovery | Production `claim_finance_totals`; scheduled job inventory | Claims outdated active-client periods for regeneration. Existing recovery job remains enabled; no schedule/permission changes. |

## Evidence and limits

- Existing removal verification: 689 balancing additions, 815 balancing deductions and three posted copies removed; zero classified additions/deductions/snapshot lines remain. Follow-up employer-ledger query also found zero copies.
- Thirty-three focused tests and production rollback/write-guard/preservation tests passed. Current compilation is successful.
- Production CLI4530 September payroll and refreshed saved totals agree: gross ₹36,999; deductions ₹6,448; net ₹30,551.
- 6,431 saved periods refreshed successfully. Another 57 periods have no usable saved calculation; no stale adjusted totals or guessed replacements are shown.
- This sweep found no further bypass requiring a behavior change beyond the source removal, shared exclusions and database guards already implemented.
- The listed UI paths were code-read, not claimed as signed-in browser-tested. Live-screen verification still requires production delivery and a production-compatible signed-in browser session.