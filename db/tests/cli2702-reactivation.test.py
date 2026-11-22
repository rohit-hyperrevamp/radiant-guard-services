import json
import os
import subprocess
import unittest


class ClientReactivationTest(unittest.TestCase):
    def test_cli2702_is_active_only_through_requested_december_date(self):
        result = subprocess.run([
            "psql", os.environ["RADIANT_PROD_DB_URL"], "-X", "-At", "-v", "ON_ERROR_STOP=1", "-c",
            "SELECT jsonb_build_object('status',u.status,'client_end',u.contract_end_date,"
            "'active_contracts',(SELECT jsonb_agg(jsonb_build_object('end',cc.end_date)) "
            "FROM client_contracts cc WHERE cc.unit_id=u.id AND cc.status='active')) "
            "FROM units u WHERE u.code='CLI2702';"
        ], check=True, capture_output=True, text=True)
        row = json.loads(result.stdout)
        self.assertEqual(row["status"], "active")
        self.assertEqual(row["client_end"], "2026-12-31")
        self.assertEqual(row["active_contracts"], [{"end": "2026-12-31"}])


if __name__ == "__main__":
    unittest.main()