from pathlib import Path
import json
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=b.new_page(viewport={'width':1200,'height':1000},accept_downloads=True)
    errors=[]; external=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    page.on('request',lambda r: external.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((root/'index.html').read_text())
    assert page.locator('#report').inner_text().startswith('候補 2:')
    assert page.locator('#stats').inner_text().find('280')>=0
    page.screenshot(path=str(root/'desktop.png'),full_page=True)
    with page.expect_download() as d: page.locator('#save').click()
    assert json.loads(Path(d.value.path()).read_text())['selected']==[1]
    page.locator('#candidates').fill('');assert page.locator('#save').is_disabled();page.locator('#run').click();assert 'できません' in page.locator('#status').inner_text()
    page.locator('#existing').fill('bad');page.locator('#run').click();assert page.locator('#save').is_disabled()
    page.locator('#reset').click();assert page.locator('#report').inner_text().startswith('候補 2:')
    page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.screenshot(path=str(root/'mobile.png'),full_page=True)
    assert not errors and not external,(errors,external)
    b.close()
print('Chromium inline UI, JSON download, invalidation, invalid input, reset, 390px, no JS errors or HTTP requests: passed')
