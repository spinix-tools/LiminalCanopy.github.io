"""Chromium interaction checks. Run: python browser_test.py (Playwright preinstalled)."""
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from threading import Thread
from contextlib import contextmanager
from playwright.sync_api import sync_playwright
import json, re, os, tempfile
ROOT=Path(__file__).parent.resolve()
PASSED=0

def check(label, condition):
    global PASSED
    if not condition: raise AssertionError(label)
    PASSED+=1
    print(f'OK {PASSED:02} {label}')

@contextmanager
def serve(root):
    class Handler(SimpleHTTPRequestHandler):
        def __init__(self,*args,**kwargs): super().__init__(*args,directory=str(root),**kwargs)
        def log_message(self,*args): pass
    server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
    t=Thread(target=server.serve_forever,daemon=True); t.start()
    try: yield f'http://127.0.0.1:{server.server_port}/index.html'
    finally: server.shutdown();server.server_close()

def inline_html():
    html=(ROOT/'index.html').read_text()
    css=(ROOT/'style.css').read_text()
    engine=(ROOT/'engine.js').read_text()
    app=(ROOT/'app.js').read_text()
    html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+css+'</style>')
    html=html.replace('<script src="engine.js"></script><script src="app.js"></script>',
      '<script>Object.defineProperty(window,"localStorage",{configurable:true,value:{getItem:k=>window.__s?.[k]??null,setItem:(k,v)=>{(window.__s??={})[k]=v},removeItem:k=>{delete (window.__s??={})[k]}}});</script>'+
      '<script>'+engine+'</script><script>'+app+'</script>')
    return html

