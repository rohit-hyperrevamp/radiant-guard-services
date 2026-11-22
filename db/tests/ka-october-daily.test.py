import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location(
    "ka_october_daily", Path(__file__).parents[1] / "imports" / "ka_october_daily.py")
if spec is None or spec.loader is None:
    raise RuntimeError("Attendance importer module missing")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class DailyAttendanceTests(unittest.TestCase):
    def test_present_and_absent_dates_are_literal(self):
        self.assertEqual(module.daily_cells(["P", "A"]), [
            {"date": "2026-10-01", "code": "P"},
            {"date": "2026-10-02", "code": "A"}])

    def test_summary_columns_are_never_attendance(self):
        cells = [None] * 30 + ["A", 27, 4, 0, 1, 0, 27, "Ignore this"]
        self.assertEqual(module.daily_cells(cells), [{"date": "2026-10-31", "code": "A"}])

    def test_blank_days_are_not_invented_from_totals(self):
        self.assertEqual(module.daily_cells([None] * 31 + [27, 4]), [])

    def test_workbook_holiday_and_weekly_off_keep_their_meaning(self):
        self.assertEqual(module.daily_cells(["W", "H"]), [
            {"date": "2026-10-01", "code": "W"},
            {"date": "2026-10-02", "code": "PH"}])

    def test_unknown_daily_marks_fail_not_guess(self):
        with self.assertRaises(ValueError):
            module.daily_cells(["PA"])


if __name__ == "__main__":
    unittest.main()