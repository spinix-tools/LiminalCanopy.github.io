from playwright.sync_api import sync_playwright
from pathlib import Path
p=Path(__file__).parent
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1280,'height':1000},accept_downloads=True)
 errors=[]; requests=[]
 page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:requests.append(r.url) if r.url.startswith(('http:','https:')) and r.url!='https://tedori.test/' else None)
 page.evaluate("Object.defineProperty(window,'localStorage',{value:{data:{},setItem(k,v){this.data[k]=v},getItem(k){return this.data[k]??null}}})");page.set_content((p/'index.html').read_text());assert '3/4' in page.locator('#metrics').inner_text();page.screenshot(path=str(p/'desktop.png'),full_page=True)
 page.get_by_role('button',name='追加して再検査').first.click();assert '5/5' in page.locator('#metrics').inner_text();page.locator('#save').click();page.locator('#sample').click();page.locator('#load').click();assert '5/5' in page.locator('#metrics').inner_text()
 with page.expect_download() as d:page.locator('#csv').click()
 assert 'YES' in Path(d.value.path()).read_text(encoding='utf-8-sig')
 page.locator('#mode').select_option('pair');page.locator('#run').click();assert '15' in page.locator('#metrics').inner_text();page.locator('#nodes').fill('bad');assert page.locator('#csv').is_disabled();page.locator('#run').click();assert page.locator('#error').inner_text();page.locator('#sample').click();page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth <= innerWidth');page.screenshot(path=str(p/'mobile.png'),full_page=True);assert not errors and not requests,(errors,requests);print('Chromium inline / mocked storage: sample, proposal, save/restore, CSV, pair mode, validation, 390px, no JS errors/HTTP requests: PASS');b.close()
