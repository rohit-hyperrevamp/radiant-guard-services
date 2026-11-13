"""Run against a DISPOSABLE fixture DB only (schema in payroll-atomic-fixture.sql)."""
import json, os, subprocess, unittest
from pathlib import Path
class AtomicPayroll(unittest.TestCase):
 def sql(self,s,ok=True):
  r=subprocess.run(['psql','-h',os.environ['ATOMIC_TEST_SOCKET'],'-p','55439','-U','lovable','-d','postgres','-X','-At','-v','ON_ERROR_STOP=1','-c',s],capture_output=True,text=True)
  if ok and r.returncode: self.fail(r.stderr)
  if not ok:self.assertNotEqual(r.returncode,0)
  return r.stdout.strip()
 def setUp(self):
  self.run='11111111-1111-1111-1111-111111111111';self.site='22222222-2222-2222-2222-222222222222';self.emp='33333333-3333-3333-3333-333333333333'
  self.sql("TRUNCATE payroll_runs,attendance_sheets,candidates,deductions,additions,employer_contributions,payroll_processing_holds,payroll_run_snapshots;"+f"INSERT INTO candidates VALUES('{self.emp}'); INSERT INTO payroll_runs VALUES('{self.run}','{self.site}','2026-09-01','2026-09-30','approved','open',null,null); INSERT INTO attendance_sheets VALUES('{self.run}','{self.site}','2026-09-01','2026-09-30','approved',1,'none');")
 def payload(self,amount=200,version=1):
  kind='payroll_run' if version==1 else 'payroll_amendment';ref=f'payroll_run:{self.run}'+('' if version==1 else f':v{version}')
  line=dict(unit_id=self.site,candidate_id=self.emp,source_kind=kind,source_ref=ref,amount=amount,deduction_name='PT',status='completed')
  return dict(mode='regular' if version==1 else 'amendment',runId=self.run,unitId=self.site,periodStart='2026-09-01',periodEnd='2026-09-30',version=version,deductions=[line],additions=[],contributions=[],holds=[],snapshots=[dict(payroll_run_id=self.run,unit_id=self.site,candidate_id=self.emp,version=version,on_hold=False)])
 def call(self,p,ok=True,allowed=True):
  return self.sql(f"SET ROLE authenticated; SET test.actor='{self.emp}'; SET test.allowed='{str(allowed).lower()}'; SELECT save_payroll_posting_atomic('{json.dumps(p)}'::jsonb);",ok)
 def state(self):return self.sql("SELECT json_build_array((SELECT count(*) FROM deductions),(SELECT count(*) FROM payroll_run_snapshots),(SELECT payroll_status FROM payroll_runs),(SELECT amendment_status FROM attendance_sheets))")
 def test_success_and_retry_no_duplicate(self):
  self.call(self.payload());self.assertEqual(json.loads(self.state()),[1,1,'processed','none']);self.call(self.payload(),False);self.assertEqual(json.loads(self.state()),[1,1,'processed','none'])
 def test_late_failure_preserves_prior_money(self):
  self.sql(f"INSERT INTO deductions(candidate_id,amount,source_kind,source_ref) VALUES('{self.emp}',100,'payroll_run','payroll_run:{self.run}'); CREATE OR REPLACE FUNCTION fail_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'simulated snapshot failure'; END $$; CREATE TRIGGER fail_test BEFORE INSERT ON payroll_run_snapshots FOR EACH ROW EXECUTE FUNCTION fail_snapshot();")
  try:self.call(self.payload(),False);self.assertEqual(json.loads(self.state()),[1,0,'open','none']);self.assertEqual(self.sql('SELECT amount FROM deductions'),'100')
  finally:self.sql('DROP TRIGGER fail_test ON payroll_run_snapshots;')
 def test_permission_refusal_preserves_everything(self):
  self.call(self.payload(),False,False);self.assertEqual(json.loads(self.state()),[0,0,'open','none'])
 def test_unapproved_run_cannot_post(self):
  self.sql("UPDATE payroll_runs SET status='submitted'");self.call(self.payload(),False);self.assertEqual(json.loads(self.state()),[0,0,'open','none'])
 def test_mismatched_site_cannot_post(self):
  p=self.payload();p['deductions'][0]['unit_id']=self.emp;self.call(p,False);self.assertEqual(json.loads(self.state()),[0,0,'open','none'])
 def test_amendment_preserves_base_and_finishes_together(self):
  self.call(self.payload());self.sql("UPDATE attendance_sheets SET current_version=2,amendment_status='approved'");self.call(self.payload(-25,2));self.assertEqual(json.loads(self.state()),[2,2,'processed','processed']);self.assertEqual(self.sql('SELECT sum(amount) FROM deductions'),'175')
 def test_amendment_failure_preserves_base_and_approval(self):
  self.call(self.payload());self.sql("UPDATE attendance_sheets SET current_version=2,amendment_status='approved'");self.call(self.payload(10000,2),False);self.assertEqual(json.loads(self.state()),[1,1,'processed','approved'])
if __name__=='__main__':unittest.main()
