"""Focused assertions for the user-requested November 9 date reversal."""
import unittest

EXPECTED_END_DATES = {
    "faf45b11-98ae-4edf-8edb-fce7b2db8d6c": "2026-04-30",  # CLI2866
    "f7b0a141-473a-4b94-8845-49ee09c096b8": "2024-08-31",  # CLI2733
    "3a2de03d-1f7d-4e0f-8667-36c99bf86432": "2026-08-20",  # CLI3194
}


def assert_restored(before, after):
    assert {c["id"] for c in before} == {c["id"] for c in after}
    previous = {c["id"]: c for c in before}
    for contract in after:
        original = previous[contract["id"]]
        if contract["id"] in EXPECTED_END_DATES:
            assert contract["end_date"] == EXPECTED_END_DATES[contract["id"]]
            unchanged = lambda row: {k: v for k, v in row.items() if k not in ("end_date", "updated_at")}
            assert unchanged(contract) == unchanged(original), "Unrelated contract terms changed"
        else:
            assert contract == original, "Historical contract changed"


class RestoreAssertionsTest(unittest.TestCase):
    def test_wrong_restoration_fails(self):
        for contract_id in EXPECTED_END_DATES:
            with self.subTest(contract=contract_id), self.assertRaises(AssertionError):
                assert_restored(
                    [{"id": contract_id, "end_date": "2026-12-01"}],
                    [{"id": contract_id, "end_date": "2026-12-01"}],
                )

    def test_unrelated_term_change_fails(self):
        contract_id = "faf45b11-98ae-4edf-8edb-fce7b2db8d6c"
        with self.assertRaises(AssertionError):
            assert_restored(
                [{"id": contract_id, "end_date": "2026-12-01", "status": "active"}],
                [{"id": contract_id, "end_date": "2026-04-30", "status": "expired"}],
            )


if __name__ == "__main__":
    unittest.main()