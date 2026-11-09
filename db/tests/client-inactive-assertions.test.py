"""User-requested client deactivation checks, reusable against live readback."""
import unittest

EXPECTED_CODES = {"CLI4473", "CLI3098"}


def assert_inactive(before, after):
    assert {row["code"] for row in before} == EXPECTED_CODES
    assert {row["code"] for row in after} == EXPECTED_CODES
    originals = {row["code"]: row for row in before}
    for row in after:
        assert row["status"] == "inactive", row["code"]
        clean = lambda value: {k: v for k, v in value.items() if k not in ("status", "updated_at")}
        assert clean(row) == clean(originals[row["code"]]), "Unrelated client details changed"


class InactiveAssertionsTest(unittest.TestCase):
    def test_cli4473_must_be_inactive(self):
        before = [{"code": code, "status": "active"} for code in EXPECTED_CODES]
        after = [{"code": code, "status": "active" if code == "CLI4473" else "inactive"} for code in EXPECTED_CODES]
        with self.assertRaises(AssertionError):
            assert_inactive(before, after)

    def test_cli3098_must_be_inactive(self):
        before = [{"code": code, "status": "active"} for code in EXPECTED_CODES]
        after = [{"code": code, "status": "active" if code == "CLI3098" else "inactive"} for code in EXPECTED_CODES]
        with self.assertRaises(AssertionError):
            assert_inactive(before, after)

    def test_unrelated_details_cannot_change(self):
        before = [{"code": code, "status": "active", "name": "Original"} for code in EXPECTED_CODES]
        after = [{"code": code, "status": "inactive", "name": "Changed"} for code in EXPECTED_CODES]
        with self.assertRaises(AssertionError):
            assert_inactive(before, after)


if __name__ == "__main__":
    unittest.main()