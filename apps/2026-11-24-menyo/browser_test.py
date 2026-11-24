from pathlib import Path
from playwright.sync_api import sync_playwright
p=Path(__file__).resolve().parent
with sync_playwright() as w:
    browser=w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1280,'height':1000},accept_downloads=True)
    errors=[]; requests=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    page.on('request',lambda r: requests.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((p/'index.html').read_text())
    assert page.locator('#fitcount').inner_text()=='10/12'
    assert page.locator('#basecount').inner_text()=='2/12'
    assert page.locator('#margin').inner_text()=='0:25'
    page.screenshot(path=str(p/'desktop.png'),full_page=True)
    page.locator('#choices tr').filter(has_text='2/12').first.locator('button').click()
    assert page.locator('#fitcount').inner_text()=='2/12'
    with page.expect_download() as d: page.locator('#csv').click()
    s=Path(d.value.path()).read_text(encoding='utf-8-sig')
    assert '"track","A","朝の窓","0","380"' in s and '"stock"' in s
    page.locator('#tracks').fill('bad'); assert page.locator('#csv').is_disabled();page.locator('#run').click();assert page.locator('#error').inner_text()
    page.locator('#tracks').fill('a|1:00|!\nb|2:00');page.locator('#baseline').fill('1');page.locator('#run').click();assert 'ありません' in page.locator('#headline').inner_text();assert page.locator('#csv').is_disabled()
    page.locator('#sample').click();assert page.locator('#fitcount').inner_text()=='10/12'
    page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth <= innerWidth');page.screenshot(path=str(p/'mobile.png'),full_page=True)
    assert not errors and not requests,(errors,requests)
    browser.close()
print('Chromium inline: sample, alternative, CSV, invalid input, all forbidden, reset, 390px, no exceptions or HTTP requests: PASS')
