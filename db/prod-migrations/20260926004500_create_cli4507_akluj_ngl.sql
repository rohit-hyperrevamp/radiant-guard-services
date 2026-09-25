-- Create CLI4507 BAJAJ FINANCE LIMITED - AKLUJ (NON GOLD 454), cloned from CLI2176, and load 21 Aug - 20 Sep 2026 muster
BEGIN;
CREATE TEMP TABLE nu AS SELECT * FROM units WHERE code='CLI2176';
UPDATE nu SET id=gen_random_uuid(), code='CLI4507', name='BAJAJ FINANCE LIMITED- AKLUJ- (NON GOLD 454)',
 billing_name='BAJAJ FINANCE LIMITED- AKLUJ- (NON GOLD 454)', shipping_name='BAJAJ FINANCE LIMITED- AKLUJ- (NON GOLD 454)',
 billing_address2='Ground Floor, Janki Niwas, Tamhani Nagar, Opposite New Bus Stand, Akluj, Tal. Malshiras, Dist. Solapur, Maharashtra - 413101',
 shipping_address2='Ground Floor, Janki Niwas, Tamhani Nagar, Opposite New Bus Stand, Akluj, Tal. Malshiras, Dist. Solapur, Maharashtra - 413101',
 client_address='Bajaj Finance Limited, Ground Floor, Janki Niwas, Tamhani Nagar, Opposite New Bus Stand, Akluj, Tal. Malshiras, Dist. Solapur, Maharashtra - 413101',
 latitude=NULL, longitude=NULL, coordinates_source=NULL, coordinates_captured_by=NULL, coordinates_captured_at=NULL, coordinates_accuracy_m=NULL,
 created_at=now(), updated_at=now();
INSERT INTO units SELECT * FROM nu;

CREATE TEMP TABLE nc AS SELECT cc.* FROM client_contracts cc JOIN units u ON u.id=cc.unit_id WHERE u.code='CLI2176' AND cc.status='active';
CREATE TEMP TABLE oc AS SELECT id FROM nc;
UPDATE nc SET id=gen_random_uuid(), contract_code='CON16226', unit_id=(SELECT id FROM nu),
 description='BAJAJ FINANCE LIMITED- AKLUJ- (NON GOLD 454) - CLI4507 | MH Solapur card, 1 x Security Guard', created_at=now(), updated_at=now(), approved_at=now();
INSERT INTO client_contracts SELECT * FROM nc;
CREATE TEMP TABLE nr AS SELECT * FROM contract_resources WHERE contract_id=(SELECT id FROM oc);
UPDATE nr SET id=gen_random_uuid(), contract_id=(SELECT id FROM nc), created_at=now(), updated_at=now();
INSERT INTO contract_resources SELECT * FROM nr;

-- postings: site lines, primaries elsewhere untouched
INSERT INTO candidate_units(candidate_id,unit_id,designation_id,is_primary,is_reliever,sort_order)
 SELECT c.id,(SELECT id FROM nu),'aad77ba7-98d2-44cb-a0f1-b598eed740f4',false,false,0 FROM candidates c WHERE c.employee_code IN ('47494','49263','26417');

CREATE TEMP TABLE g(emp text, s text);
INSERT INTO g VALUES
 ('47494','PPWPPA.........................'),
 ('49263','.........WAPPPPPWPPPPPPWPPPPPPW'),
 ('26417','.....PPPPWP....................');
INSERT INTO attendance_entries(unit_id,candidate_id,designation_id,shift_hours,is_reliever,entry_date,code,ot_hours)
 SELECT (SELECT id FROM nu), c.id,'aad77ba7-98d2-44cb-a0f1-b598eed740f4',8,false,'2026-08-21'::date+i-1,
  CASE substr(g.s,i,1) WHEN 'P' THEN 'P' WHEN 'W' THEN 'WO' ELSE 'A' END,0
 FROM g JOIN candidates c ON c.employee_code=g.emp, generate_series(1,31) i WHERE substr(g.s,i,1)<>'.';
SELECT ca.employee_code,ae.code,count(*) FROM attendance_entries ae JOIN candidates ca ON ca.id=ae.candidate_id
 WHERE ae.unit_id=(SELECT id FROM nu) GROUP BY 1,2 ORDER BY 1,2;
COMMIT;
