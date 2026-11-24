from pathlib import Path
from playwright.sync_api import sync_playwright
p=Path(__file__).parent
with sync_playwright() as w:
    browser=w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1200,'height':1000},accept_downloads=True)
    errors=[]; requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:requests.append(r.url))
    page.set_content((p/'index.html').read_text())
    assert page.locator('.big').all_text_contents()==['96','872']
    assert '1,549' in page.locator('#status').inner_text()
    page.screenshot(path=str(p/'desktop.png'),full_page=True)
    page.locator('#matrix input').first.fill('wrong')
    assert page.locator('#export').is_disabled()
    page.locator('#run').click(); assert '形式' in page.locator('#status').inner_text()
    page.locator('#sample').click(); assert page.locator('.big').all_text_contents()==['96','872']
    with page.expect_download() as d: page.locator('#export').click()
    assert '872' in Path(d.value.path()).read_text(encoding='utf-8-sig')
    page.locator('#budget').fill('0');page.locator('#run').click();assert page.locator('.big').all_text_contents()==['0','0']
    page.locator('#slots').fill('8');page.locator('#slots').press('Tab');assert page.locator('#matrix tr').count()==8
    page.locator('#budget').fill('8');page.locator('#cap').fill('7');page.locator('#run').click();assert '65,536' in page.locator('#status').inner_text()
    page.locator('#sample').click();page.set_viewport_size({'width':390,'height':844});page.screenshot(path=str(p/'mobile.png'),full_page=True)
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    assert not errors,errors
    assert not [x for x in requests if x.startswith(('http:','https:'))],requests
    print('Chromium inline: sample, invalidation, error, reset, CSV, zero budget, max enumeration, mobile width passed; no page errors or external HTTP requests')
    browser.close()
