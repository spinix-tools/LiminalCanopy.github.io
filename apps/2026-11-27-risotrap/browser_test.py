from pathlib import Path
from playwright.sync_api import sync_playwright
import json
root=Path(__file__).resolve().parent
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1280,'height':900},accept_downloads=True)
    errors=[]; requests=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    page.on('request',lambda r: requests.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((root/'index.html').read_text())
    assert page.locator('#summary').inner_text()=='28 × 18 セル / 25 通りのずれを検査'
    print('sample:',{i:page.locator('#'+i).inner_text() for i in ['before','after','added','residual']})
    page.screenshot(path=str(root/'desktop.png'),full_page=True)
    page.locator('#shift').select_option('12')
    assert '欠け 0 → 0' in page.locator('#detail').inner_text()
    for id in ['json','png','txt']:
        with page.expect_download() as d: page.locator('#'+id).click()
        path=d.value.path(); assert path.stat().st_size>0
        if id=='json': assert len(json.loads(path.read_text())['rows'])==25
        if id=='png': assert path.read_bytes().startswith(b'\x89PNG')
    page.locator('#mask').fill('AB\nA'); assert page.locator('#out').is_hidden()
    page.locator('#run').click(); assert page.locator('#err').inner_text()
    page.locator('#sample').click(); assert page.locator('#out').is_visible()
    page.set_viewport_size({'width':390,'height':844})
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.screenshot(path=str(root/'mobile.png'),full_page=True)
    assert not errors and not requests,(errors,requests)
    browser.close()
print('Browser interaction, 3 downloads, invalidation, mobile overflow, zero page errors / HTTP requests: PASS')
