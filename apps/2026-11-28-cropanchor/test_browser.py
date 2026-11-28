from pathlib import Path
from playwright.sync_api import sync_playwright
import json
base=Path(__file__).resolve().parent
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1200,'height':1050},accept_downloads=True)
    errors=[]; requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:requests.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((base/'index.html').read_text())
    assert page.locator('#stats').inner_text().find('2/3')>=0
    page.screenshot(path=str(base/'desktop.png'),full_page=True)
    page.locator('#opt').click()
    assert '3/3' in page.locator('#stats').inner_text()
    with page.expect_download() as d: page.locator('#report').click()
    data=json.loads(Path(d.value.path()).read_text());assert all(r['worst']<1e-7 for r in data['rows'])
    with page.expect_download() as d: page.get_by_role('button',name='PNG保存').first.click()
    png=Path(d.value.path()).read_bytes();assert png[:8]==b'\x89PNG\r\n\x1a\n';assert int.from_bytes(png[16:20],'big')==600
    page.locator('#regions').fill('bad,0,0,10000,1');assert page.locator('#report').is_disabled();assert page.locator('#previews article').count()==0
    page.locator('#sample').click();page.locator('#file').set_input_files({'name':'sample.png','mimeType':'image/png','buffer':png});page.wait_for_function("document.querySelector('#dimensions').textContent==='600 × 600 px'");assert page.locator('#regions').input_value()==''
    box=page.locator('#source').bounding_box();page.mouse.move(box['x']+10,box['y']+10);page.mouse.down();page.mouse.move(box['x']+60,box['y']+60);page.mouse.up();assert 'Region,' in page.locator('#regions').input_value()
    page.locator('#sample').click();page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth <= innerWidth');page.screenshot(path=str(base/'mobile.png'),full_page=True)
    assert not errors and not requests,(errors,requests)
    browser.close()
print('Chromium: initial/optimization, JSON, PNG, invalid input, import, drag, mobile; 0 errors, 0 HTTP requests')
