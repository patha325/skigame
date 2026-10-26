"""Fetch pinned browser libraries, verifying their bytes before saving them."""
import hashlib
import json
from pathlib import Path
from urllib.request import Request, urlopen


def verify_asset(content, expected):
    if hashlib.sha256(content).hexdigest() != expected:
        raise ValueError('Library checksum mismatch; downloaded content was not saved.')


def ensure_vendor(root):
    root = Path(root)
    manifest = json.loads((root / 'vendor' / 'manifest.json').read_text())
    for asset in manifest:
        name = asset['path']
        if Path(name).name != name:
            raise ValueError('Invalid vendor filename')
        target = root / 'vendor' / name
        if target.exists() and hashlib.sha256(target.read_bytes()).hexdigest() == asset['sha256']:
            continue
        print(f'Downloading pinned library: {name}', flush=True)
        request = Request(asset['url'], headers={'User-Agent': 'NordicLine/0.1'})
        with urlopen(request, timeout=45) as response:
            content = response.read()
        verify_asset(content, asset['sha256'])
        target.write_bytes(content)


if __name__ == '__main__':
    ensure_vendor(Path(__file__).resolve().parent)
