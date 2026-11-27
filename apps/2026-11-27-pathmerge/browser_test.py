from pathlib import Path
from playwright.sync_api import sync_playwright
p=Path(__file__).resolve().parent
with sync_playwright() as w:
    browser=w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1100,'height':900},accept_downloads=True)
    errors=[]; requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:requests.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((p/'index.html').read_text())
    assert page.locator('#total').inner_text()=='8'
    assert page.locator('#ok').inner_text()=='1'
    assert page.locator('#blocked').inner_text()=='7'
    page.screenshot(path=str(p/'desktop.png'),full_page=True)
    page.select_option('#filter','ok'); assert page.locator('.result').count()==1
    with page.expect_download() as d: page.click('#safe')
    assert Path(d.value.path()).read_text()=='docs/新規.txt'
    with page.expect_download() as d: page.click('#save')
    import json
    assert len(json.loads(Path(d.value.path()).read_text())['source'])==8
    page.fill('#source','../x'); assert page.locator('#save').is_disabled()
    page.click('#run'); assert '相対パス' in page.locator('#error').inner_text()
    page.click('#sample');page.uncheck('#fold');assert page.locator('#safe').is_disabled();page.click('#run');assert page.locator('#ok').inner_text()=='5'
    page.click('#sample');page.set_viewport_size({'width':390,'height':844});page.screenshot(path=str(p/'mobile.png'),full_page=True)
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    assert not errors and not requests,(errors,requests)
    browser.close()
print('Chromium: sample, filtering, downloads, invalidation, invalid input, model toggle, 390px layout, zero JS errors / external HTTP passed')
