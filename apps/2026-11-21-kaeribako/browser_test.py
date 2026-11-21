"""Chromium UI regression via inline source harness (file:// is blocked in sandbox)."""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent
def compiled_html(saved=None):
    import json
    html=(ROOT/'index.html').read_text(encoding='utf-8')
    css=(ROOT/'style.css').read_text(encoding='utf-8')
    engine=(ROOT/'engine.js').read_text(encoding='utf-8')
    app=(ROOT/'app.js').read_text(encoding='utf-8')
    html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+css+'</style>')
    storage="""<script>window.__stubStorage = {
        getItem(k){return this[k]||null;},
        setItem(k,v){this[k]=String(v);},
        removeItem(k){delete this[k];}
    };Object.defineProperty(window,'localStorage',{value:window.__stubStorage,configurable:true});</script>"""
    if saved is not None:
        storage=storage.replace('</script>',f'window.__stubStorage["kaeribako:settings:v1"]={json.dumps(saved)};</script>')
    return html.replace('<script src="engine.js"></script><script src="app.js" defer></script>',storage+'<script>'+engine+'</script><script>'+app+'</script>')
checks=[]
def check(label, condition):
    checks.append((label,bool(condition)))
    if not condition:raise AssertionError(label)

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page(viewport={'width':1440,'height':900},device_scale_factor=1,accept_downloads=True)
    errors=[]
    external=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:external.append(r.url) if r.url.startswith(('http://','https://')) else None)
    page.set_content(compiled_html(),wait_until='load')
    check('page title', 'かえり箱' in page.title())
    check('inline source is loaded',page.locator('script').count()>=3)
    check('sample routes present',page.locator('.route-card').count()==3)
    check('sample extra route present',page.locator('.extra-row').count()==1)
    check('35 days visible',page.locator('#dayRows tr').count()==35)
    check('chart SVG exists',page.locator('#chart svg').count()==1)
    check('sample baseline shortage numeric', '580' in page.locator('.metric').nth(0).inner_text())
    check('sample proposed shortage numeric','6' in page.locator('.metric').nth(1).inner_text())
    check('required stock baseline','252' in page.locator('.metric').nth(2).inner_text())
    check('required stock proposal','143' in page.locator('.metric').nth(3).inner_text())
    page.screenshot(path=str(ROOT/'desktop.png'),full_page=True)
    # Change initial inventory and witness recalculation.
    page.locator('#initialStock').fill('200');page.locator('#initialStock').dispatch_event('change')
    check('input changes recalc',page.locator('#initialStock').input_value()=='200' and '580' not in page.locator('.metric').nth(0).inner_text())
    # Reconfigure turnaround.
    page.locator('#returnDaysCut').fill('3');page.locator('#returnDaysCut').dispatch_event('change')
    check('comparison settings update',page.locator('#returnDaysCut').input_value()=='3')
    # Add, edit, reprioritize, delete route.
    page.locator('#addRoute').click()
    check('add route',page.locator('.route-card').count()==4)
    field=page.locator('.route-card').last.locator('[data-field="name"]')
    field.fill('週末イベント');field.dispatch_event('change')
    check('edit route name',page.locator('.route-card').last.locator('[data-field="name"]').input_value()=='週末イベント')
    page.locator('.route-card').last.locator('[data-day="0"]').check()
    check('weekday selection',page.locator('.route-card').last.locator('[data-day="0"]').is_checked())
    page.locator('.route-card').last.locator('[data-action="up"]').click()
    check('route reorder',page.locator('.route-card').nth(2).locator('[data-field="name"]').input_value()=='週末イベント')
    page.locator('.route-card').nth(2).locator('[data-action="delete"]').click()
    check('route delete',page.locator('.route-card').count()==3)
    # Extra dispatch editing.
    page.locator('#addExtra').click()
    check('add extra route',page.locator('.extra-row').count()==2)
    page.locator('.extra-row').last.locator('[data-field="qty"]').fill('47')
    page.locator('.extra-row').last.locator('[data-field="qty"]').dispatch_event('change')
    check('edit extra qty',page.locator('.extra-row').last.locator('[data-field="qty"]').input_value()=='47')
    page.locator('.extra-row').last.locator('[data-action="delete-extra"]').click()
    check('delete extra',page.locator('.extra-row').count()==1)
    # Fit a feasible stock budget automatically.
    page.locator('#fitStockSmall').click()
    check('fit stock shows zero shortage','0' in page.locator('.metric').nth(1).locator('.metric-number').inner_text())
    check('fit stock status message', '最小の追加箱数' in page.locator('#message').inner_text())
    # localStorage stays after reload.
    expected=page.locator('#initialStock').input_value()
    stored=page.evaluate('localStorage.getItem("kaeribako:settings:v1")')
    page.set_content(compiled_html(stored),wait_until='load')
    check('storage shim restores values',page.locator('#initialStock').input_value()==expected)
    # CSV+JSON actual download flow.
    with page.expect_download() as download_info:page.locator('#exportCSV').click()
    csv=download_info.value
    check('CSV download name',csv.suggested_filename=='kaeribako-daily.csv')
    content=Path(csv.path()).read_text(encoding='utf-8-sig')
    check('CSV header and rows','現状_欠品' in content and content.count('\n')>=34)
    with page.expect_download() as download_info:page.locator('#exportJSON').click()
    js=download_info.value
    check('JSON download name',js.suggested_filename=='kaeribako-plan.json')
    import json
    exported=json.loads(Path(js.path()).read_text(encoding='utf-8'))
    check('JSON content includes routes',len(exported['routes'])==3)
    # load a valid JSON config through real input file.
    page.locator('#fileInput').set_input_files({'name':'loaded.json','mimeType':'application/json','buffer':json.dumps({'startDate':'2026-12-15','days':14,'initialStock':15,'routes':[{'id':'a','name':'読込テスト','weekdays':[1,2],'qty':5,'returnDays':3,'washDays':1,'lossPct':0}],'extras':[],'whatIf':{'extraStock':7,'returnDaysCut':1,'washDaysCut':0}}).encode()})
    page.wait_for_function('document.getElementById("startDate").value === "2026-12-15"',timeout=3000)
    check('JSON import start date',page.locator('#startDate').input_value()=='2026-12-15')
    check('JSON import route',page.locator('.route-card').count()==1 and page.locator('.route-card').first.locator('[data-field="name"]').input_value()=='読込テスト')
    check('JSON import duration',page.locator('#dayRows tr').count()==14)
    page.locator('#resetSample').click()
    check('reset sample works',page.locator('.route-card').count()==3)
    # print invokes window.print.
    page.evaluate('window.__printed = 0; window.print = () => { window.__printed++; }')
    page.locator('#printPage').click()
    check('print button invokes print',page.evaluate('window.__printed')>=1)
    check('no external HTTP requests',len(external)==0)
    check('no JS exceptions',len(errors)==0)
    mobile=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1)
    mobile.set_content(compiled_html())
    check('mobile renders chart',mobile.locator('#chart svg').count()==1)
    check('mobile route cards accessible',mobile.locator('.route-card').count()==3)
    check('mobile document no horizontal overflow',mobile.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'))
    mobile.screenshot(path=str(ROOT/'mobile.png'),full_page=True)
    print('OK:',len(checks),'/',len(checks),'Chromium checks')
    for label,_ in checks:print('PASS',label)
    browser.close()
