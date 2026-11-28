from pathlib import Path
import json
from playwright.sync_api import sync_playwright
base=Path(__file__).parent
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1200,'height':1050},accept_downloads=True)
    errors=[]; requests=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    page.on('request',lambda r: requests.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((base/'index.html').read_text())
    assert page.locator('#total').inner_text()=='8'
    assert page.locator('#fails').inner_text()=='1'
    assert page.locator('#changes').inner_text()=='2'
    page.locator('#filter').select_option('fail'); assert page.locator('#rows tr').count()==1
    page.locator('#filter').select_option('all'); assert page.locator('#rows tr').count()==8
    page.screenshot(path=str(base/'desktop.png'),full_page=True)
    with page.expect_download() as d: page.locator('#save').click()
    result=json.loads(Path(d.value.path()).read_text());assert len(result['rows'])==8 and sum(not r['pass'] for r in result['rows'])==1
    page.locator('#after').fill('User-agent: *\nDisallow: /%20');assert page.locator('#save').is_disabled()
    page.locator('#run').click();assert '非対応' in page.locator('#status').inner_text()
    page.locator('#sample').click();assert page.locator('#fails').inner_text()=='1'
    page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.screenshot(path=str(base/'mobile.png'),full_page=True)
    assert not errors and not requests, (errors,requests)
    browser.close()
print('PASS: Chromium sample, filter, JSON download, invalidation, rejection, reset, 390px width; 0 page errors / 0 HTTP requests')
