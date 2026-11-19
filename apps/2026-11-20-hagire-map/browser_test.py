"""UI integration tests; run with python browser_test.py (Playwright + Chromium required)."""
import json
import subprocess
import threading
import http.server
import socketserver
import os
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image

ROOT=Path(__file__).resolve().parent
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args): pass

def main():
    old=os.getcwd();os.chdir(ROOT)
    # The managed browser blocks http://localhost and file://. Inline exactly the same CSS/JS.
    source=(ROOT/'index.html').read_text(encoding='utf-8')
    source=source.replace('<link rel="stylesheet" href="style.css">','<style>'+ (ROOT/'style.css').read_text(encoding='utf-8') +'</style>')
    for name in ('engine.js','app.js'):
        source=source.replace('<script src="'+name+'" defer></script>','<script>'+ (ROOT/name).read_text(encoding='utf-8') +'</script>')
    def open_inline(page):
        page.goto('about:blank')
        page.evaluate('''Object.defineProperty(window,'localStorage',{configurable:true,value:{
          values:{},getItem(k){return this.values[k]??null},setItem(k,v){this.values[k]=String(v)},removeItem(k){delete this.values[k]}
        }})''')
        page.set_content(source,wait_until='load')
    n=0
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
            ctx=browser.new_context(accept_downloads=True, viewport={'width':1365,'height':1000})
            page=ctx.new_page()
            page.on('pageerror',lambda error:print('JS ERROR:',error))
            open_inline(page);page.wait_for_selector('.sheet-card');n+=1
            assert 'はぎれ地図' in page.title();n+=1
            assert page.locator('.sheet-card').count()>0;n+=1
            assert ' / ' in page.locator('#placedMetric').inner_text();n+=1
            assert page.locator('#errors').is_hidden();n+=1
            page.locator('#projectName').fill('試作品2026');n+=1
            assert page.locator('#projectName').input_value()=='試作品2026';n+=1
            page.locator('#addStock').click();n+=1
            assert page.locator('#stockRows tr').count()==5;n+=1
            page.locator('#stockRows tr:last-child input[data-field="name"]').fill('予備の端切れ');n+=1
            assert page.locator('.sheet-card').count()>0;n+=1
            page.locator('#stockRows tr:last-child .delete').click();n+=1
            assert page.locator('#stockRows tr').count()==4;n+=1
            page.locator('#addPart').click();n+=1
            assert page.locator('#partRows tr').count()==5;n+=1
            page.locator('#partRows tr:last-child .delete').click();n+=1
            assert page.locator('#partRows tr').count()==4;n+=1
            page.locator('#gap').fill('5');n+=1
            assert page.locator('#errors').is_hidden();n+=1
            with page.expect_download() as info:page.locator('#csv').click()
            csv=info.value;assert csv.suggested_filename.endswith('.csv');n+=1
            with page.expect_download() as info:page.locator('#svg').click()
            sv=info.value;assert sv.suggested_filename.endswith('.svg');n+=1
            with page.expect_download() as info:page.locator('#saveJson').click()
            js=info.value;json_path=ROOT/'test-export.json';js.save_as(str(json_path));n+=1
            data=json.loads(json_path.read_text(encoding='utf-8'));assert data['name']=='試作品2026';n+=1
            page.locator('#fresh').click();n+=1
            assert page.locator('#stockRows tr').count()==0;n+=1
            page.locator('#jsonFile').set_input_files(str(json_path));n+=1
            page.wait_for_function('document.querySelectorAll("#stockRows tr").length===4');n+=1
            assert page.locator('#projectName').input_value()=='試作品2026';n+=1
            page.set_content(source,wait_until='load');page.wait_for_selector('.sheet-card');n+=1
            assert page.locator('#projectName').input_value()=='試作品2026';n+=1
            page.locator('#stockRows tr:first-child input[data-field="w"]').fill('-2');n+=1
            assert page.locator('#errors').is_visible();n+=1
            page.locator('#stockRows tr:first-child input[data-field="w"]').fill('460');n+=1
            assert page.locator('#errors').is_hidden();n+=1
            page.locator('#demo').click();n+=1
            assert page.locator('#stockRows tr').count()==4;n+=1
            page.screenshot(path=str(ROOT/'desktop.png'),full_page=True);n+=1
            mobile=ctx.new_page();mobile.set_viewport_size({'width':390,'height':844});open_inline(mobile);mobile.wait_for_selector('.sheet-card');n+=1
            mobile.screenshot(path=str(ROOT/'mobile.png'),full_page=True)
            picture=Image.open(ROOT/'mobile.png')
            if picture.width>390: picture.crop((0,0,390,picture.height)).save(ROOT/'mobile.png')
            n+=1
            # Commit/undo interaction on an easy one-piece project
            page.locator('#fresh').click();page.locator('#addStock').click();page.locator('#addPart').click();n+=1
            page.locator('#partRows tr:first-child input[data-field="w"]').fill('100');page.locator('#partRows tr:first-child input[data-field="h"]').fill('100');n+=1
            assert page.locator('#commit').is_enabled();n+=1
            page.locator('#commit').click();n+=1
            assert page.locator('#partRows tr').count()==0;n+=1
            assert page.locator('#undo').is_enabled();n+=1
            page.locator('#undo').click();n+=1
            assert page.locator('#partRows tr').count()==1;n+=1
            page.locator('#print').click();n+=1
            browser.close()
            json_path.unlink(missing_ok=True)
    finally:
        os.chdir(old)
    print(f'PASS: {n} browser checks, screenshots desktop.png and mobile.png')
if __name__=='__main__':main()
