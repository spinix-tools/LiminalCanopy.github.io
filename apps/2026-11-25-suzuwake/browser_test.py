from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1280,'height':960},accept_downloads=True)
    errors=[]; external=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:external.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((root/'index.html').read_text(encoding='utf-8'))
    assert page.locator('#metrics strong').all_text_contents()==['0','2','0','1']
    page.screenshot(path=str(root/'desktop.png'),full_page=True)
    with page.expect_download() as d: page.click('#csv')
    assert '推奨' in Path(d.value.path()).read_text(encoding='utf-8-sig')
    page.select_option('#absent','1');assert '担当 2 欠席時' in page.locator('#status').inner_text()
    page.fill('#beats','C5 C5');assert page.locator('#csv').is_disabled();page.click('#run');assert '重複音' in page.locator('#error').inner_text()
    page.click('#reset');assert page.locator('#metrics strong').all_text_contents()==['0','2','0','1']
    page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.screenshot(path=str(root/'mobile.png'),full_page=True)
    assert not errors and not external,(errors,external)
    print('PASS: sample, CSV, absence switch, validation, reset, 390px, no JS errors or HTTP requests')
    browser.close()
