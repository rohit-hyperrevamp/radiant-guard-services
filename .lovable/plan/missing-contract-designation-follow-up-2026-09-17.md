# Missing Contract Designation Follow-up

## Goal
Allow onboarding against any active designation, even when that designation is not yet included in the selected client unit’s contract, while creating a visible seven-day follow-up for the responsible Field Officer and Finance.

## Implementation

1. **Open designation selection without weakening the contract signal**
   - Show all enabled designation masters in each client-unit designation selector.
   - Keep contract-backed designations first and clearly label other choices as not yet in the contract.
   - Never clear an already selected out-of-contract designation.
   - Preserve the selected designation on the primary candidate record and each unit posting exactly as today.
   - Keep internal/non-billable employee designation behavior unchanged because those postings do not depend on client contracts.

2. **Create an authoritative missing-designation feed**
   - Add a production database function that compares every active employee/candidate unit posting with the unit’s current active client contract resources.
   - Return only unit/designation combinations that are genuinely missing, including person, employee/candidate code, unit, organization, designation, Field Officer ownership, and the date the gap began.
   - Scope Field Officers to people they onboarded or manage; Finance/admin users receive the full queue.
   - Derive resolution automatically: the case disappears as soon as Finance adds that designation’s billing resource to the active unit contract.
   - Use posting creation/update time as the seven-day clock, avoiding duplicate exception records or manual closure.

3. **Add the shared dashboard follow-up**
   - Add a compact **Contract designation** follow-up tile beside the existing onboarding/rehire/UAN tiles on the Field Officer dashboard.
   - Add the same tile to the Finance/admin dashboard for roles that can view contracts.
   - Clicking opens a clean list with person, unit, organization, missing designation, missing-since date, due date, and status.
   - Status bands match UAN follow-up: green days 0–3, amber days 4–6, red from day 7 onward.
   - Field Officer view is informational; Finance rows link directly to the relevant contract so billing information can be added.

4. **Refresh and audit behavior**
   - Cache the last result for immediate paint and silently refresh it.
   - Refresh after candidate posting changes and after contract resource changes so new and resolved exceptions appear without stale counts.
   - Reuse existing contract permissions and production row-security helpers; do not hardcode users, units, organizations, designations, or role assignments.

5. **Production readiness checks**
   - Apply the migration to the Radiant production database and retain it in source control.
   - Verify a contract-backed designation does not create a case.
   - Verify an out-of-contract designation can be selected and creates a day-zero green case.
   - Verify Field Officer scope, Finance visibility, seven-day colors, direct contract navigation, and automatic resolution after the billing line is added.
   - Run the project type check and validate the live production flow.
