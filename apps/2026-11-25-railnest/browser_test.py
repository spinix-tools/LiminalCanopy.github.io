from pathlib import Path
from playwright.sync_api import sync_playwright
p=Path(__file__).resolve().parent
with sync_playwright() as w:
    browser=w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1100,'height':950},accept_downloads=True)
    errors=[]; external=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:external.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((p/'index.html').read_text(encoding='utf-8'))
    assert page.locator('#metrics').inner_text().find('4 / 4')>=0
    page.screenshot(path=str(p/'desktop.png'),full_page=True)
    with page.expect_download() as d: page.locator('#csv').click()
    assert '特急' in Path(d.value.path()).read_text(encoding='utf-8-sig')
    page.locator('#trains').fill('不正')
    assert page.locator('#result').is_hidden()
    page.locator('#run').click();assert '行目' in page.locator('#status').inner_text()
    page.locator('#reset').click();assert page.locator('#result').is_visible()
    page.locator('#tracks').fill('A,100,0,0');page.locator('#run').click();assert '0 / 4' in page.locator('#metrics').inner_text()
    page.locator('#reset').click();page.set_viewport_size({'width':390,'height':844})
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.screenshot(path=str(p/'mobile.png'),full_page=True)
    assert not errors and not external,(errors,external)
    browser.close()
print('Chromium: sample, CSV, invalidation, validation, reset, no-fit, mobile, no errors/network passed')
