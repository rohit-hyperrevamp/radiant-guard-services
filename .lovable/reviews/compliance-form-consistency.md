# Compliance form review

## Reviewed collection
45 unique forms, 72 pages, 5,028 extracted fields. Both editor families now share employee/client/month selectors and the field entry panel. Original document geometry and permissions remain separate from the surrounding controls.

## Changes
- Measured glyph-width fitting for digital answers, fixed entry bounds, natural-width text and retained dotted blank rules.
- Source-reviewed Character Certificate and night-shift consent inputs; the consent name/address label pair now has separate lines because the source leaves almost no name space. Wage-slip name/identifier cells are consolidated instead of duplicating one employee into three columns; posted employee PF/ESI have separate reviewed deduction fields.
- Reviewed first-row mappings for Bonus, Employment Card, Muster Roll, Wages, Fines, Advances, Damage/Deduction and employee registers. Additional register rows are not populated with duplicate employees.
- Context refresh replaces earlier automatic values but preserves manual answers; imported drafts are protected from delayed autofill.
- Active searchable clients, saved shipping-address facts, readable month facts and posted monthly statutory values scoped to selected employee/original site. Legal employer remains organization settings, not the selected client.
- Statutory declarations, event dates, wage bases, annual bonus and unknown attendance remain unfilled. Posted-date statutory figures are not treated as earning-period wage totals.

## Remaining limitations
- 1,324 extracted boxes are narrower than 10 paper units or shorter than 5, across seven forms (02, 14, 18, 19, 23, 24, 39); some are intentionally short-value cells, others still need original-by-original validation.
- 41 original placeholder bounds and scanned/outlined text need further fidelity review. Natural-width fitting does not prove every extracted blank is correctly placed.
- Not all 45 forms have fully reviewed automatic field mappings; forms without confirmed targets remain manually editable through printed text/available blanks. Consent and certificate blank repairs still require deployed filled-output inspection.
- Client selection does not generate multi-employee attendance/wage/leave registers; these require verified form-specific period mappings. No invented totals or inferred legal declarations.
- Production currently runs the preceding editor release. Signed-in real employee selection succeeded without runtime errors, but these new shared controls and filled export readback require GitHub-to-Vercel delivery. No full live end-to-end completion claim.