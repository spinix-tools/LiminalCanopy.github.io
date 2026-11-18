from pathlib import Path
from playwright.sync_api import sync_playwright
import json
root=Path(__file__).resolve().parent
pass_count=0
def check(cond,label):
 global pass_count
 assert cond, label
 pass_count+=1
 print('PASS',label)

with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1440,'height':1000},accept_downloads=True)
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 try:
  page.goto((root/'index.html').as_uri(),wait_until='load',timeout=10000)
  loading='file://'
 except Exception:
  page.close()
  page=browser.new_page(viewport={'width':1440,'height':1000},accept_downloads=True)
  page.on('pageerror',lambda e:errors.append(str(e)))
  loading='inline content (file/http navigation blocked)'
  markup=(root/'index.html').read_text()
  markup=markup.replace('<link rel="stylesheet" href="style.css">','<style>'+ (root/'style.css').read_text() +'</style>')
  markup=markup.replace('<script src="engine.js"></script>','<script>'+ (root/'engine.js').read_text() +'</script>')
  markup=markup.replace('<script src="app.js"></script>','<script>'+ (root/'app.js').read_text() +'</script>')
  page.set_content(markup,wait_until='load')
 print('Browser loading:',loading)
 check(page.title().startswith('キュー守'),'title')
 check(page.locator('.cue').count()==9,'default cue count')
 check(':' in page.locator('#baseEnd').inner_text(),'computed end')
 check(page.locator('#delayLabel').inner_text()=='5','default delay')
 check(page.locator('.tl-row').count()==4,'four tracks rendered')
 check(page.locator('#diagnosis').inner_text()!='','diagnosis available')
 page.locator('#delay').fill('20')
 check(page.locator('#delayLabel').inner_text()=='20','delay slider updates')
 check('+' in page.locator('#endDelta').inner_text(),'end shifted by delay')
 page.locator('#resetDelay').click()
 check(page.locator('#delayLabel').inner_text()=='0','reset delay')
 check('通常と同時刻' in page.locator('#endDelta').inner_text(),'normal timeline restored')
 page.locator('#title').fill('新しい イベント')
 page.locator('#title').dispatch_event('change')
 check(page.locator('#title').input_value()=='新しい イベント','title editable')
 old=page.locator('.cue').count();page.locator('#addCue').click()
 check(page.locator('.cue').count()==old+1,'add cue')
 page.locator('.cue').last.locator('[data-key="name"]').fill('動画切替')
 page.locator('.cue').last.locator('[data-key="name"]').dispatch_event('change')
 check(page.locator('.cue').last.locator('[data-key="name"]').input_value()=='動画切替','edit cue')
 page.locator('.cue').last.locator('[data-action="remove"]').click()
 check(page.locator('.cue').count()==old,'delete cue')
 page.locator('#hardOut').fill('5');page.locator('#hardOut').dispatch_event('change')
 check('超過' in page.locator('#buffer').inner_text(),'hard-out warning')
 with page.expect_download() as download_info:page.locator('#saveJson').click()
 download=download_info.value
 check(download.suggested_filename.endswith('.json'),'JSON download')
 with page.expect_download() as download_info:page.locator('#saveCsv').click()
 check(download_info.value.suggested_filename.endswith('.csv'),'CSV download')
 data={'title':'読込テスト','start':'09:05','hardOut':15,'cues':[{'id':'x','name':'確認','lane':'舞台','owner':'運営','minutes':10,'earliest':0}]}
 page.locator('#file').set_input_files({'name':'plan.json','mimeType':'application/json','buffer':json.dumps(data).encode()})
 page.wait_for_function("document.querySelector('#title').value === '読込テスト'",timeout=5000)
 check(page.locator('#title').input_value()=='読込テスト','import JSON title')
 check(page.locator('.cue').count()==1,'import JSON cues')
 check(page.locator('#start').input_value()=='09:05','import time')
 page.once('dialog',lambda dialog:dialog.accept())
 page.locator('#preset').select_option('festival')
 check(page.locator('.cue').count()==7,'festival preset')
 check(not errors,'no JavaScript errors')
 page.screenshot(path=str(root/'desktop.png'),full_page=True)
 page.set_viewport_size({'width':390,'height':844})
 page.screenshot(path=str(root/'mobile.png'),full_page=True)
 print('WIDTH DIAG',page.evaluate('''() => ({inner:innerWidth,scroll:document.documentElement.scrollWidth, offenders:[...document.querySelectorAll('*')].map(el=>({tag:el.tagName,cl:el.className,right:Math.round(el.getBoundingClientRect().right),width:Math.round(el.getBoundingClientRect().width)})).filter(x=>x.right>innerWidth+2).slice(0,12)})'''))
 check(page.evaluate('document.documentElement.scrollWidth <= window.innerWidth+2'),'no mobile overflow')
 browser.close()
print(f'BROWSER PASS {pass_count}/{pass_count}')