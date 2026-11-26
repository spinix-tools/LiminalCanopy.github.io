from pathlib import Path
from playwright.sync_api import sync_playwright
import json
base=Path(__file__).resolve().parent
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1200,'height':950},accept_downloads=True)
    errors=[]; external=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:external.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((base/'index.html').read_text())
    assert page.locator('#stats strong').all_text_contents()==['3/3','3/3','3','2']
    page.screenshot(path=str(base/'desktop.png'),full_page=True)
    page.get_by_role('button',name='× ループ').first.click()
    assert '/old → /mid → /old' in page.locator('#trace').inner_text()
    page.locator('#phase').select_option('2');page.locator('#swap').click()
    assert page.locator('#stats strong').all_text_contents()==['3/3','3/3','1','1']
    assert page.get_by_role('button',name='× ループ').count()==0
    with page.expect_download() as d:page.locator('#export').click()
    report=json.loads(d.value.path().read_text());assert report['summary']['hidden']==1
    page.locator('#rules').fill('/a /b\n/a /c');assert page.locator('#export').is_disabled();page.locator('#run').click();assert '重複' in page.locator('#message').inner_text()
    page.locator('#sample').click();assert page.locator('#stats strong').all_text_contents()==['3/3','3/3','3','2']
    page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth===innerWidth')
    page.screenshot(path=str(base/'mobile.png'),full_page=True)
    assert not errors and not external,(errors,external)
    print('PASS browser: inline HTML, demo, trace, swap, JSON download, invalidation, invalid input, reset, mobile, zero JS errors and HTTP requests')
    browser.close()
