from pathlib import Path
from playwright.sync_api import sync_playwright
import json
p=Path(__file__).parent
with sync_playwright() as w:
    b=w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=b.new_page(viewport={'width':1200,'height':900},accept_downloads=True)
    errors=[]; requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:requests.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((p/'index.html').read_text())
    print('sample:',page.locator('#status').inner_text(),page.locator('#count').inner_text())
    page.screenshot(path=str(p/'desktop.png'),full_page=True)
    with page.expect_download() as d: page.click('#save')
    r=json.loads(Path(d.value.path()).read_text());assert r['result']['total']==16 and r['result']['before']==6 and len(r['result']['chosen'])<=4
    page.fill('#budget','0');assert page.locator('#save').is_disabled();page.click('#run');assert page.locator('#before').inner_text()==page.locator('#after').inner_text()
    page.fill('#data','bad');page.click('#run');assert '入力エラー' in page.locator('#status').inner_text();assert page.locator('#save').is_disabled()
    page.click('#sample');page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.screenshot(path=str(p/'mobile.png'),full_page=True)
    assert not errors and not requests,(errors,requests)
    b.close()
print('Chromium: inline HTML, download, zero budget, invalidation, invalid input, mobile, zero JS errors and HTTP requests passed')
