"""Transactional reference-copy verification; default rollback, --apply commits after all checks."""
import json
import os
import subprocess
import sys
import unittest
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[2]
BACKUP = ROOT / 'db/backups/poonawalla-haryana-cli4508-20261124.json'
COPY = ROOT / 'db/data-fixes/20261124_poonawalla_haryana_cli4508.sql'
META = {'id', 'contract_id', 'designation_id', 'service_type_id', 'quantity', 'sort_order', 'created_at', 'updated_at', 'role_key'}


class HaryanaReferenceTest(unittest.TestCase):
    def test_reference_copy_preserves_scope_history_and_saved_selections(self):
        backup = json.loads(BACKUP.read_text())
        self.assertEqual(backup['reference_code'], 'CLI4508')
        self.assertEqual(len(backup['resources']), 87)
        source = backup['reference_resources'][0]
        self.assertEqual(source['shift_hours'], 8)
        self.assertTrue(source['invoice_present_cap'])
        connection = os.environ.get('RADIANT_PROD_DB_URL', '')
        self.assertEqual(urlparse(connection).hostname, 'db.yimpxawqoarprhtxapie.supabase.co')
        target_ids = ','.join("'" + r['id'] + "'" for r in backup['resources'])
        snapshot = f"""jsonb_build_object(
          'source', (SELECT to_jsonb(r) FROM public.contract_resources r WHERE id='{source['id']}'),
          'headers', (SELECT md5(string_agg(to_jsonb(c)::text,'' ORDER BY id)) FROM public.client_contracts c),
          'units', (SELECT md5(string_agg(to_jsonb(u)::text,'' ORDER BY id)) FROM public.units u),
          'other_rates', (SELECT md5(string_agg(to_jsonb(r)::text,'' ORDER BY id)) FROM public.contract_resources r WHERE id NOT IN ({target_ids})),
          'attendance', (SELECT md5(string_agg(to_jsonb(a)::text,'' ORDER BY id)) FROM public.attendance_entries a WHERE unit_id IN (SELECT c.unit_id FROM public.client_contracts c JOIN public.contract_resources r ON r.contract_id=c.id WHERE r.id IN ({target_ids}))),
          'paid', (SELECT md5(string_agg(to_jsonb(p)::text,'' ORDER BY id)) FROM public.payroll_run_snapshots p WHERE unit_id IN (SELECT c.unit_id FROM public.client_contracts c JOIN public.contract_resources r ON r.contract_id=c.id WHERE r.id IN ({target_ids}))),
          'revisions', (SELECT md5(string_agg(to_jsonb(v)::text,'' ORDER BY id)) FROM public.contract_rate_revisions v)
        )"""
        expected = json.dumps(source).replace("'", "''")
        expected_targets = json.dumps(backup['resources']).replace("'", "''")
        sql = f"""BEGIN;
        SET LOCAL statement_timeout='120s';
        CREATE TEMP TABLE preservation_before AS SELECT {snapshot} AS data;
        DO $$ BEGIN
          IF (SELECT to_jsonb(r) FROM public.contract_resources r WHERE id='{source['id']}') IS DISTINCT FROM '{expected}'::jsonb
          THEN RAISE EXCEPTION 'CLI4508 changed since backup'; END IF;
          IF (SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM public.contract_resources r WHERE r.id IN ({target_ids}))
             IS DISTINCT FROM (SELECT jsonb_agg(x ORDER BY x->>'id') FROM jsonb_array_elements('{expected_targets}'::jsonb) x)
          THEN RAISE EXCEPTION 'Target rates changed since backup'; END IF;
        END $$;
        """ + COPY.read_text() + f"""
        DO $$ BEGIN
          IF (SELECT data FROM preservation_before) IS DISTINCT FROM {snapshot}
          THEN RAISE EXCEPTION 'Reference, unrelated rates, terms, attendance, paid records or history changed'; END IF;
        END $$;
        SELECT 'VERIFIED=' || jsonb_build_object(
          'targets',(SELECT count(*) FROM haryana_target_ids),
          'rates',(SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM public.contract_resources r JOIN haryana_target_ids t USING(id))
        )::text;
        """
        apply = '--apply' in sys.argv
        sql += 'COMMIT;' if apply else 'ROLLBACK;'
        result = subprocess.run(['psql', connection, '-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1'],
                                input=sql, text=True, capture_output=True, cwd=ROOT)
        if result.returncode:
            self.fail(result.stderr)
        line = next((x for x in result.stdout.splitlines() if x.startswith('VERIFIED=')), '')
        self.assertTrue(line, 'Missing verification result')
        after = json.loads(line.removeprefix('VERIFIED='))
        self.assertEqual(after['targets'], 87)
        expected_rate = {k: v for k, v in source.items() if k not in META}
        originals = {r['id']: r for r in backup['resources']}
        for row in after['rates']:
            self.assertEqual({k: v for k, v in row.items() if k not in META}, expected_rate)
            self.assertEqual({k: v for k, v in row.items() if k in META and k != 'updated_at'},
                             {k: v for k, v in originals[row['id']].items() if k in META and k != 'updated_at'})
        print('Verified 87 exact rate copies; reference, terms, history, attendance and paid records preserved; '
              + ('committed.' if apply else 'rolled back.'))


if __name__ == '__main__':
    unittest.main(argv=[sys.argv[0]])