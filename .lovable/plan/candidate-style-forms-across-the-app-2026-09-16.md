# Candidate-style forms across the app

## Goal
Replace the old long add/edit screens with the same guided experience used for Candidate onboarding: a white workspace, blue progress states, completed-step indicators, clear Back/Next actions, fast drafts, and automatic resume at the first unfinished step.

Short forms will remain one clean screen rather than adding unnecessary steps.

## Shared form experience
- Extract the Candidate form’s step navigation, desktop left rail, mobile progress strip, completion card, validation gating, scrolling, and sticky action bar into reusable building blocks.
- Keep each form’s current fields, permissions, validation rules, calculations, and save behavior intact.
- Add fast local autosave plus an explicit **Save Draft** action to every longer form.
- Restore a saved draft when reopened and continue at the first incomplete step.
- Allow backward navigation at any time; prevent skipping ahead when an earlier required step is incomplete.
- Use consistent required markers, inline errors, loading states, and success handling.
- Preserve rounded dialogs on tablet/desktop and flat, full-screen form canvases on phones.

## Forms to convert to guided steps

### Organization
Steps: Profile → Contact → Billing address → Deployment address → Review.

### Client / Unit
Steps: Organization → Client details → Billing address → Deployment address → Statutory settings → Contract inclusions → Review.

### Contract
Split the current large contract screen into focused stages:
Contract details → Service and billing → Resources and wages → Allowances and deductions → Compliance and benefits → Review and approval.

All existing formula, payroll, approval, renewal, and resource behavior remains unchanged.

### Inventory and uniforms
- Item/Product: Details → Sizes and pricing → Stock settings → Review.
- Purchase order: Vendor and order → Items → Taxes and totals → Review.
- Longer uniform issue, demand, receipt, collection, and transfer flows: Details → Items → Review.
- Keep quick actions such as “Add stock” as a clean single-screen form.

### Vehicles and assets
- Vehicle: Identity → Registration → Insurance/compliance → Assignment → Review.
- Longer asset records: Details → Ownership/value → Assignment → Documents → Review.
- Keep short expense, service, insurance, PUC, FASTag, loan, and assignment dialogs as polished single-screen forms unless their field count requires two focused steps.

### Migration and other long operational forms
- Migration: Select destination → Upload/import → Editable preview → Validate → Confirm.
- Convert any remaining long add/edit form found in the final inventory using the same smart-step rule.

## Forms that stay single-screen
State, branch, warehouse, vendor, role, workflow, policy, duty, service type, billing type, ESIC branch, professional tax, LWF, holiday, language, attendance code, and other short master forms will retain one screen while adopting the same white/blue header, section, field, error, and action treatment.

Read-only filters, reports, tables, dashboards, and destructive confirmation boxes will not be changed.

## Technical details
- Create a reusable wizard shell, footer, step list, draft hook, resume hook, and validation-navigation hook.
- Use a per-form step definition so conditional sections can appear only when relevant.
- Store drafts separately by form type and record; expire abandoned local drafts safely.
- For long forms whose existing database status supports drafts, persist drafts there as well. Otherwise preserve the current database contract and use fast local drafts without introducing invalid partial records.
- Consolidate duplicated Candidate step UI into the shared shell first, ensuring Candidate behavior remains unchanged before migrating other forms.
- Keep activity logging on every existing create/update/enable/disable/delete path.

## Verification
- Run type checks and focused tests after each conversion group.
- Check required-field blocking, Back/Next navigation, completed-step states, Save Draft, restore, edit resume, final submission, and cancellation.
- Review representative Organization, Client, Contract, Item/Uniform, Vehicle, Asset, and Migration flows at phone, tablet, and desktop sizes.
- Compare the resulting layouts directly with the Candidate form and correct spacing, overflow, action placement, and step-state inconsistencies.
- Confirm existing calculations, permissions, approvals, and saved values are unchanged.
- Validate the deployed result on the live production site after publication; no preview or test database will be used.
