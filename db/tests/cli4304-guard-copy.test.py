"""Check both Rathi Legacy Guard entries against the requested reference."""
import json
import sys
import unittest
from pathlib import Path

SOURCE = '5e1fb464-99f5-43d9-bd77-07cf0de85664'
TARGETS = {'e90fcc54-61f0-4bb8-9cd6-bed56ce566eb', 'ad853fdd-0393-4a24-9ed1-a471851c0731'}
META = {'id', 'contract_id', 'designation_id', 'service_type_id', 'quantity', 'sort_order', 'created_at', 'updated_at', 'role_key', 'payroll_day_base_id'}

def verify(before, after):
    src = next(r for r in before if r['id'] == SOURCE)
    assert src['shift_hours'] == 12
    assert set(TARGETS).issubset({r['id'] for r in after})
    for b in before:
        a = next(r for r in after if r['id'] == b['id'])
        if b['id'] in TARGETS:
            assert {k: v for k, v in a.items() if k not in META} == {k: v for k, v in src.items() if k not in META}, 'Rate differs from Koramangala'
            assert {k: v for k, v in a.items() if k in META and k != 'updated_at'} == {k: v for k, v in b.items() if k in META and k != 'updated_at'}, 'Staffing or identity changed'
        else:
            assert a == b, 'Reference or another role changed'

class GuardCopyTest(unittest.TestCase):
    def test_production_exact_copy(self):
        p = Path(sys.argv[1])
        verify(json.loads((p / 'resources-before.json').read_text()), json.loads((p / 'resources-after.json').read_text()))

    def test_both_remain_twelve_hours(self):
        p = Path(sys.argv[1])
        rows = json.loads((p / 'resources-after.json').read_text())
        for r in rows:
            if r['id'] in TARGETS:
                self.assertEqual(r['shift_hours'], 12)

if __name__ == '__main__':
    unittest.main(argv=[sys.argv[0]])