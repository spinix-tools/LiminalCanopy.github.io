from playwright.sync_api import sync_playwright
from pathlib import Path
import json
p=Path(__file__).resolve().parent
with sync_playwright() as w:
 b=w.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']); page=b.new_page(viewport={'width':1200,'height':1000},accept_downloads=True); errs=[]; req=[]
 page.on('pageerror',lambda e:errs.append(str(e)));page.on('request',lambda r:req.append(r.url));page.set_content((p/'index.html').read_text());page.wait_for_selector('.stat strong');assert page.locator('.stat strong').all_text_contents()==['3 / 4','2 / 4','3 本'];page.screenshot(path=str(p/'desktop.png'),full_page=True)
 with page.expect_download() as d: page.click('#download')
 report=json.loads(Path(d.value.path()).read_text());assert report['plan']['count']==3 and report['plan']['priority']==19
 page.fill('#margin','10');assert page.locator('#download').is_disabled();page.click('#run');assert page.locator('#download').is_enabled();page.fill('#jobs','invalid');page.click('#run');assert '入力エラー' in page.locator('#status').inner_text();assert page.locator('#download').is_disabled();page.click('#sample');page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth <= innerWidth');page.screenshot(path=str(p/'mobile.png'),full_page=True);assert not errs,errs;assert not [r for r in req if r.startswith(('http:','https:'))],req;b.close();print('Chromium: sample, JSON download, edit invalidation, recalculation, invalid input, reset, mobile, no JS errors or HTTP requests passed')
