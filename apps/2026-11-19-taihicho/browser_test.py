from playwright.sync_api import sync_playwright
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parent
HTML=ROOT/'index.html'
checks=0
def chk(ok, message):
 global checks
 assert ok,message
 checks+=1
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1390,'height':980},accept_downloads=True)
 errors=[]
 page.on('pageerror',lambda e: errors.append(str(e)))
 page.set_content(HTML.read_text(encoding='utf-8'),wait_until='domcontentloaded')
 chk(page.title().startswith('たいひ帳'),'title')
 chk(page.locator('#rows tr').count()==2,'sample has two rows')
 chk(page.locator('#beforeCN').inner_text()!='—','initial metrics')
 chk('kg' in page.locator('#proposal').inner_text(),'initial proposal')
 chk(not page.locator('#apply').is_disabled(),'apply enabled')
 page.screenshot(path=str(ROOT/'desktop.png'),full_page=True)
 page.locator('#candidateB').select_option('leaves')
 chk('解を一意' in page.locator('#proposal').inner_text(),'duplicate candidate invalid')
 chk(page.locator('#apply').is_disabled(),'apply disabled')
 page.locator('#candidateB').select_option('coffee')
 chk('kg' in page.locator('#proposal').inner_text(),'resolves')
 with page.expect_download() as d:
  page.locator('#save').click()
 download=d.value
 chk(download.suggested_filename=='taihicho-project.json','json name')
 path=ROOT/'test-export.json';download.save_as(path)
 chk(len(json.loads(path.read_text())['items'])==2,'json round trip')
 with page.expect_download() as d: page.locator('#csv').click()
 chk(d.value.suggested_filename.endswith('.csv'),'csv download')
 initial=page.locator('#rows tr').count()
 page.locator('#apply').click()
 chk(page.locator('#rows tr').count()>initial,'apply adds ingredients')
 chk('目安範囲' in page.locator('#beforeStatus').inner_text(),'goal reached')
 page.locator('#add').click()
 chk(page.locator('#rows tr').count()>initial+1,'add button')
 page.locator('#rows tr').last.locator('input').first.fill('自作素材')
 page.locator('#rows tr').last.locator('input').first.press('Tab')
 chk(page.locator('#rows tr').last.locator('input').first.input_value()=='自作素材','edit name')
 page.locator('#rows tr').last.get_by_role('button',name='削除').click()
 chk(page.locator('#rows tr').count()==initial+2,'remove row')
 page.locator('#reset').click()
 chk(page.locator('#rows tr').count()==2,'reset rows')
 page.locator('#targetCN').fill('33');page.locator('#targetCN').press('Tab')
 chk(page.locator('#targetCN').input_value()=='33','target edit')
 page.locator('#load').click()
 page.locator('#file').set_input_files(str(path))
 page.wait_for_timeout(300)
 chk(page.locator('#targetCN').input_value()=='30','JSON import resets target')
 chk(page.locator('#rows tr').count()==2,'JSON import rows')
 page.set_viewport_size({'width':390,'height':844})
 page.screenshot(path=str(ROOT/'mobile.png'),full_page=True)
 chk(page.locator('h1').is_visible(),'mobile heading')
 chk(not errors,'browser console errors: '+str(errors))
 print(f'PASS: {checks} browser assertions, 0 page errors')
 browser.close()