-- Move IDBI attendance from old CLIs to paired new CLIs (old = source of truth).
BEGIN;
CREATE TEMP TABLE mv_map(new_code text, old_code text) ON COMMIT DROP;
INSERT INTO mv_map VALUES
 ('CLI4764','CLI3735'),('CLI4765','CLI3734'),('CLI4766','CLI3733'),('CLI4767','CLI3732'),
 ('CLI4768','CLI3731'),('CLI4769','CLI3730'),('CLI4770','CLI3729'),('CLI4771','CLI3728'),
 ('CLI4772','CLI3727'),('CLI4774','CLI3725'),('CLI4775','CLI3724'),('CLI4776','CLI3723');
CREATE TEMP TABLE mv_pairs ON COMMIT DROP AS
SELECT m.*, ou.id oid, nu.id nid FROM mv_map m JOIN units ou ON ou.code=m.old_code JOIN units nu ON nu.code=m.new_code;
DO $$ BEGIN IF (SELECT count(*) FROM mv_pairs)<>12 THEN RAISE EXCEPTION 'pairs'; END IF; END $$;

-- Backups
CREATE TABLE public.backup_idbi_move_att_20261103 AS
SELECT e.* FROM attendance_entries e WHERE e.unit_id IN (SELECT oid FROM mv_pairs UNION SELECT nid FROM mv_pairs);
CREATE TABLE public.backup_idbi_move_cu_20261103 AS
SELECT cu.* FROM candidate_units cu WHERE cu.candidate_id IN (SELECT candidate_id FROM backup_idbi_move_att_20261103);
CREATE TABLE public.backup_idbi_move_cand_20261103 AS
SELECT id, unit_id FROM candidates WHERE id IN (SELECT candidate_id FROM backup_idbi_move_att_20261103);

CREATE TEMP TABLE mv_src ON COMMIT DROP AS
SELECT p.nid, e.* FROM mv_pairs p JOIN attendance_entries e ON e.unit_id=p.oid;

-- Make guards regular at the new site
UPDATE candidate_units cu SET is_reliever=false, updated_at=now()
FROM (SELECT DISTINCT nid, candidate_id FROM mv_src) s
WHERE cu.unit_id=s.nid AND cu.candidate_id=s.candidate_id AND cu.is_reliever
  AND NOT EXISTS (SELECT 1 FROM candidate_units x WHERE x.candidate_id=cu.candidate_id AND x.unit_id=cu.unit_id
     AND x.designation_id IS NOT DISTINCT FROM cu.designation_id AND x.shift_hours IS NOT DISTINCT FROM cu.shift_hours AND NOT x.is_reliever);
UPDATE candidates c SET unit_id=p.nid FROM mv_pairs p
WHERE c.unit_id=p.oid AND c.id IN (SELECT candidate_id FROM mv_src WHERE nid=p.nid);

-- Remove duplicate new-site days (same guard, same date) that old site already records
DELETE FROM attendance_entries n USING mv_src s
WHERE n.unit_id=s.nid AND n.candidate_id=s.candidate_id AND n.entry_date=s.entry_date;

-- Remove old-site rows, then insert exact copies at new site
DELETE FROM attendance_entries e USING mv_pairs p WHERE e.unit_id=p.oid;
INSERT INTO attendance_entries (unit_id,candidate_id,entry_date,code,ot_hours,designation_id,shift_hours,is_reliever,created_at)
SELECT nid,candidate_id,entry_date,code,ot_hours,designation_id,shift_hours,false,created_at FROM mv_src;

-- Verify: every old row now exists at the new site, nothing left at old sites, no duplicates
DO $$ DECLARE src int; got int; left_old int; dup int; BEGIN
  SELECT count(*) INTO src FROM mv_src;
  SELECT count(*) INTO got FROM mv_src s JOIN attendance_entries e ON e.unit_id=s.nid AND e.candidate_id=s.candidate_id AND e.entry_date=s.entry_date;
  SELECT count(*) INTO left_old FROM attendance_entries WHERE unit_id IN (SELECT oid FROM mv_pairs);
  SELECT count(*) INTO dup FROM (SELECT unit_id,candidate_id,entry_date FROM attendance_entries WHERE unit_id IN (SELECT nid FROM mv_pairs) GROUP BY 1,2,3 HAVING count(*)>1) d;
  RAISE NOTICE 'source % moved % left_old % dup %', src, got, left_old, dup;
  IF got<>src OR left_old<>0 OR dup<>0 THEN RAISE EXCEPTION 'verification failed'; END IF;
END $$;
COMMIT;
