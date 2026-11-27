from pathlib import Path
from playwright.sync_api import sync_playwright
import json
root=Path(__file__).resolve().parent
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1100,'height':1000},accept_downloads=True)
    errors=[]; requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:requests.append(r.url) if r.url.startswith(('https:','http:')) else None)
    page.set_content((root/'index.html').read_text())
    assert page.locator('#pick').inner_text()=='102%'
    assert page.locator('#count').inner_text()=='3 / 3'
    page.screenshot(path=str(root/'desktop.png'),full_page=True)
    page.click('#conflict'); assert '不合格' in page.locator('#status').inner_text()
    page.click('#sample')
    with page.expect_download() as d: page.click('#save')
    assert json.loads(Path(d.value.path()).read_text())['best']['p']==102
    page.fill('#data','bad'); assert page.locator('#results').is_hidden()
    page.click('#run'); assert '行目' in page.locator('#status').inner_text()
    page.click('#sample');page.set_viewport_size({'width':390,'height':844})
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.screenshot(path=str(root/'mobile.png'),full_page=True)
    assert not errors and not requests,(errors,requests)
    print('PASS: inline HTML load, samples, invalidation, malformed input, JSON download, 390px; no page errors or HTTP requests')
    browser.close()
