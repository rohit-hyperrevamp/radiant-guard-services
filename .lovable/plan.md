# Fix cascading Clients filters

## Change
- Replace the single-choice Organization filter with the same searchable multi-select used for State and City.
- Limit State choices to clients belonging to the selected organizations.
- Limit City choices to the selected organizations and selected states.
- Automatically remove State or City selections that are no longer valid when a parent filter changes.
- Keep **All organizations**, **All states**, and **All cities** as independent reset choices.

## Verification
- Confirm multiple organizations can be selected together.
- Confirm Organization → State → City options and client rows cascade correctly.
- Run the required TypeScript check and confirm the app build is healthy.
