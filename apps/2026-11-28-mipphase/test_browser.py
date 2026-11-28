from playwright.sync_api import sync_playwright
from pathlib import Path
import json
p=Path(__file__).resolve().parent
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']); page=b.new_page(viewport={'width':1200,'height':850},accept_downloads=True); errors=[];net=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:net.append(r.url) if r.url.startswith(('http:','https:')) else None);page.set_content((p/'index.html').read_text());assert '2 方向' in page.locator('#summary').inner_text();page.screenshot(path=str(p/'desktop.png'),full_page=True);page.click('#opt');assert '→ 0' in page.locator('#proposal').inner_text();page.click('#apply');assert '0 方向' in page.locator('#summary').inner_text();
 with page.expect_download() as dl: page.click('#export')
 assert json.load(open(dl.value.path()))['levels'][2]['pairs']==[]
 page.fill('#data','{}');assert page.locator('#export').is_disabled();page.click('#run');assert page.locator('#error').inner_text();page.click('#sample');page.select_option('#filter','linear');page.click('#run');assert '方向' in page.locator('#summary').inner_text();page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth <= innerWidth');page.screenshot(path=str(p/'mobile.png'),full_page=True);assert not errors and not net,(errors,net);print('Chromium: sample, optimize/apply, JSON download, invalidation, linear, mobile, zero page errors/HTTP PASS');b.close()
