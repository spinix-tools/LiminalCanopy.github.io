from pathlib import Path
from playwright.sync_api import sync_playwright
import json
root=Path(__file__).parent
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1180,'height':960},accept_downloads=True)
    errors=[]; requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:requests.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((root/'index.html').read_text())
    assert page.locator('.stat strong').all_text_contents()==['0箱','3箱','7個']
    page.screenshot(path=str(root/'desktop.png'),full_page=True)
    with page.expect_download() as d: page.locator('#save').click()
    data=json.loads(Path(d.value.path()).read_text()); assert data['plan']['k']==3
    page.get_by_label('箱 4 の区分').select_option('exclude'); assert page.locator('#result').is_hidden()
    page.locator('#run').click(); assert page.locator('.stat strong').all_text_contents()[1]=='2箱'
    page.get_by_label('部品 1 箱 1',exact=True).fill(''); page.locator('#run').click(); assert page.locator('#error').inner_text()
    page.locator('#sample').click(); page.locator('#addBox').click(); page.locator('#run').click(); assert page.locator('#error').inner_text()
    page.locator('#delBox').click(); page.locator('#addRow').click(); page.locator('#run').click(); assert page.locator('#error').inner_text()
    page.locator('#sample').click(); page.set_viewport_size({'width':390,'height':844}); assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.screenshot(path=str(root/'mobile.png'),full_page=True)
    assert not errors and not requests,(errors,requests)
    browser.close()
print('PASS: Chromium inline HTML, sample, JSON download, exclude, blank validation, row/box editing, 390px, no JS errors or HTTP requests.')
