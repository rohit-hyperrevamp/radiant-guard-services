# Mobile muster-grid attendance entry

## Goal
Make phone attendance look and behave like the desktop muster roll, while keeping daily entry simple and touch-friendly.

## Changes
- Replace the separate one-day employee-card view with one compact attendance grid that shows employees against all payroll-period days.
- Keep employee name and ID visible while the days scroll horizontally, so every cell remains identifiable.
- Make each eligible day cell a clear tap target; tapping opens the existing attendance-code choices and saves through the current attendance flow.
- Keep Extra Duty as a compact second row per employee and retain its existing hours picker.
- Preserve search, scanning/upload, vacant mapping, payroll windows, approval/amendment states, joining-date and future-date restrictions, reliever rules, totals, printing, and desktop behavior.
- Retain bulk marking through compact row selection and a dock-safe action bar.

## Technical details
- Reuse the existing attendance and Extra Duty state, mutation handlers, code definitions, and restrictions rather than creating a second saving path.
- Render the same muster data with phone-specific sizing and sticky identity columns; desktop and print retain the statutory Form XVI layout.
- Use regular/medium typography, compact controls, and the existing semantic colors and black dock clearance.
- Run `bunx tsgo --noEmit` and formatting checks after the change.
