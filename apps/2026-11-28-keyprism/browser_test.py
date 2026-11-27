from pathlib import Path
import json
from playwright.sync_api import sync_playwright
root=Path(__file__).parent
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1280,'height':1000},accept_downloads=True)
    errors=[]; network=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    page.on('request',lambda r: network.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((root/'index.html').read_text())
    assert '4 → 6' in page.locator('#metrics').inner_text()
    page.screenshot(path=str(root/'desktop.png'),full_page=True)
    page.locator('#zero').check(); assert page.locator('#results').is_hidden()
    page.locator('#run').click(); assert '4 → 7' in page.locator('#metrics').inner_text()
    with page.expect_download() as d: page.locator('#export').click()
    data=json.loads(Path(d.value.path()).read_text()); assert data['totals']['after']==7
    page.locator('#left').fill(''); page.locator('#run').click(); assert page.locator('#results').is_hidden()
    page.locator('#left').fill('<img src=x>'); page.locator('#right').fill('<img src=x>');page.locator('#run').click();page.locator('#filter').select_option('all');assert page.locator('tbody img').count()==0
    page.locator('#sample').click();page.set_viewport_size({'width':390,'height':844})
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.screenshot(path=str(root/'mobile.png'),full_page=True)
    assert not errors and not network, (errors,network)
    browser.close()
print('Chromium inline sample, toggle, stale result, download, empty input, text safety, mobile, no HTTP or JS errors: PASS')
