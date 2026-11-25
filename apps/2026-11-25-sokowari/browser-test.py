from pathlib import Path
from playwright.sync_api import sync_playwright
p=Path(__file__).resolve().parent
with sync_playwright() as w:
    browser=w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1200,'height':1000},accept_downloads=True)
    errors=[]; requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:requests.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((p/'index.html').read_text())
    assert page.locator('#metrics').inner_text().endswith('6 / 64')
    assert page.locator('#after td.diff').count()==6
    page.screenshot(path=str(p/'desktop.png'),full_page=True)
    with page.expect_download() as dl: page.click('#csv')
    assert 'shaft,1,2,2,3,1,2,4,2' in Path(dl.value.path()).read_text()
    page.fill('#limit','7'); assert page.locator('#csv').is_disabled()
    page.click('#run'); assert page.locator('#after td.diff').count()==0
    page.fill('#draft','01\n1');page.click('#run');assert page.locator('#error').inner_text();assert page.locator('#csv').is_disabled()
    page.click('#sample');assert page.locator('#after td.diff').count()==6
    page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.screenshot(path=str(p/'mobile.png'),full_page=True)
    assert not errors and not requests,(errors,requests)
    print('Chromium: sample, 6 changed cells, CSV download, stale result, 7 shafts, invalid input, reset, 390px, no JS errors or HTTP requests: PASS')
    browser.close()
