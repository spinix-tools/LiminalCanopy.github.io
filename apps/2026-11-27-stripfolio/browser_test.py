from playwright.sync_api import sync_playwright
from pathlib import Path
import json, os
root=Path(__file__).resolve().parent
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM','/usr/bin/chromium'),args=['--no-sandbox'])
    page=b.new_page(viewport={'width':1280,'height':900},accept_downloads=True)
    errors=[]; requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:requests.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((root/'index.html').read_text())
    print(page.locator('#options').inner_text(),page.locator('.metric').inner_text())
    assert page.locator('.sheet').count()==1
    page.screenshot(path=str(root/'desktop.png'),full_page=True)
    with page.expect_download() as d: page.click('#save')
    plan=json.load(open(d.value.path()));assert plan['plan']['pages']==1 and not set(plan['plan']['newCuts'])&set(plan['blocked']);print(plan)
    page.fill('#fixed','6');assert page.locator('#save').is_disabled();page.click('#run');assert '重複' in page.locator('#status').inner_text()
    page.click('#reset');page.locator('#options button').nth(1).click();assert page.locator('#options button').nth(1).get_attribute('aria-pressed')=='true'
    page.click('#reset');page.fill('#n','4');page.fill('#blocked','1,2,3');page.fill('#cap','3');page.click('#run');assert page.locator('#options button').last.is_disabled()
    page.fill('#n','8');page.fill('#blocked','1,2,3,4,5,6,7');page.click('#run');assert page.locator('#save').is_disabled() and '全候補' in page.locator('#status').inner_text()
    page.click('#reset');page.set_viewport_size({'width':390,'height':844});page.screenshot(path=str(root/'mobile.png'),full_page=True)
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');assert not errors and not requests
    print('Browser checks passed; errors',errors,'HTTP',requests);b.close()
