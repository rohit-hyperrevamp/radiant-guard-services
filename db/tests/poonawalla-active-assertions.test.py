"""Checks for the explicit all-Poonawalla reactivation request."""
import unittest


def assert_restored(before, after, customer_ids):
    originals = {row['id']: row for row in before}
    assert set(originals) == {row['id'] for row in after}
    for row in after:
        original = originals[row['id']]
        if row['customer_id'] in customer_ids:
            assert row['status'] == 'active', row['code']
            assert {k: v for k, v in row.items() if k not in ('status', 'updated_at')} == {
                k: v for k, v in original.items() if k not in ('status', 'updated_at')
            }
        else:
            assert row == original, 'Unrelated client changed'


class PoonawallaRestorationTest(unittest.TestCase):
    def setUp(self):
        self.rows = [dict(id='p', code='CLI-P', customer_id='poonawalla', status='inactive', name='Original'),
                     dict(id='other', code='CLI4473', customer_id='bob', status='inactive', name='Other')]

    def test_every_poonawalla_client_must_be_active(self):
        with self.assertRaises(AssertionError):
            assert_restored(self.rows, self.rows, {'poonawalla'})

    def test_other_clients_must_stay_unchanged(self):
        after = [{**r, 'status': 'active'} for r in self.rows]
        with self.assertRaises(AssertionError):
            assert_restored(self.rows, after, {'poonawalla'})

    def test_only_status_can_change(self):
        after = [{**self.rows[0], 'status': 'active', 'name': 'Wrong'}, self.rows[1]]
        with self.assertRaises(AssertionError):
            assert_restored(self.rows, after, {'poonawalla'})

    def test_valid_reactivation(self):
        assert_restored(self.rows, [{**self.rows[0], 'status': 'active'}, self.rows[1]], {'poonawalla'})


if __name__ == '__main__':
    unittest.main()