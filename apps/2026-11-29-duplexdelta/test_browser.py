from pathlib import Path
from playwright.sync_api import sync_playwright
import json, tempfile, base64
from PIL import Image
ROOT=Path(__file__).resolve().parent
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1200,'height':900},accept_downloads=True)
    errors=[]; requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:requests.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((ROOT/'index.html').read_text())
    page.click('#sample'); assert '1.41' in page.locator('#stats').inner_text()
    page.screenshot(path=str(ROOT/'desktop.png'),full_page=True)
    with page.expect_download() as d: page.click('#json')
    report=json.loads(Path(d.value.path()).read_text()); assert max(report['residual'])<1e-8
    page.fill('#d40','2'); assert '許容外' in page.locator('#status').inner_text()
    page.fill('#d40',''); assert page.locator('#json').is_disabled()
    page.click('#sample'); page.select_option('#flip','short')
    with page.expect_download() as d: page.click('#svg')
    assert 'transform="matrix(' in Path(d.value.path()).read_text()
    page.evaluate('window.print=()=>{window.printed=true}')
    page.click('#verify'); assert page.evaluate('window.printed') and page.locator('#printArea .sheet').count()==2
    assert page.locator('#printArea .sheet').nth(1).locator('g').count()==1
    page.click('#raw'); assert page.locator('#printArea .sheet').nth(1).locator('g').count()==0
    with tempfile.TemporaryDirectory() as td:
        img=Path(td)/'test.png'; Image.new('RGB',(210,297),'white').save(img)
        page.locator('#art').set_input_files(str(img)); page.wait_for_function('!document.getElementById("artSave").disabled')
        with page.expect_download() as d: page.click('#artSave')
        assert 'data:image/png;base64,' in Path(d.value.path()).read_text()
        page.select_option('#paper','letter'); assert page.locator('#artSave').is_disabled()
    page.select_option('#paper','a4'); page.set_viewport_size({'width':390,'height':844}); page.screenshot(path=str(ROOT/'mobile.png'),full_page=True)
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    assert not errors and not requests, (errors,requests)
    browser.close()
print('Chromium: inline HTML, sample, holdout, invalid, 3 downloads, print DOM, image ratio, 390px, zero errors/network PASS')
