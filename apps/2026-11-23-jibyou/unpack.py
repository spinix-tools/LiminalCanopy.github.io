"""Restore standalone.html from payload.js. No external dependencies."""
from pathlib import Path
import re, json, base64, gzip, hashlib
p = Path(__file__).resolve().parent
s = (p/'payload.js').read_text(encoding='utf-8')
m = re.search(r'window\.__JIBYOU_B64=("[A-Za-z0-9+/=]+")', s)
if not m: raise SystemExit('payload.jsが見つかりません。')
raw = gzip.decompress(base64.b64decode(json.loads(m.group(1))))
out = p/'standalone.html'
out.write_bytes(raw)
print(f'{out}: {len(raw)} bytes, SHA-256 {hashlib.sha256(raw).hexdigest()}')
