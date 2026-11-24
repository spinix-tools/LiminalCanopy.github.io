from pathlib import Path
from playwright.sync_api import sync_playwright
p=Path(__file__).parent
with sync_playwright() as w:
    browser=w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1150,'height':1000},accept_downloads=True)
    errors=[]; requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:requests.append(r.url))
    page.set_content((p/'index.html').read_text())
    assert page.locator('#best').inner_text()=='10.49 mm'
    assert page.locator('#count').inner_text()=='5 / 151'
    page.screenshot(path=str(p/'desktop.png'),full_page=True)
    page.locator('#err').fill('1');assert page.locator('#csv').is_disabled()
    page.locator('#run').click();assert '適合なし' in page.locator('#status').inner_text()
    page.locator('#current').fill('20');page.locator('#run').click();assert '範囲外' in page.locator('#metrics').inner_text()
    page.locator('#data').fill('bad');page.locator('#run').click();assert page.locator('#csv').is_disabled()
    page.locator('#sample').click();assert page.locator('#best').inner_text()=='10.49 mm'
    with page.expect_download() as d: page.locator('#csv').click()
    assert len(Path(d.value.path()).read_text().splitlines())==152
    page.set_viewport_size({'width':390,'height':844});page.screenshot(path=str(p/'mobile.png'),full_page=True)
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    assert not errors,errors
    assert not [x for x in requests if x.startswith(('http:','https:'))],requests
    print('Chromium inline: sample, invalidation, infeasible, no extrapolation, invalid input, reset, CSV, mobile passed; no page errors or external HTTP requests')
    browser.close()
