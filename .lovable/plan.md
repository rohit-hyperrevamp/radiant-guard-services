# Modern Candidate Form

## Goal
Modernize the complete Candidate and internal employee form without changing validation, saving, verification, permissions, or approval behavior.

## What will change
- Replace the crowded header and pill rail with a cleaner progress header showing the current step, completion, and a compact step navigator.
- Establish one consistent visual language for every step: flat form canvas, clear section hierarchy, restrained surfaces, and consistent spacing.
- Standardize all fields, selectors, date controls, upload areas, helper text, required markers, errors, and completed states.
- Simplify copy and labels across Aadhaar, PAN, personal details, addresses, bank, contacts, posting, records, wages, documents, and review.
- Improve mobile navigation with a stable bottom action area, clear primary action, compact draft action, and phone-safe spacing.
- Improve desktop density with a balanced two-column workspace while retaining the same step order and data.
- Refine loading, verification, incomplete, complete, upload, and save-error states so status is immediately understandable.
- Keep forms flat while preserving rounded buttons, tiles, badges, menus, and dashboard styling elsewhere.

## Technical details
- Refactor only the Candidate wizard presentation and closely related shared form sections.
- Reuse existing semantic color tokens and shared controls; add only reusable semantic styling hooks where needed.
- Preserve all current validation rules, required fields, draft resume behavior, API calls, data mappings, and audit logging.
- Verify the form at narrow Android, iPhone, tablet, and desktop widths, including keyboard-safe scrolling and long labels.
