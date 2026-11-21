"""End-to-end verification with real Chromium. Run: python browser_test.py"""
import json
import pathlib
import tempfile
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).parent
checks = []
def check(name, ok, detail=''):
    checks.append((name,bool(ok)))
    if not ok: raise AssertionError(f'{name}: {detail}')
# Browser policy blocks all local and external navigations. Serve identical source
# inline via document.write rather than pretending HTTP/file:// were tested.
html=(ROOT/'index.html').read_text('utf-8')
css=(ROOT/'style.css').read_text('utf-8')
engine=(ROOT/'engine.js').read_text('utf-8')
app=(ROOT/'app.js').read_text('utf-8')
html=html.replace('<link rel="stylesheet" href="style.css">', '<style>'+css+'</style>')
html=html.replace('<script defer src="engine.js"></script>', '')
html=html.replace('<script defer src="app.js"></script>', '')
html=html.replace('</body>', '<script>'+engine+'</script><script>'+app+'</script></body>')
def init_storage(page):
    page.evaluate("""() => { const data = {}; Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>Object.prototype.hasOwnProperty.call(data,k)?data[k]:null,setItem:(k,v)=>{data[k]=String(v)},removeItem:k=>{delete data[k]},clear:()=>{Object.keys(data).forEach(k=>delete data[k])}}}); }""")
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
    ctx=browser.new_context(viewport={'width':1440,'height':980},accept_downloads=True)
    page=ctx.new_page(); errors=[]; external=[]
    page.on('pageerror',lambda err:errors.append(str(err)))
    page.on('request',lambda req: external.append(req.url))
    init_storage(page)
    page.set_content(html,wait_until='load')
    check('app heading visible',page.get_by_role('heading',name='会場の条件').count()==1)
    check('initial devices six',page.locator('.device-card').count()==6)
    check('initial circuits two',page.locator('.circuit-row').count()==2)
    check('sample peak displayed',page.locator('#maxTotal').inner_text()=='3,340')
    check('sample has two overload buckets',page.locator('#overCount').inner_text()=='2')
    check('chart contains bars',page.locator('#chartArea svg rect').count()==32)
    check('risk includes 11:00', '11:00' in page.locator('#riskList').inner_text())
    check('chart has accessible title', page.locator('#chartArea svg title').count()>=1)
    page.screenshot(path=str(ROOT/'desktop.png'),full_page=True)
    page.locator('#optimizeBtn').click()
    check('optimizer proposes improvement', '2 → 0' in page.locator('#optimizerResult').inner_text())
    check('optimizer lists kettle shift', '湯沸かしポット' in page.locator('#optimizerResult').inner_text())
    page.locator('#applyProposal').click()
    check('applying suggestion eliminates overload', page.locator('#overCount').inner_text()=='0')
    check('time actually updated', page.locator('.device-card').nth(1).locator('[data-dfield=start]').input_value()=='570')
    check('localStorage contains plan',page.evaluate('!!localStorage.getItem("dengen-kasane-v1")'))
    page.set_content(html,wait_until='load')
    check('persistence survives reload',page.locator('.device-card').nth(1).locator('[data-dfield=start]').input_value()=='570')
    page.locator('#addDevice').click()
    check('add device works',page.locator('.device-card').count()==7)
    page.locator('.device-card').last.locator('[data-dfield=name]').fill('取扱い注意 / 仮機材')
    page.locator('.device-card').last.locator('[data-dfield=name]').dispatch_event('change')
    check('edit device works','取扱い注意' in page.locator('.device-card').last.inner_text() or page.locator('.device-card').last.locator('[data-dfield=name]').input_value().startswith('取扱い注意'))
    page.locator('.device-card').last.locator('[data-ddel]').click()
    check('delete device works',page.locator('.device-card').count()==6)
    page.locator('#addCircuit').click()
    check('add circuit works',page.locator('.circuit-row').count()==3)
    page.locator('.circuit-row').last.locator('[data-cdel]').click()
    check('delete circuit works',page.locator('.circuit-row').count()==2)
    page.locator('#venueLimit').fill('4000');page.locator('#venueLimit').dispatch_event('change')
    check('edit venue limit works',page.locator('#venueLimit').input_value()=='4000')
    page.locator('#eventTitle').fill('<img src=x onerror=alert(1)>');page.locator('#eventTitle').dispatch_event('change')
    check('HTML metacharacters safe',page.locator('#chartArea img').count()==0 and page.locator('#eventTitle').input_value().startswith('<img'))
    # clipboard permissions not required; clipboard success may be restricted by environment.
    with page.expect_download() as dl:
        page.locator('#saveJson').click()
    item=dl.value
    check('json download filename',item.suggested_filename=='dengen-kasane-plan.json')
    with tempfile.TemporaryDirectory() as td:
        target=pathlib.Path(td)/'plan.json';item.save_as(target)
        exported=json.loads(target.read_text())
        check('json contains edited title',exported['title'].startswith('<img'))
        with page.expect_download() as dc:
            page.locator('#exportCsv').click()
        csv=dc.value;csvpath=pathlib.Path(td)/'export.csv';csv.save_as(csvpath)
        check('csv download filename',csv.suggested_filename=='dengen-kasane-equipment.csv')
        check('csv UTF-8 BOM',csvpath.read_bytes().startswith(b'\xef\xbb\xbf'))
        check('csv includes equipment', 'ホットプレート' in csvpath.read_text(encoding='utf-8-sig'))
        # Reset app, then restore JSON from browser file upload.
        page.on('dialog',lambda d:d.accept())
        page.locator('#resetBtn').click()
        check('reset works',page.locator('#eventTitle').input_value()=='週末マルシェ / A区画')
        page.locator('#fileInput').set_input_files(str(target))
        check('import restores title',page.locator('#eventTitle').input_value().startswith('<img'))
        check('import restores venue limit',page.locator('#venueLimit').input_value()=='4000')
        bad=pathlib.Path(td)/'bad.json';bad.write_text('{"hello":"world"}')
        page.locator('#fileInput').set_input_files(str(bad))
        check('invalid import is rejected', '読込できません' in page.locator('#toast').inner_text())
        check('invalid import preserves plan',page.locator('#venueLimit').input_value()=='4000')
    check('no JavaScript errors',len(errors)==0,errors)
    check('no external network requests',len(external)==0,external)
    mobile=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1,accept_downloads=True)
    m=mobile.new_page();init_storage(m);m.set_content(html,wait_until='load')
    check('mobile app loads',m.get_by_role('heading',name='重なり診断').count()==1)
    check('mobile no horizontal page overflow',m.evaluate('document.documentElement.scrollWidth <= window.innerWidth+1'),m.evaluate('[document.documentElement.scrollWidth, window.innerWidth]'))
    m.screenshot(path=str(ROOT/'mobile.png'),full_page=True)
    check('mobile optimizer interactive',m.locator('#optimizeBtn').is_visible())
    check('mobile device inputs visible',m.locator('.device-card').first.locator('[data-dfield=watts]').is_visible())
    browser.close()
print(f'CHROMIUM: {len(checks)}/{len(checks)} checks OK')
for name,_ in checks:print('PASS',name)
