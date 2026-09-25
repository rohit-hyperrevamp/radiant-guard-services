# Clean HR Executive experience

## Scope
- Replace the current boxed HR Executive dashboard with a compact, product-consistent client portfolio view.
- Keep only executive-relevant client mapping information: client, organization, type, dividing factor, pay cycle, pay date, payroll manager, and salary-slip requirement.
- Remove compliance statistics, compliance columns, compliance navigation, and compliance access for HR Executives.

## Access and data rules
- Organizations: HR Executives receive no organization page access.
- Clients: show only mapped clients and allow updates; keep create, delete, and export unavailable.
- Contracts: show only mapped-client contracts in view-only mode; remove all Excel/CSV export and management actions.
- Contract detail: show the contract and salary breakdown only through the deductions section; hide “Total Amount Payable” and every value below it.
- Employees and attendance remain scoped to mapped clients; employees remain view-only.
- Payroll: enforce mapped-client scope in both the payroll list and direct payroll pages, with no cross-client records or actions.

## Technical details
- Add a production-only migration under `db/prod-migrations/` to correct HR Executive module/submodule permissions and row policies where required.
- Add explicit HR Executive unit scoping in shared list logic rather than relying on manager-subtree detection.
- Add direct-page guards so a copied URL cannot expose another client.
- Preserve existing components, tokens, spacing, mobile behavior, and pagination.

## Verification
- Apply and verify the production migration against the Radiant production database only.
- Run `bunx tsgo --noEmit`.
- Verify the live site with an HR Executive session if one is available; otherwise report that signed-in visual verification remains blocked.
