from pathlib import Path
import json
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1280,'height':900},accept_downloads=True)
    errors=[]; requests=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    page.on('request',lambda r: requests.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((root/'index.html').read_text())
    assert page.locator('#status').inner_text().startswith('矛盾')
    assert page.locator('.pill').count()==3
    page.screenshot(path=str(root/'desktop.png'),full_page=True)
    page.locator('.pill').first.click()
    assert page.locator('#status').inner_text().startswith('成立')
    with page.expect_download() as dl: page.locator('#export').click()
    assert json.loads(Path(dl.value.path()).read_text())['result']['ok'] is True
    page.locator('#repeat').fill('0')
    assert page.locator('#export').is_disabled()
    page.locator('#run').click()
    assert '整数' in page.locator('#status').inner_text()
    page.locator('#good').click()
    assert page.locator('#status').inner_text().startswith('成立')
    page.locator('#parts').fill('A,<img src=x onerror=alert(1)>\nB,後身頃\nC,切替布')
    page.locator('#run').click()
    assert page.locator('#result img').count()==0
    assert '<img' in page.locator('#result').inner_text()
    page.locator('#reset').click()
    page.set_viewport_size({'width':390,'height':844})
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.screenshot(path=str(root/'mobile.png'),full_page=True)
    assert not errors and not requests
    browser.close()
print('Chromium interaction, JSON download, invalidation, validation, safe rendering, mobile, zero errors/HTTP: PASS')
