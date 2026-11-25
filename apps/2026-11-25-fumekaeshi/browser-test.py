from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1100,'height':1000},accept_downloads=True)
    errors=[]; external=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:external.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((root/'index.html').read_text())
    assert '3 → 0回' in page.locator('#metrics').inner_text()
    assert page.locator('#rows tr').count()==3
    page.screenshot(path=str(root/'desktop.png'),full_page=True)
    with page.expect_download() as d: page.click('#csv')
    assert '1,1,3,3,3,0' in Path(d.value.path()).read_text(encoding='utf-8-sig')
    page.fill('#budget','0'); assert not page.locator('#results').is_visible()
    page.click('#run'); assert '0 / 0組' in page.locator('#metrics').inner_text()
    page.fill('#gaps','x'); page.click('#run'); assert not page.locator('#results').is_visible() and '最大119' in page.locator('#error').inner_text()
    page.click('#reset'); assert '3 → 0回' in page.locator('#metrics').inner_text()
    page.set_viewport_size({'width':390,'height':844})
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.screenshot(path=str(root/'mobile.png'),full_page=True)
    assert not errors and not external,(errors,external)
    browser.close()
print('Chromium: sample, CSV, budget, stale results, invalid input, reset, mobile, no JS errors / HTTP requests: PASS')
