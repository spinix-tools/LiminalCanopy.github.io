from pathlib import Path
from playwright.sync_api import sync_playwright
import json
p=Path(__file__).parent
with sync_playwright() as w:
    b=w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=b.new_page(viewport={'width':1200,'height':900},accept_downloads=True)
    errors=[]; requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:requests.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((p/'index.html').read_text())
    assert page.locator('.stat strong').all_text_contents()==['3 / 3','2 / 3']
    page.screenshot(path=str(p/'desktop.png'),full_page=True)
    with page.expect_download() as d: page.click('#save')
    data=json.loads(Path(d.value.path()).read_text());assert data['filled']==3 and data['rows'][0]['object']=='ART-Z'
    page.fill('#slots','W1,40,20,10,20,ART-X\nW2,60,30,10,20,\nW3,90,30,10,30,')
    assert page.locator('#save').is_disabled() and page.locator('#result').inner_text()==''
    page.click('#run');assert page.locator('.stat strong').first.inner_text()=='2 / 3'
    page.fill('#slots','W3,90,30,10,30,ART-Z');page.click('#run');assert '固定割付不可' in page.locator('#status').inner_text() and page.locator('#save').is_disabled()
    page.click('#sample');page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.screenshot(path=str(p/'mobile.png'),full_page=True)
    assert not errors and not requests,(errors,requests)
    print('Chromium: initial, JSON download, input invalidation, fixed assignment, impossible fixed, reset, 390px layout, no JS errors or HTTP requests: PASS')
    b.close()
