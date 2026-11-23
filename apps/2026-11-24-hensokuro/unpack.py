"""Offline unpacker for the GitHub compressed distribution; only stdlib required."""
from pathlib import Path
import base64, gzip, hashlib, re
folder=Path(__file__).resolve().parent
s=(folder/'payload.js').read_text('utf-8')
m=re.fullmatch(r'window\.HENSOKURO_PAYLOAD="([A-Za-z0-9+/=]+)";\s*',s)
if not m: raise SystemExit('Malformed payload.js')
content=gzip.decompress(base64.b64decode(m.group(1),validate=True))
if b'<title>\xe5\xa4\x89\xe9\x80\x9f\xe8\xb7\xaf' not in content: raise SystemExit('Unexpected source')
out=folder/'index.unpacked.html';out.write_bytes(content)
print(f'{out}: {len(content)} bytes, SHA-256 {hashlib.sha256(content).hexdigest()}')
