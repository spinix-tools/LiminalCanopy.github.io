from pathlib import Path
from playwright.sync_api import sync_playwright
p=Path(__file__).resolve().parent
with sync_playwright() as w:
    browser=w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1200,'height':900},accept_downloads=True)
    errors=[]; requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:requests.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((p/'index.html').read_text()); assert page.locator('#rows tr').count()==10
    assert '4 → 0' in page.locator('#stats').inner_text()
    page.screenshot(path=str(p/'desktop.png'),full_page=True)
    with page.expect_download() as dl: page.locator('#csv').click()
    assert len(Path(dl.value.path()).read_text().splitlines())==11
    page.locator('#profile').fill('20,1\n30,2'); assert page.locator('#csv').is_disabled()
    page.get_by_role('button',name='計算する').click(); assert page.locator('#rows tr').count()==2
    page.locator('#front').fill('50,34');page.get_by_role('button',name='計算する').click();assert page.locator('#error').inner_text() and page.locator('#csv').is_disabled()
    page.locator('#resetBtn').click();assert page.locator('#rows tr').count()==10
    page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth <= innerWidth');page.screenshot(path=str(p/'mobile.png'),full_page=True)
    assert not errors and not requests,(errors,requests)
    browser.close()
print('Chromium: initial, CSV, edit, validation, reset, 390px, no exceptions/HTTP passed')
