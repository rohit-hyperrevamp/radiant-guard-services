# Finance comparison flow review

## Rule
Every eligible client in the selected period stays visible, including pending clients. Commercial Admin, Service, Management and Reliever charges remain in profit, not employer costs. They are already inside invoice revenue and must never be added twice. Actual statutory contributions remain costs. Preserve issued invoices and posted payroll.

## Places read in this sweep
| Place | Result |
|---|---|
| Dashboard period/window selector and saved attendance-window resolver | Follows the rule: all windows by default, exact saved historical sheet dates, explicit selected-window filtering. |
| Dashboard payroll versus invoice, invoice coverage and profitability | Follows the rule: starts from the whole selected roster; pending/failed clients stay visible; only current saved figures enter totals. |
| Dashboard search, pagination, client breakdown and CSV downloads | Follows the rule: all filtered clients can be paged/exported; unavailable amounts are marked pending rather than manufactured. |
| Shared commercial-cost classifier | Found an additional stored spelling: **Relieving Charges 16.67% (CTC)** was still counted as cost. Corrected that alias while preserving statutory PF formulas that mention it. Only affected aggregates were invalidated. |
| Multi-site payroll totals and per-person comparison costs | Uses that same corrected classifier; preserves earned gross, deductions, net pay and original full employer totals separately. |
| Invoice source engine and bulk dashboard invoice calculation | Uses the shared invoice pricing/part functions; commercial charges remain within invoice amounts, not an additional profit credit. |
| Saved aggregate calculation | Separates computed/posted employer cost and commercial charges; latest exact-window payroll snapshots take precedence; no source records are rewritten. |
| Saved final-invoice readback | Reads latest single-site parts, avoids allocating a whole group invoice to every site. Its code only replaces matching computed part keys. Current production has no applicable single-site final parts to exercise this branch, so historical split-change behaviour remains unverified. |
| Refresh endpoint and leased worker | Worker uses the bound database client and publishes versioned/generation-checked values; errors never publish guessed amounts. Direct production worker was exercised previously; deployed endpoint delivery remains unverified. |
| Database request, claim, publish, fail, continue, kick and dispatch functions | Read their migration definitions: exact periods; version-aware claims; trusted publication; stale-generation rejection; bounded retry; no ordinary user may publish money. |
| Database source-change invalidation and settings/request triggers | Read definitions: changes mark aggregate generations dirty and dispatch refresh; attendance, contracts, revisions, payroll posting, final invoices and relevant reference settings covered. Settings/permissions were not changed. |
| Hourly recovery job | Read its schedule and dispatcher; event-driven refresh handles normal changes, hourly dispatch recovers stalled work. |
| Invoice and payroll landing registers | Read both screens and shared register: all filtered clients are paginated; commercial costs use the same helper. However they still run their own engines and can fall back to computed values when saved totals are pending. **Outside this dashboard-only change; not modified.** |
| Invoice-register client/employee margins and CSV | Read: uses corrected actual employer cost, but the CSV still rounds values to whole rupees and some person figures remain freshly computed. **Outside dashboard scope; not modified.** |
| Combined invoice Tally/MIS and single-invoice Tally/print | Read: current invoice engine produces line amounts and quantities; export/finalisation paths differ from saved dashboard aggregates. **Not changed; downloads not exercised signed in.** |
| Final invoice generation dialog and number allocation call | Read: saves taxable/tax/total for selected exact-period parts; no existing final records changed. |
| Payroll detail summary/table/employee breakdown, payroll MIS, processing/amendment totals | Read: still show/store the original complete employer total, including commercial lines. **Outside dashboard scope; not modified.** |
| Employee profile Monthly CTC | Read: still uses the original wages employer-cost field, including commercial lines. **Outside dashboard scope; not modified.** |

## Verification limits carried forward
- The preceding refresh completed **5,159** usable active periods across May–November. **31** exact periods lack usable invoice source data (14 September, 16 October, one November); they remain visible without invented amounts.
- September full-roster production readback covered **1,714** distinct saved-period clients, with no omitted names or profit arithmetic mismatches.
- The additional alias occurs in four clients: CLI1400, CLI3356, CLI4097 and CLI4201. Only their affected saved aggregate generations were dirtied; contract rates, attendance, payroll snapshots and issued invoices were not changed.
- Deployment through GitHub-to-Vercel and signed-in live dashboard/download checks remain pending. Code inspection and production worker/database tests are not a substitute for signed-in screen verification.
- Labels such as **Admin Expenses** and **Operational & Administrative Cost** were not automatically reclassified: the name alone does not establish whether they are a commercial fee or an actual cost.

## Separate approval needed
Apply the same display-only separation to payroll detail/MIS/profile CTC, and replace register fallback/whole-rupee exports with exact saved values? That would be a separate outside-dashboard change and must not rewrite settled source records.