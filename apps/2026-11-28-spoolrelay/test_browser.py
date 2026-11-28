from pathlib import Path
import json
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1100,'height':950},accept_downloads=True)
    errors=[]; requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:requests.append(r.url) if r.url.startswith(('https:','http:')) else None)
    page.set_content((root/'index.html').read_text())
    assert '3/3' in page.locator('#stats').inner_text() and '2/3' in page.locator('#stats').inner_text()
    page.screenshot(path=str(root/'desktop.png'),full_page=True)
    with page.expect_download() as d: page.click('#export')
    report=json.loads(Path(d.value.path()).read_text()); assert report['count']==3 and report['grams']==150
    page.fill('#jobs','Bad,x,0'); assert page.locator('#export').is_disabled() and page.locator('#result').is_hidden()
    page.click('#run'); assert '行目' in page.locator('#status').inner_text()
    page.fill('#jobs','<img src=x onerror=alert(1)>,PLA-white,70'); page.click('#run'); assert page.locator('#bars img').count()==0 and '<img' in page.locator('#bars').inner_text()
    page.click('#sample'); page.fill('#reserve','90');page.click('#run');assert '0/3' in page.locator('#stats').inner_text()
    page.click('#sample'); page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.screenshot(path=str(root/'mobile.png'),full_page=True)
    assert not errors and not requests,(errors,requests)
    browser.close()
print('Chromium: sample, JSON download, invalidation, invalid input, text safety, reserve, mobile width, no HTTP/JS errors PASS')
