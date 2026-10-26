"""The first-run library downloader must reject unexpected library bytes."""
import hashlib
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from bootstrap import ensure_vendor, verify_asset
import json


class VendorTests(unittest.TestCase):
    def test_checksums_reject_changed_content(self):
        digest = hashlib.sha256(b'expected').hexdigest()
        verify_asset(b'expected', digest)
        with self.assertRaises(ValueError):
            verify_asset(b'changed', digest)

    def test_installed_library_is_used_without_network(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'vendor').mkdir()
            content = b'approved test fixture'
            (root / 'vendor' / 'example.js').write_bytes(content)
            (root / 'vendor' / 'manifest.json').write_text(json.dumps([{
                'path': 'example.js', 'sha256': hashlib.sha256(content).hexdigest(),
                'url': 'https://example.invalid/library',
            }]))
            with patch('bootstrap.urlopen', side_effect=AssertionError('Unexpected network')):
                ensure_vendor(root)


if __name__ == '__main__':
    unittest.main()
