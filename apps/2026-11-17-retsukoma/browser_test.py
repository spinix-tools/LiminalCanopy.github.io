from pathlib import Path
from playwright.sync_api import sync_playwright
html=Path(__file__).with_name('index.html').read_text(encoding='utf8')
mock="""<script>window.__STORE={};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>__STORE[k]||null,setItem:(k,v)=>__STORE[k]=String(v)}})</script>"""
fixture=html.replace('<script>\n',mock+'<script>\n')
checks=0

def ok(name,cond):
 global checks
 assert cond,name
 checks+=1
 print('✓',name)
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--allow-file-access-from-files'])
 page=browser.new_page(viewport={'width':1280,'height':900},accept_downloads=True)
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(fixture,wait_until='load')
 ok('title', '列こま' in page.title())
 ok('loads six time slots',page.locator('#slots tr').count()==6)
 ok('shows computed P90', '分' in page.locator('#p90').inner_text())
 ok('default deterministic trial number',page.locator('#badge').inner_text()=='100回試行')
 ok('chart has current polyline',page.locator('#chart polyline').count()==1)
 ok('table has six rows',page.locator('#detailRows tr').count()==6)
 initial=page.locator('#p90').inner_text()
 page.locator('#slots input[data-k="arrivals"]').first.fill('0')
 page.locator('#run').click()
 ok('arrival adjustment and recompute',page.locator('#slots input[data-k="arrivals"]').first.input_value()=='0')
 ok('P90 changes on demand change',page.locator('#p90').inner_text()!=initial)
 page.locator('#reset').click()
 ok('reset restores example',page.locator('#slots input[data-k="arrivals"]').first.input_value()=='18')
 page.locator('#target').fill('0.5')
 page.locator('#propose').click()
 ok('proposal result visible',page.locator('#pair').is_visible())
 ok('two chart polylines',page.locator('#chart polyline').count()==2)
 ok('proposed P90 numeric', '分' in page.locator('#p90new').inner_text())
 ok('proposal not mutate original staffing',page.locator('#slots input[data-k="staff"]').first.input_value()=='2')
 ok('proposal text', '改善案' in page.locator('#suggestion').inner_text() or '追加なし' in page.locator('#suggestion').inner_text())
 with page.expect_download() as d:
  page.locator('#csv').click()
 csv=d.value
 ok('CSV file name',csv.suggested_filename=='retsukoma-results.csv')
 ok('CSV content', '現在P90分' in Path(csv.path()).read_text(encoding='utf-8-sig'))
 with page.expect_download() as d: page.locator('#json').click()
 jsondl=d.value
 ok('JSON file name',jsondl.suggested_filename=='retsukoma-settings.json')
 import json
 content=json.loads(Path(jsondl.path()).read_text(encoding='utf8'))
 ok('JSON version',content['app']=='retsukoma' and content['version']==1)
 page.locator('#slots input[data-k="arrivals"]').first.fill('4')
 page.locator('#importFile').set_input_files({'name':'case.json','mimeType':'application/json','buffer':json.dumps(content).encode()})
 ok('JSON import restores',page.locator('#slots input[data-k="arrivals"]').first.input_value()=='18')
 page.locator('#service').fill('-1')
 page.locator('#run').click()
 ok('invalid input shows error', '入力エラー' in page.locator('#status').inner_text())
 page.locator('#service').fill('2.8')
 page.locator('#run').click()
 ok('corrected input recomputes', '試算しました' in page.locator('#status').inner_text())
 page.locator('#save').click()
 ok('localStorage writes settings',page.evaluate('localStorage.getItem("retsukoma-v1")') is not None)
 saved=page.evaluate('localStorage.getItem("retsukoma-v1")')
 restored=browser.new_page()
 restored.set_content(html.replace('<script>\n',mock.replace('window.__STORE={}', 'window.__STORE={"retsukoma-v1":'+json.dumps(saved)+'}')+'<script>\n'),wait_until='load')
 ok('localStorage restores in new page',restored.locator('#slots input[data-k="arrivals"]').first.input_value()=='18')
 ok('no runtime errors',not errors)
 page.screenshot(path=str(Path(__file__).with_name('desktop.png')),full_page=True)
 small=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1)
 small.set_content(fixture,wait_until='load')
 ok('mobile inputs visible',small.locator('#slots').is_visible())
 ok('mobile chart visible',small.locator('#chart').is_visible())
 ok('mobile no horizontal overflow',small.evaluate('document.documentElement.scrollWidth<=innerWidth+2'))
 small.screenshot(path=str(Path(__file__).with_name('mobile.png')),full_page=True)
 browser.close()
print(f'{checks}/{checks} Playwright checks passed')