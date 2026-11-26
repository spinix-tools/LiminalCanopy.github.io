from pathlib import Path
from playwright.sync_api import sync_playwright
import csv,io
root=Path(__file__).resolve().parent
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1200,'height':900},accept_downloads=True)
    errors=[]; network=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:network.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((root/'index.html').read_text())
    assert page.locator('#grid button').count()==21
    page.locator('#grid button').nth(4).click()
    assert '試験 5' in page.locator('#detail').inner_text()
    with page.expect_download() as d:page.locator('#csv').click()
    path=d.value.path(); rows=list(csv.DictReader(io.StringIO(path.read_text(encoding='utf-8-sig'))))
    assert len(rows)==21 and rows[0]['wet_A_g']=='25.000000'
    page.screenshot(path=str(root/'desktop.png'),full_page=True)
    page.locator('#tick').select_option('5');assert page.locator('#results').is_hidden()
    page.locator('#q0').fill('0');page.locator('button[type=submit]').click()
    assert '不足' in page.locator('#metrics').inner_text() and page.locator('#grid button.bad').count()>0
    page.locator('#n').select_option('10');page.locator('button[type=submit]').click();assert page.locator('#grid button').count()==66
    page.locator('#mass').fill('0');page.locator('button[type=submit]').click();assert page.locator('#results').is_hidden()
    page.locator('#reset').click();assert page.locator('#grid button').count()==21
    page.set_viewport_size({'width':390,'height':844});page.screenshot(path=str(root/'mobile.png'),full_page=True)
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    assert not errors and not network,(errors,network)
    browser.close()
print('PASS Chromium inline HTML, tile selection, CSV download, coarse scale, shortage, 66 tiles, invalid input, reset, mobile 390px, no JS errors or HTTP requests')
