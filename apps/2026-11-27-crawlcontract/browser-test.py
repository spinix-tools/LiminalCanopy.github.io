from playwright.sync_api import sync_playwright
from pathlib import Path
import json
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']); page=b.new_page(viewport={'width':1200,'height':950},accept_downloads=True); errors=[]; requests=[];page.on('pageerror',lambda e: errors.append(str(e)));page.on('request',lambda r: requests.append(r.url) if r.url.startswith(('http:','https:')) else None)
 page.set_content(Path(__file__).with_name('index.html').read_text()); assert page.locator('#rows tr').count()==6; assert page.locator('#rows .bad').count()==2; page.screenshot(path='desktop.png',full_page=True);page.select_option('#filter','fail');assert page.locator('#rows tr').count()==2
 with page.expect_download() as d: page.click('#export')
 data=json.loads(Path(d.value.path()).read_text());assert data['fail']==2 and data['changed']==2
 page.fill('#after','Disallow: /');assert not page.locator('#results').is_visible();page.click('#run');assert 'User-agent' in page.locator('#notice').inner_text();assert not page.locator('#results').is_visible();page.click('#sample');page.click('#self');assert '16 件合格' in page.locator('#notice').inner_text();page.set_viewport_size({'width':390,'height':844});page.screenshot(path='mobile.png',full_page=True);assert page.evaluate('document.documentElement.scrollWidth <= innerWidth');assert not errors and not requests;print('Chromium inline, filter, JSON download, invalidation, invalid input, reset, self-test, mobile, no JS errors/network: PASS'); b.close()
