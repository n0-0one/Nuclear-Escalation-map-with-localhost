"""Check the Windows data boundary independently of the release workflow."""
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from build_feed import build, safe_strings
from update import OUTPUTS, PUBLIC
from hud_names import add_names

class FeedTests(unittest.TestCase):
    def test_hud_names_use_exact_short_english_localization(self):
        specs = {'launcher': {'model': 'test'}, 'unknown': {'model': 'other'}}
        add_names(specs, '"<ID|readonly|noverify>";"<English>"\n"launcher_0";"Long name"\n"launcher_1";"Short (TELAR)"\n')
        self.assertEqual(specs['launcher']['hud_names'], ['Short (TELAR)'])
        self.assertEqual(specs['unknown']['hud_names'], [])
    def test_deterministic_pack_contains_only_allowlisted_data(self):
        with tempfile.TemporaryDirectory(prefix='ntl-feed-') as directory:
            root = Path(directory)
            first = build(PUBLIC, root / 'first')
            second = build(PUBLIC, root / 'second')
            self.assertEqual(first, second)
            payload = (root / 'first' / first['pack']).read_bytes()
            self.assertEqual(hashlib.sha256(payload).hexdigest(), first['sha256'])
            self.assertEqual(len(payload), first['bytes'])
            self.assertEqual(set(json.loads(payload)['files']), set(OUTPUTS))
    def test_display_strings_cannot_carry_markup_or_unsafe_keys(self):
        for value in ['<script>', {'constructor': 'bad'}, 'line\x00break']:
            with self.assertRaises(ValueError):
                safe_strings(value)

if __name__ == '__main__':
    unittest.main()
