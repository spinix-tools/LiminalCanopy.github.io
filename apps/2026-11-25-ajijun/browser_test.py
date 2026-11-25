from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1100,'height':850},accept_downloads=True)
    errors=[]; external=[]
    page.on('pageerror',lambda err: errors.append(str(err)))
    page.on('request',lambda req: external.append(req.url) if req.url.startswith(('http://','https://')) else None)
    page.set_content((root/'index.html').read_text())
    page.click('#demo')
    assert page.locator('#schedule tbody tr').count()==8
    assert page.locator('#metrics strong').all_text_contents()==['336','0']
    assert page.locator('#schedule tbody tr').nth(0).inner_text()==page.locator('#schedule tbody tr').nth(1).inner_text().replace('2\t固定','1\t固定',1)
    with page.expect_download() as dl: page.click('#csv')
    assert '369,155,611,440' in Path(dl.value.path()).read_text(encoding='utf-8-sig')
    assert not page.locator('#key').is_visible(); page.click('#reveal'); assert page.locator('#key').is_visible()
    with page.expect_download() as dl: page.click('#keycsv')
    assert 'A,369' in Path(dl.value.path()).read_text(encoding='utf-8-sig')
    page.emulate_media(media='print'); assert not page.locator('#keybox').is_visible(); assert page.locator('#result').is_visible(); page.emulate_media(media='screen')
    page.click('#copy'); assert len(page.locator('#locked').input_value().splitlines())==8; assert not page.locator('#result').is_visible()
    page.fill('#total','7');page.click('#run');assert page.locator('#error').inner_text()
    page.fill('#locked','ABBA');page.click('#run');assert page.locator('#error').inner_text()
    page.click('#reset');assert not page.locator('#result').is_visible()
    page.click('#demo');page.screenshot(path=str(root/'desktop.png'),full_page=True)
    page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth <= innerWidth');page.screenshot(path=str(root/'mobile.png'),full_page=True)
    assert not errors and not external,(errors,external)
    print('Chromium: demo, fixed rows, both CSV downloads, key hiding, print CSS, copy, invalid input, reset, mobile, zero page errors/HTTP requests passed.')
    browser.close()
