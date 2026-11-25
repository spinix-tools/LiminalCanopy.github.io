from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1100,'height':850},accept_downloads=True)
    errors=[]; requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:requests.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((root/'index.html').read_text())
    assert page.locator('#status').inner_text()=='計算完了'
    print(page.locator('#output').inner_text())
    page.screenshot(path=str(root/'desktop.png'),full_page=True)
    with page.expect_download() as d: page.locator('#csv').click()
    assert '朝の窓' in Path(d.value.path()).read_text(encoding='utf-8-sig')
    page.locator('#tracks').fill('invalid')
    assert page.locator('#csv').is_disabled()
    page.locator('#calc').click()
    assert page.locator('#status').get_attribute('class')=='error'
    page.locator('#tracks').fill('x | 59:00 | 1 | 必須 | A')
    page.locator('#calc').click()
    assert 'ありません' in page.locator('#output').inner_text()
    page.locator('#reset').click()
    assert page.locator('#status').inner_text()=='計算完了'
    page.set_viewport_size({'width':390,'height':844})
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.screenshot(path=str(root/'mobile.png'),full_page=True)
    assert not errors and not requests,(errors,requests)
    browser.close()
print('browser: inline HTML, CSV, invalidation, invalid input, infeasible, reset, 390px, no JS errors or HTTP requests passed')
