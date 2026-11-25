from pathlib import Path
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1280,'height':950},accept_downloads=True)
    errors=[]; requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:requests.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content(Path(__file__).with_name('index.html').read_text())
    assert '全反復' in page.locator('#status').inner_text()
    assert page.locator('.tile').count()==11
    page.locator('.zone').first.locator('.ref input').fill('60')
    page.locator('.zone').first.locator('.tile:not(.ref) input').first.fill('80')
    assert '20.0' in page.locator('#analysis').inner_text()
    with page.expect_download() as d: page.locator('#csv').click()
    assert '"20"' in Path(d.value.path()).read_text(encoding='utf-8-sig')
    page.screenshot(path=str(Path(__file__).with_name('desktop.png')),full_page=True)
    page.locator('#reps').fill('3');assert page.locator('#csv').is_disabled()
    page.locator('#go').click();assert '配置不足' in page.locator('#status').inner_text()
    page.locator('#zones').fill('bad');page.locator('#go').click();assert page.locator('#csv').is_disabled()
    page.locator('#reset').click();assert page.locator('.tile').count()==11
    page.locator('#variants').fill('<img src=x onerror=alert(1)>');page.locator('#go').click();assert page.locator('#map img').count()==0
    page.locator('#reset').click();page.set_viewport_size({'width':390,'height':844})
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.screenshot(path=str(Path(__file__).with_name('mobile.png')),full_page=True)
    assert not errors and not requests,(errors,requests)
    print('Chromium: sample, paired score, CSV download, invalidation, partial, invalid, reset, safe text, 390px, zero page errors/HTTP requests passed')
    browser.close()
