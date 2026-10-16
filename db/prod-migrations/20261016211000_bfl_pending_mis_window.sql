-- BFL sites in the 21-20 window that are not in the Sep 2026 client MIS (and had no September work)
-- go to a separate holding window with the same 21-20 dates until their MIS arrives.
BEGIN;
INSERT INTO payroll_windows(id,label,window_start_day,window_end_day,processing_day,enabled)
VALUES ('b7f1e000-0000-4000-8000-00000000bf11','BFL - Pending MIS (21 to 20)',21,20,27,true)
ON CONFLICT (id) DO NOTHING;
CREATE TABLE IF NOT EXISTS _bkp_bfl_pending_mis_20261016 AS
  SELECT cc.id contract_id, cc.payroll_window_id, u.id unit_id, u.mapping_payroll_window_id FROM client_contracts cc JOIN units u ON u.id=cc.unit_id WHERE u.code IN ('CLI1325','CLI2618','CLI4149','CLI4399','CLI1453','CLI2976','CLI3175','CLI3980','CLI4397','CLI4398','CLI2781','CLI2191','CLI4787','CLI4788','CLI4791','CLI4792','CLI4793','CLI4794','CLI4795','CLI4796','CLI4797','CLI4798','CLI4799','CLI2398','CLI2192','CLI3272','CLI2221') AND cc.status='active';
UPDATE client_contracts cc SET payroll_window_id='b7f1e000-0000-4000-8000-00000000bf11', updated_at=now()
  FROM units u WHERE u.id=cc.unit_id AND u.code IN ('CLI1325','CLI2618','CLI4149','CLI4399','CLI1453','CLI2976','CLI3175','CLI3980','CLI4397','CLI4398','CLI2781','CLI2191','CLI4787','CLI4788','CLI4791','CLI4792','CLI4793','CLI4794','CLI4795','CLI4796','CLI4797','CLI4798','CLI4799','CLI2398','CLI2192','CLI3272','CLI2221') AND cc.status='active';
UPDATE units SET mapping_payroll_window_id='b7f1e000-0000-4000-8000-00000000bf11', updated_at=now() WHERE code IN ('CLI1325','CLI2618','CLI4149','CLI4399','CLI1453','CLI2976','CLI3175','CLI3980','CLI4397','CLI4398','CLI2781','CLI2191','CLI4787','CLI4788','CLI4791','CLI4792','CLI4793','CLI4794','CLI4795','CLI4796','CLI4797','CLI4798','CLI4799','CLI2398','CLI2192','CLI3272','CLI2221');
COMMIT;
