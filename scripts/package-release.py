"""Package built artifacts and Git-tracked sources; never include live telemetry."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import zipfile

parser = argparse.ArgumentParser()
parser.add_argument('--desktop-dir', default='target/release')
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
version = json.loads((root / 'package.json').read_text(encoding='utf-8'))['version']
desktop = root / args.desktop_dir
output = root / 'release' / version
output.mkdir(parents=True, exist_ok=True)
inputs = {
    'Nuclear-Thunder-Live.exe': desktop / 'ntl-desktop.exe',
    'Nuclear-Thunder-Live-Setup.exe': desktop / 'bundle' / 'nsis' / f'Nuclear Thunder Live_{version}_x64-setup.exe',
    'ntl-bridge.exe': root / 'target' / 'release' / 'ntl-bridge.exe',
}
for name, path in inputs.items():
    if not path.is_file():
        raise FileNotFoundError(path)
    shutil.copy2(path, output / name)

def add_tree(archive, directory, prefix):
    for file in sorted(directory.rglob('*')):
        if file.is_file():
            archive.write(file, str(Path(prefix) / file.relative_to(directory)))

def add_docs(archive):
    archive.write(root / 'README.md', 'README.md')
    add_tree(archive, root / 'LICENSES', 'LICENSES')
    for file in sorted((root / 'docs').glob('*.md')):
        if file.name != 'master-request.md':
            archive.write(file, 'docs/' + file.name)

with zipfile.ZipFile(output / f'Nuclear-Thunder-Live-{version}-Windows.zip', 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    for name in ['Nuclear-Thunder-Live.exe', 'ntl-bridge.exe']:
        archive.write(output / name, name)
    add_docs(archive)
    archive.writestr('START-HERE.txt', 'Extract this folder and run Nuclear-Thunder-Live.exe. Requires WebView2.\nThe desktop connects to War Thunder directly. ntl-bridge.exe is optional and only needed for the browser version.\nSee README.md and docs/acceptance.md for usage and verified limits.\n')

with zipfile.ZipFile(output / f'Nuclear-Thunder-Live-{version}-Web.zip', 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    add_tree(archive, root / 'dist', 'dist')
    add_docs(archive)
    archive.writestr('START-HERE.txt', 'Serve the dist directory using any static HTTP server, for example:\npython -m http.server 4173 --bind 127.0.0.1 --directory dist\nThen open http://127.0.0.1:4173 . Do not open index.html using file://.\n')

tracked = subprocess.check_output(['git', 'ls-files', '-z'], cwd=root).decode('utf-8').split('\0')
if 'package.json' not in tracked:
    raise RuntimeError('Stage the source files in Git before packaging the source archive')
with zipfile.ZipFile(output / f'Nuclear-Thunder-Live-{version}-Source.zip', 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    for relative in tracked:
        if relative:
            archive.write(root / relative, f'nuclear-thunder-live-{version}/{relative}')

files = sorted(p for p in output.iterdir() if p.is_file() and p.name not in {'SHA256SUMS.txt', 'manifest.json'})
manifest = []
for file in files:
    with file.open('rb') as stream:
        digest = hashlib.file_digest(stream, 'sha256').hexdigest()
    manifest.append({'file': file.name, 'bytes': file.stat().st_size, 'sha256': digest})
(output / 'manifest.json').write_text(json.dumps({'version': version, 'files': manifest}, indent=2) + '\n', encoding='utf-8')
(output / 'SHA256SUMS.txt').write_text(''.join(f"{item['sha256']}  {item['file']}\n" for item in manifest), encoding='utf-8')
print(json.dumps({'output': str(output), 'files': manifest}, indent=2))
