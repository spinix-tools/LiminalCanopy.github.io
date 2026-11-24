from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1100,'height':1000},accept_downloads=True)
    errors=[];requests=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    page.on('request',lambda r: requests.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((root/'index.html').read_text())
    assert page.locator('#metrics').inner_text().count('2 → 0')==1
    assert page.locator('#rows tr').count()==12
    page.screenshot(path=str(root/'desktop.png'),full_page=True)
    with page.expect_download() as info: page.locator('#csv').click()
    assert '折丁,用紙' in Path(info.value.path()).read_text(encoding='utf-8-sig')
    page.locator('#direction').select_option('right');assert page.locator('#result').is_hidden();page.locator('#run').click()
    assert page.locator('#rows tr').first.locator('td').nth(2).inner_text()=='1'
    page.locator('#sizes').fill('5');page.locator('#run').click();assert page.locator('#error').inner_text();assert page.locator('#result').is_hidden()
    page.locator('#reset').click();assert page.locator('#result').is_visible()
    page.locator('#sizes').fill('16');page.locator('#run').click();assert 'ありません' in page.locator('#error').inner_text()
    page.locator('#reset').click();page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth <= innerWidth');page.screenshot(path=str(root/'mobile.png'),full_page=True)
    assert not errors and not requests,(errors,requests)
    browser.close()
print('Chromium: default, CSV, binding direction, stale state, invalid and infeasible input, reset, 390px, no JS errors or HTTP requests: PASS')
