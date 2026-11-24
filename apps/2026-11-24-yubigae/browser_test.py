from pathlib import Path
from playwright.sync_api import sync_playwright
p=Path(__file__).resolve().parent
with sync_playwright() as w:
 b=w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']); page=b.new_page(viewport={'width':1200,'height':950},accept_downloads=True); errors=[]; network=[]
 page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:network.append(r.url) if r.url.startswith(('http:','https:')) else None)
 page.set_content((p/'index.html').read_text()); assert '231 /' in page.locator('#summary').inner_text(); print(page.locator('#summary').inner_text()); print(page.locator('#comparison').inner_text()); print(page.locator('#ranking tbody tr').first.inner_text());page.screenshot(path=str(p/'desktop.png'),full_page=True)
 original=page.locator('#layout').input_value();page.locator('#ranking button:not([disabled])').first.click();assert page.locator('#layout').input_value()!=original;page.locator('#undo').click();assert page.locator('#layout').input_value()==original
 with page.expect_download() as d: page.locator('#csv').click()
 assert len(Path(d.value.path()).read_text(encoding='utf-8-sig').splitlines())==232
 page.locator('#layout').fill('abc');page.locator('#run').click();assert '重複なく' in page.locator('#msg').inner_text();page.locator('#reset').click();page.locator('#locks').fill('abcdefghijklmnopqrstuvwxyz');page.locator('#run').click();assert 'ありません' in page.locator('#msg').inner_text();page.locator('#locks').fill('zxcv');page.locator('#run').click();page.set_viewport_size({'width':390,'height':844}); assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.screenshot(path=str(p/'mobile.png'),full_page=True);assert not errors and not network;print('browser PASS, errors',errors,'HTTP',network);b.close()
