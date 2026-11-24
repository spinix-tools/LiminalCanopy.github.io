from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1200,'height':850},accept_downloads=True)
    errors=[]; requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:requests.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((root/'index.html').read_text())
    assert page.locator('#done').inner_text()=='6 本'
    page.screenshot(path=str(root/'desktop.png'),full_page=True)
    page.locator('#limit').fill('1');assert page.locator('#csv').is_disabled();page.locator('#run').click();assert page.locator('#done').inner_text()=='3 本'
    with page.expect_download() as d: page.locator('#csv').click()
    assert 'pending' in Path(d.value.path()).read_text()
    page.locator('#rows').fill('X,A,1,1\nX,B,1,0');page.locator('#run').click();assert '重複' in page.locator('#out').inner_text();assert page.locator('#csv').is_disabled()
    page.locator('#sample').click();assert page.locator('#done').inner_text()=='6 本'
    page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.screenshot(path=str(root/'mobile.png'),full_page=True)
    assert not errors and not requests,(errors,requests)
    browser.close()
print('Chromium inline HTML, input, recalc, CSV, validation, reset, 390px, no JS errors or HTTP requests: PASS')
