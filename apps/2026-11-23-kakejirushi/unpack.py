"""Restore readable KAKEJIRUSHI app from GitHub's standalone gzip loader."""
from pathlib import Path
import base64
import gzip
import hashlib
import re

root = Path(__file__).resolve().parent
html = (root / "index.html").read_text(encoding="utf-8")
match = re.search(
    r'<script id="gzip-payload" type="application/octet-stream">([A-Za-z0-9+/=]+)</script>',
    html,
)
if not match:
    raise SystemExit("gzip-payload not found in index.html")
raw = gzip.decompress(base64.b64decode(match.group(1)))
expected = "49becb0b67d45c4746fc0b0abecfcb91ee4f3420160ed0d77c131462d04caee3"
actual = hashlib.sha256(raw).hexdigest()
if actual != expected:
    raise SystemExit(f"SHA-256 mismatch: {actual}")
dest = root / "standalone.html"
dest.write_bytes(raw)
print(f"{dest.name}: {len(raw)} bytes, SHA-256 {actual}")
