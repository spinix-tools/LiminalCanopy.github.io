from pathlib import Path
import base64, gzip, re, hashlib
p = Path(__file__).parent
src = p / 'github-index.html' if (p / 'github-index.html').exists() else p / 'index.html'
match = re.search(r'<script id="payload" type="application/octet-stream">([^<]+)</script>', src.read_text(encoding='utf-8'))
if not match:
    raise SystemExit('No gzip payload found')
data = gzip.decompress(base64.b64decode(match.group(1), validate=True))
assert hashlib.sha256(data).hexdigest() == 'f44b22119bb2668802f860c41bc1075db57c8bd4b1608aff5f1775644dea635f'
with (p / 'standalone.html').open('xb') as out:
    out.write(data)
print('Restored standalone.html (SHA-256 verified)')
