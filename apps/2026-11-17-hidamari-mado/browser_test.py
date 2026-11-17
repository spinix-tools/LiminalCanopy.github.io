"""Chromium DOM interaction smoke tests with direct HTML/JS injection.
The sandbox blocks localhost and file navigation, so localStorage is mocked.
Run: python browser_test.py (requires playwright and Chromium).
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent
HTML=(ROOT/'index.html').read_text(encoding='utf-8').replace('<script src="engine.js"></script><script src="app.js"></script>','')
ENGINE=(ROOT/'engine.js').read_text(encoding='utf-8')
APP=(ROOT/'app.js').read_text(encoding='utf-8')

def boot(page,saved=None):
    page.set_content(HTML,wait_until='domcontentloaded')
    page.evaluate("""(saved) => {
        const store = saved ? {'hidamari-mado-v1': saved} : {};
        Object.defineProperty(window,'localStorage',{configurable:true, value: {
            getItem(k){return Object.prototype.hasOwnProperty.call(store,k) ? store[k] : null},
            setItem(k,v){store[k] = String(v)}, removeItem(k){delete store[k]}
        }});
    }""",saved)
    page.add_script_tag(content=ENGINE)
    page.add_script_tag(content=APP)
checks=[]
def check(name,condition):
    assert condition, name
    checks.append(name)

try:
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
        page=browser.new_page(viewport={'width':1440,'height':1024},accept_downloads=True)
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        requests=[]
        page.on('request',lambda request: requests.append(request.url))
        boot(page)
        check('title', 'ひだまり窓' in page.title())
        check('live computed', '時間' in page.locator('#direct-hours').inner_text() and '--' not in page.locator('#direct-hours').inner_text())
        check('24-hour timeline',page.locator('#timeline .segment').count()>1)
        check('12 months',page.locator('#months .month').count()==12)
        check('sunshine windows displayed',page.locator('#windows').inner_text().strip()!='')
        check('default localStorage persisted',page.evaluate("!!localStorage.getItem('hidamari-mado-v1')"))
        check('zero console errors',len(errors)==0)
        check('no external network requests',len(requests)==0)
        page.screenshot(path=str(ROOT/'desktop.png'),full_page=True)
        # changing a date and angle must affect calculation.
        before=page.locator('#direct-hours').inner_text()
        page.locator('#facing').select_option('0')
        page.locator('#settings button[type="submit"]').click()
        check('north-facing changes result',page.locator('#direct-hours').inner_text()!=before)
        saved=page.evaluate("localStorage.getItem('hidamari-mado-v1')")
        boot(page,saved)
        check('reload restores facing',page.locator('#facing').input_value()=='0')
        # Preset and physical overhang constraints.
        page.locator('[data-preset="tokyo"]').click()
        check('Tokyo preset selected',page.locator('#facing').input_value()=='180')
        page.locator('#depth').fill('5')
        page.locator('#clearance').fill('0.2')
        page.locator('#settings button[type="submit"]').click()
        roof=float(page.locator('#roof-hours').inner_text())
        check('overhang shows shade',roof>0)
        page.locator('#depth').fill('0')
        page.locator('#settings button[type="submit"]').click()
        check('no roof when no overhang',page.locator('#roof-hours').inner_text()=='0.0')
        # Validation: no incorrect silently-clamped states.
        page.locator('#lat').fill('100')
        page.locator('#settings button[type="submit"]').click()
        check('invalid latitude rejected','範囲外' in page.locator('#status').inner_text())
        page.locator('[data-preset="sapporo"]').click()
        check('Sapporo preset selected',page.locator('#facing').input_value()=='90')
        # CSV download contains selected day and monthly comparisons.
        with page.expect_download() as dl: page.locator('#csv').click()
        saved=ROOT/'browser-export-check.csv';dl.value.save_as(str(saved))
        data=saved.read_text(encoding='utf-8-sig')
        check('CSV contains 12 months',data.count('毎月15日')==12)
        check('CSV selected date',page.locator('#date').input_value() in data)
        page.locator('#reset').click()
        check('reset defaults',page.locator('#facing').input_value()=='180')
        # Print invoked (avoid print browser dialog)
        page.evaluate("window.__printed = false;window.print = () => window.__printed = true")
        page.locator('#print').click()
        check('print wired',page.evaluate('window.__printed'))
        # Narrow viewport and horizontal overflow check.
        page.set_viewport_size({'width':390,'height':844})
        page.screenshot(path=str(ROOT/'mobile.png'),full_page=True)
        check('mobile has no horizontal overflow',page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'))
        check('mobile controls functional',page.locator('#lat').is_visible() and page.locator('#csv').is_visible())
        check('no JS exceptions throughout',len(errors)==0)
        browser.close()
finally:
    pass
print(f'PASS {len(checks)}/{len(checks)} browser checks')
for x in checks:print('✓',x)