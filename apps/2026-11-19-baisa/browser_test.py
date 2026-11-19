"""Real Chromium DOM assertions, with page source injected because managed Chromium may deny file://."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json

folder=Path(__file__).parent
html=(folder/'index.html').read_text()
css=(folder/'style.css').read_text()
engine=(folder/'engine.js').read_text()
app=(folder/'app.js').read_text()
html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+css+'</style>')
html=html.replace('<script defer src="engine.js"></script><script defer src="app.js"></script>','')
html=html.replace('</body>','<script>'+engine+'</script><script>'+app+'</script></body>')
n=0
def check(cond, name):
 global n
 assert cond,name
 n+=1

with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1366,'height':900},accept_downloads=True)
 errors=[]
 page.on('pageerror',lambda exc:errors.append(str(exc)))
 page.set_content(html,wait_until='load')
 check(page.title().startswith('焙差'), 'title')
 check('°C' in page.locator('#mae').inner_text(), 'computed average')
 check(page.locator('#chart svg').count()==1,'svg graph')
 check(page.locator('#summary-rows tr').count()==2,'summary rows')
 check(page.locator('#phase-grid').is_visible(),'phase visible')
 initial=page.locator('#mae').inner_text()
 check(page.locator('#error').is_hidden(),'error initially hidden')
 page.locator('#cursor').fill('80')
 check(page.locator('#cursor-label').inner_text()=='80%','slider live update')
 check('差' in page.locator('#cursor-detail').inner_text(),'slider measurement')
 page.get_by_role('button',name='1ハゼで揃える').click()
 check(page.locator('#phase-grid').is_hidden(),'phase hidden in crack mode')
 check(page.locator('[data-mode="crack"]').get_attribute('aria-pressed')=='true','mode toggle aria')
 page.get_by_role('button',name='経過時間').click()
 check(page.locator('#axis-note').inner_text().startswith('投入'),'elapsed axis')
 page.get_by_role('button',name='工程で揃える').click()
 check(page.locator('#phase-grid').is_visible(),'phase mode restored')
 page.locator('#yellow-b').fill('12:00')
 check(page.locator('#error').is_visible(),'invalid data flagged')
 check(page.locator('#mae').inner_text()=='—','stale metric cleared')
 page.locator('#yellow-b').fill('3:45')
 check(page.locator('#error').is_hidden(),'recovered from invalid event')
 check(page.locator('#mae').inner_text()==initial,'metric restored')
 page.locator('#csv-b').fill('time,bt\n0,113\n60,123\n60,143')
 check(page.locator('#error').is_visible(),'duplicate CSV rejected')
 page.get_by_role('button',name='デモ値に戻す').click()
 check(page.locator('#error').is_hidden(),'demo resets invalid state')
 check(page.locator('#csv-b').input_value().startswith('time,bt'),'demo csv refreshed')
 with page.expect_download() as info:page.locator('#export-csv').click()
 download=info.value
 check(download.suggested_filename=='baisa-comparison.csv','CSV name')
 with page.expect_download() as info:page.locator('#export-svg').click()
 check(info.value.suggested_filename=='baisa-roast-curves.svg','SVG download')
 with page.expect_download() as info:page.locator('#export-json').click()
 check(info.value.suggested_filename=='baisa-project.json','JSON download')
 page.screenshot(path=str(folder/'desktop.png'),full_page=True)
 # Exercise HTML file input using an actual file
 page.locator('#file-a').set_input_files({'name':'test.csv','mimeType':'text/csv','buffer':b'time,bt\n0,100\n60,110\n120,130\n210,170\n420,200\n570,210'})
 check('100' in page.locator('#csv-a').input_value(),'CSV upload')
 check(page.locator('#error').is_hidden(),'new CSV works')
 # JSON project restore via browser upload
 config={'schema':1,'mode':'elapsed','batches':[{'name':'New A','csv':'time,bt\n0,100\n60,140\n120,160\n180,180','yellow':'0:30','crack':'1:30','drop':'3:00'},{'name':'New B','csv':'time,bt\n0,100\n60,130\n120,165\n180,185','yellow':'0:40','crack':'1:40','drop':'3:00'}]}
 page.locator('#import-json').set_input_files({'name':'project.json','mimeType':'application/json','buffer':json.dumps(config).encode()})
 page.wait_for_function("document.querySelector('#name-a').value === 'New A'",timeout=5000)
 check(page.locator('#name-a').input_value()=='New A','JSON restores batch name')
 check(page.locator('[data-mode="elapsed"]').get_attribute('aria-pressed')=='true','JSON restores mode')
 check(page.locator('#error').is_hidden(),'JSON render success')
 # Mobile overflow regression
 page.set_viewport_size({'width':390,'height':844})
 check(page.locator('body').evaluate('(e)=>e.scrollWidth<=window.innerWidth+1'),'no horizontal overflow')
 check(page.locator('#chart svg').count()==1,'mobile chart')
 check(len(errors)==0,'no runtime JS errors: '+str(errors))
 print(f'{n}/{n} Chromium assertions passed')
 page.screenshot(path=str(folder/'mobile.png'),full_page=True)
 browser.close()
