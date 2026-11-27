from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright
import io
base=Path(__file__).parent
buf=io.BytesIO(); frames=[Image.new('RGB',(12,12),(i*10,0,255-i*10)) for i in range(24)];frames[0].save(buf,format='GIF',save_all=True,append_images=frames[1:],duration=40,loop=0)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page(viewport={'width':1200,'height':1000},accept_downloads=True);errors=[];external=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:external.append(r.url) if r.url.startswith(('http:','https:')) else None);page.set_content((base/'index.html').read_text());assert '960.00' in page.locator('#stats').inner_text();page.screenshot(path=str(base/'desktop.png'),full_page=True)
 page.locator('#file').set_input_files({'name':'test.gif','mimeType':'image/gif','buffer':buf.getvalue()});page.wait_for_function("!document.getElementById('patch').disabled");assert '24画像' in page.locator('#fileinfo').inner_text()
 with page.expect_download() as d:page.click('#patch')
 out=Image.open(d.value.path());src=Image.open(io.BytesIO(buf.getvalue()));dur=[]
 for i in range(24):
  out.seek(i);src.seek(i);assert out.convert('RGB').tobytes()==src.convert('RGB').tobytes();dur.append(out.info['duration'])
 assert sum(dur)==1000 and set(dur)=={40,50};assert out.info.get('loop')==src.info.get('loop')==0
 with page.expect_download() as d:page.click('#export')
 assert len(Path(d.value.path()).read_text().splitlines())==25
 page.fill('#num','0');assert page.locator('#patch').is_disabled();page.click('#run');assert page.locator('#error').inner_text();page.click('#sample');assert not page.locator('#patch').is_disabled();page.fill('#count','23');page.click('#run');assert page.locator('#patch').is_disabled();page.click('#clear');page.click('#sample');page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth <= innerWidth');page.screenshot(path=str(base/'mobile.png'),full_page=True);assert not errors and not external;b.close()
print('Chromium: GIF patch/download, 24 decoded frames identical, 1000ms, loop preserved, CSV, invalidation, mismatch, mobile, no page errors or external HTTP: PASS')
