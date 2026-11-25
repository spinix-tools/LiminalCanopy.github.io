from pathlib import Path
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1200,'height':920},accept_downloads=True)
    errors=[];requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r: requests.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content(Path(__file__).with_name('index.html').read_text())
    assert page.locator('#rows tr').count()==6
    assert '55 / 35 / 30' in page.locator('#summary').inner_text()
    page.screenshot(path=str(Path(__file__).with_name('desktop.png')),full_page=True)
    with page.expect_download() as d: page.locator('#csv').click()
    assert 'T01,required,20,0,0' in Path(d.value.path()).read_text(encoding='utf-8-sig')
    page.locator('#grid button').first.click()
    assert page.locator('#csv').is_disabled()
    page.locator('#run').click()
    assert '1 点' in page.locator('#stats').inner_text()
    page.locator('#c').fill('1');page.locator('#run').click()
    assert '在庫' in page.locator('#status').inner_text()
    page.locator('#reset').click();assert page.locator('#rows tr').count()==6
    page.locator('#n').fill('10');page.locator('#v').fill('20');page.locator('#run').click();assert page.locator('#grid button').count()==66
    page.locator('#reset').click();page.set_viewport_size({'width':390,'height':844});page.screenshot(path=str(Path(__file__).with_name('mobile.png')),full_page=True)
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    assert not errors and not requests,(errors,requests)
    browser.close()
print('Chromium inline HTML UI, CSV, edits, invalid input, reset, 66 points, 390px, no external requests/errors: PASS')
