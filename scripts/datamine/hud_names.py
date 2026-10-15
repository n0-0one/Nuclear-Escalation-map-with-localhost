"""Attach exact English short HUD names from the pinned localization source."""
import csv
import hashlib
import io
import json
from pathlib import Path
from urllib.request import Request, urlopen

SOURCE = 'lang.vromfs.bin_u/lang/units.csv'

def add_names(specs, text):
    reader = csv.reader(io.StringIO(text.lstrip('\ufeff')), delimiter=';')
    header = next(reader, [])
    if len(header) < 2 or 'English' not in header[1]:
        raise ValueError('Unexpected localization header')
    names = {row[0].strip().lower(): ' '.join(row[1].split()) for row in reader if len(row) > 1}
    for key, spec in specs.items():
        identity = str(spec.get('unit_class') or key).replace('\\', '/').lower()
        candidates = {identity, identity.rsplit('/', 1)[-1], key.lower()}
        spec['hud_names'] = sorted({names[f'{name}_1'] for name in candidates if names.get(f'{name}_1')})

def enrich(directory: Path):
    lock = json.loads((directory / 'datamine-lock.json').read_text(encoding='utf-8'))
    revision = lock['accepted_commit']
    source = next(item for item in lock['sources'] if item['path'] == SOURCE)
    url = f'https://raw.githubusercontent.com/gszabi99/War-Thunder-Datamine/{revision}/{SOURCE}'
    with urlopen(Request(url, headers={'User-Agent': 'Nuclear-Thunder-Live-data'}), timeout=60) as response:
        content = response.read(32 * 1024 * 1024 + 1)
    if len(content) > 32 * 1024 * 1024:
        raise ValueError('Localization source exceeds its size limit')
    digest = hashlib.sha1(f'blob {len(content)}\0'.encode() + content).hexdigest()
    if digest != source['sha']:
        raise ValueError('Localization source does not match its pinned Git blob')
    path = directory / 'unit_specs.json'
    specs = json.loads(path.read_text(encoding='utf-8'))
    add_names(specs, content.decode('utf-8-sig'))
    path.write_text(json.dumps(specs, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return sum(bool(spec['hud_names']) for spec in specs.values())

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', type=Path)
    print(f"Attached HUD names for {enrich(parser.parse_args().directory)} unit models.")
