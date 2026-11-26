from pathlib import Path
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1100,'height':980},accept_downloads=True)
    errors=[]; external=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    page.on('request',lambda r: external.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content(Path(__file__).with_name('index.html').read_text())
    assert page.locator('.metric strong').all_text_contents()==['3音','1音','0件']
    page.screenshot(path=str(Path(__file__).with_name('desktop.png')),full_page=True)
    with page.expect_download() as d: page.locator('#save').click()
    import json
    assert json.loads(Path(d.value.path()).read_text())['result']['changes']==3
    page.locator('#owners').fill('0|1|2|C5\n0|1|2|D5');assert page.locator('#save').is_disabled()
    page.locator('#beats').fill('C5 D5');page.locator('#run').click();assert '不可能' in page.locator('#result').inner_text()
    page.locator('#beats').fill('BAD');page.locator('#run').click();assert page.locator('#error').inner_text()
    page.locator('#sample').click();page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.screenshot(path=str(Path(__file__).with_name('mobile.png')),full_page=True)
    assert not errors and not external,(errors,external)
    browser.close();print('Chromium: sample, JSON download, invalidation, impossible, invalid input, reset, 390px, no errors or HTTP requests: PASS')
