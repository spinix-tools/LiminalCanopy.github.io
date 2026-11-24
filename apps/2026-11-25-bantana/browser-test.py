from pathlib import Path
from playwright.sync_api import sync_playwright
p=Path(__file__).resolve().parent
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1200,'height':850},accept_downloads=True)
    errors=[]; requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:requests.append(r.url) if r.url.startswith(('https:','http:')) else None)
    page.set_content((p/'index.html').read_text(encoding='utf-8'))
    assert page.locator('.stat strong').all_text_contents()==['12枚','26%','0枚']
    assert page.locator('.segment.move').all_text_contents()==['G-J']
    page.screenshot(path=str(p/'desktop.png'),full_page=True)
    with page.expect_download() as download:
        page.locator('#csv').click()
    assert 'G-J' in Path(download.value.path()).read_text(encoding='utf-8-sig')
    page.locator('#reserve').fill('27');assert page.locator('#csv').is_disabled();page.locator('button[type=submit]').click();assert '収まりません' in page.locator('#status').inner_text()
    page.locator('#groups').fill('test,1,50,9');page.locator('button[type=submit]').click();assert page.locator('#status').get_attribute('class')=='error'
    page.locator('#sample').click();assert page.locator('.stat strong').first.inner_text()=='12枚'
    page.locator('#reserve').fill('0');page.locator('button[type=submit]').click();assert page.locator('.stat strong').first.inner_text()=='0枚'
    page.locator('#sample').click();page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth <= innerWidth');page.screenshot(path=str(p/'mobile.png'),full_page=True)
    assert not errors and not requests,(errors,requests)
    browser.close()
print('Chromium inline: sample, CSV, invalid input, infeasible input, stale result protection, reset, 390px; zero page errors / HTTP requests')
