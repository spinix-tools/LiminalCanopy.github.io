from pathlib import Path
import json
from playwright.sync_api import sync_playwright
base=Path(__file__).resolve().parent
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1280,'height':900},accept_downloads=True)
    errors=[]; requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:requests.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((base/'index.html').read_text())
    assert page.locator('#dup').inner_text()=='10'
    assert not page.locator('#apply').is_disabled()
    page.screenshot(path=str(base/'desktop.png'),full_page=True)
    page.locator('#preview').select_option('1'); assert page.locator('#current').get_attribute('width')=='480'
    with page.expect_download() as d: page.locator('#save').click()
    data=json.loads(Path(d.value.path()).read_text()); assert data['current']['dup']==10 and data['best']['pass']
    page.locator('#apply').click(); assert page.locator('#dup').inner_text()=='0' and page.locator('#overlap').inner_text()=='0'
    page.locator('#ticks').fill('1, 1'); assert page.locator('#save').is_disabled(); page.locator('#run').click(); assert '昇順' in page.locator('#error').inner_text()
    page.locator('#reset').click(); assert page.locator('#dup').inner_text()=='10'
    page.locator('#ticks').fill(','.join(str(i) for i in range(30)));page.locator('#widths').fill('240,320');page.locator('#run').click();assert page.locator('#apply').is_disabled()
    page.locator('#reset').click();page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth <= innerWidth');page.screenshot(path=str(base/'mobile.png'),full_page=True)
    assert not errors and not requests,(errors,requests)
    browser.close()
print('Chromium: sample, preview, JSON download, apply, invalidation, invalid input, reset, impossible, 390px, no HTTP/JS errors passed')
