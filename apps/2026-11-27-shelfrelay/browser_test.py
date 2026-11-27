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
    assert page.locator('.metric strong').all_text_contents()==['7','2','1','1']
    page.screenshot(path=str(p/'desktop.png'),full_page=True)
    with page.expect_download() as d: page.click('#save')
    r=json.loads(Path(d.value.path()).read_text());assert len(r['moves'])==2 and r['unknown']==['X99']
    page.fill('#actual','B01\nB01');assert page.locator('#save').is_disabled() and page.locator('#result').inner_text()==''
    page.click('#run');assert '重複ID' in page.locator('#status').inner_text() and page.locator('#save').is_disabled()
    page.fill('#actual','');page.click('#run');assert page.locator('.metric strong').all_text_contents()==['0','0','8','0']
    page.click('#sample');page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.screenshot(path=str(p/'mobile.png'),full_page=True)
    assert not errors and not requests;print('Browser: passed; JS errors=0, external HTTP requests=0');b.close()
