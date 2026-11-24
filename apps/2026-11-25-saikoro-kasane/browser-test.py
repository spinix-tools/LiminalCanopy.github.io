from playwright.sync_api import sync_playwright
from pathlib import Path
import os
os.chdir(Path(__file__).resolve().parent)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']); page=b.new_page(viewport={'width':1200,'height':950},accept_downloads=True); errors=[]; requests=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r: requests.append(r.url) if r.url.startswith(('https:','http:')) else None)
 page.set_content(Path('index.html').read_text()); print(page.locator('#choice').inner_text(),page.locator('#gap').inner_text(),page.locator('#status').inner_text());assert page.locator('#choice').inner_text()=='4d6-3';page.screenshot(path='desktop.png',full_page=True)
 page.locator('[data-i="1"]').click();assert page.locator('#choice').inner_text()=='4d6-4';page.locator('#threshold').fill('10');assert '元 55.00%' in page.locator('#at').inner_text()
 with page.expect_download() as d: page.locator('#csv').click()
 path=d.value.path();assert Path(path).read_text().startswith('threshold,original_probability,alternative_probability,difference');print('CSV',d.value.suggested_filename)
 page.locator('#d6').fill('0');page.locator('#run').click();assert '1個以上' in page.locator('#err').inner_text();assert page.locator('#csv').is_disabled();page.locator('#reset').click();assert page.locator('#choice').inner_text()=='4d6-3'
 page.locator('#s').fill('101');page.locator('#run').click();assert '入力範囲' in page.locator('#err').inner_text();page.locator('#reset').click()
 page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth <= innerWidth');page.screenshot(path='mobile.png',full_page=True);assert not errors and not requests;print('Chromium: selection, threshold, CSV, empty stock, invalid input, reset, 390px, no exceptions/HTTP: PASS');b.close()
