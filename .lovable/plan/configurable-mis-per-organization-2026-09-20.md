# Configurable MIS per organization

Today the MIS sheet is one fixed layout that was built around L&T. This turns MIS into a
Control Center setting: each organization gets its own MIS definition, and every client site
under that organization exports in that shape.

## What you get

**Control Center → MIS**
- A list of MIS formats, one row per organization: organization name, number of columns,
  number of client sites covered, Active/Inactive, and View / Edit / Delete. Searchable and
  paginated like the other managers.
- **Create MIS**: pick an organization, then either download a blank template or upload the
  client's own Excel. The upload is read for its column headings only — no data is imported.
- After upload you see every heading found in the sheet with a tick box. Headings that match
  something the system already knows (employee code, name, designation, working days, billing
  amounts, GST, State, Zone, Branch SAP code…) are auto-matched and labelled "filled by the
  system". The rest become **custom fields** you can fill in per client.
- Ticking custom fields adds those fields to every client site of that organization as optional
  (never mandatory) values. Nothing existing is disturbed and blank is always allowed.
- **Values screen** inside each MIS: a table of that organization's client sites down the side
  and the custom fields across the top, editable inline and saved per site. Search + pagination.
- Active/Inactive controls whether that organization's MIS is used; inactive falls back to the
  standard layout.

**L&T pre-loaded**
A row is created for L&T Finance Holdings with every column of today's sheet already selected,
including Zone and Branch SAP Code, and all its client sites covered — so nothing changes for
L&T on day one.

**Exports**
The MIS Format (XLSX) buttons on the invoice screen and the invoice list keep working exactly
as they do, but the column list, their order and their headings now come from the organization's
MIS. Custom fields print the value saved for that client site. Organizations without an MIS
keep the current layout.

## Technical notes

Migration under `db/prod-migrations/`:
- `mis_templates` — id, customer_id (organization), name, enabled, timestamps, created_by.
  One active template per organization (partial unique index).
- `mis_template_columns` — template_id, header, sort_order, source (`system` | `custom`),
  `system_key` (registry key when system-filled), enabled.
- `mis_unit_values` — template_id, column_id, unit_id, value text; unique on (column_id, unit_id).
- GRANTs for `authenticated` + `service_role`, RLS enabled, policies gated on
  `public.current_user_has_permission('control_center', 'mis_manager', …)` for writes and
  `view` for reads; export reads need SELECT for authenticated.
- Seed insert for the L&T organization with today's 29 columns mapped to system keys.

Code:
- `src/lib/mis-template.ts` — `MIS_SYSTEM_FIELDS` registry (key, label, header aliases, resolver
  contract), header-matching helper, and `loadMisTemplateForCustomer(customerId)` /
  `loadMisUnitValues(templateId, unitIds)`.
- `src/lib/mis-build.ts` — `buildMisColumnsAndRows({ template, context, perEmployeeRows })` used
  by both export paths, so the invoice screen and the invoice list stay identical in output.
- `src/routes/admin.mis-manager.tsx` — the manager (list, create wizard with XLSX header parse
  via the existing `xlsx` dependency, column picker, values grid), with `logActivity` on
  create/update/enable/disable/delete labelled "MIS Manager".
- `src/lib/rbac-modules.ts` — new `control_center` sub-module `mis_manager` → `/admin/mis-manager`.
- Refactor `exportMisFormat` in `src/routes/admin.invoice.$unitId.tsx` and `exportMisCombined`
  in `src/components/FinanceCharter.tsx` onto `buildMisColumnsAndRows`, keeping the existing
  hardcoded layout as the fallback when no active template exists.
- `bunx tsgo --noEmit` must pass; production data verified on the live database.
