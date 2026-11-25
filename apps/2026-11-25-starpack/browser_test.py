from pathlib import Path
from playwright.sync_api import sync_playwright
base=Path(__file__).resolve().parent
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1280,'height':1000},accept_downloads=True)
    errors=[]; external=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:external.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((base/'index.html').read_text(encoding='utf-8'))
    assert '5 / 5' in page.locator('#metrics').inner_text()
    page.screenshot(path=str(base/'desktop.png'),full_page=True)
    page.locator('#budget').fill('0');assert not page.locator('#output').is_visible()
    page.locator('#run').click();assert page.locator('#metrics').inner_text().count('4 / 5')==2
    page.locator('#limit').fill('0');page.locator('#run').click();assert '0 / 5' in page.locator('#metrics').inner_text()
    page.locator('#focal').fill('');page.locator('#run').click();assert page.locator('#error').inner_text() and not page.locator('#output').is_visible()
    page.locator('#reset').click();assert '5 / 5' in page.locator('#metrics').inner_text()
    with page.expect_download() as d: page.locator('#export').click()
    assert d.value.suggested_filename=='starpack-plan.csv'
    csv=Path(d.value.path()).read_text(encoding='utf-8-sig');assert '32mm 候補' in csv and '広域の星団' in csv
    page.locator('#lenses').fill('<img src=x onerror=alert(1)> | 25 | 50 | 0');page.locator('#run').click();assert page.locator('#detail img').count()==0
    page.locator('#reset').click();page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth <= innerWidth');page.screenshot(path=str(base/'mobile.png'),full_page=True)
    assert not errors and not external,(errors,external)
    print('Chromium: sample, stale results, budget=0, limit=0, invalid, reset, CSV, HTML escaping, mobile width PASS; JS errors=0; external HTTP=0')
    browser.close()
