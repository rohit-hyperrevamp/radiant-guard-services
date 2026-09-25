-- BFL Maharashtra muster 21 Aug - 20 Sep 2026: CLI1410 Beed Barshi Rd, CLI2329 Baramati Kacheri Rd, CLI2622 Aurangabad Beed Bypass
BEGIN;
CREATE TEMP TABLE pr(emp text, ucode text);
INSERT INTO pr VALUES ('33124','CLI2329'),('38787','CLI2329'),('45190','CLI2329'),('48562','CLI2622');
UPDATE candidate_units cu SET is_primary=false FROM pr, candidates c, units u
 WHERE c.employee_code=pr.emp AND u.code=pr.ucode AND cu.candidate_id=c.id AND cu.unit_id<>u.id AND cu.is_primary;
INSERT INTO candidate_units(candidate_id,unit_id,designation_id,is_primary,is_reliever,sort_order)
 SELECT c.id,u.id,'aad77ba7-98d2-44cb-a0f1-b598eed740f4',true,false,0 FROM pr JOIN candidates c ON c.employee_code=pr.emp JOIN units u ON u.code=pr.ucode
 WHERE NOT EXISTS (SELECT 1 FROM candidate_units x WHERE x.candidate_id=c.id AND x.unit_id=u.id);
UPDATE candidates c SET unit_id=u.id FROM pr, units u WHERE c.employee_code=pr.emp AND u.code=pr.ucode;
-- relievers (cover weekly offs / absences) -> ED only
CREATE TEMP TABLE rl(emp text, ucode text);
INSERT INTO rl VALUES ('33184','CLI1410'),('45863','CLI2329'),('47635','CLI2329'),('45539','CLI2622');
INSERT INTO candidate_units(candidate_id,unit_id,designation_id,is_primary,is_reliever,sort_order)
 SELECT c.id,u.id,'aad77ba7-98d2-44cb-a0f1-b598eed740f4',false,true,0 FROM rl JOIN candidates c ON c.employee_code=rl.emp JOIN units u ON u.code=rl.ucode
 WHERE NOT EXISTS (SELECT 1 FROM candidate_units x WHERE x.candidate_id=c.id AND x.unit_id=u.id);

-- day strings: 31 chars for 21 Aug .. 20 Sep. P=present, W=weekly off, A=absent, R=reliever ED day, .=none
CREATE TEMP TABLE g(emp text, ucode text, s text);
INSERT INTO g VALUES
 ('44769','CLI1410','PPPPWPPAPPWPPPPPWPPPPPWPPPPPPPP'),
 ('44474','CLI1410','PPPPPWPPPPPWPAPPPWPPPPPWPPPPPPP'),
 ('28775','CLI1410','PPPPPPWPPPPPWPPPPPWAPPPPPWPPPPP'),
 ('33184','CLI1410','....RRRR..RRRR..RRRR..RRR......'),
 ('33124','CLI2329','WPPPPPPWPPPPPPWPPPPPPWPPPPPPWPP'),
 ('38787','CLI2329','PWPPPPPPWPPPPPPWPPPPPPWPPPPPPWP'),
 ('45190','CLI2329','PPWAAPPPPWPPPPPPWAPPPPPWPPPPPPW'),
 ('45863','CLI2329','RRRRR..RRR....RR...............'),
 ('47635','CLI2329','................RR...RRR....RRR'),
 ('48562','CLI2622','PPWPPPPPPWPPPPWPWPPPPPPWPPPPPWW'),
 ('45539','CLI2622','..............R..............R.');
CREATE TEMP TABLE s AS
 SELECT u.id u, c.id c, ('2026-08-21'::date + i-1) d, substr(g.s,i,1) ch
 FROM g JOIN candidates c ON c.employee_code=g.emp JOIN units u ON u.code=g.ucode, generate_series(1,31) i
 WHERE substr(g.s,i,1)<>'.';
DELETE FROM attendance_entries WHERE unit_id IN (SELECT DISTINCT u FROM s) AND entry_date BETWEEN '2026-08-21' AND '2026-09-20';
INSERT INTO attendance_entries(unit_id,candidate_id,designation_id,shift_hours,is_reliever,entry_date,code,ot_hours)
 SELECT u,c,'aad77ba7-98d2-44cb-a0f1-b598eed740f4',CASE WHEN ch='R' THEN 0 ELSE 8 END,ch='R',d,
  CASE ch WHEN 'P' THEN 'P' WHEN 'W' THEN 'WO' WHEN 'A' THEN 'A' ELSE '' END, CASE WHEN ch='R' THEN 1 ELSE 0 END FROM s;
SELECT un.code,ca.employee_code,ae.code,count(*),sum(ae.ot_hours) FROM attendance_entries ae JOIN units un ON un.id=ae.unit_id JOIN candidates ca ON ca.id=ae.candidate_id
 WHERE ae.unit_id IN (SELECT DISTINCT u FROM s) AND entry_date BETWEEN '2026-08-21' AND '2026-09-20' GROUP BY 1,2,3 ORDER BY 1,2,3;
COMMIT;
