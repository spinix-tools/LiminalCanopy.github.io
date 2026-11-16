"""Playwright Chromium UI smoke/e2e tests; set_content + mocked localStorage due to restricted navigation."""
from pathlib import Path
import http.server
import socketserver
import threading
import json
import re
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs): super().__init__(*args, directory=str(ROOT), **kwargs)
    def log_message(self, format, *args): pass

class HTTPServer(socketserver.TCPServer): allow_reuse_address = True

with HTTPServer(("127.0.0.1", 0), Handler) as server:
    thread = threading.Thread(target=server.serve_forever, daemon=True);thread.start()
    url = f"http://127.0.0.1:{server.server_address[1]}/"
    html = re.sub(r'<script src="(?:engine|app)\.js"></script>', '', (ROOT/'index.html').read_text('utf-8'))
    def init_page(pg, store=None):
        pg.set_content(html, wait_until='load')
        pg.evaluate("""(data) => { const values=new Map(data||[]); Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k),clear:()=>values.clear(),dump:()=>Array.from(values.entries())}}) }""", store)
        pg.add_script_tag(content=(ROOT/'engine.js').read_text('utf-8'))
        pg.add_script_tag(content=(ROOT/'app.js').read_text('utf-8'))
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        context = browser.new_context(accept_downloads=True, viewport={"width": 1440, "height": 1000})
        page = context.new_page()
        init_page(page)
        errors=[]
        page.on('pageerror', lambda exc: errors.append(str(exc)))
        assert page.title().startswith('値札あわせ')
        assert page.locator('.item').count() == 3
        assert page.locator('#totalTags').inner_text() == '15'
        assert page.locator('#totalPages').inner_text() == '2'
        print('PASS 01 initial render and pagination')

        page.locator('#addProduct').click()
        page.locator('#editName').fill('限定ミニピン')
        page.locator('#editPrice').fill('900')
        page.locator('#editQty').fill('4')
        page.locator('#editNote').fill('試作 / 税込')
        page.locator('#editForm button[type="submit"]').click()
        assert page.locator('.item').count() == 4
        assert page.locator('#totalTags').inner_text() == '19'
        print('PASS 02 product addition')

        page.locator('.item [data-action="edit"]').last.click()
        page.locator('#editQty').fill('2')
        page.locator('#editForm button[type="submit"]').click()
        assert page.locator('#totalTags').inner_text() == '17'
        print('PASS 03 edit product')

        page.locator('#nextPage').click()
        assert page.locator('#pageIndicator').inner_text().startswith('2 / 2')
        page.locator('#prevPage').click()
        print('PASS 04 preview navigation')

        page.locator('#preset').select_option('mini24')
        assert page.locator('#perSheet').inner_text()=='24'
        assert page.locator('#totalPages').inner_text()=='1'
        print('PASS 05 layout preset')

        page.locator('[data-conf="offsetX"]').fill('-2')
        page.locator('[data-conf="offsetX"]').dispatch_event('change')
        position=page.locator('#preview .tag').first.evaluate('(x)=>x.style.left')
        assert position=='8mm',position
        print('PASS 06 offset calibration')

        page.locator('#calibrate').click()
        assert page.locator('#preview').get_by_text('100mmを定規で確認').count()==1
        assert page.locator('#printArea .sheet').count()==1
        page.locator('#calibrate').click()
        print('PASS 07 calibration test sheet')

        page.locator('[data-conf="left"]').fill('40')
        page.locator('[data-conf="left"]').dispatch_event('change')
        assert page.locator('#printBtn').is_disabled()
        assert '用紙の外' in page.locator('#warning').inner_text()
        page.locator('#preset').select_option('market12')
        assert not page.locator('#printBtn').is_disabled()
        print('PASS 08 overflow blocks printing')

        with page.expect_download() as info:
            page.locator('#exportCSV').click()
        csv = info.value.path().read_text(encoding='utf-8-sig')
        assert '限定ミニピン' in csv and 'price' in csv
        print('PASS 09 CSV export')

        page.locator('#csvFile').set_input_files({"name":"products.csv","mimeType":"text/csv","buffer":'商品名,価格,枚数,補足\n帽子,2100,3,試着可\n靴下,750,1,新色'.encode()})
        assert page.locator('.item').count()==2
        assert page.locator('#totalTags').inner_text()=='4'
        print('PASS 10 CSV import')

        with page.expect_download() as info:
            page.locator('#exportJSON').click()
        exported=json.loads(info.value.path().read_text('utf-8'))
        assert len(exported['items'])==2
        print('PASS 11 JSON backup')

        page.locator('#jsonFile').set_input_files({"name":"restore.json","mimeType":"application/json","buffer":json.dumps({"version":1,"config":{"cols":2,"rows":4,"width":91,"height":55,"gapX":0,"gapY":8,"left":14,"top":20},"items":[{"name":"返却後","price":150,"qty":1,"note":"OK"}]}).encode('utf-8')})
        assert page.locator('.item-name').inner_text()=='返却後'
        assert page.locator('#perSheet').inner_text()=='8'
        print('PASS 12 JSON restore')

        snapshot = page.evaluate('window.localStorage.dump()')
        page.close()
        page = context.new_page()
        page.on('pageerror', lambda exc: errors.append(str(exc)))
        init_page(page, snapshot)
        assert page.locator('.item-name').inner_text()=='返却後'
        print('PASS 13 mocked localStorage reinitialization')

        page.locator('#csvFile').set_input_files({"name":"x.csv","mimeType":"text/csv","buffer":'name,price,qty,note\n<img src=x onerror=alert(1)>,500,1,abc'.encode()})
        assert page.locator('#preview img').count()==0
        assert page.locator('#preview').get_by_text('<img src=x onerror=alert(1)>').count()==1
        print('PASS 14 HTML injection rendered as text')

        page.evaluate('() => { window.__printCalled=0; window.print=()=>{window.__printCalled++}; }')
        page.locator('#printBtn').click()
        assert page.evaluate('window.__printCalled')==1, page.evaluate('window.__printCalled')
        print('PASS 15 print activation')

        page.once('dialog', lambda dialog: dialog.accept())
        page.locator('#reset').click()
        assert page.locator('.item').count()==3
        assert page.locator('#totalTags').inner_text()=='15'
        print('PASS 16 reset with confirmation')

        assert not errors, errors
        page.screenshot(path=str(ROOT/'desktop.png'), full_page=True)
        print('PASS 17 no JavaScript exceptions, desktop screenshot')
        mobile=browser.new_context(accept_downloads=True,viewport={"width":390,"height":844},device_scale_factor=1)
        mp=mobile.new_page();init_page(mp)
        assert mp.locator('#preview .sheet').count()==1
        assert mp.evaluate('document.documentElement.scrollWidth <= innerWidth+2')
        mp.screenshot(path=str(ROOT/'mobile.png'), full_page=True)
        print('PASS 18 mobile layout, no horizontal overflow')
        mobile.close();context.close();browser.close()
    server.shutdown()