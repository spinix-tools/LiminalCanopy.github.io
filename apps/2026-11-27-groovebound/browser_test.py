from playwright.sync_api import sync_playwright
from pathlib import Path
import json
p=Path(__file__).resolve().parent
with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=b.new_page(viewport={'width':1200,'height':1000},accept_downloads=True)
    errors=[]; requests=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    page.on('request',lambda r: requests.append(r.url) if r.url.startswith(('https:','http:')) else None)
    page.set_content((p/'index.html').read_text()); page.wait_for_selector('#plans details')
    print('sample',page.locator('#overview').inner_text(),page.locator('summary').all_inner_texts())
    print('sample sides',page.locator('#plans details').first.locator('strong').all_inner_texts())
    page.screenshot(path=str(p/'desktop.png'),full_page=True)
    page.select_option('#sides','4'); assert page.locator('#result').is_hidden()
    page.fill('#limits','13:00,13:00,13:00,13:00'); page.click('#run'); assert page.locator('#plans details').count()>0
    print('4 sides',page.locator('#overview').inner_text(),page.locator('summary').all_inner_texts())
    print('4 sides best',page.locator('#plans details').first.locator('strong').all_inner_texts())
    with page.expect_download() as d: page.click('#export')
    report=json.loads(Path(d.value.path()).read_text()); assert len(report['best'][0]['times'])==4 and report['best'][0]['score'][0]==0
    page.fill('#tracks','invalid'); page.click('#run'); assert page.locator('#result').is_hidden(); assert '形式' in page.locator('#status').inner_text()
    page.click('#sample'); assert page.locator('#result').is_visible()
    page.set_viewport_size({'width':390,'height':844}); assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'); page.screenshot(path=str(p/'mobile.png'),full_page=True)
    assert not errors and not requests,(errors,requests)
    print('Chromium: initial render, 4-side change, JSON download, invalidation, reset, mobile width, no errors/network passed')
    b.close()
