from pathlib import Path
from playwright.sync_api import sync_playwright
import json
root=Path(__file__).resolve().parent
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1200,'height':900},accept_downloads=True)
    errors=[]; requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:requests.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((root/'index.html').read_text())
    assert '全譜めくり境界' in page.locator('#status').inner_text()
    page.screenshot(path=str(root/'desktop.png'),full_page=True)
    with page.expect_download() as event: page.click('#save')
    report=json.loads(Path(event.value.path()).read_text())
    assert report['optimal']['cost'][0]==0 and report['baseline']['cost'][0]==4
    assert [x['end'] for x in report['optimal']['pages']]==[3,7,12]
    page.fill('#threshold','60'); assert page.locator('#save').is_disabled()
    page.click('#run'); assert '最小不足' in page.locator('#status').inner_text()
    page.select_option('#mode','odd'); page.click('#run'); assert not page.locator('#save').is_disabled()
    page.fill('#data','1,2\n3'); page.click('#run'); assert page.locator('#save').is_disabled() and '列数' in page.locator('#status').inner_text()
    page.click('#sample'); page.set_viewport_size({'width':390,'height':844})
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.screenshot(path=str(root/'mobile.png'),full_page=True)
    assert not errors and not requests,(errors,requests)
    browser.close()
print('Chromium: inline HTML, JSON download, input invalidation, insufficient rests, odd mode, malformed rows, mobile overflow; 0 JS errors, 0 external HTTP requests')
