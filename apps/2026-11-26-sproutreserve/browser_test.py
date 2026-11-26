from pathlib import Path
from playwright.sync_api import sync_playwright
import csv
root=Path(__file__).resolve().parent
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1200,'height':900},accept_downloads=True)
    errors=[]; external=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:external.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((root/'index.html').read_text())
    assert '目標未達' in page.locator('#status').inner_text()
    assert page.locator('#chance').inner_text()=='43.58%'
    page.screenshot(path=str(root/'desktop.png'),full_page=True)
    page.select_option('#mode','observed'); assert page.locator('#result').is_hidden()
    page.click('#run'); assert page.locator('#used').inner_text()=='50 粒'
    assert page.locator('#chance').inner_text()=='95.27%'
    with page.expect_download() as d: page.click('#save')
    with open(d.value.path(),newline='') as f: rows=list(csv.DictReader(f))
    assert len(rows)==24 and sum(int(r['seeds']) for r in rows)==50
    page.fill('#k','21');page.click('#run');assert page.locator('#result').is_hidden()
    page.click('#reset');assert page.locator('#chance').inner_text()=='43.58%'
    page.set_viewport_size({'width':390,'height':844}); assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.screenshot(path=str(root/'mobile.png'),full_page=True)
    assert not errors and not external, (errors,external)
    browser.close()
print('Chromium: sample, mode, invalidation, CSV 24 rows, invalid input, reset, 390px, zero JS errors / HTTP requests: PASS')
