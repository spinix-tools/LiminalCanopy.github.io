from pathlib import Path
from playwright.sync_api import sync_playwright
import json
root=Path(__file__).parent
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1200,'height':900},accept_downloads=True)
    errors=[];requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:requests.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((root/'index.html').read_text())
    assert 'アフィン変形' in page.locator('#metrics').inner_text()
    assert '0.141' in page.locator('#metrics').inner_text()
    page.screenshot(path=str(root/'desktop.png'),full_page=True)
    for button in ['front','back','corrected','report']:
        with page.expect_download() as d: page.locator('#'+button).click()
        f=d.value.path(); s=f.read_text()
        if button=='report': assert json.loads(s)['chosen']=='affine'
        else: assert '<svg' in s and ('transform=' in s)==(button=='corrected')
    page.locator('#train').fill('bad');assert page.locator('#results').is_hidden()
    page.locator('#run').click();assert '4行' in page.locator('#status').inner_text()
    page.locator('#sample').click();assert page.locator('#results').is_visible()
    page.locator('#flip').select_option('short');assert page.locator('#results').is_hidden()
    page.locator('#run').click();assert page.locator('#results').is_visible()
    page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.screenshot(path=str(root/'mobile.png'),full_page=True)
    assert not errors and not requests,(errors,requests)
    browser.close()
print('Chromium inline HTML: sample, 4 downloads, invalid input, reset, binding change, 390px, zero JS errors / HTTP requests passed')
