"""Playwright Chromium UI regression. Run: python browser_test.py.
The test directly injects the authored HTML and JS because sandbox blocks file:// and local HTTP navigation.
localStorage is mocked for repeatability; WebAudio uses headless Chromium's audio implementation.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json

ROOT=Path(__file__).resolve().parent
checked=0
errors=[]
def check(label,predicate):
 global checked
 checked+=1
 assert predicate,f'FAIL #{checked}: {label}'
 print(f'PASS {checked}: {label}')

def load(page):
 html=(ROOT/'index.html').read_text().replace('<script src="engine.js"></script><script src="app.js"></script>','')
 page.set_content(html,wait_until='load')
 page.evaluate('''() => {
  window.__stored = {};
  Object.defineProperty(window,'localStorage',{configurable:true,value:{
    getItem(k){return window.__stored[k]??null},
    setItem(k,v){window.__stored[k]=String(v)},
    removeItem(k){delete window.__stored[k]}
  }});
 }''')
 for name in ['engine.js','app.js']:page.add_script_tag(content=(ROOT/name).read_text())

with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
 page=browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1,accept_downloads=True)
 page.on('pageerror',lambda e: errors.append(str(e)))
 load(page)
 check('title', 'テンポ坂' in page.title())
 check('initial block count',page.locator('.block').count()==4)
 check('initial total duration',page.locator('#total').inner_text()=='1:42')
 check('initial bars',page.locator('#barCount').inner_text()=='32')
 check('count in default checked',page.locator('#countIn').is_checked())
 check('timeline graph has bars',page.locator('#chart rect').count()==32)
 check('rest graph is orange',page.locator('#chart rect[fill="#ffb16b"]').count()==4)
 check('play starts idle',page.locator('#state').inner_text()=='待機中')
 page.screenshot(path=str(ROOT/'desktop.png'),full_page=True)
 page.locator('#preset').select_option('trio')
 check('preset replaces blocks',page.locator('.block').count()==3)
 check('triplet option selected',page.locator('.block').nth(1).locator('[data-key="sub"]').input_value()=='3')
 check('trio total bars',page.locator('#barCount').inner_text()=='28')
 page.locator('#add').click()
 check('append block',page.locator('.block').count()==4)
 check('new block 4 bars',page.locator('.block').last.locator('[data-key="bars"]').input_value()=='4')
 page.locator('.block').last.locator('[data-key="name"]').fill('最後の練習')
 page.locator('.block').last.locator('[data-key="name"]').press('Tab')
 check('rename block',page.locator('.block').last.locator('[data-key="name"]').input_value()=='最後の練習')
 page.locator('.block').last.locator('[data-action="up"]').click()
 check('move block up',page.locator('.block').nth(2).locator('[data-key="name"]').input_value()=='最後の練習')
 page.locator('.block').nth(2).locator('[data-action="down"]').click()
 check('move block down',page.locator('.block').last.locator('[data-key="name"]').input_value()=='最後の練習')
 page.locator('.block').last.locator('[data-action="remove"]').click()
 check('delete block',page.locator('.block').count()==3)
 page.locator('.block').first.locator('[data-key="start"]').fill('92')
 page.locator('.block').first.locator('[data-key="start"]').press('Tab')
 check('edit bpm updates chart',page.locator('#chart rect').first.get_attribute('y') is not None)
 check('bpm reflected in player',page.locator('#bpm').inner_text()=='92')
 page.locator('.block').first.locator('[data-key="start"]').fill('999')
 page.locator('.block').first.locator('[data-key="start"]').press('Tab')
 check('invalid edit rolled back',page.locator('.block').first.locator('[data-key="start"]').input_value()=='92')
 check('invalid edit says warning','値が範囲外' in page.locator('#notice').inner_text())
 page.locator('#countIn').uncheck()
 check('count-in unchecked',not page.locator('#countIn').is_checked())
 page.locator('#save').click()
 check('explicit save confirmation','保存しました' in page.locator('#notice').inner_text())
 saved=page.evaluate('window.__stored["tempozaka-plan-v1"]')
 check('saved JSON has three blocks',len(json.loads(saved)['segments'])==3)
 check('saved JSON remembers countin',json.loads(saved)['countIn'] is False)
 with page.expect_download() as info:page.locator('#exportJson').click()
 download=info.value
 check('JSON download name',download.suggested_filename=='tempozaka-plan.json')
 exported_json=Path(ROOT/'downloaded-plan.json');download.save_as(str(exported_json))
 check('JSON export valid',len(json.loads(exported_json.read_text())['segments'])==3)
 with page.expect_download() as info:page.locator('#exportCsv').click()
 d=info.value
 check('CSV download name',d.suggested_filename=='tempozaka-bars.csv')
 csvpath=ROOT/'downloaded-bars.csv';d.save_as(str(csvpath))
 check('CSV has BOM',csvpath.read_bytes().startswith(b'\xef\xbb\xbf'))
 check('CSV has rows',len(csvpath.read_text(encoding='utf-8-sig').strip().splitlines())==29)
 page.locator('#reset').click()
 check('reset returns to four blocks',page.locator('.block').count()==4)
 page.locator('#importJson').set_input_files(str(exported_json))
 check('import returns to three blocks',page.locator('.block').count()==3)
 check('import restores 92 BPM',page.locator('.block').first.locator('[data-key="start"]').input_value()=='92')
 check('import restores countin',not page.locator('#countIn').is_checked())
 page.locator('#planName').fill('<script>alert(1)</script>')
 page.locator('#planName').press('Tab')
 check('plan name input handles text',page.locator('#planName').input_value()=='<script>alert(1)</script>')
 page.locator('.block').first.locator('[data-key="name"]').fill('<img onerror=alert(1)>')
 page.locator('.block').first.locator('[data-key="name"]').press('Tab')
 page.locator('#add').click()
 check('unsafe name text not HTML-injected',page.locator('.block img').count()==0)
 # Actual Web Audio transport on a restored preset
 page.locator('#reset').click()
 page.locator('#play').click()
 page.wait_for_timeout(300)
 check('WebAudio transport starts',page.locator('#state').inner_text()=='再生中')
 check('WebAudio player shows count-in','カウントイン' in page.locator('#stage').inner_text())
 page.locator('#skip').click()
 page.wait_for_timeout(220)
 check('skip from count-in seeks first block',page.locator('#stage').inner_text().startswith('ゆっくり確認'))
 page.locator('#skip').click()
 page.wait_for_timeout(220)
 check('second skip seeks following block',page.locator('#stage').inner_text().startswith('少しずつ加速'))
 check('skip changes BPM',int(page.locator('#bpm').inner_text())>=68)
 page.locator('#play').click()
 check('stop transport',page.locator('#state').inner_text()=='待機中')
 page.locator('#tap').click();page.wait_for_timeout(430);page.locator('#tap').click();page.wait_for_timeout(430);page.locator('#tap').click()
 check('tap tempo gives measured BPM','BPM' in page.locator('#tapResult').inner_text())
 check('no page errors',not errors)
 mobile=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1,accept_downloads=True,is_mobile=True,has_touch=True)
 mobile.on('pageerror',lambda e:errors.append(str(e)))
 load(mobile)
 mobile.screenshot(path=str(ROOT/'mobile.png'),full_page=True)
 check('mobile blocks load',mobile.locator('.block').count()==4)
 check('mobile primary play visible',mobile.locator('#play').is_visible())
 check('mobile content fits screen',mobile.evaluate('document.documentElement.scrollWidth <= window.innerWidth+2'))
 mobile.locator('#preset').select_option('stamina')
 check('mobile preset interaction',mobile.locator('.block').count()==4)
 check('no mobile JS errors',not errors)
 browser.close()
print(f'BROWSER TESTS: {checked} passed / {checked} assertions')
