#!/usr/bin/env python3
"""Restore ORIRAN's exact complete HTML source from the GitHub loader."""
from pathlib import Path
import base64, gzip, re, hashlib
source = Path(__file__).with_name('index.html').read_text(encoding='utf-8')
match = re.search(r'const packed="([A-Za-z0-9+/=]+)";', source)
if not match:
    raise SystemExit('圧縮ペイロードが見つかりません')
content = gzip.decompress(base64.b64decode(match.group(1)))
out = Path(__file__).with_name('standalone.html')
out.write_bytes(content)
print(f'{out} ({len(content):,} bytes) sha256={hashlib.sha256(content).hexdigest()}')
