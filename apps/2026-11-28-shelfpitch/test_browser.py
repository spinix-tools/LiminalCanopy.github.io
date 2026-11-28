from pathlib import Path
from playwright.sync_api import sync_playwright
p=Path(__file__).parent
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1200,'height':900},accept_downloads=True)
    errors=[];requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:requests.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((p/'index.html').read_text())
    assert page.locator('#moves').inner_text()=='1 枚'
    assert page.locator('#distance').inner_text()=='32 mm'
    assert page.locator('#shortage').inner_text()=='1 → 0'
    page.screenshot(path=str(p/'desktop.png'),full_page=True)
    with page.expect_download() as d: page.locator('#save').click()
    assert 'shelf,2,512,544,,32' in Path(d.value.path()).read_text(encoding='utf-8-sig')
    page.locator('#ban').fill('544');assert page.locator('#save').is_disabled()
    page.locator('#run').click();assert page.locator('#distance').inner_text()=='64 mm'
    page.locator('#need').fill('500,500,500,500');page.locator('#run').click();assert page.locator('#result').is_hidden() and 'ありません' in page.locator('#status').inner_text()
    page.locator('#old').fill('257,512,768');page.locator('#run').click();assert '格子外' in page.locator('#status').inner_text()
    page.locator('#reset').click();assert page.locator('#distance').inner_text()=='32 mm'
    page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.screenshot(path=str(p/'mobile.png'),full_page=True)
    assert not errors and not requests,(errors,requests)
    browser.close()
print('Chromium: sample, download, ban, invalidation, infeasible, invalid, reset, mobile, no errors/HTTP passed')
