"""Chromium UI test. The managed browser blocks file://; real sources are injected into an about:blank document."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json

ROOT=Path(__file__).parent
html=(ROOT/'index.html').read_text(encoding='utf-8')
css=(ROOT/'style.css').read_text(encoding='utf-8')
engine=(ROOT/'engine.js').read_text(encoding='utf-8')
app=(ROOT/'app.js').read_text(encoding='utf-8')
html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+css+'</style>')
html=html.replace('<script src="engine.js"></script><script src="app.js"></script>',
 '<script>'+engine+'</script><script>'+app+'</script>')
passed=0

def check(condition, name):
 global passed
 assert condition, name
 passed+=1
 print(f'PASS {passed:02d} {name}')

with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 context=browser.new_context(viewport={'width':1440,'height':950}, device_scale_factor=1, accept_downloads=True)
 page=context.new_page()
 errors=[]
 page.on('pageerror',lambda e: errors.append(str(e)))
 page.evaluate('''() => {const data={}; Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>data[k]??null,setItem:(k,v)=>data[k]=String(v),removeItem:k=>delete data[k]}})}''')
 page.set_content(html,wait_until='load')
 check(page.title().startswith('ぱた箱'),'document loads')
 check(page.locator('#svgPreview svg').count()==1,'live SVG drawn')
 check(page.locator('#pagesPerBox').inner_text().startswith('1'),'default single sheet')
 check('768' in page.locator('#totalCost').inner_text(),'cost calculation')
 check('124 × 112' in page.locator('#netSize').inner_text(),'net dimension')
 check('64 × 52 × 30' in page.locator('#innerSpec').inner_text(),'inside dimension')
 check(page.locator('.preset.active').get_attribute('data-preset')=='accessory','preset active state')
 check(page.locator('#svgPreview .tab').count()==4,'four tabs rendered')
 check(page.locator('#svgPreview .fold').count()==8,'eight fold guides')
 check(page.locator('#svgPreview .cut').count()>=16,'cut lines drawn')
 check('紙厚' in page.locator('#warning').inner_text(),'construction warning')
 page.locator('#productW').fill('250')
 check('250' in page.locator('#productW').input_value(),'dimensions editable')
 check(page.locator('.preset.active').count()==0,'editing removes preset highlight')
 page.locator('#productD').fill('265')
 page.locator('#productH').fill('115')
 check(int(page.locator('#pagesPerBox').inner_text().split('枚')[0])>1,'big template tiles')
 check('貼り合わせ' in page.locator('#warning').inner_text(),'tile warning')
 page.locator('#quantity').fill('5')
 page.locator('#sheetCost').fill('10')
 g=page.evaluate('window.PataApp.getCurrent()')
 check(g['cost']==g['tile']['count']*50,'cost updates on quantity and paper price')
 page.locator('#autoRotate').uncheck()
 check(page.evaluate('window.PataApp.getCurrent().input.autoRotate') is False,'rotation can be disabled')
 page.locator('[data-preset="soap"]').click()
 check(page.locator('#productW').input_value()=='85','soap preset loads')
 check(page.locator('.preset.active').get_attribute('data-preset')=='soap','soap preset selected')
 page.locator('[data-preset="gift"]').click()
 check(page.locator('#productH').input_value()=='60','gift preset loads')
 page.locator('#reset').click()
 check(page.locator('#productW').input_value()=='60','reset returns defaults')
 check('初期値' in page.locator('#toast').inner_text(),'reset feedback')
 with page.expect_download() as download:
  page.locator('#downloadSvg').click()
 obj=download.value
 check(obj.suggested_filename=='patabako-tray.svg','download svg')
 with page.expect_download() as download:
  page.locator('#downloadCsv').click()
 check(download.value.suggested_filename=='patabako-estimate.csv','download csv')
 with page.expect_download() as download:
  page.locator('#saveJson').click()
 check(download.value.suggested_filename=='patabako-project.json','download json')
 imported={'schema':'patabako/v1','config':{'productW':110,'productD':80,'productH':20,'gap':3,'quantity':19,'sheetCost':15,'autoRotate':False}}
 page.locator('#loadFile').set_input_files({'name':'project.json','mimeType':'application/json','buffer':json.dumps(imported).encode()})
 check(page.locator('#productW').input_value()=='110','json project restore')
 check(page.locator('#quantity').input_value()=='19','json restores quantity')
 page.locator('#loadFile').set_input_files({'name':'bad.json','mimeType':'application/json','buffer':b'{ nope'})
 check('読み込み失敗' in page.locator('#toast').inner_text(),'malformed file safely rejected')
 page.evaluate('window.print=()=>{window.__printWasCalled=true}')
 page.locator('#printTiles').click()
 check(page.evaluate('window.__printWasCalled===true'),'print action invoked')
 check(page.locator('#printArea .print-sheet').count()==page.evaluate('PataApp.getCurrent().tile.count'),'printed tile count exact')
 check(page.locator('#printArea svg').first.get_attribute('width')=='190mm','printed tile has physical width')
 check(page.locator('#printArea svg .mark').count()>=4,'registration marks present')
 check(not errors,'no browser JavaScript errors')
 page.evaluate('PataApp.fill(PataEngine.DEFAULT)')
 page.evaluate("document.getElementById('toast').style.display='none'")
 page.screenshot(path=str(ROOT/'desktop.png'),full_page=True)
 mobile=context.new_page()
 mobile.set_viewport_size({'width':390,'height':844})
 mobile.evaluate('''() => {Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:()=>null,setItem:()=>{}}})}''')
 mobile.set_content(html,wait_until='load')
 check(mobile.locator('#svgPreview svg').count()==1,'mobile SVG loads')
 check(mobile.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'),'no mobile horizontal overflow')
 mobile.screenshot(path=str(ROOT/'mobile.png'),full_page=True)
 browser.close()
 print(f'BROWSER PASS: {passed}/{passed}')
