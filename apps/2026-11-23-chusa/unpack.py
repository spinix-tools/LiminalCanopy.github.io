"""Restore the readable lightweight HTML from GitHub index.html (standard library only)."""
from pathlib import Path
import base64, gzip, hashlib, re
source = Path(__file__).with_name('index.html').read_text(encoding='utf-8')
match = re.search(r'<script id="packed" type="application/octet-stream">([A-Za-z0-9+/=]+)</script>', source)
if not match:
    raise SystemExit('gzip payload not found')
html = gzip.decompress(base64.b64decode(match.group(1)))
out = Path(__file__).with_name('readable-lite.html')
out.write_bytes(html)
print('Restored', len(html), 'bytes, sha256', hashlib.sha256(html).hexdigest())
