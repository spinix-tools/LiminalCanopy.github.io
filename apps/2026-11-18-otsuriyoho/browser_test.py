"""Chromium end-to-end smoke tests for OTSURI YOHO. Runs against the actual local files."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json, re, sys

BASE=Path(__file__).resolve().parent
# The managed browser blocks file:// and localhost. Inline the unchanged source files into
# about:blank for functional testing, and replace localStorage with an in-memory shim.
html=(BASE/'index.html').read_text(encoding='utf-8')
html=html.replace('<link rel="stylesheet" href="./style.css">','<style>'+ (BASE/'style.css').read_text(encoding='utf-8')+'</style>')
html=html.replace('<script src="./engine.js" defer></script>','').replace('<script src="./app.js" defer></script>','')
html=html.replace('</body>','<script>'+(BASE/'engine.js').read_text(encoding='utf-8')+'</script><script>'+(BASE/'app.js').read_text(encoding='utf-8')+'</script></body>')
SHIM="""() => {const cache={}; Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem(k){return Object.prototype.hasOwnProperty.call(cache,k)?cache[k]:null},setItem(k,v){cache[k]=String(v)},removeItem(k){delete cache[k]},clear(){for(const k of Object.keys(cache))delete cache[k]}}});}"""
checks=[]
def check(label,cond):
    checks.append((label,bool(cond)))
    if not cond: raise AssertionError(label)

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
    context=browser.new_context(viewport={'width':1440,'height':950},accept_downloads=True)
    page=context.new_page()
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('about:blank');page.evaluate(SHIM);page.set_content(html,wait_until='load')
    page.wait_for_function("document.getElementById('avg-failed').textContent !== '—'")
    check('title visible',page.get_by_role('heading',name=re.compile('おつり')).count()>0)
    check('default product row count',page.locator('#product-rows tr').count()==4)
    check('default denomination count',page.locator('[data-float]').count()==10)
    check('scenario name',page.locator('#scenario-name').input_value()=='週末マルシェ')
    check('default float computed',page.locator('#float-total').inner_text().startswith('¥'))
    check('default average computed',float(page.locator('#avg-failed').inner_text())>=0)
    check('risk percentage computed',page.locator('#risk').inner_text().endswith('%'))
    check('distribution histogram',page.locator('.hist-col').count()==24)
    check('transaction ledger',page.locator('#ledger-rows tr').count()==20)
    check('recommendation presented',page.locator('#rec-summary').inner_text()!='—')
    check('localStorage persisted',page.evaluate("localStorage.getItem('otsuriyoho_v1')") is not None)
    page.screenshot(path=str(BASE/'desktop.png'),full_page=True)
    # Financial configuration and real recomputation
    page.locator('#count').fill('45')
    page.locator('#runs').fill('10')
    page.locator('#budget').fill('0')
    page.locator('#run-btn').click()
    check('new number of runs',page.locator('.hist-col').count()==10)
    check('new metadata', '45 件 × 10 回' in page.locator('#run-meta').inner_text())
    check('zero budget additional cash', '追加なし' in page.locator('#rec-summary').inner_text())
    # Add and delete product
    page.locator('#add-product').click()
    check('add product',page.locator('#product-rows tr').count()==5)
    page.locator('#product-rows tr').last.locator('[data-field="name"]').fill('木のこもの')
    page.locator('#product-rows tr').last.locator('[data-field="price"]').fill('680')
    page.locator('#run-btn').click()
    check('new product in form',page.locator('#product-rows tr').last.locator('[data-field="name"]').input_value()=='木のこもの')
    page.locator('#product-rows tr').last.locator('[data-remove]').click()
    check('delete product',page.locator('#product-rows tr').count()==4)
    # Cash denomination subtotal changes with edits
    before=page.locator('#float-total').inner_text()
    page.locator('[data-float="3"]').fill('20')
    after=page.locator('#float-total').inner_text()
    check('cash total realtime update',before!=after)
    page.locator('#run-btn').click()
    check('changed float persisted',page.locator('[data-float="3"]').input_value()=='20')
    # Quick calculator
    page.locator('#calc-price').fill('850');page.locator('#calc-tender').fill('1000')
    page.locator('#calc-btn').click()
    check('quick change calculation', '¥150' in page.locator('#calc-result').inner_text())
    page.locator('#calc-tender').fill('100')
    page.locator('#calc-btn').click()
    check('insufficient tender is rejected', '届いていません' in page.locator('#calc-result').inner_text())
    # Export, import both are exercised
    with page.expect_download() as info:page.locator('#export-json').click()
    down=info.value
    destination=BASE/'test-export-plan.json';down.save_as(destination)
    obj=json.loads(destination.read_text(encoding='utf-8'))
    check('JSON export version',obj['version']==1)
    check('JSON export edited amount',obj['float'][3]==20)
    check('JSON export edited count',obj['count']==45)
    with page.expect_download() as info:page.locator('#export-csv').click()
    down=info.value;csv_file=BASE/'test-export-report.csv';down.save_as(csv_file)
    csv=csv_file.read_text(encoding='utf-8-sig')
    check('CSV export heading', '初期枚数,提案追加' in csv)
    check('CSV export product', '焼き菓子' in csv)
    page.locator('#preset').select_option('school');page.locator('#load-preset').click()
    check('switch preset',page.locator('#scenario-name').input_value()=='学園祭の模擬店')
    check('school preset item count',page.locator('#product-rows tr').count()==3)
    page.locator('#json-file').set_input_files(str(destination))
    check('imported JSON scenario',page.locator('#scenario-name').input_value()=='週末マルシェ')
    check('imported product count',page.locator('#product-rows tr').count()==4)
    check('imported float restored',page.locator('[data-float="3"]').input_value()=='20')
    check('re-run after import',page.locator('.hist-col').count()==10)
    # Validation: corrupt integer should produce an error message, not hang.
    page.locator('#count').fill('0');page.locator('#run-btn').click()
    check('invalid count rejected', '入力を確認' in page.locator('#message').inner_text())
    page.locator('#count').fill('45');page.locator('#run-btn').click()
    check('form recovers from invalid input','再計算しました' in page.locator('#message').inner_text())
    check('no uncaught JS exception on desktop',len(errors)==0)
    # Test another page and persistent browser localStorage
    page.set_content(html,wait_until='load');page.wait_for_function("document.getElementById('avg-failed').textContent !== '—'")
    check('localStorage persisted across reload',page.locator('#count').input_value()=='45')
    check('no uncaught JS exception on reload',len(errors)==0)
    # Mobile layout, no horizontal scrolling
    mobile=context.new_page();mobile.set_viewport_size({'width':390,'height':844})
    mobile.goto('about:blank');mobile.evaluate(SHIM);mobile.set_content(html,wait_until='load')
    mobile.wait_for_function("document.getElementById('avg-failed').textContent !== '—'")
    check('mobile forecast visible',mobile.locator('#avg-failed').inner_text()!='—')
    check('mobile no horizontal overflow',mobile.evaluate('document.documentElement.scrollWidth <= window.innerWidth+2'))
    mobile.screenshot(path=str(BASE/'mobile.png'),full_page=True)
    check('no uncaught JS exception on mobile',len(errors)==0)
    browser.close()

for idx,(name,ok) in enumerate(checks,1):print(f'{idx:02} {"PASS" if ok else "FAIL"} {name}')
print(f'\nRESULT: {sum(x[1] for x in checks)}/{len(checks)} passed')
