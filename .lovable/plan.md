# Operations dashboard refresh

## What will change
- Expand the top overview into a balanced eight-tile grid: Organizations, Clients, Contracts, Total Field Officers, Live on Duty Today, Sites Visited Today, Most Visited Client This Month, and Least Visited Client This Month.
- Make the visit tiles open Radar with the matching monthly view/highlight.
- Add a client-location module with a By City / By State toggle, counts, search, and compact pagination using active client sites only.
- Keep the live Radar map and visit-progress section prominent beneath the overview.
- Move the larger Operations organizational tree below Radar, visits, location coverage, and deployments so it can use the full page width without crowding the top.

## Data behavior
- Count only active field officers and active client sites.
- “Live on duty” means a field officer checked in today and not yet checked out.
- “Sites visited today” counts distinct active client sites with a visit today.
- Monthly most/least visited clients use completed visits across all field officers; least visited includes active sites with zero completed visits, making gaps visible.
- City and state totals are derived from each active site's billing location, with missing locations grouped clearly as “Not recorded.”

## Technical details
- Reuse the existing Radar and field-visit tables and React Query caching; no new backend service or edge function.
- Share one Operations overview query across the new tiles and location module to avoid duplicate requests.
- Preserve current RBAC so these additions only appear in the Operations-focused dashboard.
- Validate TypeScript and the production-backed results before completion.
