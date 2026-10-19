# Fast search, active-first clients, consistent filters

## 1. Find and fix the real cause of search lag
- Audit every search box (employees, candidates, clients, organizations, contracts, attendance, payroll, invoices, case desk, employee detail, pickers).
- Likely causes to confirm per page: the whole page (large lists, tables, heavy calculations) re-renders on every keystroke; a new database request fires on every letter; filtering thousands of rows in the browser each keystroke.
- Fix: typing updates only the box instantly; the list updates after a short pause (about 250ms); previous results stay visible while new ones load; old in-flight requests are cancelled; heavy filtering is memoized.
- One shared search box used everywhere so behaviour is identical.

## 1b. Search finds people by any part of their name
- Typing any part of a name works: first, middle or last name (e.g. "Tarun", "Singh"), in capitals or small letters, plus employee ID and phone number.
- Several words ("tarun singh", "singh tarun") match when every word appears somewhere, in any order.
- Extra spaces and dots are ignored; phone search works with or without +91 or spaces.
- Applies to employee, candidate, client, organization, contract and case searches and all pick-a-person boxes.

## 2. Clients: active first
- Client list (and client search results) sort Active first, then Pending/Inactive, then Expired, keeping current order within each group.

## 3. Consistent filter placement on every page
- One standard toolbar directly under the page title, in this order: Search, period/payroll window, other filters, Clear, then Export/actions on the right.
- On phones it stays compact in the same order.
- Apply across all list pages; remove bottom or scattered filter placements.

## 4. General polish
- Same spacing, empty states, loading states and button placement across pages; no change to data, permissions or calculations.

## Technical details
- New `useDebouncedValue` hook + shared `SearchInput`/`FilterBar` components; `useDeferredValue`/`placeholderData: keepPreviousData` for queries; abort signals on Supabase queries.
- Client ordering by status rank in the list query/sort.
- Frontend only; no database changes. Verification via TypeScript checks; live check after publish.
