from pathlib import Path
from playwright.sync_api import sync_playwright
import json,csv,io
root=Path(__file__).parent
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1200,'height':1100},accept_downloads=True)
    errors=[]; network=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    page.on('request',lambda r: network.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((root/'index.html').read_text(encoding='utf-8'));page.wait_for_selector('#results')
    assert page.locator('#metrics strong').all_text_contents()==['2 / 3','50 L','0 L','1200.0 mg']
    page.screenshot(path=str(root/'desktop.png'),full_page=True)
    with page.expect_download() as d: page.click('#csv')
    data=list(csv.reader(io.StringIO(Path(d.value.path()).read_text(encoding='utf-8-sig'))));assert len(data)==4 and sum(int(r[1]) for r in data[1:])==50
    with page.expect_download() as d: page.click('#json')
    assert json.loads(Path(d.value.path()).read_text())['optimal']['hit']==2
    page.fill('#budget','0');assert page.locator('#results').is_hidden();page.click('#run');assert page.locator('#metrics strong').first.inner_text()=='0 / 3'
    page.fill('#step','0');page.click('#run');assert page.locator('#results').is_hidden() and page.locator('#error').inner_text()
    page.click('#reset');page.click('#add');assert page.locator('.tank').count()==4;page.locator('.tank button').last.click();assert page.locator('.tank').count()==3
    page.locator('.tank input[data-key=name]').first.fill('<img src=x onerror=alert(1)>');page.click('#run');assert page.locator('#rows img').count()==0
    page.click('#reset');page.set_viewport_size({'width':390,'height':844});page.screenshot(path=str(root/'mobile.png'),full_page=True)
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth');assert not errors,errors;assert not network,network
    browser.close()
print('PASS: Chromium inline HTML load, CSV/JSON download, edits, validation, add/delete, safe text, 390px layout, zero page errors / HTTP requests')
