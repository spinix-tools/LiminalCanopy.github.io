from pathlib import Path
from playwright.sync_api import sync_playwright
p=Path(__file__).resolve().parent
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1200,'height':1100},accept_downloads=True)
    errors=[]; external=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:external.append(r.url) if r.url.startswith(('https://','http://')) else None)
    page.set_content((p/'index.html').read_text())
    assert '540 / 690' in page.locator('#stats').inner_text(),page.locator('#stats').inner_text()
    assert '56分10秒' in page.locator('#stats').inner_text()
    page.screenshot(path=str(p/'desktop.png'),full_page=True)
    with page.expect_download() as d: page.locator('#export').click()
    assert '追加撮影' in Path(d.value.path()).read_text(encoding='utf-8-sig')
    page.locator('#budget').fill('0'); assert page.locator('#result').is_hidden()
    page.locator('#run').click();assert '100 / 690' in page.locator('#stats').inner_text()
    page.locator('#profiles').fill('broken');page.locator('#run').click();assert '9項目' in page.locator('#error').inner_text()
    page.locator('#sample').click();assert '540 / 690' in page.locator('#stats').inner_text()
    page.set_viewport_size({'width':390,'height':844});page.screenshot(path=str(p/'mobile.png'),full_page=True)
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    assert not errors,errors;assert not external,external
    print('Chromium: sample, CSV download, stale-output invalidation, zero budget, malformed input, reset, 390px layout, no JS error or external HTTP request passed.')
    browser.close()
