from pathlib import Path
from playwright.sync_api import sync_playwright
p=Path(__file__).parent
with sync_playwright() as w:
    browser=w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1200,'height':900},accept_downloads=True)
    errors=[]; requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:requests.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((p/'index.html').read_text())
    assert page.locator('#result').is_visible()
    assert '6候補' in page.locator('#summary').inner_text()
    assert page.locator('#stats strong').all_inner_texts()==['0:00','0:00','7:04']
    page.screenshot(path=str(p/'desktop.png'),full_page=True)
    page.get_by_role('button',name='表示',exact=True).nth(1).click()
    assert page.locator('#stats strong').all_inner_texts()==['0:00','4:00','1:00']
    with page.expect_download() as d: page.locator('#download').click()
    import json
    data=json.loads(Path(d.value.path()).read_text());assert data['selected']['late']==240
    page.locator('#tracks').fill('bad');assert not page.locator('#result').is_visible()
    page.locator('#run').click();assert page.locator('#status').get_attribute('class')=='error'
    page.locator('#reset').click();assert page.locator('#result').is_visible()
    page.locator('#sides').select_option('4');page.locator('#run').click();assert page.locator('#diagram .side').count()==4
    page.locator('#reset').click();page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.screenshot(path=str(p/'mobile.png'),full_page=True)
    assert not errors and not requests,(errors,requests)
    print('Chromium: initial, candidate switch, JSON download, invalidation, invalid input, reset, 4 sides, mobile, no JS error/HTTP passed')
    browser.close()
