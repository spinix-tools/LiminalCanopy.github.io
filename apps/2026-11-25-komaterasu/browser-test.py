from pathlib import Path
from playwright.sync_api import sync_playwright
import tempfile
root=Path(__file__).resolve().parent
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1200,'height':1000},accept_downloads=True)
    errors=[]; external=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:external.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((root/'index.html').read_text(encoding='utf-8'))
    assert page.locator('.metric strong').all_text_contents()==['3','4','3']
    page.screenshot(path=str(root/'desktop.png'),full_page=True)
    page.locator('#anchors').fill(page.locator('#anchors').input_value()+'\n04 | scan002.jpg')
    assert page.locator('#result').is_hidden()
    page.locator('#run').click()
    assert page.locator('.metric strong').first.inner_text()=='1'
    with page.expect_download() as d: page.locator('#csv').click()
    with tempfile.TemporaryDirectory() as tmp:
        target=Path(tmp)/'result.csv';d.value.save_as(target)
        data=target.read_text(encoding='utf-8-sig');assert 'scan002.jpg' in data and '目視確認' in data
    page.locator('#reset').click();page.locator('#allow').select_option('1');assert page.locator('#result').is_hidden();page.locator('#run').click();assert page.locator('.metric strong').first.inner_text()=='18'
    page.locator('#reverse').click();page.locator('#run').click();assert '矛盾' in page.locator('#message').inner_text() and page.locator('#result').is_hidden()
    page.locator('#reset').click();page.locator('#frames').fill('<img src=x onerror=alert(1)>');page.locator('#scans').fill('s');page.locator('#anchors').fill('');page.locator('#run').click();assert page.locator('#frameRows img').count()==0
    page.locator('#reset').click();page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth <= innerWidth');page.screenshot(path=str(root/'mobile.png'),full_page=True)
    assert not errors and not external,(errors,external)
    browser.close()
    print('Chromium: sample, narrowing, CSV, allowance, conflict, safe rendering, reset, 390px, no JS errors or HTTP requests passed')
