#!/usr/bin/env python3
"""Restore verified readable standalone.html from GitHub payload.js (Python 3 stdlib)."""
from pathlib import Path
import gzip, base64, hashlib, re
root = Path(__file__).resolve().parent
text = (root / 'payload.js').read_text(encoding='utf-8')
match = re.fullmatch(r'window\.HONRIN_PAYLOAD\s*=\s*"([A-Za-z0-9+/=]+)";\s*', text)
if not match:
    raise SystemExit('Invalid payload.js format')
html = gzip.decompress(base64.b64decode(match.group(1), validate=True))
expected = '291d8a894d8404cd399ee5367a9c1e7a44c5292cc05208c323b8e7ed648c8056'
actual = hashlib.sha256(html).hexdigest()
if actual != expected:
    raise SystemExit(f'SHA-256 mismatch: {actual}')
(root / 'standalone.html').write_bytes(html)
print('Restored standalone.html; SHA-256 verified:', actual)
