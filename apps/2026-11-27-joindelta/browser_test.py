from pathlib import Path
from playwright.sync_api import sync_playwright
import json
root=Path(__file__).parent
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=b.new_page(viewport={'width':1150,'height':1000},accept_downloads=True)
    errors=[]; network=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:network.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((root/'index.html').read_text())
    assert page.locator('#metrics').inner_text().find('300')>=0
    page.screenshot(path=str(root/'desktop.png'),full_page=True)
    with page.expect_download() as d: page.locator('#save').click()
    report=json.loads(Path(d.value.path()).read_text());assert report['after']['leftSum']=='1250' and report['added']==3
    page.locator('#nfkc').uncheck();assert page.locator('#save').is_disabled() and page.locator('#out').is_hidden()
    page.locator('#run').click();assert page.locator('#save').is_enabled()
    page.locator('#left').fill('broken');page.locator('#run').click();assert page.locator('#save').is_disabled() and 'Tab' in page.locator('#status').inner_text()
    page.locator('#sample').click();page.locator('#filter').select_option('all');assert page.locator('#detail tr').count()==5
    page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.screenshot(path=str(root/'mobile.png'),full_page=True)
    page.locator('#clear').click();assert page.locator('#left').input_value()=='' and page.locator('#out').is_hidden()
    assert not errors and not network,(errors,network)
    b.close()
print('Chromium: sample, download, invalidation, invalid input, filter, mobile, clear; no JS errors or external HTTP requests')
