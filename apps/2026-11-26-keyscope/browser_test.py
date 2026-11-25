from pathlib import Path
import json
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1200,'height':1000},accept_downloads=True)
    errors=[]; remote=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:remote.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((root/'index.html').read_text())
    assert page.locator('.stat strong').all_text_contents()==['1','1','4']
    page.screenshot(path=str(root/'desktop.png'),full_page=True)
    page.get_by_role('button',name='ctrl+alt+j',exact=True).first.click()
    assert page.locator('.stat strong').all_text_contents()==['1','0','2']
    with page.expect_download() as d: page.locator('#export').click()
    data=json.loads(Path(d.value.path()).read_text());assert len(data['issues'])==1
    page.locator('#os').select_option('mac');assert page.locator('#export').is_disabled()
    page.locator('#run').click();assert page.locator('.stat strong').all_text_contents()==['1','0','2']
    page.locator('#data').fill('invalid');page.locator('#run').click();assert page.locator('#status').get_attribute('class')=='error'
    page.locator('#data').fill('a | * | A | <img src=x onerror=alert(1)>\na | * | a | x');page.locator('#run').click();assert page.locator('#results img').count()==0
    page.locator('#reset').click();page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.screenshot(path=str(root/'mobile.png'),full_page=True)
    assert not errors and not remote,(errors,remote)
    browser.close()
print('browser: sample, apply, export, OS change, invalid input, safe text, reset, mobile, no JS errors or HTTP requests passed')
