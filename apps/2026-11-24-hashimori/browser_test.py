from playwright.sync_api import sync_playwright
from pathlib import Path
from PIL import Image, ImageDraw
import io
p=Path(__file__).parent
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page(viewport={'width':1200,'height':950},accept_downloads=True)
 errs=[];requests=[];page.on('pageerror',lambda e:errs.append(str(e)));page.on('request',lambda r:requests.append(r.url) if r.url.startswith(('http:','https:')) else None)
 page.evaluate("Object.defineProperty(window,'localStorage',{value:{store:{},setItem(k,v){this.store[k]=v},getItem(k){return this.store[k]??null}}})");page.set_content((p/'index.html').read_text());assert page.locator('#islands').inner_text()=='32';page.screenshot(path=str(p/'desktop.png'),full_page=True)
 page.click('#break');box=page.locator('#board').bounding_box();page.mouse.click(box['x']+box['width']*4.5/30,box['y']+box['height']*10.5/22);assert '新規脱落' in page.locator('#status').inner_text()
 for _ in range(3):
  page.click('#search');btn=page.get_by_role('button',name='適用',exact=True)
  if not btn.count():break
  page.get_by_role('button',name='表示',exact=True).first.click();btn.first.click()
 assert page.locator('#islands').inner_text()=='0';assert page.locator('#weak').inner_text()=='0';page.click('#save');page.click('#clear');page.click('#restore');assert page.locator('#weak').inner_text()=='0';page.click('#undo')
 with page.expect_download() as d:page.click('#export')
 assert '90mm' in Path(d.value.path()).read_text();page.locator('summary').click();page.locator('#ascii').fill('invalid');page.click('#load');assert '30文字' in page.locator('#status').inner_text()
 im=Image.new('RGB',(28,20),'white');ImageDraw.Draw(im).rectangle((4,4,12,12),outline='black',width=2);f=io.BytesIO();im.save(f,format='PNG');page.locator('#file').set_input_files({'name':'test.png','mimeType':'image/png','buffer':f.getvalue()});page.wait_for_function("document.querySelector('#status').textContent.includes('取り込みました')");assert int(page.locator('#islands').inner_text())>0
 page.click('#sample');page.locator('summary').click();page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.screenshot(path=str(p/'mobile.png'),full_page=True);assert not errs and not requests,(errs,requests);print('Chromium: sample, break, preview/apply, save/restore, undo, SVG, invalid ASCII, PNG import, mobile, no errors/HTTP passed');b.close()
