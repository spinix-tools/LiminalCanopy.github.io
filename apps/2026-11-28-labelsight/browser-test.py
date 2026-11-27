from pathlib import Path
from playwright.sync_api import sync_playwright
import json
root=Path(__file__).resolve().parent
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=b.new_page(viewport={'width':1200,'height':1050},accept_downloads=True)
    errors=[];requests=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    page.on('request',lambda r: requests.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((root/'index.html').read_text())
    assert page.locator('#before').inner_text()=='0/3'
    assert page.locator('#after').inner_text()=='3/3'
    assert page.locator('#best').inner_text()=='1210 mm'
    page.locator('#which').select_option('after')
    page.screenshot(path=str(root/'desktop.png'),full_page=True)
    with page.expect_download() as d: page.locator('#export').click()
    assert json.loads(Path(d.value.path()).read_text())['best']['z']==1210
    page.locator('#apply').click();assert page.locator('#before').inner_text()=='3/3'
    page.locator('#step').fill('0');assert page.locator('#export').is_disabled()
    page.locator('#run').click();assert page.locator('#error').inner_text()
    page.locator('#reset').click();assert page.locator('#best').inner_text()=='1210 mm'
    page.locator('#bar').fill('3000');page.locator('#run').click();assert page.locator('#after').inner_text()=='0/3'
    page.locator('#reset').click();page.set_viewport_size({'width':390,'height':844})
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.screenshot(path=str(root/'mobile.png'),full_page=True)
    assert not errors and not requests,(errors,requests)
    b.close()
print('PASS: Chromium inline, sample, diagram selection, JSON download, apply, invalidation, invalid input, reset, infeasible scenario, mobile width, no JS errors or HTTP requests')
