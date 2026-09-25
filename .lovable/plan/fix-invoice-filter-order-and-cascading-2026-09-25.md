# Fix invoice filter order and cascading

## Changes
- Move Organization and Unit from the invoice header into the filter area, immediately above State and City.
- Derive State choices only from units remaining after the selected Organization and Unit filters.
- Derive City choices only from those remaining units and the selected States.
- Automatically remove State or City selections that become invalid when an upstream filter changes.
- Keep search, invoice status, clear-filters behavior, and pagination working as they do now.

## Verification
- Select an organization with no units in a state and confirm that state is absent.
- Confirm Unit follows Organization, City follows State, and invalid child selections clear automatically.
- Run the required TypeScript check and confirm the production build signal remains healthy.
