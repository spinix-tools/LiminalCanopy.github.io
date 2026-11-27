from pathlib import Path
from playwright.sync_api import sync_playwright
import json
root=Path(__file__).resolve().parent
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1200,'height':850},accept_downloads=True)
    errors=[]; net=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:net.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((root/'index.html').read_text())
    assert '全て' in page.locator('#status').inner_text()
    assert '3 / 4' in page.locator('#result').inner_text()
    with page.expect_download() as d: page.locator('#export').click()
    data=json.loads(Path(d.value.path()).read_text());assert data['optimal']['end']==10600
    page.locator('#phase').fill('600');assert page.locator('#export').is_disabled()
    page.locator('#run').click();assert page.locator('#error').inner_text()
    page.locator('#reset').click();assert '3 / 4' in page.locator('#result').inner_text()
    page.screenshot(path=str(root/'desktop.png'),full_page=True)
    page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.screenshot(path=str(root/'mobile.png'),full_page=True)
    assert not errors and not net,(errors,net)
    browser.close()
print('PASS: inline HTML load, sample, JSON download, input invalidation, validation, reset, 390px, zero page errors/HTTP requests')
