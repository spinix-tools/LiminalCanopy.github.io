from pathlib import Path
from playwright.sync_api import sync_playwright
p=Path(__file__).resolve().parent
with sync_playwright() as w:
    b=w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=b.new_page(viewport={'width':1200,'height':900},accept_downloads=True)
    errors=[]; requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:requests.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((p/'index.html').read_text())
    assert '12.00%' in page.locator('#metrics').inner_text()
    assert '15,625' in page.locator('#status').inner_text()
    page.screenshot(path=str(p/'desktop.png'),full_page=True)
    page.locator('#budget').fill('0'); assert page.locator('#csv').is_disabled()
    page.locator('#run').click(); assert '20.63%' in page.locator('#metrics').inner_text() and '未達' in page.locator('#status').inner_text()
    page.locator('#tunings').fill('13 0 0 0 0 0');page.locator('#run').click();assert page.locator('#result').is_hidden() and page.locator('#error').inner_text()
    page.locator('#reset').click();page.locator('#drop').click();assert '1 / 3' in page.locator('#metrics').inner_text()
    page.locator('#dad').click()
    with page.expect_download() as d:page.locator('#csv').click()
    data=Path(d.value.path()).read_text();assert len(data.splitlines())==19 and 'density_ratio' in data
    page.set_viewport_size({'width':390,'height':844}); assert page.evaluate('document.documentElement.scrollWidth===innerWidth')
    page.screenshot(path=str(p/'mobile.png'),full_page=True)
    assert not errors and not requests
    print('Chromium: sample, budget, stale result, invalid input, presets, CSV, 390px, zero JS errors / HTTP requests passed')
    b.close()
