from pathlib import Path
from playwright.sync_api import sync_playwright
import json
root=Path(__file__).parent
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1100,'height':900},accept_downloads=True)
    errors=[]; requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:requests.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((root/'index.html').read_text())
    assert page.locator('#worst').inner_text()=='40'
    page.screenshot(path=str(root/'desktop.png'),full_page=True)
    with page.expect_download() as d: page.locator('#save').click()
    assert json.loads(Path(d.value.path()).read_text())['worst']==40
    with page.expect_download() as d: page.locator('#png').click()
    assert Path(d.value.path()).read_bytes().startswith(b'\x89PNG\r\n\x1a\n')
    page.locator('#double').click(); assert page.locator('#worst').inner_text()=='0'
    page.locator('#size').select_option('3'); assert page.locator('#worst').inner_text()=='0'
    page.locator('#sample').click(); assert page.locator('#worst').inner_text()=='40'
    page.locator('summary').click(); page.locator('#mask').fill('bad'); page.locator('#apply').click(); assert page.locator('#error').inner_text()
    page.locator('#clear').click(); assert page.locator('#worst').inner_text()=='0'
    page.locator('#sample').click(); page.locator('#size').select_option('1'); page.locator('summary').click()
    page.locator('#mode').select_option('inspect'); page.locator('#list button').nth(1).click(); assert '脱落' in page.locator('#selected').inner_text()
    page.locator('#mode').select_option('toggle'); box=page.locator('#grid').bounding_box(); page.locator('#grid').click(position={'x':(11+.5)*box['width']/24,'y':(6+.5)*box['height']/24}); assert int(page.locator('#isolated').inner_text())>0
    page.locator('#sample').click(); page.set_viewport_size({'width':390,'height':844}); assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'); page.screenshot(path=str(root/'mobile.png'),full_page=True)
    assert not errors and not requests,(errors,requests)
    browser.close()
print('Chromium inline HTML, editing, inspection, invalid input, JSON/PNG downloads, mobile, no external requests: passed')
