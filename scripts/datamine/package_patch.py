"""Package only validated JSON changes for the separate GitHub write job."""
from pathlib import Path
import subprocess

from update import OUTPUTS, PUBLIC, ROOT, validate

validate(PUBLIC)
allowed = {f"apps/web/public/{name}" for name in OUTPUTS}
changed = subprocess.check_output(["git", "diff", "--name-only"], cwd=ROOT, text=True).splitlines()
unexpected = set(changed) - allowed
if unexpected:
    raise SystemExit("Refusing to publish unexpected changes: " + ", ".join(sorted(unexpected)))
patch = subprocess.check_output(["git", "diff", "--binary", "--", *sorted(allowed)], cwd=ROOT)
if not patch:
    raise SystemExit("The updater reported changes but generated no patch")
destination = ROOT / ".local/datamine.patch"
destination.parent.mkdir(parents=True, exist_ok=True)
destination.write_bytes(patch)
print(f"Packaged {len(changed)} generated JSON files ({len(patch)} bytes)")
