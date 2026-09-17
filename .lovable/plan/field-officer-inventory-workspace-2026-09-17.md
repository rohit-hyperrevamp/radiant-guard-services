# Field Officer Inventory Workspace

## Goal
Turn the field-officer dashboard’s **Items** tile into a clickable **Inventory** entry point with a focused, fully usable uniform-and-shoe workflow.

## What will change
- Rename the dashboard tile from **Items** to **Inventory** and open the inventory workspace when clicked.
- Show field officers a dedicated Uniform Manager dashboard instead of the company-wide inventory command center.
- Summarize the field officer’s current Uniform and Shoe stock, including sizes and total quantities.
- Add clickable workflow tiles for:
  - **My stock** — inventory currently held by the field officer.
  - **Demands** — request Uniform or Shoe stock from the primary unit or headquarters and track request status.
  - **Issuances** — issue stock to reporting guards and complete pending onboarding issues.
  - **Collections** — collect stock back from reporting guards, including offboarding collections.
- Surface pending receipt/acknowledgement work so issued stock can be accepted into the field officer’s inventory.
- Keep every list scoped to the signed-in field officer, their permitted sources, and their reporting guards.
- Preserve the existing admin and inventory-manager command center unchanged.

## Technical details
- Make `/admin/inventory` role-aware using the existing field-officer role resolver.
- Reuse the existing demand, issuance, collection, receipt, and personal-stock routes rather than duplicating workflow logic.
- Build the field-officer summary from existing inventory balances and workflow records, with cached reads and silent refresh.
- Keep the catalogue restricted to Uniform and Shoe and retain the existing primary-unit/headquarters demand-source rules.
- Add activity logging to any new mutation only; navigation and summary reads need no new database writes.
- Verify route navigation, field-officer scoping, empty/loading states, and TypeScript checks.
