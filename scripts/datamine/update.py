"""Regenerate a bounded set of data files using the reviewed majorlier extractor.

The updater never downloads executable code and never replaces our renderer.
Run from the repository root: python scripts/datamine/update.py --check
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / "apps/web/public"
HERE = Path(__file__).resolve().parent
SUFFIXES = ("", "_mirror", "_city", "_city_mirror")
OUTPUTS = tuple(
    name for suffix in SUFFIXES
    for name in (f"map_data{suffix}.json", f"mission_logic{suffix}.json")
) + ("presets.json", "unit_specs.json", "unit_display_names.json", "datamine-lock.json")
MAX_FILE_BYTES = 16 * 1024 * 1024


def load(path: Path):
    if path.is_symlink() or path.stat().st_size > MAX_FILE_BYTES:
        raise ValueError(f"Unexpected file type or size: {path.name}")
    return json.loads(path.read_text(encoding="utf-8"), parse_constant=lambda value: (
        (_ for _ in ()).throw(ValueError(f"Non-finite JSON value: {value}"))
    ))


def position(value) -> bool:
    return isinstance(value, list) and len(value) == 3 and all(
        isinstance(number, (int, float)) and not isinstance(number, bool)
        and math.isfinite(number) and abs(number) <= 1_000_000
        for number in value
    )


def validate(directory: Path) -> dict:
    """Validate the whole candidate before copying any file into the app."""
    data = {name: load(directory / name) for name in OUTPUTS}
    presets = data["presets.json"]["presets"]
    ids = {preset["id"] for preset in presets}
    if not ids or len(ids) != len(presets) or any(
        not isinstance(value, str) or not re.fullmatch(r"rank-\d+-\d+", value)
        for value in ids
    ):
        raise ValueError("Scenario identifiers must be unique rank ranges")
    expected_variants = {"standard", "mirror", "city", "city_mirror"}
    if {entry["id"] for entry in data["presets.json"]["variants"]} != expected_variants:
        raise ValueError("The renderer requires the four known map variants")
    specs = data["unit_specs.json"]
    if not isinstance(specs, dict) or not specs or any(
        not isinstance(spec, dict) or not str(spec.get("model", "")).strip()
        for spec in specs.values()
    ):
        raise ValueError("Unit specifications must include model names")
    if not isinstance(data["unit_display_names.json"], dict):
        raise ValueError("Unit display names must be a dictionary")
    sites = units = 0
    for suffix in SUFFIXES:
        rows = data[f"map_data{suffix}.json"]
        if not isinstance(rows, list) or not rows:
            raise ValueError(f"Empty map data: {suffix or 'standard'}")
        names = set()
        for site in rows:
            name = site.get("name")
            if not isinstance(name, str) or not name or name in names:
                raise ValueError(f"Missing or duplicate site name: {name}")
            names.add(name)
            if site.get("team") not in (1, 2) or not position(site.get("world_pos")):
                raise ValueError(f"Invalid site team or position: {name}")
            for group in ("units_by_era", "buildings_by_era"):
                eras = site.get(group)
                if not isinstance(eras, dict) or set(eras) != ids:
                    raise ValueError(f"Scenario coverage mismatch: {name}/{group}")
                for components in eras.values():
                    if not isinstance(components, list):
                        raise ValueError(f"Invalid component list: {name}")
                    for component in components:
                        if not position(component.get("world_pos")):
                            raise ValueError(f"Invalid component position: {name}")
                        lifecycle = component.get("lifecycle")
                        if lifecycle and lifecycle.get("kind") not in {
                            "none", "restore", "repair_with_site", "mission_rule"
                        }:
                            raise ValueError(f"Unknown component lifecycle: {name}")
                        units += 1
        logic = data[f"mission_logic{suffix}.json"]
        if not isinstance(logic, dict) or not isinstance(logic.get("sites"), list):
            raise ValueError(f"Invalid mission logic: {suffix or 'standard'}")
        for site in logic["sites"]:
            if site.get("name") not in names or not position(site.get("world_pos")):
                raise ValueError(f"Mission logic refers to an invalid site: {site.get('name')}")
        sites += len(rows)
    lock = data["datamine-lock.json"]
    if lock.get("repository") != "gszabi99/War-Thunder-Datamine" or not re.fullmatch(
        r"[0-9a-f]{40}", lock.get("accepted_commit", "")
    ):
        raise ValueError("Missing pinned War Thunder datamine revision")
    if not isinstance(lock.get("sources"), list) or not lock["sources"]:
        raise ValueError("Datamine source hashes are required")
    return {"variants": 4, "scenarios": len(ids), "sites": sites, "components": units}


def verify_tooling() -> None:
    provenance = json.loads((HERE / "provenance.json").read_text(encoding="utf-8"))
    expected = provenance["files"]
    actual = {path.name for path in (HERE / "tools").iterdir() if path.is_file()}
    if actual != set(expected):
        raise ValueError("Extractor files differ from the reviewed provenance manifest")
    for name, digest in expected.items():
        content = (HERE / "tools" / name).read_bytes().replace(b"\r\n", b"\n")
        if hashlib.sha256(content).hexdigest() != digest:
            raise ValueError(f"Extractor changed without a provenance review: {name}")


def changed_outputs(before: Path, candidate: Path) -> list[str]:
    changes = []
    for name in OUTPUTS:
        left, right = load(before / name), load(candidate / name)
        if name == "datamine-lock.json":
            for value in (left, right):
                value.pop("accepted_commit", None)
                value["sources"] = sorted(value.get("sources", []), key=lambda item: item["path"])
        if left != right:
            changes.append(name)
    if changes and "datamine-lock.json" not in changes:
        changes.append("datamine-lock.json")
    return changes


def import_candidate(candidate: Path, destination: Path, apply: bool) -> list[str]:
    validate(candidate)
    changed = changed_outputs(destination, candidate)
    if apply:
        for name in changed:
            shutil.copyfile(candidate / name, destination / name)
    return changed


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Generate and validate without importing")
    parser.add_argument("--validate-only", action="store_true", help="Validate checked-in data without network access")
    parser.add_argument("--commit", help="Use a full datamine commit SHA for a reproducible run")
    parser.add_argument("--github-output", type=Path)
    parser.add_argument("--report", type=Path, default=ROOT / ".local/datamine-update-report.md")
    args = parser.parse_args()
    verify_tooling()
    print(json.dumps(validate(PUBLIC)))
    if args.validate_only:
        return 0
    if args.commit and not re.fullmatch(r"[0-9a-f]{40}", args.commit):
        parser.error("--commit must be a full 40-character hexadecimal commit SHA")
    args.report.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="ntl-datamine-") as temporary:
        staging = Path(temporary)
        shutil.copytree(HERE / "tools", staging / "tools", ignore=shutil.ignore_patterns("__pycache__"))
        for name in OUTPUTS:
            shutil.copyfile(PUBLIC / name, staging / name)
        command = [sys.executable, str(staging / "tools/update_from_datamine.py"), "--report", str(args.report.resolve())]
        if args.commit:
            command += ["--commit", args.commit]
        subprocess.run(command, check=True, cwd=staging, env={**os.environ, "PYTHONUTF8": "1"}, timeout=2700)
        from hud_names import enrich
        enrich(staging)
        statistics = validate(staging)
        changed = import_candidate(staging, PUBLIC, apply=not args.check)
        revision = load(staging / "datamine-lock.json")["accepted_commit"]
    with args.report.open("a", encoding="utf-8") as report:
        report.write("\n## Nuclear Thunder Live import\n\n")
        report.write(f"Validated {statistics['sites']} sites across four variants.\n\n")
        report.write("Only generated JSON data is eligible for import. Renderer, UI, workflows, terrain and artwork remain unchanged.\n\n")
        report.write("Changed files: " + (", ".join(changed) or "none") + ".\n")
        report.write("\n" + ("Check only: no app data was changed." if args.check else "Candidate data was imported; application tests and build must pass before publication.") + "\n")
    print(json.dumps({"changed": bool(changed), "files": changed, "datamine_commit": revision, "check_only": args.check}))
    if args.github_output:
        with args.github_output.open("a", encoding="utf-8") as output:
            output.write(f"changed={str(bool(changed)).lower()}\ndatamine_commit={revision}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
