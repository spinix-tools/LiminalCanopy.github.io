from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).parent.resolve()
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1200,'height':950},accept_downloads=True)
    errors=[]; network=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:network.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((root/'index.html').read_text(encoding='utf-8'))
    assert page.locator('#headline').inner_text()=='2 / 3 束を変更'
    assert '55.7' in page.locator('#bars').inner_text()
    assert page.locator('#body tr').count()==3
    page.screenshot(path=str(root/'desktop.png'),full_page=True)
    with page.expect_download() as d: page.locator('#csv').click()
    assert '追加セット' in Path(d.value.path()).read_text(encoding='utf-8-sig')
    page.locator('#width').fill('65'); assert page.locator('#csv').is_disabled(); page.locator('#run').click(); assert '外幅' in page.locator('#detail').inner_text()
    page.locator('#reserve').fill('61');page.locator('#run').click();assert '余白が' in page.locator('#error').inner_text()
    page.locator('#reset').click();assert page.locator('#headline').inner_text()=='2 / 3 束を変更'
    page.locator('#depth').fill('10');page.locator('#run').click();assert 'すべての' in page.locator('#detail').inner_text()
    page.locator('#reset').click();page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.screenshot(path=str(root/'mobile.png'),full_page=True)
    assert not errors and not network,(errors,network)
    browser.close()
print('Chromium: sample, CSV, invalidation, face mismatch, invalid input, depth infeasible, reset, 390px, 0 JS errors/HTTP requests passed')
