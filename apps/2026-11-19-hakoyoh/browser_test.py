"""Playwright UI regression tests. File/HTTP navigation is blocked in this managed runtime;
load identical HTML/CSS/JS into Chromium with set_content, mock localStorage.
Run: python browser_test.py
"""
from pathlib import Path
from tempfile import TemporaryDirectory
import json
from playwright.sync_api import sync_playwright

BASE=Path(__file__).resolve().parent
STORAGE="""(()=>{const m={};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>Object.prototype.hasOwnProperty.call(m,k)?m[k]:null,setItem:(k,v)=>{m[k]=String(v)},removeItem:k=>{delete m[k]},get length(){return Object.keys(m).length}}});})();"""

def bootstrap(browser, width=1440, height=900):
    page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1,accept_downloads=True)
    page.set_content((BASE/'index.html').read_text(encoding='utf-8'),wait_until='domcontentloaded')
    page.add_style_tag(content=(BASE/'style.css').read_text(encoding='utf-8'))
    page.evaluate(STORAGE)
    page.add_script_tag(content=(BASE/'engine.js').read_text(encoding='utf-8'))
    page.add_script_tag(content=(BASE/'app.js').read_text(encoding='utf-8'))
    return page

def run():
    checks=0
    def ok(expr,msg):
        nonlocal checks
        assert expr,msg
        checks+=1
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
        pg=bootstrap(browser)
        errors=[]
        pg.on('pageerror',lambda e:errors.append(str(e)))
        ok('ハコ余白' in pg.title(),'title')
        ok(pg.locator('#items .editor-row').count()==3,'default 3 SKUs')
        ok(pg.locator('#boxes .editor-row').count()==3,'default 3 boxes')
        ok(pg.locator('.candidate').count()==3,'three results')
        ok('2 / 3' in pg.locator('#stats').inner_text(),'two feasible boxes')
        ok(pg.locator('#diagram svg').count()==1,'visualized SVG')
        ok(pg.locator('#progress').input_value()=='4','four placed steps')
        ok(pg.locator('#manifest .manifestrow').count()==4,'four manifest records')
        ok(pg.evaluate("localStorage.getItem('hakoyoh-v1')!==null"),'saved to mocked localStorage')
        pg.screenshot(path=str(BASE/'desktop.png'),full_page=True)
        pg.locator('#prevStep').click()
        ok(pg.locator('#progress').input_value()=='3','previous step')
        pg.locator('#nextStep').click()
        ok(pg.locator('#progress').input_value()=='4','next step')
        pg.locator('#progress').fill('2')
        ok(pg.locator('#manifest .manifestrow').count()==2,'range input step projection')
        pg.locator('#candidates [data-select]').last.click()
        ok('小型箱' in pg.locator('#chosenName').inner_text(),'selected unsuccessful candidate')
        ok(pg.locator('#progress').input_value()=='3','partial packed result selectable')
        pg.locator('#candidates [data-select]').first.click()
        ok('中型箱' in pg.locator('#chosenName').inner_text(),'reselected recommended')
        pg.locator('#addItem').click()
        ok(pg.locator('#items .editor-row').count()==4,'add SKU')
        pg.locator('#items [data-key="name"]').last.fill('箱詰め追加品')
        pg.locator('#items [data-key="name"]').last.press('Tab')
        ok(pg.locator('#items [data-key="name"]').last.input_value()=='箱詰め追加品','rename SKU persisted')
        pg.locator('#items [data-key="qty"]').last.fill('2')
        pg.locator('#items [data-key="qty"]').last.press('Tab')
        ok('6点' in pg.locator('#stats').inner_text(),'quantity recalculation')
        pg.locator('#items [data-delete-kind="items"]').last.click()
        ok(pg.locator('#items .editor-row').count()==3,'delete SKU')
        ok('4点' in pg.locator('#stats').inner_text(),'quantity restored')
        pg.locator('#addBox').click()
        ok(pg.locator('#boxes .editor-row').count()==4,'add box')
        ok(pg.locator('.candidate').count()==4,'new box compared')
        pg.locator('#boxes [data-delete-kind="boxes"]').last.click()
        ok(pg.locator('#boxes .editor-row').count()==3,'delete box')
        pg.locator('#padding').fill('3')
        pg.locator('#padding').press('Tab')
        ok(pg.locator('#padding').input_value()=='3','padding updated')
        pg.locator('#padding').fill('0.5')
        pg.locator('#padding').press('Tab')
        ok('2 / 3' in pg.locator('#stats').inner_text(),'padding reset recalculates')
        pg.locator('#boxes [data-key="postage"]').nth(1).fill('10')
        pg.locator('#boxes [data-key="postage"]').nth(1).press('Tab')
        ok('¥120' in pg.locator('.candidate').first.inner_text(),'postage cost calculation')
        with pg.expect_download() as d:
            pg.locator('#exportJson').click()
        data=d.value.path().read_text(encoding='utf-8')
        exported=json.loads(data)
        ok(exported['boxes'][1]['postage']==10,'JSON export reflects edits')
        ok(exported['items'][0]['name']=='文庫本セット','JSON supports Japanese')
        with pg.expect_download() as d2:
            pg.locator('#downloadCsv').click()
        csv=d2.value.path().read_bytes()
        ok(csv.startswith(b'\xef\xbb\xbf'),'CSV BOM')
        ok('文庫本セット' in csv.decode('utf-8'),'CSV packing manifest')
        with pg.expect_download() as d3:
            pg.locator('#downloadSvg').click()
        svg=d3.value.path().read_text(encoding='utf-8')
        ok(svg.startswith('<svg'),'SVG export valid root')
        ok('<polygon' in svg,'SVG contains box geometry')
        pg.locator('#items [data-key="name"]').first.fill('変更中')
        pg.locator('#items [data-key="name"]').first.press('Tab')
        ok(pg.locator('#items [data-key="name"]').first.input_value()=='変更中','edited before import')
        pg.locator('#importJson').set_input_files({'name':'saved.json','mimeType':'application/json','buffer':data.encode('utf-8')})
        ok(pg.locator('#items [data-key="name"]').first.input_value()=='文庫本セット','JSON import restores saved names')
        ok(pg.locator('#boxes [data-key="postage"]').nth(1).input_value()=='10','JSON import restores numeric input')
        pg.locator('#items [data-key="w"]').first.fill('0')
        pg.locator('#items [data-key="w"]').first.press('Tab')
        ok(pg.locator('#error').is_visible(),'bad item width flagged')
        pg.locator('#items [data-key="w"]').first.fill('15')
        pg.locator('#items [data-key="w"]').first.press('Tab')
        ok(not pg.locator('#error').is_visible(),'validation error clears')
        pg.on('dialog',lambda dialog:dialog.accept())
        pg.locator('#reset').click()
        ok(pg.locator('#boxes [data-key="postage"]').nth(1).input_value()=='1040','reset to sample prices')
        ok(pg.locator('#items .editor-row').count()==3,'reset to demo items')
        ok(not errors,'no unhandled JS errors '+str(errors))
        mobile=bootstrap(browser,390,844)
        ok(mobile.locator('.candidate').count()==3,'mobile candidates present')
        ok(mobile.locator('#diagram svg').is_visible(),'mobile visualization')
        metrics=mobile.evaluate('({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth})')
        ok(metrics['sw']<=metrics['cw']+1,'mobile no horizontal overflow: '+str(metrics))
        mobile.screenshot(path=str(BASE/'mobile.png'),full_page=True)
        browser.close()
    print(f'CHROMIUM: {checks}/{checks} assertions passed. Navigation blocked: same original source embedded; localStorage mock.')

if __name__=='__main__':run()