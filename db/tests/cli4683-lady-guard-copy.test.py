"""Exact role copy without changing the reference or existing roles."""
import unittest

META = {'id', 'contract_id', 'created_at', 'updated_at', 'sort_order'}


def assert_role_copy(source, copied, before, after):
    assert {k: v for k, v in source.items() if k not in META} == {
        k: v for k, v in copied.items() if k not in META
    }, 'Lady Guard structure differs from CLI3098'
    existing = {r['id']: r for r in after if r['id'] != copied['id']}
    assert existing == {r['id']: r for r in before}, 'Existing resources changed'
    assert copied['contract_id'] == 'dfcfcd06-f9a0-430c-873f-9830e4e757fe'


class ExactCopyTest(unittest.TestCase):
    def setUp(self):
        self.source = dict(id='source', contract_id='reference', gross=26208, quantity=1,
                           shift_hours=8, deductions=[{'amount': 1800}], employer_contributions=[{'amount': 3000}, {'amount': 125}, {'amount': 125}, {'amount': 883.74}])
        self.copy = {**self.source, 'id': 'new', 'contract_id': 'dfcfcd06-f9a0-430c-873f-9830e4e757fe'}
        self.before = [dict(id='existing', gross=28444)]

    def test_exact_source_rate_required(self):
        with self.assertRaises(AssertionError):
            assert_role_copy(self.source, {**self.copy, 'gross': 26209}, self.before, [*self.before, self.copy])

    def test_existing_roles_preserved(self):
        with self.assertRaises(AssertionError):
            assert_role_copy(self.source, self.copy, self.before, [self.copy])

    def test_exact_copy_passes(self):
        assert_role_copy(self.source, self.copy, self.before, [*self.before, self.copy])


if __name__ == '__main__':
    unittest.main()