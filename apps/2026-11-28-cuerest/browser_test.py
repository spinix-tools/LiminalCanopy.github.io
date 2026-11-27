from pathlib import Path
import json
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1280,'height':960},accept_downloads=True)
    errors=[]; external=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:external.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((root/'index.html').read_text())
    assert page.locator('#export').is_enabled()
    print('sample',page.locator('.metrics').inner_text())
    with page.expect_download() as d:page.locator('#export').click()
    report=json.loads(Path(d.value.path()).read_text());print('scores',report['baseScore'],report['optScore'])
    assert report['baseScore']['bad']>report['optScore']['bad']
    page.screenshot(path=str(root/'desktop.png'),full_page=True)
    page.locator('#mode').select_option('single');assert page.locator('#export').is_disabled();page.locator('#run').click();assert page.locator('#export').is_enabled()
    page.locator('#data').fill('invalid');page.locator('#run').click();assert page.locator('#status').inner_text();assert page.locator('#export').is_disabled()
    page.locator('#sample').click();assert page.locator('#export').is_enabled()
    page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth <= innerWidth');page.screenshot(path=str(root/'mobile.png'),full_page=True)
    assert not errors and not external,(errors,external)
    browser.close();print('Browser: sample, mode, download, invalidation, invalid input, reset, mobile, no external requests/errors passed')
