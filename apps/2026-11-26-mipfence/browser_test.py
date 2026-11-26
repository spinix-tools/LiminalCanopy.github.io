from pathlib import Path
import json
from playwright.sync_api import sync_playwright
from PIL import Image
from io import BytesIO
p=Path(__file__).resolve().parent
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1200,'height':900},accept_downloads=True)
    errors=[]; network=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:network.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((p/'index.html').read_text())
    assert page.locator('#results tr').count()==5
    print(page.locator('#summary').inner_text())
    page.screenshot(path=str(p/'desktop.png'),full_page=True)
    with page.expect_download() as d: page.locator('#save').click()
    report=json.loads(Path(d.value.path()).read_text()); assert len(report['frames'])==4
    print('sample maxima:',[round(m['max'],2) for m in report['frames'][0]['mips']])
    page.locator('#w').fill('999'); assert page.locator('#save').is_disabled();page.locator('#run').click();assert '上限' in page.locator('#status').inner_text()
    page.locator('#sample').click(); assert page.locator('#save').is_enabled()
    buf=BytesIO();Image.new('RGBA',(32,32),(80,120,50,255)).save(buf,format='PNG');page.locator('#file').set_input_files({'name':'uniform.png','mimeType':'image/png','buffer':buf.getvalue()});page.wait_for_function("document.querySelector('#status').textContent.includes('設定して')");page.locator('#run').click();assert page.locator('#summary').inner_text()=='0 / 16 セルに警告'
    page.locator('#sample').click();page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.screenshot(path=str(p/'mobile.png'),full_page=True)
    assert not errors,errors;assert not network,network
    print('Chromium: sample, PNG upload, JSON download, invalidation, invalid input, mobile, zero page errors and HTTP requests passed')
    browser.close()
