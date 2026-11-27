from pathlib import Path
import json
from playwright.sync_api import sync_playwright
p=Path(__file__).resolve().parent
with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=b.new_page(viewport={'width':1200,'height':1000},accept_downloads=True)
    errors=[]; requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:requests.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((p/'index.html').read_text()); assert '200 × 280 mm · 3/4' in page.locator('#summary').inner_text()
    print(page.locator('#ranking').inner_text()); print(page.locator('#placements').inner_text())
    page.screenshot(path=str(p/'desktop.png'),full_page=True)
    page.select_option('#pick','1'); assert page.locator('#placements tr').count()==4
    page.select_option('#art','2'); assert page.locator('#preview svg').count()==1
    with page.expect_download() as d: page.click('#save')
    report=json.loads(Path(d.value.path()).read_text()); assert report['selected']==1 and report['rank'][0]['count']==3
    page.fill('#t','0'); assert page.locator('#result').is_hidden(); page.click('#run'); assert page.locator('#result').is_visible()
    page.fill('#works','bad'); page.click('#run'); assert page.locator('#result').is_hidden() and '形式' in page.locator('#status').inner_text()
    page.click('#sample'); assert '3/4' in page.locator('#summary').inner_text()
    page.set_viewport_size({'width':390,'height':844}); assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'); page.screenshot(path=str(p/'mobile.png'),full_page=True)
    assert not errors and not requests,(errors,requests)
    print('Chromium: inline HTML, preview selection, JSON, recalculation, invalid input, reset, 390px, no JS errors/network: pass')
    b.close()
