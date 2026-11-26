from playwright.sync_api import sync_playwright
from pathlib import Path
root=Path(__file__).resolve().parent
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1200,'height':900},accept_downloads=True)
    errors=[]; requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:requests.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((root/'index.html').read_text())
    assert page.locator('.tile').count()==45
    assert page.locator('.tile.bad').count()==39
    page.screenshot(path=str(root/'desktop.png'),full_page=False)
    page.locator('#apply').click()
    assert page.locator('#mass').input_value()=='1.6'
    assert page.locator('.tile.bad').count()==0
    with page.expect_download() as d: page.locator('#csv').click()
    assert len(Path(d.value.path()).read_text(encoding='utf-8-sig').splitlines())==46
    page.locator('#mass').fill('1.01'); assert not page.locator('#result').is_visible()
    page.locator('#run').click(); assert '整数倍' in page.locator('#error').inner_text()
    page.locator('#reset').click(); assert page.locator('.tile.bad').count()==39
    page.locator('#k').select_option('2'); page.locator('#run').click(); assert page.locator('.tile').count()==9
    page.locator('#reset').click(); page.set_viewport_size({'width':390,'height':844}); assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.screenshot(path=str(root/'mobile.png'),full_page=False)
    assert not errors and not requests,(errors,requests)
    browser.close()
print('Chromium: sample, recommendation, CSV, invalidation, error, reset, 2-way, mobile, no HTTP or JS errors: PASS')
