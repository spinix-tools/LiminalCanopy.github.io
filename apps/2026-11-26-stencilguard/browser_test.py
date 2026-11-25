from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw
import tempfile
base=Path(__file__).resolve().parent
with sync_playwright() as p, tempfile.TemporaryDirectory() as d:
    b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']); page=b.new_page(viewport={'width':1120,'height':920},accept_downloads=True)
    errors=[]; remote=[]; page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:remote.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((base/'index.html').read_text());assert page.locator('#weak').inner_text()=='4';assert page.locator('#max').inner_text()=='17';page.screenshot(path=str(base/'desktop.png'),full_page=True)
    box=page.locator('#view').bounding_box();page.mouse.click(box['x']+box['width']*7.5/15,box['y']+box['height']*2.5/13);assert '17 セル' in page.locator('#detail').inner_text()
    page.click('#two');assert page.locator('#weak').inner_text()=='0';page.click('#none');assert page.locator('#islands').inner_text()=='15'
    page.select_option('#mode','edit');box=page.locator('#view').bounding_box();page.mouse.click(box['x']+box['width']*7.5/15,box['y']+box['height']*3.5/13);page.mouse.click(box['x']+box['width']*7.5/15,box['y']+box['height']*4.5/13);assert page.locator('#islands').inner_text()=='0'
    page.locator('#grid').fill('bad');page.click('#apply');assert '入力' in page.locator('#status').inner_text();page.click('#one')
    for id,ext in [('csv','csv'),('png','png')]:
        with page.expect_download() as dl:page.click('#'+id)
        out=Path(d)/('out.'+ext);dl.value.save_as(str(out));assert out.stat().st_size>0
        if ext=='csv':assert len(out.read_text().splitlines())==196
        else:assert Image.open(out).size==(150,130)
    im=Image.new('RGB',(30,30),'white');draw=ImageDraw.Draw(im);draw.rectangle((5,5,24,24),fill='black');draw.rectangle((10,10,19,19),fill='white');path=Path(d)/'input.png';im.save(path);page.locator('#file').set_input_files(str(path));page.wait_for_function("document.querySelector('#islands').textContent==='100'");page.click('#one');page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth <= innerWidth');page.screenshot(path=str(base/'mobile.png'),full_page=True);assert not errors and not remote,(errors,remote);b.close()
print('Chromium inline HTML, presets, damage, edit, invalid input, CSV/PNG, PNG import, 390px, no JS errors or HTTP requests: PASS')
