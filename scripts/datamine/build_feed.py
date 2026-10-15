"""Package validated JSON for installed Windows applications; never includes code."""
import argparse
import hashlib
import json
from pathlib import Path
from update import OUTPUTS, PUBLIC, load, validate, verify_tooling


def safe_strings(value, depth=0):
    if depth > 64:
        raise ValueError('Data nesting is too deep')
    if isinstance(value, str):
        if len(value) > 4096 or '<' in value or '>' in value or any(ord(c) < 32 for c in value):
            raise ValueError('Data contains unsupported display text')
    elif isinstance(value, dict):
        for key, item in value.items():
            if key in {'__proto__', 'prototype', 'constructor'}:
                raise ValueError('Unsafe dictionary key')
            safe_strings(key, depth + 1)
            safe_strings(item, depth + 1)
    elif isinstance(value, list):
        for item in value:
            safe_strings(item, depth + 1)


def build(source: Path, output: Path):
    verify_tooling()
    validate(source)
    data = {name: load(source / name) for name in OUTPUTS}
    safe_strings(data)
    revision = data['datamine-lock.json']['accepted_commit']
    payload = json.dumps({'formatVersion': 1, 'datamineCommit': revision, 'files': data},
                         sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode('utf-8')
    if len(payload) > 32 * 1024 * 1024:
        raise ValueError('Windows data pack exceeds its size limit')
    digest = hashlib.sha256(payload).hexdigest()
    manifest = {'formatVersion': 1, 'datamineCommit': revision, 'sha256': digest,
                'bytes': len(payload), 'pack': f'packs/{digest}.json'}
    (output / 'packs').mkdir(parents=True, exist_ok=True)
    (output / manifest['pack']).write_bytes(payload)
    (output / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    return manifest


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=PUBLIC)
    parser.add_argument('--output', type=Path, default=Path('.local/windows-feed'))
    args = parser.parse_args()
    print(json.dumps(build(args.source, args.output)))
