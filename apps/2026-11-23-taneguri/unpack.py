"""Restore exact standalone HTML from GitHub's index.html (or github-index.html)."""
from pathlib import Path
import re,base64,gzip,hashlib,sys
root=Path(__file__).parent
source=Path(sys.argv[1]) if len(sys.argv)>1 else (root/'index.html' if (root/'index.html').exists() else root/'github-index.html')
text=source.read_text(encoding='utf-8')
m=re.search(r'const PACKED="([A-Za-z0-9+/=]+)";',text)
h=re.search(r'const SOURCE_SHA256="([0-9a-f]{64})";',text)
if not m or not h: raise SystemExit('Gzip payload not found: use the packed GitHub index.html')
raw=gzip.decompress(base64.b64decode(m.group(1),validate=True))
assert hashlib.sha256(raw).hexdigest()==h.group(1), 'SHA-256 mismatch'
out=root/'restored-standalone.html';out.write_bytes(raw)
print('Verified SHA-256:',h.group(1));print('Saved:',out)
