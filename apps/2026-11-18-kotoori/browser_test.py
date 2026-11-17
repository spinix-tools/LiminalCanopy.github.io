"""Real Chromium E2E smoke & interactions for KOTOORI. Run: python browser_test.py"""
from __future__ import annotations
import json
import threading
import tempfile
import re
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
from playwright.sync_api import sync_playwright
from PIL import Image

ROOT=Path(__file__).resolve().parent
count=0

def verify(label, result):
    global count
    if not result: raise AssertionError(label)
    count+=1
    print('PASS',count,label)

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass

server=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietHandler,directory=str(ROOT)))
thread=threading.Thread(target=server.serve_forever,daemon=True)
thread.start()
try:
    with sync_playwright() as playwright:
        browser=playwright.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
        context=browser.new_context(accept_downloads=True,viewport={'width':1440,'height':980},device_scale_factor=1)
        page=context.new_page()
        exceptions=[]
        page.on('pageerror',lambda e: exceptions.append(str(e)))
        # This environment blocks even loopback HTTP navigation. Keep real Chromium DOM,
        # but inject local HTML/JS and a controlled storage adapter instead.
        def load_app(seed=None):
            html=(ROOT/'index.html').read_text(encoding='utf-8')
            html=re.sub(r'<script src="\./(?:engine|app)\.js"></script>', '', html)
            page.set_content(html, wait_until='load')
            page.evaluate('''(seed) => {
              const values = Object.assign({}, seed || {});
              Object.defineProperty(window, 'localStorage', {
                configurable:true,
                value:{getItem(k){return Object.hasOwn(values,k)?values[k]:null;},
                       setItem(k,v){values[k]=String(v);},
                       removeItem(k){delete values[k];}}
              });
            }''',seed)
            page.add_script_tag(content=(ROOT/'engine.js').read_text(encoding='utf-8'))
            page.add_script_tag(content=(ROOT/'app.js').read_text(encoding='utf-8'))
        load_app()
        verify('document loads',page.title().startswith('こと折'))
        verify('eight ordered edit page choices',page.locator('.page-choice').count()==8)
        verify('eight imposed sheet panels',page.locator('#sheet .panel').count()==8)
        verify('sheet top row is reversed and rotated',page.locator('#sheet .panel').evaluate_all('(els)=>els.slice(0,4).map(e=>e.dataset.page).join(",")')=='7,6,5,4' and page.locator('#sheet .panel.top').count()==4)
        verify('sheet bottom row has rear-cover first',page.locator('#sheet .panel').evaluate_all('(els)=>els.slice(4).map(e=>e.dataset.page).join(",")')=='8,1,2,3')
        verify('default vertical orientation',page.locator('#sheet .panel-content').first.evaluate('(el)=>getComputedStyle(el).writingMode')=='vertical-rl')
        verify('initial demo content',page.locator('#titleInput').input_value()=='小さな旅の記録')
        verify('default summary has eight pages',page.locator('#summary').inner_text().startswith('8ページ'))
        page.screenshot(path=str(ROOT/'desktop.png'),full_page=True)
        page.locator('.page-choice').nth(2).click()
        verify('select page 3 updates heading',page.locator('#selectedTitle').inner_text().startswith('3 ·'))
        page.locator('#titleInput').fill('夜のページ')
        page.locator('#bodyInput').fill('縦書きの短編。\n次の行。')
        verify('title updates sheet preview',page.locator('#sheet .panel[data-page="3"] h3').inner_text()=='夜のページ')
        verify('body updates sheet preview',page.locator('#sheet .panel[data-page="3"] p').inner_text().startswith('縦書き'))
        verify('autosave wrote localStorage',page.evaluate('localStorage.getItem("kotoori:project:v1")!==null'))
        saved=page.evaluate('localStorage.getItem("kotoori:project:v1")')
        load_app({'kotoori:project:v1':saved})
        page.locator('.page-choice').nth(2).click()
        verify('saved content survived reload',page.locator('#titleInput').input_value()=='夜のページ')
        page.locator('#direction').select_option('horizontal')
        verify('horizontal writing mode applies',page.locator('#sheet .panel-content').first.evaluate('(el)=>getComputedStyle(el).writingMode')=='horizontal-tb')
        page.locator('#paper').select_option('blue')
        verify('paper color change applies',page.locator('#sheet .panel').first.evaluate('(el)=>getComputedStyle(el).backgroundColor')=='rgb(224, 235, 238)')
        page.locator('#fontSize').fill('18')
        verify('font slider updates CSS',page.locator('#sheet').evaluate('(el)=>el.style.getPropertyValue("--type-size")')=='18')
        page.locator('#guides').uncheck()
        verify('guide checkbox toggles class',not page.locator('#sheet').evaluate('(el)=>el.classList.contains("guides")'))
        page.locator('#readMode').click()
        verify('reading order view shows 8 previews',page.locator('#reader .reader-item').count()==8)
        verify('reading view selected',page.locator('#readMode').get_attribute('aria-pressed')=='true')
        page.locator('#reader .reader-item').nth(4).click()
        verify('reader page click changes editor',page.locator('#selectedTitle').inner_text().startswith('5 ·'))
        page.locator('#sheetMode').click()
        verify('sheet view returns',page.locator('#sheetMode').get_attribute('aria-pressed')=='true')
        # Malicious strings must remain text, never be parsed as DOM.
        page.locator('#bodyInput').fill('<script>window.XSS=1</script>')
        verify('untrusted user content not interpreted',page.evaluate('window.XSS===undefined') and page.locator('#sheet script').count()==0)
        with page.expect_download() as event:
            page.locator('#exportBtn').click()
        download=event.value
        verify('download is JSON project',download.suggested_filename.endswith('.json'))
        with tempfile.TemporaryDirectory() as tmp:
            file=Path(tmp)/'export.json';download.save_as(file)
            data=json.loads(file.read_text())
            verify('JSON contains eight pages',len(data['pages'])==8)
            verify('JSON includes edited content',data['pages'][4]['body']=='<script>window.XSS=1</script>')
            # Accept the destructive-action confirmation.
            page.once('dialog',lambda d:d.accept())
            page.locator('#newBtn').click()
            verify('new project blanked selected page',page.locator('#bodyInput').input_value()=='')
            page.locator('#jsonFile').set_input_files(str(file))
            page.wait_for_timeout(220)
            verify('import restores title/page content',page.locator('.page-choice').nth(2).inner_text().find('夜のページ')>=0)
            page.locator('.page-choice').nth(4).click()
            verify('import restores sanitized text',page.locator('#bodyInput').input_value()=='<script>window.XSS=1</script>')
        with tempfile.TemporaryDirectory() as tmp:
            pic=Path(tmp)/'small.png'
            Image.new('RGB',(120,70),(180,65,44)).save(pic)
            page.locator('#imageInput').set_input_files(str(pic))
            page.wait_for_function('document.querySelectorAll("#sheet .panel img").length === 1')
            verify('local image appears in page preview',page.locator('#sheet .panel[data-page="5"] img').count()==1)
            verify('local image was converted to embedded JPEG',page.locator('#sheet .panel[data-page="5"] img').get_attribute('src').startswith('data:image/jpeg;base64,'))
            page.locator('#removeImage').click()
            verify('remove image clears page',page.locator('#sheet .panel[data-page="5"] img').count()==0)
        # Oversized body: warning from actual DOM content dimensions.
        page.locator('#bodyInput').fill('あ'*2500)
        page.wait_for_timeout(120)
        verify('overflow warning flags long body', '5ページ' in page.locator('#sheetWarning').inner_text())
        page.locator('#bodyInput').fill('短い文章')
        page.wait_for_timeout(100)
        verify('overflow cleared for short body', '5ページ' not in page.locator('#sheetWarning').inner_text())
        page.emulate_media(media='print')
        verify('print sheet has 297mm width',page.locator('#sheet').evaluate('(el)=>getComputedStyle(el).width') in ['1122.52px','1122.51px'] or abs(float(page.locator('#sheet').evaluate('(el)=>parseFloat(getComputedStyle(el).width)'))-1122.52)<1)
        verify('print top row remains rotated',page.locator('#sheet .panel.top .panel-rotator').first.evaluate('(el)=>getComputedStyle(el).transform')=='matrix(-1, 0, 0, -1, 0, 0)')
        page.emulate_media(media='screen')
        verify('no browser JavaScript exceptions',not exceptions)
        # Responsive layout screenshot without mutating the base document.
        page.set_viewport_size({'width':390,'height':844})
        page.screenshot(path=str(ROOT/'mobile.png'),full_page=True)
        verify('mobile view maintains 8 page choices',page.locator('.page-choice').count()==8)
        verify('mobile body has no horizontal document overflow',page.evaluate('document.documentElement.scrollWidth <= innerWidth + 2'))
        browser.close()
finally:
    server.shutdown()
print(f'CHROMIUM E2E: {count}/{count} PASS')
