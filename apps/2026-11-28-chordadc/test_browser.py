from pathlib import Path
from playwright.sync_api import sync_playwright
import json
root=Path(__file__).resolve().parent
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1100,'height':950},accept_downloads=True)
    errors=[]; requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:requests.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((root/'index.html').read_text())
    assert page.locator('#rows tr').count()==16
    assert page.locator('#metrics strong').all_text_contents()==['16','9','6','16']
    page.screenshot(path=str(root/'desktop.png'),full_page=True)
    page.click('#preset')
    assert page.locator('#metrics strong').all_text_contents()==['16','16','0','0']
    page.check('#only'); assert page.locator('#rows tr').count()==0
    page.uncheck('#only')
    with page.expect_download() as d: page.click('#save')
    data=json.loads(Path(d.value.path()).read_text());assert data['unique']==16
    with page.expect_download() as d: page.click('#code')
    assert 'int decodeADC(int raw)' in Path(d.value.path()).read_text()
    page.locator('#probe').fill('1023');assert '未押下' in page.locator('#probeResult').inner_text()
    page.fill('#rp','0');assert page.locator('#save').is_disabled();page.click('#run');assert page.locator('#error').inner_text()
    page.click('#reset');page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.screenshot(path=str(root/'mobile.png'),full_page=True)
    assert not errors and not requests,(errors,requests)
    browser.close()
print('Chromium: initial/preset/filter/JSON/C++/probe/invalid/reset/mobile/no HTTP or JS errors passed')
