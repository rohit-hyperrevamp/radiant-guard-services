# End-to-end mobile interface re-review

## Goal
Re-review every app screen and finish the mobile-first refinement so content, controls, tables, dialogs, and navigation remain usable without cropping or overlap.

## Work
- Audit all routes and shared interface controls for fixed widths, overflow, cramped headers, dense text, and undersized touch targets.
- Normalize mobile headers and action rows to bounded grid layouts with shrink-safe titles and fixed controls.
- Contain wide operational tables within their own horizontal scrolling area while preserving intentional finance and hierarchy layouts.
- Fix remaining filters, selectors, cards, dialogs, forms, and toggles using the existing iOS-inspired visual language.
- Verify type safety, edited-file integrity, and representative mobile screens without changing business logic.

## Technical notes
- Changes remain limited to frontend presentation and responsive classes.
- Existing desktop behavior, permissions, calculations, data access, and workflows remain unchanged.
