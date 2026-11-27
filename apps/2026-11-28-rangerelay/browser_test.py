from pathlib import Path
import json
from playwright.sync_api import sync_playwright
root=Path(__file__).parent
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=b.new_page(viewport={'width':1280,'height':1000},accept_downloads=True)
    errors=[]; network=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:network.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((root/'index.html').read_text())
    assert '新規未カバー 1種' in page.locator('#summary').inner_text()
    assert page.locator('#rows tr').count()==9
    page.screenshot(path=str(root/'desktop.png'),full_page=True)
    page.select_option('#filter','lost'); assert page.locator('#rows tr').count()==1
    with page.expect_download() as info: page.click('#save')
    data=json.loads(Path(info.value.path()).read_text());assert data['lost']==1 and data['before']['size']==225 and data['after']['size']==175
    page.fill('#after','broken');assert page.locator('#save').is_disabled() and page.locator('#results').is_hidden()
    page.click('#run');assert page.locator('#status').get_attribute('class')=='error'
    page.click('#reset');assert page.locator('#save').is_enabled()
    page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.screenshot(path=str(root/'mobile.png'),full_page=True)
    assert not errors and not network,(errors,network)
    print('Chromium inline HTML: sample, filter, JSON download, invalidation, invalid input, reset, 390px, no JS errors or HTTP requests: PASS')
    b.close()
