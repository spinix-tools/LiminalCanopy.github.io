from playwright.sync_api import sync_playwright
from pathlib import Path
import json
base=Path(__file__).resolve().parent
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1200,'height':850},accept_downloads=True)
 errors=[]; requests=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('request',lambda r:requests.append(r.url) if r.url.startswith(('http:','https:')) else None)
 page.set_content((base/'index.html').read_text())
 assert '3 / 3' in page.locator('#status').inner_text()
 print(page.locator('#out h3').all_text_contents(),page.locator('.metric').all_text_contents())
 page.screenshot(path=str(base/'desktop.png'),full_page=True)
 with page.expect_download() as dl: page.locator('#save').click()
 data=json.loads(Path(dl.value.path()).read_text());assert len(data['results'])==3
 page.locator('#labels').fill('abc');assert page.locator('#save').is_disabled();page.locator('#run').click();assert '6点点字' in page.locator('#status').inner_text()
 page.locator('#reset').click();assert '3 / 3' in page.locator('#status').inner_text()
 page.locator('#stock').fill('10 x 10');page.locator('#run').click();assert '0 / 3' in page.locator('#status').inner_text()
 page.locator('#reset').click();page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
 page.screenshot(path=str(base/'mobile.png'),full_page=True)
 assert not errors and not requests,(errors,requests)
 print('Chromium inline HTML, invalid input, stale report, reset, no-fit, JSON download, 390px, no HTTP or JS errors: passed')
 b.close()
