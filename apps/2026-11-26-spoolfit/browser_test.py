from pathlib import Path
import json
from playwright.sync_api import sync_playwright
p=Path(__file__).parent
with sync_playwright() as w:
    b=w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=b.new_page(viewport={'width':1200,'height':900},accept_downloads=True)
    errors=[]; requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:requests.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((p/'index.html').read_text())
    assert page.locator('.metric b').all_inner_texts()==['5 / 5','4 件','135 g']
    page.screenshot(path=str(p/'desktop.png'),full_page=True)
    with page.expect_download() as d: page.locator('#save').click()
    data=json.loads(Path(d.value.path()).read_text());assert data['plan']['best']['count']==5
    page.locator('#margin').fill('10');assert page.locator('#result').is_hidden() and page.locator('#save').is_disabled()
    page.locator('#run').click();assert page.locator('.metric b').first.inner_text()=='3 / 5'
    page.locator('#jobs').fill('bad');page.locator('#run').click();assert page.locator('#result').is_hidden()
    page.locator('#sample').click();assert page.locator('#result').is_visible()
    page.locator('#jobs').fill('<img src=x>,PLA-black,10');page.locator('#run').click();assert page.locator('#result img').count()==0
    page.locator('#sample').click();page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.screenshot(path=str(p/'mobile.png'),full_page=True)
    assert not errors and not requests,(errors,requests)
    print('PASS: inline HTML Chromium, calculation, JSON download, invalidation, margin, invalid input, reset, safe text, mobile, no JS errors/HTTP requests')
    b.close()
