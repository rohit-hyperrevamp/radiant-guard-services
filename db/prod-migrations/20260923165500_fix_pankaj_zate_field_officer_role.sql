-- Pankaj Zate's employee edit was reverted by a delayed client-side form reload.
-- Restore the requested classification after removing that race in the editor.
UPDATE public.candidates
SET role_key = 'field_officer'
WHERE id = '148a8ab5-7433-4f3d-bc8a-11c8bf2d859b'
  AND employee_code = '49258';