"""Chromium E2E via injected real page source; localStorage shim due to browser localhost policy."""
from pathlib import Path
from contextlib import contextmanager
import json, subprocess, socket, time
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).parent
@contextmanager
def server():
    with socket.socket() as s:
        s.bind(('127.0.0.1',0)); port=s.getsockname()[1]
    proc=subprocess.Popen(['python','-m','http.server',str(port),'--bind','127.0.0.1'],cwd=str(ROOT),stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    try:
        for _ in range(25):
            try:
                with socket.create_connection(('127.0.0.1',port),.15):break
            except OSError:time.sleep(.1)
        else:raise RuntimeError('server unavailable')
        yield f'http://127.0.0.1:{port}/'
    finally:proc.terminate();proc.wait(timeout=5)

def main():
    checks=[]
    def check(name,condition):
        assert condition,name
        checks.append(name)
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
        ctx=browser.new_context(viewport={'width':1440,'height':950},accept_downloads=True)
        page=ctx.new_page()
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        def mount(target):
            target.set_content((ROOT/'index.html').read_text(),wait_until='load')
            target.add_style_tag(content=(ROOT/'style.css').read_text())
            target.evaluate("""if(!window.__ls){window.__ls={};}Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>window.__ls[k]||null,setItem:(k,v)=>window.__ls[k]=v,removeItem:k=>delete window.__ls[k]}});""")
            target.add_script_tag(content=(ROOT/'engine.js').read_text())
            target.add_script_tag(content=(ROOT/'app.js').read_text())
        mount(page)
        check('title',page.title().startswith('れつみる'))
        check('default 6 rows',page.locator('#slots-body tr').count()==6)
        check('initial simulation', '計算完了' in page.locator('#status').inner_text())
        check('visible dashboard',page.locator('#metrics .metric').count()==8)
        check('SVG chart',page.locator('#chart svg path').count()==2)
        check('six staff options',page.locator('#recommendations .suggestion').count()==4)
        check('no JS errors',not errors)
        page.screenshot(path=str(ROOT/'desktop.png'),full_page=True)
        page.locator('#title-input').fill('出張受付テスト')
        page.locator('#title-input').dispatch_event('change')
        check('title change saves',page.locator('#title-input').input_value()=='出張受付テスト')
        check('dirty state', '再計算' in page.locator('#status').inner_text())
        page.locator('#calculate').click()
        check('recalculate successful','計算完了' in page.locator('#status').inner_text())
        page.locator('#service-input').fill('6');page.locator('#service-input').dispatch_event('change')
        page.locator('#calculate').click()
        check('service edit accepted',page.locator('#service-input').input_value()=='6')
        page.locator('#add-slot').click()
        check('add slot',page.locator('#slots-body tr').count()==7)
        page.locator('#slots-body button[data-remove="6"]').click()
        check('remove slot',page.locator('#slots-body tr').count()==6)
        page.locator('#slots-body input[data-i="0"][data-field="arrivals"]').fill('66')
        page.locator('#slots-body input[data-i="0"][data-field="arrivals"]').dispatch_event('change')
        check('arrival edit',page.locator('#slots-body input[data-i="0"][data-field="arrivals"]').input_value()=='66')
        page.locator('#calculate').click()
        top_idx=int(page.locator('#recommendations button[data-apply]').first.get_attribute('data-apply'))
        before=int(page.locator(f'#slots-body input[data-i="{top_idx}"][data-field="staff"]').input_value())
        page.locator('#recommendations button[data-apply]').first.click()
        now=int(page.locator(f'#slots-body input[data-i="{top_idx}"][data-field="staff"]').input_value())
        check('recommendation applied',now==before+1)
        check('recommendation recalculated','計算完了' in page.locator('#status').inner_text())
        with page.expect_download() as item:page.locator('#export-json').click()
        download=item.value
        check('JSON download name',download.suggested_filename=='retsumiru-settings.json')
        file=ROOT/'test-import.json';download.save_as(file)
        imported=json.loads(file.read_text())
        check('JSON valid and contains edits',imported['data']['title']=='出張受付テスト' and imported['data']['slots'][0]['arrivals']==66)
        with page.expect_download() as item2:page.locator('#export-csv').click()
        csv=item2.value;check('CSV download name',csv.suggested_filename.endswith('.csv'))
        csvpath=ROOT/'test-results.csv';csv.save_as(csvpath)
        check('CSV populated','90%点' in csvpath.read_text(encoding='utf-8-sig'))
        page.locator('#preset').click();check('preset restored',page.locator('#title-input').input_value()=='地域マルシェ・入場受付')
        page.locator('#import-json').set_input_files(str(file))
        check('JSON imported',page.locator('#title-input').input_value()=='出張受付テスト')
        check('localStorage present',page.evaluate("localStorage.getItem('retsumiru.v1')") is not None)
        mount(page)
        check('persistent state after reload',page.locator('#title-input').input_value()=='出張受付テスト')
        page.locator('#service-input').fill('0');page.locator('#service-input').dispatch_event('change')
        check('invalid service rejected',page.locator('#service-input').input_value()=='6')
        page.locator('#preset').click()
        check('reset after invalid',page.locator('#service-input').input_value()=='3')
        page.evaluate('window.__printed = false; window.print = () => window.__printed = true;')
        page.locator('#print').click()
        check('print invoked',page.evaluate('window.__printed'))
        check('no JS errors after interactions',not errors)
        mobile=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1,accept_downloads=True)
        mp=mobile.new_page();mount(mp)
        check('mobile dashboard',mp.locator('#metrics .metric').count()==8)
        check('mobile no horizontal overflow',mp.evaluate('document.documentElement.scrollWidth <= window.innerWidth+2'))
        mp.screenshot(path=str(ROOT/'mobile.png'),full_page=True)
        mobile.close();ctx.close();browser.close()
    print(f'Chromium E2E: {len(checks)}/{len(checks)} PASS')
    for x in checks:print('  ✓',x)
    for x in ['test-import.json','test-results.csv']:
        (ROOT/x).unlink(missing_ok=True)
if __name__=='__main__':main()
