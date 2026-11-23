# Python 3.8+ / standard library only. Reconstruct standalone.html from index.html
from pathlib import Path
import base64,gzip,re,hashlib
src=Path(__file__).with_name("index.html").read_text(encoding="utf8")
encoded=re.search(r'const PACK="([A-Za-z0-9+/=]+)"',src).group(1)
html=gzip.decompress(base64.b64decode(encoded))
Path(__file__).with_name("standalone.html").write_bytes(html)
print("Restored",len(html),"bytes; sha256",hashlib.sha256(html).hexdigest())
