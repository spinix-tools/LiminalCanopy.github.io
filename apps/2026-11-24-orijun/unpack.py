#!/usr/bin/env python3
"""Restore the readable standalone HTML from the GitHub web entrypoint."""
from pathlib import Path
import re, base64, gzip, hashlib

root = Path(__file__).resolve().parent
text = (root / "index.html").read_text(encoding="utf-8")
match = re.search(r'<script id="payload" type="application/octet-stream">([A-Za-z0-9+/=]+)</script>', text)
if not match:
    raise SystemExit("Embedded payload not found")
raw = gzip.decompress(base64.b64decode(match.group(1)))
expected = "92b7feba93aea3707750ca1f8d6a79c76979c3e3bf05afafd327b84a3b4767e5"
assert hashlib.sha256(raw).hexdigest() == expected, "SHA-256 mismatch"
out = root / "standalone.html"
out.write_bytes(raw)
print(f"Restored {out}: {len(raw)} bytes, SHA256 {expected}")
