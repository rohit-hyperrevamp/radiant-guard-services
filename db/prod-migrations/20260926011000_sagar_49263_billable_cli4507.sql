-- Sagar (49263): billable Security Guard at CLI4507; reload his 21 Aug-20 Sep muster
BEGIN;
UPDATE candidates SET non_billable=false, designation_id='aad77ba7-98d2-44cb-a0f1-b598eed740f4' WHERE employee_code='49263';
DELETE FROM attendance_entries WHERE candidate_id='5cbfa3f3-1315-48d2-92f6-99311ffdf11b' AND entry_date BETWEEN '2026-08-21' AND '2026-09-20';
INSERT INTO attendance_entries(unit_id,candidate_id,designation_id,shift_hours,is_reliever,entry_date,code,ot_hours)
 SELECT '6b5a0cf8-0d76-45ce-8087-ecb6e4bb3c69','5cbfa3f3-1315-48d2-92f6-99311ffdf11b','aad77ba7-98d2-44cb-a0f1-b598eed740f4',8,false,'2026-08-21'::date+i-1,
  CASE substr(s,i,1) WHEN 'P' THEN 'P' WHEN 'W' THEN 'WO' ELSE 'A' END,0
 FROM (SELECT '.........WAPPPPPWPPPPPPWPPPPPPW'::text s) g, generate_series(1,31) i WHERE substr(s,i,1)<>'.';
SELECT code,count(*) FROM attendance_entries WHERE candidate_id='5cbfa3f3-1315-48d2-92f6-99311ffdf11b' AND entry_date BETWEEN '2026-08-21' AND '2026-09-20' GROUP BY 1;
COMMIT;
