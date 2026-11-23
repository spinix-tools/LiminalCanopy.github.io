#!/usr/bin/env python3
"""Restore ATSUTABA's complete browser-only HTML from payload.js."""
from pathlib import Path
import base64
import gzip
import hashlib
import re

folder = Path(__file__).resolve().parent
encoded = (folder / "payload.js").read_text(encoding="utf-8")
match = re.search(r'ATSUTABA_PAYLOAD="([A-Za-z0-9+/=]+)"', encoded)
if not match:
    raise SystemExit("ATSUTABA_PAYLOAD not found in payload.js")
source = gzip.decompress(base64.b64decode(match.group(1)))
digest = hashlib.sha256(source).hexdigest()
expected = "a1d704454085e3e76da72a186fd595ac4d8d19e6f5a82d8f5b08cd82e8ec69d2"
if digest != expected:
    raise SystemExit("Digest mismatch; payload may be corrupted: " + digest)
(folder / "standalone.html").write_bytes(source)
print("Verified and restored standalone.html: SHA-256 " + digest)
