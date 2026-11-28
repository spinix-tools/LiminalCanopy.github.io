from pathlib import Path
from playwright.sync_api import sync_playwright
import json
base=Path(__file__).resolve().parent
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=b.new_page(viewport={'width':1200,'height':1000},accept_downloads=True)
    errors=[]; requests=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    page.on('request',lambda r: requests.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((base/'index.html').read_text())
    assert page.locator('.metric b').all_text_contents()==['2 / 3 件','3 / 3 件','3 / 3 件']
    page.screenshot(path=str(base/'desktop.png'),full_page=True)
    with page.expect_download() as d: page.click('#save')
    data=json.loads(Path(d.value.path()).read_text()); assert data['robust']['count']==3
    page.fill('#reserve','10'); assert page.locator('#save').is_disabled(); page.click('#run'); assert page.locator('.metric b').all_text_contents()==['2 / 3 件','2 / 3 件','3 / 3 件']
    page.fill('#spools','S1,10,0,11'); page.click('#run'); assert page.locator('#error').inner_text() and page.locator('#save').is_disabled()
    page.click('#sample'); assert not page.locator('#save').is_disabled()
    page.fill('#jobs','<img src=x onerror=alert(1)>,40'); page.click('#run'); assert page.locator('#result img').count()==0
    page.click('#sample'); page.set_viewport_size({'width':390,'height':844}); assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.screenshot(path=str(base/'mobile.png'),full_page=True)
    assert not errors and not requests, (errors,requests)
    b.close()
print('Chromium inline, sample, reserve, download, invalid input, safe rendering, reset, mobile, no external requests: PASS')
