#!/usr/bin/env python3
"""Reconstruct readable full HTML source from the four lossless payload files."""
import base64
import gzip
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
parts = []
for i in range(1, 5):
    code = (ROOT / f"payload-{i}.js").read_text("utf-8")
    match = re.fullmatch(r'\(globalThis\.SARAMEGURI_PARTS \|\|= \[\]\)\[' + str(i-1) + r'\]=("[A-Za-z0-9+/=]+")\s*;', code.strip())
    if not match:
        raise ValueError(f"Invalid payload {i}")
    parts.append(json.loads(match.group(1)))
html = gzip.decompress(base64.b64decode("".join(parts), validate=True))
digest = hashlib.sha256(html).hexdigest()
expected = "7b9786f8bf2938348deaf641af36244ceebef1198f3871593e3821c745bb929e"
if digest != expected:
    raise ValueError(f"SHA-256 mismatch: {digest}")
output = ROOT / "index.unpacked.html"
output.write_bytes(html)
print(f"Verified exact HTML {len(html)} bytes: {output}")
