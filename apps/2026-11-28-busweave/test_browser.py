from pathlib import Path
import json
from playwright.sync_api import sync_playwright
base=Path(__file__).parent
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1200,'height':900},accept_downloads=True)
    errors=[]; external=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:external.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((base/'index.html').read_text())
    assert '6/6' in page.locator('#out').inner_text()
    page.screenshot(path=str(base/'desktop.png'),full_page=True)
    with page.expect_download() as dl: page.locator('#save').click()
    data=json.loads(Path(dl.value.path()).read_text());assert data['result']['channels']==2 and data['result']['cost']==1 and data['result']['mux']==113
    page.locator('#limit').select_option('0');assert page.locator('#save').is_disabled();page.locator('#run').click();assert '不可能' in page.locator('#status').inner_text()
    page.locator('#devices').fill('A, 00');page.locator('#run').click();assert page.locator('#save').is_disabled() and '0x08' in page.locator('#status').inner_text()
    page.locator('#devices').fill('<img src=x onerror=alert(1)>, 48');page.locator('#run').click();assert page.locator('#out img').count()==0 and '<img' in page.locator('#out').inner_text()
    page.locator('#sample').click();page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.screenshot(path=str(base/'mobile.png'),full_page=True)
    assert not errors and not external,(errors,external)
    browser.close()
print('Chromium: sample, JSON download, stale result, infeasible case, invalid input, safe text, mobile, no external HTTP/JS errors PASS')
