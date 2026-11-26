from pathlib import Path
from playwright.sync_api import sync_playwright
import csv, io
root=Path(__file__).resolve().parent
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1200,'height':1000},accept_downloads=True)
    errors=[]; external=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:external.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((root/'index.html').read_text())
    assert '240 枚' in page.locator('#result').inner_text()
    print(page.locator('table').inner_text())
    page.screenshot(path=str(root/'desktop.png'),full_page=True)
    with page.expect_download() as d:page.click('#export')
    rows=list(csv.reader(io.StringIO(Path(d.value.path()).read_text(encoding='utf-8-sig'))))
    assert len(rows)==241 and rows[1][2]=='0.000000'
    times=[float(r[2]) for r in rows[1:]];assert all(a<b for a,b in zip(times,times[1:])) and times[-1]<1800
    page.fill('#shots','100');assert page.locator('#export').is_disabled();page.click('#run');assert '範囲外' in page.locator('#status').inner_text()
    page.click('#reset');page.click('#add');assert page.locator('.segment').count()==4;page.locator('.segment button').last.click();assert page.locator('.segment').count()==3
    page.locator('.segment input').first.fill('<img src=x onerror=alert(1)>');page.click('#run');assert page.locator('#result img').count()==0
    page.locator('.segment input').nth(1).fill('');page.click('#run');assert '空欄' in page.locator('#status').inner_text()
    page.click('#reset');page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth <= innerWidth');page.screenshot(path=str(root/'mobile.png'),full_page=True)
    assert not errors and not external,(errors,external)
    print('Chromium: initial render, CSV 240 frames, input invalidation, budget rejection, add/delete, safe text, blank rejection, reset, 390px, no errors or external HTTP: PASS')
    browser.close()
