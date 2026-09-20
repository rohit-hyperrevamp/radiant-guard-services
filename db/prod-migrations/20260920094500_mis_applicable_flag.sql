-- Organizations that never receive an MIS sheet: the invoice screens hide the
-- MIS download for them and for every client under them.

ALTER TABLE public.mis_templates
  ADD COLUMN IF NOT EXISTS mis_applicable boolean NOT NULL DEFAULT true;

INSERT INTO public.mis_templates (customer_id, name, enabled, row_grain, mis_applicable)
SELECT c.id, 'MIS not applicable', true, 'employee', false
FROM public.customers c
WHERE c.id IN (
    '254beee4-e51d-439f-9820-de2cf2730baf', -- LODHA -CGC/PRIMIER/CROWN/PALAVA PHASE II
    '2c97c9d4-6537-43a8-9bb1-dd249b97804e', -- Lodha Amara -Vigilance Officer
    'ccd7eb88-66d9-4c3c-8838-90ff924d19d9', -- Lodha Amara Parking 04 FA
    '05b76255-3791-4a5b-87b7-f795776f2660', -- Macrotech Developers (Lodha)
    '6e0b043c-467e-4eea-bc27-44cebb9d1261', -- United Spirits Ltd.
    '6974f50c-97f9-40d1-b2b3-15fdf81379fa', -- Vertiv Energy Private Limited
    '8ac19ef7-a47e-4dca-b83e-2469dc35c5b2'  -- Kids Clinic India Limited (Cloudnine)
  )
  AND NOT EXISTS (SELECT 1 FROM public.mis_templates t WHERE t.customer_id = c.id);

UPDATE public.mis_templates
SET mis_applicable = false, name = 'MIS not applicable'
WHERE customer_id IN (
  '254beee4-e51d-439f-9820-de2cf2730baf',
  '2c97c9d4-6537-43a8-9bb1-dd249b97804e',
  'ccd7eb88-66d9-4c3c-8838-90ff924d19d9',
  '05b76255-3791-4a5b-87b7-f795776f2660',
  '6e0b043c-467e-4eea-bc27-44cebb9d1261',
  '6974f50c-97f9-40d1-b2b3-15fdf81379fa',
  '8ac19ef7-a47e-4dca-b83e-2469dc35c5b2'
);
