# Cross-platform mobile UI/UX polish

## Direction
- Preserve the current Radiant color system.
- Use Sora for headings and Manrope for body text.
- Apply the selected compact operational dashboard structure consistently across Android and iOS.
- Standardize 16px page margins, an 8px spacing rhythm, restrained 8–16px corner radii, and accessible touch targets.

## Experience fixes
- Make phone autofill accept numbers with or without `+91`; improve OTP autofill; style Privacy Policy and HyperRevamp as links.
- Remove duplicate profile/photo entry points and make location, attendance status, and all attendance times clear and actionable.
- Use amber/soft red for unmarked working days, green for marked attendance, and neutral grey for holidays or weekly offs.
- Prevent cropped tiles and right-edge overflow; replace awkward dash-only values with meaningful empty states.
- Correct dashboard navigation for stock, onboarding, rehire, uniform, and other summary tiles.
- Make candidate sections orderly and compact; use an icon-only edit action and scroll selected sections into view.
- Repair employee lookup controls and add contextual back navigation on secondary screens.
- Upgrade Uniform Manager with total, serviceable, remaining, issued-to, and related stock details already available in the system.
- Add a visible close control and compact-on-scroll behavior to the More menu; correct all Uniform links.
- Add Hindi to language preference and make device setup wording/platform controls adapt to Android or iOS.
- Make signed PDF actions work reliably in installed Android and iOS apps.

## Shared mobile system
- Consolidate shared page width, card, header, form, button, status, empty-state, bottom-navigation, and sheet patterns.
- Keep native safe areas consistent without hiding horizontal layout errors.
- Use one responsive structure from small Android phones through larger iPhones and tablets.
- Preserve existing permissions, data rules, native push paths, and attendance behavior.

## Validation
- Verify the login, dashboard, attendance, candidates, employee lookup, inventory/uniform, menu, profile, and document flows.
- Check representative narrow, standard, and large mobile widths for clipping, alignment, touch targets, and text wrapping.
- Confirm the relevant production-facing behavior and avoid changing locked native push infrastructure.
