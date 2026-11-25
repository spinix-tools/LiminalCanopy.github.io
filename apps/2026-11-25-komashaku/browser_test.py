from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1100,'height':950},accept_downloads=True)
    errors=[]; external=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    page.on('request',lambda r: external.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((root/'index.html').read_text(encoding='utf-8'))
    assert page.locator('#cost').inner_text()=='7'
    assert page.locator('#body tr').count()==6
    page.screenshot(path=str(root/'desktop.png'),full_page=True)
    page.locator('#scrub').fill('10'); assert '接地' in page.locator('#preview').inner_text()
    page.locator('#play').click(); page.wait_for_timeout(250); assert int(page.locator('#scrub').input_value())>10
    page.locator('#stop').click()
    with page.expect_download() as d: page.locator('#export').click()
    assert '接地,4,4,7,10,10,12' in Path(d.value.path()).read_text(encoding='utf-8-sig').replace('"','')
    page.locator('#total').fill('19'); assert page.locator('#result').is_hidden()
    page.locator('#run').click(); assert '満たせません' in page.locator('#status').inner_text()
    page.locator('#rows').fill('bad'); page.locator('#run').click(); assert '行目' in page.locator('#status').inner_text()
    page.locator('#reset').click(); assert page.locator('#cost').inner_text()=='7'
    page.set_viewport_size({'width':390,'height':844}); page.screenshot(path=str(root/'mobile.png'),full_page=True)
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    assert not errors and not external,(errors,external)
    browser.close()
    print('Browser: inline HTML, playback, scrub, download, invalidation, infeasible/invalid input, reset, 390px, no errors/HTTP: PASS')
