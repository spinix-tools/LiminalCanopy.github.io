# Python 3.8+ / standard library only. Reconstruct standalone.html from the gzip GitHub loader.
from pathlib import Path
import base64, gzip, hashlib, re
root=Path(__file__).resolve().parent
for name in ("index.html", "github-index.html"):
    file=root/name
    if not file.exists():
        continue
    found=re.search(r'const PACK="([A-Za-z0-9+/=]+)"',file.read_text(encoding="utf8"))
    if found:
        html=gzip.decompress(base64.b64decode(found.group(1)))
        (root/"standalone.html").write_bytes(html)
        print("Restored",len(html),"bytes; sha256",hashlib.sha256(html).hexdigest())
        break
else:
    raise SystemExit("No PACK found in index.html or github-index.html")