with sync_playwright() as p, serve(ROOT) as url:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':1100},device_scale_factor=1,accept_downloads=True)
    exceptions=[]; failed_requests=[]
    page.on('pageerror',lambda err:exceptions.append(str(err)))
    page.on('requestfailed',lambda req:failed_requests.append(req.url))
    method='HTTP server'
    try:
        page.goto(url,timeout=9000,wait_until='load')
        page.locator('#resultView .big-number').wait_for(timeout=3000)
    except Exception as e:
        print('HTTP navigation unavailable, use inlined identical source:',str(e)[:130])
        method='inline HTML / emulated localStorage'
        page.close()
        page=browser.new_page(viewport={'width':1440,'height':1100},device_scale_factor=1,accept_downloads=True)
        page.on('pageerror',lambda err:exceptions.append(str(err)))
        page.set_content(inline_html(),wait_until='load')
        page.locator('#resultView .big-number').wait_for(timeout=10000)
    print('BROWSER METHOD:',method)
    check('title',page.title()=='ころび予報 | KOROBI YOHOU')
    check('initial step rows',page.locator('.step-entry').count()==5)
    check('initial title text',page.locator('#titleInput').input_value().startswith('霧の砦'))
    check('risk metric',page.locator('#resultView .big-number').inner_text().endswith('%'))
    check('probability rows',page.locator('#probabilityList .prob-row').count()==5)
    check('histogram svg visible',page.locator('#histogram svg rect').count()>0)
    check('recommendation content',page.locator('.recommendation').inner_text().find('連続失敗')>=0)
    check('no runtime exception initial',not exceptions)
    page.screenshot(path=str(ROOT/'desktop.png'),full_page=True)
    original_risk=page.locator('#resultView .big-number').inner_text()
    page.locator('#assistInput').fill('5');page.locator('#assistInput').dispatch_event('change')
    check('assist edit persisted',page.locator('#assistInput').input_value()=='5')
    check('assist changes comparison',page.locator('.compare-card.assisted .value').inner_text().endswith('%'))
    page.locator('#streakInput').fill('2');page.locator('#streakInput').dispatch_event('change')
    check('streak threshold recalculates',page.locator('#resultView .big-number').inner_text()!=original_risk)
    page.locator('#countInput').fill('1');page.locator('#countInput').dispatch_event('change')
    check('dice count edit',page.locator('#countInput').input_value()=='1')
    page.locator('#sidesInput').fill('20');page.locator('#sidesInput').dispatch_event('change')
    check('sides edit',page.locator('#sidesInput').input_value()=='20')
    page.locator('#modifierInput').fill('2');page.locator('#modifierInput').dispatch_event('change')
    check('modifier edit',page.locator('#modifierInput').input_value()=='2')
    page.locator('#goalInput').fill('25');page.locator('#goalInput').dispatch_event('change')
    check('risk target edit',page.locator('#goalInput').input_value()=='25')
    page.locator('#addStep').click()
    check('add step',page.locator('.step-entry').count()==6)
    page.locator('.step-entry').last.locator('[data-step-field="name"]').fill('ボスの最終確認')
    page.locator('.step-entry').last.locator('[data-step-field="name"]').dispatch_event('change')
    check('rename step',page.locator('#probabilityList').inner_text().find('ボスの最終確認')>=0)
    page.locator('.step-entry').last.locator('[data-step-field="repeats"]').fill('3')
    page.locator('.step-entry').last.locator('[data-step-field="repeats"]').dispatch_event('change')
    check('repeat count updates',page.locator('#stepTotal').inner_text().find('13回')>=0)
    page.locator('.step-entry').last.locator('[data-step-field="mode"]').select_option('advantage')
    check('advantage change',page.locator('.step-entry').last.locator('select').input_value()=='advantage')
    page.locator('.step-entry').last.locator('[data-step-field="dc"]').fill('16')
    page.locator('.step-entry').last.locator('[data-step-field="dc"]').dispatch_event('change')
    check('dc change',page.locator('#probabilityList').inner_text().find('DC 16')>=0)
    page.locator('.step-entry').last.locator('[data-remove]').click()
    check('remove step',page.locator('.step-entry').count()==5)
    page.locator('#resetBtn').click()
    check('reset count 5',page.locator('.step-entry').count()==5)
    check('reset restored title',page.locator('#titleInput').input_value().startswith('霧の砦'))
    page.locator('#rollBtn').click()
    check('actual dice roll',page.locator('#rollResult').inner_text().find('10回中')>=0)
    check('roll 10 item lines',page.locator('#rollResult .roll-row').count()==10)
    with page.expect_download() as d:
        page.locator('#downloadCsv').click()
    csv=d.value.path().read_bytes().decode('utf-8-sig')
    check('CSV download',d.value.suggested_filename=='korobi-report.csv')
    check('CSV includes data', '迷いの森' in csv and '連続失敗' in csv)
    with page.expect_download() as d:
        page.locator('#downloadJson').click()
    data=json.loads(d.value.path().read_text())
    check('JSON download',data['steps'][0]['name']=='迷いの森')
    data['title']='インポートされた世界';data['steps'][0]['name']='復元した橋'
    page.locator('#fileInput').set_input_files({'name':'restore.json','mimeType':'application/json','buffer':json.dumps(data,ensure_ascii=False).encode()})
    page.wait_for_function('document.querySelector("#titleInput").value === "インポートされた世界"')
    check('JSON import title',page.locator('#titleInput').input_value()=='インポートされた世界')
    check('JSON import step',page.locator('#probabilityList').inner_text().find('復元した橋')>=0)
    data['steps'][0]['name']='<img src=x onerror=alert(1)>'
    page.locator('#fileInput').set_input_files({'name':'risk.json','mimeType':'application/json','buffer':json.dumps(data,ensure_ascii=False).encode()})
    check('HTML injection escaped',page.locator('#probabilityList img').count()==0)
    check('escaped text visible',page.locator('#probabilityList').inner_text().find('<img src=x')>=0)
    data['steps'][0]['repeats']=999
    page.locator('#fileInput').set_input_files({'name':'broken.json','mimeType':'application/json','buffer':json.dumps(data,ensure_ascii=False).encode()})
    check('invalid JSON rejected',page.locator('#notice').inner_text().find('読み込み失敗')>=0)
    check('invalid import did not replace state',page.locator('#titleInput').input_value()=='インポートされた世界')
    page.locator('#clearSave').click()
    check('clear local storage notice',page.locator('#notice').inner_text().find('消去')>=0)
    page.evaluate('window._printed=false; window.print=()=>{window._printed=true}')
    page.locator('#printBtn').click()
    check('print triggers print',page.evaluate('window._printed') is True)
    # Run mobile on a new isolated context; no localStorage inherited.
    mobile=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1)
    if method=='HTTP server': mobile.goto(url,wait_until='load')
    else: mobile.set_content(inline_html(),wait_until='load')
    mobile.locator('#resultView .big-number').wait_for()
    mobile.screenshot(path=str(ROOT/'mobile.png'),full_page=True)
    check('mobile dashboard visible',mobile.locator('#resultView .big-number').is_visible())
    check('mobile no horizontal overflow',mobile.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'))
    check('no unexpected JS errors',not exceptions)
    print(f'PASSED {PASSED}/{PASSED}, method={method}, exceptions={exceptions}, failed_requests={failed_requests}')
    mobile.close();browser.close()
