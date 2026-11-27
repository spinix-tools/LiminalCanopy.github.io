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
    assert page.locator('.metric strong').all_text_contents()==['2','2','5','3']
    page.screenshot(path=str(p/'desktop.png'),full_page=True)
    page.select_option('#filter','missing');assert page.locator('#rows tr').count()==2
    with page.expect_download() as d: page.click('#save')
    r=json.loads(Path(d.value.path()).read_text());assert r['stats']['regression']==2 and len(r['rows'])==8
    page.fill('#policy','{}');assert page.locator('#save').is_disabled() and page.locator('#rows tr').count()==0
    page.click('#run');assert '入力エラー' in page.locator('#status').inner_text()
    page.click('#sample');page.uncheck('#empty');page.click('#run');assert page.locator('.metric strong').all_text_contents()==['2','2','4','2']
    page.click('#sample');page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.screenshot(path=str(p/'mobile.png'),full_page=True)
    assert not errors and not requests,(errors,requests)
    b.close()
print('Chromium: sample, filter, download, invalidation, validation, empty policy, mobile, zero page errors / HTTP requests passed')
