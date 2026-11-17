"""Interactive browser acceptance tests: python browser_test.py (requires Playwright + Chromium)."""
from pathlib import Path
import json, re
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent
checks=[]
def ok(name, cond):
    checks.append((name,bool(cond)))
    if not cond: raise AssertionError(name)

HTML=re.sub(r'<script src="(?:engine|app)\.js"></script>','', (ROOT/'index.html').read_text())
ENGINE=(ROOT/'engine.js').read_text()
APP=(ROOT/'app.js').read_text()
def setup_page(page, backup=None):
    page.set_content(HTML, wait_until='load')
    # Local storage can be blocked in managed sandboxes, so emulate only the storage API.
    page.evaluate("""(backup) => {
        window.__testStorage = Object.assign({}, backup || {});
        Object.defineProperty(window,'localStorage',{configurable:true,value:{
            getItem(k){return window.__testStorage[k] ?? null},
            setItem(k,v){window.__testStorage[k]=String(v)},
            removeItem(k){delete window.__testStorage[k]}
        }});
    }""", backup)
    page.add_script_tag(content=ENGINE)
    page.add_script_tag(content=APP)

try:
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
        context=browser.new_context(viewport={'width':1365,'height':900},accept_downloads=True)
        page=context.new_page()
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        setup_page(page)
        ok('page loaded',page.title().startswith('鮮度まわし'))
        ok('demo has 3 products',page.locator('#product-rows tr').count()==3)
        ok('demo has 5 lots',page.locator('#lots-rows tr').count()==5)
        ok('14 forecast rows',page.locator('#forecast-rows tr').count()==14)
        ok('chart has SVG bars',page.locator('#chart svg rect').count()>0)
        ok('summary populated',page.locator('#metric-waste').inner_text()!='--')
        ok('no initial JS error',not errors)
        page.screenshot(path=str(ROOT/'desktop.png'),full_page=True)
        page.locator('#days').select_option('7')
        ok('interactive horizon change',page.locator('#forecast-rows tr').count()==7)
        page.locator('#uplift').select_option('1')
        ok('interactive campaign percentage', '100%増' in page.locator('#insight').inner_text())
        page.locator('#product-name').fill('試作品クッキー')
        page.locator('#product-unit').fill('袋')
        page.locator('#product-daily').fill('4')
        page.locator('#product-cost').fill('120')
        page.locator('#product-price').fill('380')
        page.locator('#product-form button[type=submit]').click()
        ok('new product created',page.locator('#product-rows tr').count()==4)
        ok('new product selectable',page.locator('#lot-product option').count()==4)
        product_id=page.locator('#lot-product option').last.get_attribute('value')
        page.locator('#lot-product').select_option(product_id)
        page.locator('#lot-label').fill('実験ロット')
        page.locator('#lot-qty').fill('11')
        page.locator('#lot-expiry').fill('2026-12-30')
        page.locator('#lot-form button[type=submit]').click()
        ok('new lot created',page.locator('#lots-rows tr').count()==6)
        ok('lot label visible',page.get_by_text('実験ロット').count()>0)
        page.locator('#move-product').select_option(product_id)
        page.locator('#move-qty').fill('3')
        page.locator('#move-date').fill('2026-11-17')
        page.locator('#movement-form button[type=submit]').click()
        ok('sale created',page.locator('#movement-rows tr').count()==1)
        ok('stock correctly reduced',page.locator('#lots-rows').inner_text().find('8 袋')>=0)
        page.locator('#undo').click()
        ok('undo restored stock',page.locator('#lots-rows').inner_text().find('11 袋')>=0)
        ok('undo cleared transaction log', '実績はまだありません' in page.locator('#movement-rows').inner_text())
        page.locator('#lots-rows button[data-action=edit-lot]').last.click()
        ok('edit lot loads form',page.locator('#lot-label').input_value()=='実験ロット')
        page.locator('#lot-label').fill('改訂ロット')
        page.locator('#lot-form button[type=submit]').click()
        ok('edit lot persists', '改訂ロット' in page.locator('#lots-rows').inner_text())
        # Injection input must be shown literally and not as a DOM element.
        page.locator('#product-name').fill('<img src=x onerror=alert(1)>')
        page.locator('#product-unit').fill('袋')
        page.locator('#product-daily').fill('1')
        page.locator('#product-cost').fill('1')
        page.locator('#product-price').fill('2')
        page.locator('#product-form button[type=submit]').click()
        ok('user text escaped as DOM text',page.locator('#product-rows img').count()==0)
        with page.expect_download() as a: page.locator('#export-json').click()
        download=a.value
        ok('JSON backup downloaded',download.suggested_filename.endswith('.json'))
        data=json.loads(Path(download.path()).read_text())
        ok('backup includes created lot', any(l['label']=='改訂ロット' for l in data['lots']))
        with page.expect_download() as a: page.locator('#export-csv').click()
        ok('CSV downloaded',a.value.suggested_filename.endswith('.csv'))
        with page.expect_download() as a: page.locator('#export-forecast').click()
        ok('forecast CSV downloaded',a.value.suggested_filename.endswith('.csv'))
        backup=page.evaluate('window.__testStorage')
        page.close()
        page=context.new_page()
        page.on('pageerror',lambda e: errors.append(str(e)))
        setup_page(page,backup)
        ok('localStorage data restored in new page via simulated storage','改訂ロット' in page.locator('#lots-rows').inner_text())
        # Reset and restore local JSON file.
        page.on('dialog', lambda d: d.accept())
        page.locator('#demo-reset').click()
        ok('demo reset has original 5 lots',page.locator('#lots-rows tr').count()==5)
        page.locator('#import-json').set_input_files({'name':'backup.json','mimeType':'application/json','buffer':json.dumps(data).encode('utf8')})
        ok('JSON restore replaced lot list','改訂ロット' in page.locator('#lots-rows').inner_text())
        ok('after interactions no JS errors',not errors)
        mobile=browser.new_page(viewport={'width':390,'height':844})
        setup_page(mobile)
        ok('mobile usable with scroll',mobile.locator('#forecast-panel').is_visible())
        ok('mobile no horizontal overflow',mobile.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'))
        mobile.screenshot(path=str(ROOT/'mobile.png'),full_page=True)
        browser.close()
finally:
    pass
print(f'BROWSER RESULT: {sum(x[1] for x in checks)}/{len(checks)} PASS')
for label,_ in checks:print('  PASS',label)