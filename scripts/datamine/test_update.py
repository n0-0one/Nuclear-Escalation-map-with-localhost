"""Boundary regressions for the data-only updater. No network access required."""
import copy
import json
from pathlib import Path
import shutil
import tempfile
import unittest

from update import OUTPUTS, PUBLIC, changed_outputs, import_candidate, validate, verify_tooling


class DataImportTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="ntl-datamine-test-")
        self.addCleanup(self.temporary.cleanup)
        self.candidate = Path(self.temporary.name) / "candidate"
        self.destination = Path(self.temporary.name) / "destination"
        for folder in (self.candidate, self.destination):
            folder.mkdir()
            for name in OUTPUTS:
                shutil.copyfile(PUBLIC / name, folder / name)

    def change(self, name, callback):
        path = self.candidate / name
        value = json.loads(path.read_text(encoding="utf-8"))
        callback(value)
        path.write_text(json.dumps(value), encoding="utf-8")

    def test_checked_in_data_and_reviewed_extractor_are_valid(self):
        verify_tooling()
        self.assertGreater(validate(self.candidate)["sites"], 0)

    def test_new_commit_without_data_change_is_not_an_update(self):
        self.change("datamine-lock.json", lambda data: data.update(accepted_commit="a" * 40))
        self.assertEqual(changed_outputs(self.destination, self.candidate), [])

    def test_renderer_is_never_copied_and_check_is_read_only(self):
        renderer = self.destination / "legacy.js"
        renderer.write_text("our patched renderer", encoding="utf-8")
        (self.candidate / "legacy.js").write_text("upstream renderer", encoding="utf-8")
        self.change("unit_display_names.json", lambda data: data.update(test_model="Updated unit"))
        self.assertIn("unit_display_names.json", import_candidate(self.candidate, self.destination, False))
        self.assertNotIn("test_model", json.loads((self.destination / "unit_display_names.json").read_text()))
        self.assertEqual(renderer.read_text(), "our patched renderer")
        import_candidate(self.candidate, self.destination, True)
        self.assertEqual(renderer.read_text(), "our patched renderer")

    def test_invalid_variant_aborts_before_any_file_is_copied(self):
        self.change("unit_display_names.json", lambda data: data.update(test_model="Must not publish"))
        self.change("map_data_city_mirror.json", lambda data: data[0].update(world_pos=[float("inf"), 0, 0]))
        before = {name: (self.destination / name).read_bytes() for name in OUTPUTS}
        with self.assertRaises(ValueError):
            import_candidate(self.candidate, self.destination, True)
        self.assertEqual(before, {name: (self.destination / name).read_bytes() for name in OUTPUTS})

    def test_duplicate_site_and_missing_scenario_are_rejected(self):
        self.change("map_data.json", lambda data: data.append(copy.deepcopy(data[0])))
        with self.assertRaisesRegex(ValueError, "duplicate"):
            validate(self.candidate)
        shutil.copyfile(PUBLIC / "map_data.json", self.candidate / "map_data.json")
        self.change("map_data.json", lambda data: data[0]["units_by_era"].pop(next(iter(data[0]["units_by_era"]))))
        with self.assertRaisesRegex(ValueError, "Scenario coverage"):
            validate(self.candidate)

    def test_unknown_variant_cannot_silently_reach_the_renderer(self):
        self.change("presets.json", lambda data: data["variants"].append({"id": "future_map"}))
        with self.assertRaisesRegex(ValueError, "four known map variants"):
            validate(self.candidate)


if __name__ == "__main__":
    unittest.main()
