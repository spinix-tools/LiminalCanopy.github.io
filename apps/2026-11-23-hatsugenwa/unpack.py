"""Restore the readable HTML packed into this directory's index.html."""
from pathlib import Path
import base64, gzip, re
src=Path(__file__).with_name('index.html')
m=re.search(r'const payload = "([A-Za-z0-9+/=]+)";',src.read_text('utf-8'))
if not m:
    raise SystemExit('gzip payload not found in index.html')
data=gzip.decompress(base64.b64decode(m.group(1)))
assert data.startswith(b'<!doctype html>')
out=src.with_name('index-restored.html')
out.write_bytes(data)
print(f'Restored {out} ({len(data)} bytes)')
