from pathlib import Path
from playwright.sync_api import sync_playwright
import json
root=Path(__file__).resolve().parent
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1200,'height':1000},accept_downloads=True)
    errors=[]; requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:requests.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((root/'index.html').read_text()); page.locator('#solve').click()
    assert '2マス変更が最少。1候補' in page.locator('#status').inner_text()
    assert page.locator('#preview .change').count()==2
    page.screenshot(path=str(root/'desktop.png'),full_page=True)
    with page.expect_download() as d: page.locator('#save').click()
    obj=json.loads(Path(d.value.path()).read_text());assert obj['repair']['choices']==[[10,39]]
    page.locator('#apply').click();assert '適合' in page.locator('#issues').inner_text()
    assert page.locator('#grid .lock').count()==1
    page.locator('#pattern').fill('bad'); assert page.locator('#solve').is_disabled()
    page.locator('#load').click();assert '長方形' in page.locator('#message').inner_text()
    page.locator('#sample').click();page.locator('#mode').select_option('lock');page.locator('#grid button').nth(0).click();assert page.locator('#pattern').input_value().startswith('o')
    page.locator('#sample').click();page.set_viewport_size({'width':390,'height':844});page.locator('#solve').click()
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.screenshot(path=str(root/'mobile.png'),full_page=True)
    assert not errors and not requests,(errors,requests)
    browser.close()
print('Chromium inline: sample, preview, JSON, apply, validation, lock editing, 390px; no page errors or HTTP requests.')
