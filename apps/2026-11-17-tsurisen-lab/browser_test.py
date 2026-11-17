"""Browser interaction checks via Chromium DOM injection (file:// is blocked in this sandbox).
Storage is emulated because about:blank has no durable localStorage origin.
"""
import json, re
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent
HTML=re.sub(r'<script src="(?:engine|app)\.js"></script>','',(ROOT/'index.html').read_text(encoding='utf-8'))
checks=0

def check(ok, description):
 global checks
 assert ok, description
 checks+=1
 print('✓',description)

def boot(page):
 page.set_content(HTML,wait_until='domcontentloaded')
 page.evaluate("""() => {const store = new Map(); Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)}});}""")
 page.add_script_tag(content=(ROOT/'engine.js').read_text(encoding='utf-8'))
 page.add_script_tag(content=(ROOT/'app.js').read_text(encoding='utf-8'))

with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 context=browser.new_context(viewport={'width':1320,'height':900},accept_downloads=True,device_scale_factor=1)
 page=context.new_page()
 errors=[]
 page.on('pageerror', lambda err: errors.append(str(err)))
 page.on('dialog', lambda dialog: dialog.accept())
 boot(page)
 check('つり銭ラボ' in page.title(),'Japanese app title loads')
 check(page.locator('#heroCash').inner_text()=='15,770','initial drawer value displayed')
 check(page.locator('#productRows tr').count()==4,'default 4 products visible')
 check(page.locator('#openingFields input').count()==10,'all 10 denominations editable')
 check(page.locator('#panel-prep').is_visible(),'preparation is initial tab')
 page.locator('#open-100').fill('23')
 check('16,070' in page.locator('#openingTotal').inner_text(),'opening cash preview reacts')
 page.locator('#saveOpening').click()
 check(page.locator('#heroCash').inner_text()=='16,070','saved opening updates hero')
 check(page.evaluate("localStorage.getItem('tsurisen-lab-v1') !== null"),'local save invoked')
 page.locator('#productName').fill('手作りカード')
 page.locator('#productPrice').fill('450')
 page.locator('#productWeight').fill('7')
 page.locator('#saveProduct').click()
 check(page.locator('#productRows tr').count()==5,'product add works')
 check('手作りカード' in page.locator('#productRows').inner_text(),'custom product name displayed')
 # edit the created product in last row
 page.locator('#productRows tr').last.locator('[data-edit]').click()
 check(page.locator('#saveProduct').inner_text()=='変更を保存','edit prefills form')
 page.locator('#productPrice').fill('460')
 page.locator('#saveProduct').click()
 check('¥460' in page.locator('#productRows').inner_text(),'edit updates price')
 page.locator('[data-tab="sim"]').click()
 check(page.locator('#panel-sim').is_visible(),'simulation tab works')
 page.locator('#simVisits').fill('12')
 page.locator('#simTrials').fill('12')
 page.locator('#runSimulation').click()
 check('12試行' in page.locator('#simResults').inner_text(),'simulation returns results')
 check('不足したお釣り金額' in page.locator('#simResults').inner_text(),'risk amount chart present')
 page.locator('[data-tab="pos"]').click()
 check(page.locator('#saleProducts button').count()==5,'sale cards reflect products')
 page.locator('[data-add="p1"]').first.click()
 check(page.locator('#cartTotal').inner_text()=='¥350','cart total updates')
 page.locator('#tenderSelect').select_option('1000')
 check('¥650' in page.locator('#quoteStatus').inner_text(),'change quote computed')
 page.locator('#recordSale').click()
 check(page.locator('#heroRevenue').inner_text()=='350','sale adds revenue')
 check(page.locator('#heroCash').inner_text()=='16,420','sale adds cash profit')
 check(page.locator('#salesRows tr').count()==1,'sale history appears')
 page.locator('[data-tab="prep"]').click()
 check(page.locator('#saveOpening').is_disabled(),'opening locked after first sale')
 page.locator('[data-tab="close"]').click()
 check('¥16,420' in page.locator('#closeExpected').inner_text(),'closing expected balance correct')
 page.locator('#fillExpected').click()
 page.locator('#checkPhysical').click()
 check('現金差異なし' in page.locator('#closeResult').inner_text(),'equal physical count reconciles')
 page.locator('#physical-100').fill(str(int(page.locator('#physical-100').input_value())+1))
 page.locator('#checkPhysical').click()
 check('+¥100' in page.locator('#closeResult').inner_text(),'cash surplus detected')
 page.locator('[data-tab="prep"]').click()
 with page.expect_download() as info: page.locator('#exportCsv').click()
 download=info.value
 check(download.suggested_filename=='tsurisen-sales.csv','CSV download works')
 with page.expect_download() as info: page.locator('#exportJson').click()
 check(info.value.suggested_filename=='tsurisen-backup.json','JSON download works')
 # tampered JSON is rejected
 bad={'version':1,'opening':[0]*10,'products':[],'sales':[{'id':'s1','label':'x','amount':500,'tender':1000,'change':[0]*10,'at':'2026-11-17'}]}
 page.locator('#importJson').set_input_files({'name':'bad.json','mimeType':'application/json','buffer':json.dumps(bad).encode()})
 check('復元エラー' in page.locator('#toast').inner_text(),'invalid JSON backup rejected')
 page.locator('[data-tab="pos"]').click()
 page.locator('#undoSale').click()
 check(page.locator('#heroRevenue').inner_text()=='0','last sale undo updates totals')
 page.locator('[data-tab="prep"]').click()
 check(page.locator('#saveOpening').is_enabled(),'float editable after undo')
 # valid JSON restore
 restored={'version':1,'opening':[0,0,0,4,10,10,10,10,10,10], 'products':[{'id':'pX','name':'復元商品','price':1200,'weight':1}],'sales':[], 'physical':None}
 page.locator('#importJson').set_input_files({'name':'good.json','mimeType':'application/json','buffer':json.dumps(restored,ensure_ascii=False).encode()})
 check('復元商品' in page.locator('#productRows').inner_text(),'valid JSON restore works')
 check(page.locator('#productRows tr').count()==1,'restore replaces product list')
 page.locator('#resetAll').click()
 check(page.locator('#productRows tr').count()==4,'reset all returns demo dataset')
 check(len(errors)==0,'no JavaScript uncaught errors')
 # preview: desktop preparation and risk simulation, plus mobile
 page.locator('[data-tab="prep"]').click();page.screenshot(path=str(ROOT/'desktop.png'),full_page=True)
 page.locator('[data-tab="sim"]').click();page.locator('#runSimulation').click();page.screenshot(path=str(ROOT/'simulation.png'),full_page=True)
 mobile=context.new_page()
 mobile.set_viewport_size({'width':390,'height':844})
 mobile.on('dialog', lambda d:d.accept())
 boot(mobile)
 check(mobile.locator('#openingFields input').count()==10,'mobile responsive DOM loads')
 check(mobile.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'),'mobile layout has no horizontal document overflow')
 mobile.screenshot(path=str(ROOT/'mobile.png'),full_page=True)
 context.close();browser.close()
print(f'BROWSER_PASS={checks}')
