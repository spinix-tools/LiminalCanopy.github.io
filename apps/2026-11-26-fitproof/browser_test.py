from pathlib import Path
from playwright.sync_api import sync_playwright
import json
p=Path(__file__).parent
with sync_playwright() as w:
    b=w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=b.new_page(viewport={'width':1200,'height':920},accept_downloads=True)
    errors=[]; requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:requests.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((p/'index.html').read_text())
    assert '許容内' in page.locator('#result').inner_text()
    print(page.locator('#result').inner_text())
    page.screenshot(path=str(p/'desktop.png'),full_page=True)
    with page.expect_download() as d: page.locator('#export').click()
    assert json.loads(Path(d.value.path()).read_text())['status']=='pass'
    page.locator('#target').fill('50'); assert page.locator('#export').is_disabled();page.locator('#run').click();assert '範囲外：' in page.locator('#result').inner_text()
    page.locator('#data').fill('5,,fit');page.locator('#run').click();assert '1行目' in page.locator('#result').inner_text()
    page.locator('#reset').click();page.locator('#data').fill('5,4.72,fit\n10,9.65,fit\n20,19.46,fit\n30,29.33,fit\n15,13,check');page.locator('#run').click();assert '許容誤差超過' in page.locator('#result').inner_text()
    page.locator('#reset').click();page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth <= innerWidth');page.screenshot(path=str(p/'mobile.png'),full_page=True)
    assert not errors and not requests,(errors,requests)
    b.close()
    print('browser passed: initial, JSON, invalidation, extrapolation, invalid input, failed check, reset, mobile, no JS errors or HTTP requests')
