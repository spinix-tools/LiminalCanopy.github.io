"""Playwright smoke test; direct file:// if allowed, else identical sources inlined into about:blank."""
from pathlib import Path
from playwright.sync_api import sync_playwright
from playwright._impl._errors import Error as PlaywrightError
import json

ROOT = Path(__file__).parent.resolve()
URL = (ROOT / 'index.html').as_uri()
checks = []
HTML = (ROOT/'index.html').read_text(encoding='utf-8')
CSS = (ROOT/'style.css').read_text(encoding='utf-8')
ENGINE = (ROOT/'engine.js').read_text(encoding='utf-8')
APP = (ROOT/'app.js').read_text(encoding='utf-8')
INLINED_HTML = (HTML
    .replace('<link rel="stylesheet" href="style.css">', '<style>'+CSS+'</style>')
    .replace('<script src="engine.js" defer></script>', '')
    .replace('<script src="app.js" defer></script>', '')
    .replace('</body>', '<script>'+ENGINE+'</script><script>'+APP+'</script></body>'))
mode = 'inlined'
def load_test(page):
    global mode
    if mode == 'file':
        try:
            page.goto(URL, wait_until='load')
            return
        except PlaywrightError as ex:
            if 'ERR_BLOCKED_BY_ADMINISTRATOR' not in str(ex): raise
            mode = 'inlined'
            page.goto('about:blank', wait_until='load')
    page.evaluate("""() => {if (!window.__testStorage) window.__testStorage = {}; Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>window.__testStorage[k]??null,setItem:(k,v)=>window.__testStorage[k]=String(v),removeItem:k=>delete window.__testStorage[k]}})}""")
    page.set_content(INLINED_HTML, wait_until='load')
def check(name, condition):
    assert condition, name
    checks.append(name)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    context = browser.new_context(accept_downloads=True, viewport={'width': 1440, 'height': 980})
    page = context.new_page()
    load_test(page)
    check('title', page.title().startswith('停電配分室'))
    check('6 sample devices', page.locator('#devices-body tr').count() == 6)
    check('A/B rendered', page.locator('.result-card').count() == 2)
    check('SVG graph rendered', page.locator('#chart svg path').count() == 2)
    check('first-day 24 rows', page.locator('#hour-rows tr').count() == 24)
    check('warnings visible', page.locator('#warnings li').count() >= 1)
    page.screenshot(path=str(ROOT / 'desktop.png'), full_page=True)

    page.locator('[data-setting="capacityWh"]').fill('2400')
    page.locator('[data-setting="capacityWh"]').press('Tab')
    check('battery capacity editable', page.locator('[data-setting="capacityWh"]').input_value() == '2400')
    check('persisted local storage', '2400' in page.evaluate('localStorage.getItem("teiden-haibun-v1")'))
    load_test(page)
    check('reload retains capacity', page.locator('[data-setting="capacityWh"]').input_value() == '2400')

    page.locator('[data-setting="hours"]').select_option('72')
    check('72h controls day switch', page.locator('#day-select option').count() == 3)
    page.locator('#day-select').select_option('3')
    check('day 3 rows appear', page.locator('#hour-rows tr').count() == 24)
    check('last hour 23:00 exists', '23:00' in page.locator('#hour-rows').inner_text())

    page.locator('#add-device').click()
    check('add device', page.locator('#devices-body tr').count() == 7)
    last = page.locator('#devices-body tr').last
    last.locator('[data-field="name"]').fill('試験機器 <script>')
    last.locator('[data-field="name"]').press('Tab')
    check('name text safely escaped', page.locator('#devices-body script').count() == 0)
    check('name roundtrip', page.locator('#devices-body tr').last.locator('[data-field="name"]').input_value() == '試験機器 <script>')
    last = page.locator('#devices-body tr').last
    last.locator('[data-field="watts"]').fill('350')
    last.locator('[data-field="watts"]').press('Tab')
    check('edited watts retained', page.locator('#devices-body tr').last.locator('[data-field="watts"]').input_value() == '350')
    page.locator('#devices-body tr').last.locator('[data-remove]').click()
    check('delete device', page.locator('#devices-body tr').count() == 6)

    with page.expect_download() as d:
        page.locator('#export-json').click()
    jsd=d.value
    contents=Path(jsd.path()).read_text()
    check('JSON export', json.loads(contents)['settings']['capacityWh'] == 2400)
    with page.expect_download() as d:
        page.locator('#export-csv').click()
    csv = Path(d.value.path()).read_text(encoding='utf-8-sig')
    check('CSV export 72 rows', len(csv.splitlines()) == 73)
    check('CSV header', csv.startswith('hour,baseline_soc_pct'))

    import_file = ROOT / 'test-import.json'
    import_file.write_text(json.dumps({'settings': {'capacityWh': 3100, 'initialPct': 90, 'reservePct': 10, 'efficiencyPct': 80, 'outputW': 800, 'hours': 48}, 'devices':[{'name':'LED','watts':5,'count':2,'dutyPct':100,'start':0,'end':24,'tier':'must'}]},ensure_ascii=False), encoding='utf-8')
    page.locator('#import-file').set_input_files(str(import_file))
    page.wait_for_function('document.querySelector("[data-setting=capacityWh]").value === "3100"')
    check('JSON import restores settings', page.locator('[data-setting="capacityWh"]').input_value() == '3100')
    check('JSON import updates devices', page.locator('#devices-body tr').count() == 1)
    check('JSON import updates horizon', page.locator('[data-setting="hours"]').input_value() == '48')
    import_file.unlink()

    page.locator('#reset').click()
    check('sample reset', page.locator('#devices-body tr').count() == 6)
    check('sample reset battery', page.locator('[data-setting="capacityWh"]').input_value() == '1024')
    check('automatic saves after reset', json.loads(page.evaluate('localStorage.getItem("teiden-haibun-v1")'))['settings']['capacityWh'] == 1024)

    mobile = browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1,accept_downloads=True)
    mp = mobile.new_page()
    load_test(mp)
    check('mobile A/B cards', mp.locator('.result-card').count()==2)
    check('mobile no horizontal document overflow', mp.evaluate('document.documentElement.scrollWidth <= window.innerWidth+2'))
    mp.screenshot(path=str(ROOT/'mobile.png'),full_page=True)
    mobile.close()
    context.close()
    browser.close()

print(f'PASS: {len(checks)} browser checks (mode={mode}; localStorage, exports, imports, mobile)')
for x in checks: print('  ✓',x)
