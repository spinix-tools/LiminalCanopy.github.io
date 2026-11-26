from pathlib import Path
from playwright.sync_api import sync_playwright
import json
root=Path(__file__).resolve().parent
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1280,'height':960},accept_downloads=True)
    errors=[]; requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:requests.append(r.url) if r.url.startswith(('http://','https://')) else None)
    page.set_content((root/'index.html').read_text())
    assert page.locator('#policies tr').count()==32
    assert page.locator('#stats b').all_text_contents()==['1','0','0','0']
    page.locator('#policies tr').nth(15).get_by_role('button').click()
    assert page.locator('#stats b').all_text_contents()==['7','6','0','0']
    page.screenshot(path=str(root/'desktop.png'),full_page=True)
    page.locator('#policies tr').nth(31).get_by_role('button').click()
    assert page.locator('#stats b').all_text_contents()==['6','6','3','1']
    page.select_option('#filter','ambiguous');assert page.locator('#groups tr').count()==1
    with page.expect_download() as dl:page.click('#download')
    data=json.loads(Path(dl.value.path()).read_text());assert data['m']==31 and len(data['all'])==32 and data['lost']==1
    page.select_option('#only','best');assert 0<page.locator('#policies tr').count()<32
    page.fill('#left','x'*121);assert page.locator('#results').is_hidden();page.click('#run');assert '120' in page.locator('#error').inner_text()
    page.fill('#left','<img src=x onerror=alert(1)>');page.fill('#right','<img src=x onerror=alert(1)>');page.click('#run');assert page.locator('#groups img').count()==0
    page.click('#clear');assert page.locator('#results').is_hidden() and page.input_value('#left')==''
    page.click('#sample');page.locator('#policies tr').nth(15).get_by_role('button').click()
    page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth <= innerWidth');page.screenshot(path=str(root/'mobile.png'),full_page=True)
    assert not errors and not requests,(errors,requests)
    browser.close()
print('PASS Chromium: 32 policies, collision, filters, JSON download, invalidation, bounds, text rendering, clear, mobile 390px, no JS errors or HTTP(S) requests')
