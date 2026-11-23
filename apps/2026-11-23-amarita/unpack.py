#!/usr/bin/env python3
"""Recover the complete offline HTML from GitHub index.html: python unpack.py"""
from pathlib import Path
import re, gzip, base64
source = Path('index.html').read_text(encoding='utf-8')
match = re.search(r'<script id="payload" type="application/octet-stream">([A-Za-z0-9+/=\\s]+)</script>', source)
if not match:
    raise SystemExit('Payload not found; place this script beside the GitHub index.html')
result = gzip.decompress(base64.b64decode(''.join(match.group(1).split())))
Path('standalone.html').write_bytes(result)
print(f'Wrote standalone.html ({len(result):,} bytes)')
