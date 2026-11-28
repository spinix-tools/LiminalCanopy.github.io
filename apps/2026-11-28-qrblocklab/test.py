"""Requires Node.js, qrcode, playwright and Chromium. No network."""
import json, subprocess, pathlib, random
import qrcode, qrcode.base as base, qrcode.constants as C
from playwright.sync_api import sync_playwright
p=pathlib.Path(__file__).resolve().parent
core=(p/'index.html').read_text().split('<script id="core">')[1].split('</script>')[0]
js=core+''';const result=[];for(let v=1;v<=6;v++)for(const e of 'LMQH'){const m=model(v,e);result.push(m)}console.log(JSON.stringify(result))'''
models=json.loads(subprocess.check_output(['node','-e',js]))
for m in models:
    v=m['v']; e=getattr(C,'ERROR_CORRECT_'+m['ec']); n=m['n']; blocks=base.rs_blocks(v,e)
    assert m['data']==[b.data_count for b in blocks]
    assert all(b.total_count-b.data_count==m['ecc'] for b in blocks)
    expected=[]
    for offset in range(max(b.data_count for b in blocks)):
        expected += [i for i,b in enumerate(blocks) if offset<b.data_count]
    for offset in range(m['ecc']): expected += list(range(len(blocks)))
    assert m['owner']==expected
    # Independently recover bit coordinates from Python qrcode's mapper, using
    # unique binary labels for each bit, encoded as a series of payloads.
    qr=qrcode.QRCode(version=v,error_correction=e); qr.modules_count=n
    qr.modules=[[None]*n for _ in range(n)]
    qr.setup_position_probe_pattern(0,0); qr.setup_position_probe_pattern(n-7,0); qr.setup_position_probe_pattern(0,n-7)
    qr.setup_position_adjust_pattern(); qr.setup_timing_pattern(); qr.setup_type_info(True,0)
    blank=[r[:] for r in qr.modules]; ids=[[0]*n for _ in range(n)]; count=len(expected)*8
    for k in range((count+1).bit_length()):
        data=[sum((((i*8+j+1)>>k)&1)<<(7-j) for j in range(8)) for i in range(len(expected))]
        qr.modules=[r[:] for r in blank]; qr.map_data(data,0)
        for y in range(n):
            for x in range(n):
                if blank[y][x] is None and (bool(qr.modules[y][x]) != ((x+y)%2==0)): ids[y][x]|=1<<k
    ref=[[-2 if blank[y][x] is not None else (ids[y][x]-1)//8 if ids[y][x] else -1 for x in range(n)] for y in range(n)]
    assert ref==m['grid'], (v,m['ec'])
print('24/24 QR maps and interleaving matched Python qrcode')
rng=random.Random(17);cases=[]
for i in range(150):
    m=rng.choice(models); n=m['n'];w=rng.randint(1,n);h=rng.randint(1,n);r=dict(x=rng.randint(0,n-w),y=rng.randint(0,n-h),w=w,h=h);cases.append([m['v'],m['ec'],r,rng.randrange(0,5)])
js=core+';console.log(JSON.stringify('+json.dumps(cases)+'.map(([v,e,r,s])=>{const m=model(v,e);return [inspect(m,r,s),optimize(m,r,s)]})))'
results=json.loads(subprocess.check_output(['node','-e',js]))
for (v,e,r,s),(a,b) in zip(cases,results):
    m=next(m for m in models if m['v']==v and m['ec']==e);n=m['n'];g=m['grid'];owner=m['owner']
    def calc(x,y):
        cells=[g[j][i] for j in range(y,y+r['h']) for i in range(x,x+r['w'])]; counts=[len({c for c in cells if c>=0 and owner[c]==i}) for i in range(len(m['data']))];return cells.count(-2),max(counts),(x-r['x'])**2+(y-r['y'])**2,sum(counts),y,x,counts
    expected=calc(r['x'],r['y']); assert a['counts']==expected[-1] and a['func']==expected[0] and a['pass']==(expected[0]==0 and expected[1]+s<=m['cap'])
    best=min(calc(x,y) for y in range(n-r['h']+1) for x in range(n-r['w']+1));assert b['rect']['x']==best[5] and b['rect']['y']==best[4] and b['counts']==best[-1]
print('150/150 rectangle and placement comparisons passed')
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=browser.new_page(viewport={'width':1100,'height':1120},accept_downloads=True);errors=[];external=[]
    page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:external.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((p/'index.html').read_text());assert page.locator('#worst').inner_text()=='6 / 11';page.screenshot(path=str(p/'desktop.png'),full_page=True)
    page.click('#opt');assert page.locator('#worst').inner_text()=='5 / 11';assert page.locator('#func').inner_text()=='0'
    with page.expect_download() as event:page.click('#export')
    report=json.loads(pathlib.Path(event.value.path()).read_text());assert report['counts']==[4,4,5,5] and report['rect']['y']==26
    page.fill('#w','999');assert page.locator('#export').is_disabled() and page.locator('#error').inner_text()
    page.click('#reset');page.select_option('#v','1');assert page.locator('#error').inner_text()=='';page.fill('#x','0');page.fill('#y','0');assert int(page.locator('#func').inner_text())>0
    page.click('#reset');page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.screenshot(path=str(p/'mobile.png'),full_page=True)
    assert not errors and not external,(errors,external);browser.close()
print('Chromium: sample, optimize, download, invalid input, version, functional hit, mobile; no JS errors or HTTP requests')
