from pathlib import Path
from playwright.sync_api import sync_playwright
import json
root=Path(__file__).resolve().parent
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1100,'height':900},accept_downloads=True)
    errors=[]; external=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    page.on('request',lambda r: external.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((root/'index.html').read_text())
    assert page.locator('#save').is_disabled()
    page.click('#sample'); assert '逆順' in page.locator('#status').inner_text()
    assert '10, 8, 6, 4, 2' in page.locator('#result').inner_text()
    assert '白紙ページ 10' in page.locator('#result').inner_text()
    with page.expect_download() as d: page.click('#save')
    data=json.loads(Path(d.value.path()).read_text()); assert data['back']==[10,8,6,4,2] and data['blank']==10
    page.locator('#count').fill('8'); assert '白紙ページ' not in page.locator('#result').inner_text()
    page.locator('#count').fill('501'); assert page.locator('#save').is_disabled()
    page.locator('#count').fill('9'); page.locator('#side0').select_option('inverted'); assert page.locator('#save').is_disabled()
    page.click('#sample'); page.screenshot(path=str(root/'desktop.png'),full_page=True)
    page.set_viewport_size({'width':390,'height':844}); page.screenshot(path=str(root/'mobile.png'),full_page=True)
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.select_option('#flip','top'); assert page.locator('#save').is_disabled()
    page.evaluate('window.print=()=>{}'); page.click('#front'); assert page.locator('#printArea .paper').count()==3
    assert page.locator('#printArea .paper b').all_text_contents()==['A','B','C']
    page.emulate_media(media='print'); assert page.locator('#printArea').is_visible() and not page.locator('main').is_visible()
    page.emulate_media(media='screen'); page.click('#back'); assert page.locator('#printArea .paper b').all_text_contents()==['1','2','3']
    assert not errors and not external,(errors,external)
    browser.close()
print('PASS: Chromium UI, JSON download, invalidation, 390px layout, print DOM, zero JS errors / HTTP requests')
