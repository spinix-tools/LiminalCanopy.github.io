from pathlib import Path
import json
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1200,'height':1000},accept_downloads=True)
    errors=[]; external=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:external.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((root/'index.html').read_text())
    assert '400 h' in page.locator('#stats').inner_text()
    assert '200 h' in page.locator('#compare').inner_text()
    assert '前期 → 資料 B' in page.locator('#timeline').inner_text()
    page.screenshot(path=str(root/'desktop.png'),full_page=True)
    with page.expect_download() as d: page.click('#save')
    data=json.loads(Path(d.value.path()).read_text())
    assert data['best']['a']==[1,0,2] and data['best']['hours']==400
    page.fill('#objects','bad'); assert page.locator('#save').is_disabled() and page.locator('#result').is_hidden()
    page.click('#run'); assert '行数' in page.locator('#status').inner_text()
    page.fill('#objects','<img src=x>|10|0|10|*'); page.fill('#slots','S|1|1|0|0'); page.click('#run')
    assert '<img src=x>' in page.locator('#timeline').inner_text() and page.locator('#timeline img').count()==0
    page.click('#reset'); assert '400 h' in page.locator('#stats').inner_text()
    page.set_viewport_size({'width':390,'height':844}); assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.screenshot(path=str(root/'mobile.png'),full_page=True)
    assert not errors and not external,(errors,external)
    browser.close()
print('Chromium inline HTML, sample, download, invalidation, invalid input, literal rendering, reset, 390px, no external requests / page errors: PASS')
