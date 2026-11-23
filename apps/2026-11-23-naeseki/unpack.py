#!/usr/bin/env python3
"""Restore standalone.html from GitHub's payload-*.js with Python stdlib."""
import base64,gzip,re,hashlib
from pathlib import Path
root=Path(__file__).parent
chunks=[]
for i in range(1,4):
 s=(root/f'payload-{i}.js').read_text(encoding='utf-8')
 m=re.search(r"= '([A-Za-z0-9+/=]+)';",s)
 if not m: raise SystemExit(f'Invalid payload-{i}.js')
 chunks.append(m.group(1))
raw=gzip.decompress(base64.b64decode(''.join(chunks)))
(root/'standalone.html').write_bytes(raw)
print(f'restored {len(raw)} bytes, sha256={hashlib.sha256(raw).hexdigest()}')
