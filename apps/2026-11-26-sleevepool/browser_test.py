from pathlib import Path
from playwright.sync_api import sync_playwright
import json
root=Path(__file__).parent
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1100,'height':900},accept_downloads=True)
    errors=[]; network=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    page.on('request',lambda r: network.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((root/'index.html').read_text())
    assert '440 円' in page.locator('#stats').inner_text()
    page.screenshot(path=str(root/'desktop.png'),full_page=True)
    with page.expect_download() as event: page.locator('#save').click()
    data=json.loads(Path(event.value.path()).read_text());assert data['plan']['cost']==440
    page.locator('#decks').fill('A | 1000 | X');assert page.locator('#save').is_disabled();page.locator('#run').click();assert '入力エラー' in page.locator('#status').inner_text()
    page.locator('#decks').fill('A | 100 | X');page.locator('#skus').fill('X | 0 | 50 | 1 | 1');page.locator('#run').click();assert '割当不可' in page.locator('#status').inner_text()
    page.locator('#decks').fill('<img src=x onerror=alert(1)> | 1 | X');page.locator('#run').click();assert '<img' in page.locator('#allocation').inner_text();assert page.locator('#allocation img').count()==0
    page.locator('#reset').click();assert '440 円' in page.locator('#stats').inner_text()
    page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth <= innerWidth');page.screenshot(path=str(root/'mobile.png'),full_page=True)
    assert not errors and not network,(errors,network)
    browser.close()
print('Chromium: inline HTML, sample, JSON download, invalid input, infeasible, escaped text, reset, 390px, no HTTP/JS errors: PASS')
