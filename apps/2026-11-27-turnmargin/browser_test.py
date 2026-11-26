from pathlib import Path
import json
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1100,'height':900},accept_downloads=True)
    errors=[]; requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:requests.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((root/'index.html').read_text())
    assert page.locator('#out').inner_text().count('不足めくり')==2
    page.screenshot(path=str(root/'desktop.png'),full_page=True)
    with page.expect_download() as d: page.locator('#save').click()
    report=json.loads(Path(d.value.path()).read_text());assert report['before']['bad']==1 and report['after']['bad']==0 and report['after']['ends']==[3,7,11]
    page.locator('#rows').fill('1,,0');assert page.locator('#save').is_disabled();page.locator('#run').click();assert '秒数' in page.locator('#err').inner_text()
    page.locator('#rows').fill('5,0,0');page.locator('#run').click();assert '案がありません' in page.locator('#out').inner_text()
    page.locator('#sample').click();page.locator('#mode').select_option('single');assert page.locator('#save').is_disabled();page.locator('#run').click();assert page.locator('#save').is_enabled()
    page.locator('#sample').click();page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth <= innerWidth');page.screenshot(path=str(root/'mobile.png'),full_page=True)
    assert not errors and not requests,(errors,requests)
    browser.close()
print('Chromium: inline HTML, initial output, JSON download, invalidation, invalid input, infeasible, mode change, reset, 390px, no JS errors or HTTP requests: PASS')
