from pathlib import Path
from playwright.sync_api import sync_playwright
import json
root=Path(__file__).parent
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1200,'height':1000},accept_downloads=True)
    errors=[]; network=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:network.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((root/'index.html').read_text())
    assert '0 mm' in page.locator('#metrics').inner_text() and '450 mm' in page.locator('#metrics').inner_text()
    assert page.locator('#rows tr').count()==9
    page.screenshot(path=str(root/'desktop.png'),full_page=True)
    with page.expect_download() as dl: page.locator('#save').click()
    plan=json.loads(Path(dl.value.path()).read_text()); assert plan['optimal']['width']==0 and plan['greedy']['width']==450
    page.locator('#shelves').fill('900,901'); assert page.locator('#save').is_disabled(); assert page.locator('#result').is_hidden()
    page.locator('#run').click(); assert page.locator('#status').get_attribute('class')=='error'
    page.locator('#shelves').fill('100,0'); page.locator('#books').fill('A,101,0'); page.locator('#run').click(); assert '存在しません' in page.locator('#status').inner_text()
    page.locator('#shelves').fill('900,0'); page.locator('#books').fill('<img src=x>,10,0'); page.locator('#run').click(); assert page.locator('#rows img').count()==0 and '<img src=x>' in page.locator('#rows').inner_text()
    page.locator('#reset').click(); page.set_viewport_size({'width':390,'height':844}); assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.screenshot(path=str(root/'mobile.png'),full_page=True)
    assert not errors and not network,(errors,network)
    browser.close()
print('Chromium: sample, JSON download, invalidation, invalid/impossible inputs, text escaping, reset, 390px width; 0 page errors / HTTP requests')
