-- Move 56 client contracts (the IDs not on the client's 21–20 list) from the
-- 21–20 payroll window to the 1 to 30/31 payroll window.
-- Applied to production on 2026-09-19 (56 contracts updated).

BEGIN;

UPDATE client_contracts cc
SET payroll_window_id = '9676d05d-fbb3-4d9a-bdca-b4b9ac65db0c', -- 1 to 30/31
    updated_at = now()
FROM units u
WHERE u.id = cc.unit_id
  AND u.code IN ('CLI1453','CLI1620','CLI2191','CLI2289','CLI2772','CLI2785','CLI2858','CLI290','CLI2921','CLI2978','CLI3183','CLI3281','CLI3305','CLI3626','CLI3857','CLI3858','CLI3859','CLI3860','CLI3861','CLI3862','CLI3863','CLI3864','CLI3865','CLI3866','CLI3867','CLI3868','CLI3869','CLI3886','CLI3898','CLI3899','CLI3900','CLI3904','CLI3905','CLI3907','CLI3908','CLI3909','CLI3910','CLI3912','CLI3913','CLI3914','CLI3916','CLI3930','CLI3931','CLI3933','CLI3934','CLI3935','CLI3962','CLI3963','CLI3964','CLI4181','CLI4297','CLI4476','CLI4500','CLI4501','CLI4502','CLI4503');

COMMIT;
