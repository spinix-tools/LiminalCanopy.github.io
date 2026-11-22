#!/usr/bin/env python3
"""Restore readable, fully standalone MVP source from the checked-in payload."""
from pathlib import Path
import base64
import gzip
import hashlib

directory = Path(__file__).resolve().parent
payload = "".join(
    (directory / f"payload.part{i}.b64").read_text(encoding="ascii")
    for i in range(1, 5)
)
source = gzip.decompress(base64.b64decode(payload, validate=True))
expected = "4845d56396b2922792d36ec4565d73188b2fbc97e458cc02f71954d7abe9ade7"
actual = hashlib.sha256(source).hexdigest()
if actual != expected:
    raise SystemExit(f"Source checksum mismatch: {actual}")
output = directory / "source.html"
output.write_bytes(source)
print(f"Restored {output} ({len(source)} bytes, SHA256 verified)")
