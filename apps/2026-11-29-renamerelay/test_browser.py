from pathlib import Path
import json
from playwright.sync_api import sync_playwright
root=Path(__file__).parent
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1200,'height':900},accept_downloads=True)
    errors=[]; requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:requests.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((root/'index.html').read_text(encoding='utf-8'))
    assert page.locator('#steps').inner_text()=='7'
    assert page.locator('#temps').inner_text()=='2'
    page.screenshot(path=str(root/'desktop.png'),full_page=True)
    for _ in range(7):page.locator('#next').click()
    assert page.locator('#progress').inner_text()=='7 / 7'
    assert page.locator('#state tr').first.locator('td').nth(1).inner_text()=='B.txt'
    page.locator('#prev').click();assert page.locator('#progress').inner_text()=='6 / 7'
    with page.expect_download() as d:page.locator('#save').click()
    data=json.loads(Path(d.value.path()).read_text());assert len(data['steps'])==len(data['undo'])==7
    page.locator('#pairs').fill('a\tb\nc\tB');assert page.locator('#save').is_disabled()
    page.locator('#run').click();assert '重複' in page.locator('#status').inner_text();assert page.locator('#save').is_disabled()
    page.locator('#pairs').fill('a\tb');page.locator('#occupied').fill('B');page.locator('#run').click();assert '既存名' in page.locator('#status').inner_text()
    page.locator('#sample').click();page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.screenshot(path=str(root/'mobile.png'),full_page=True)
    assert not errors and not requests,(errors,requests)
    browser.close()
print('Chromium: replay, JSON download, duplicate/occupied rejection, invalidation, 390px, zero JS errors / HTTP(S) requests: PASS')
