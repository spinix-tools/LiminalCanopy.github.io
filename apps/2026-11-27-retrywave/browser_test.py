from pathlib import Path
from playwright.sync_api import sync_playwright
import json
p=Path(__file__).resolve().parent
with sync_playwright() as w:
    browser=w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1100,'height':950},accept_downloads=True)
    errors=[];requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:requests.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((p/'index.html').read_text())
    assert page.locator('#results').is_visible()
    assert '36 / 120' in page.locator('#metrics').inner_text()
    page.screenshot(path=str(p/'desktop.png'),full_page=True)
    with page.expect_download() as d: page.locator('#download').click()
    report=json.loads(Path(d.value.path()).read_text()); assert report['A']['success']==36 and len(report['A']['trace'])==60
    page.locator('#capacity').fill('5');assert page.locator('#download').is_disabled() and not page.locator('#results').is_visible()
    page.get_by_role('button',name='比較を実行').click();assert '15 / 120' in page.locator('#metrics').inner_text()
    page.locator('#aCap').fill('1');page.get_by_role('button',name='比較を実行').click();assert '待機上限' in page.locator('#status').inner_text() and page.locator('#download').is_disabled()
    page.locator('#resetSample').click();assert '36 / 120' in page.locator('#metrics').inner_text()
    page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth <= innerWidth');page.screenshot(path=str(p/'mobile.png'),full_page=True)
    assert not errors and not requests,(errors,requests)
    print('Chromium inline HTML: initial, download, edit, rerun, invalid, reset, mobile, no errors or HTTP requests OK')
    browser.close()
