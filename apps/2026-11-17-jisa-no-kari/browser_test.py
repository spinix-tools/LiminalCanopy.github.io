"""Chromium UI tests with injected HTML/JS and simulated storage.
Run: python browser_test.py
"""
import tempfile
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).parent
checks=[]
def check(name, condition):
    if not condition: raise AssertionError(name)
    checks.append(name)

# The controlled runtime blocks HTTP/file navigation in Chromium.
# Load real HTML and JavaScript by injecting them into an about:blank page;
# a tiny storage shim allows exercising save/restore without network calls.
html=(ROOT/'index.html').read_text('utf-8').replace('<script src="engine.js"></script><script src="app.js"></script>','')
engine=(ROOT/'engine.js').read_text('utf-8')
app=(ROOT/'app.js').read_text('utf-8')
STORE={}
def load_app(page,store=STORE):
    page.set_content(html)
    page.evaluate('''(data) => { window.__store=data; Object.defineProperty(window,'localStorage',{
      configurable:true, value:{getItem(k){return window.__store[k]??null},
      setItem(k,v){window.__store[k]=String(v)},removeItem(k){delete window.__store[k]}}
      }); }''',store)
    page.add_script_tag(content=engine)
    page.add_script_tag(content=app)

try:
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
        desktop=browser.new_context(viewport={'width':1440,'height':1000},accept_downloads=True)
        page=desktop.new_page()
        errors=[]
        page.on('pageerror', lambda error: errors.append(str(error)))
        external=[]
        page.on('request',lambda req: external.append(req.url))
        load_app(page)
        check('page loads and title', '時差の借り' in page.title())
        check('default participants',page.locator('.fieldrow[data-id]').count()==3)
        check('first render four weeks',page.locator('#scheduleArea tbody tr').count()==4)
        check('first render has computed numbers','点' in page.locator('#comfortTotal').inner_text())
        check('no JS errors on boot',not errors)
        check('no external network requests',not external)
        page.screenshot(path=str(ROOT/'desktop.png'),full_page=True)
        page.locator('#tabFair').click()
        check('fair tab switches',page.locator('#tabFair').get_attribute('aria-pressed')=='true')
        check('fair plan displayed','偏りを抑える案' in page.locator('#planLabel').inner_text())
        page.locator('#add').click()
        check('add participant',page.locator('.fieldrow[data-id]').count()==4)
        page.locator('.fieldrow[data-id]').last.locator('input[data-key=label]').fill('シドニー支部')
        page.locator('.fieldrow[data-id]').last.locator('input[data-key=label]').blur()
        page.locator('#calculate').click()
        check('renamed participant in table','シドニー支部' in page.locator('#scheduleArea').inner_text())
        page.locator('.fieldrow[data-id]').last.locator('button[data-remove]').click()
        check('remove participant',page.locator('.fieldrow[data-id]').count()==3)
        page.locator('#date').fill('2026-11-18')
        page.locator('#weeks').select_option('2')
        page.locator('#duration').select_option('30')
        page.locator('#calculate').click()
        check('custom weeks result',page.locator('#scheduleArea tbody tr').count()==2)
        with page.expect_download() as info:page.locator('#exportIcs').click()
        dl=info.value
        with tempfile.TemporaryDirectory() as td:
            path=Path(td)/dl.suggested_filename;dl.save_as(path)
            data=path.read_bytes().decode('utf-8')
            check('ICS UTC events',data.count('BEGIN:VEVENT')==2 and 'DTSTART:' in data and '\r\n' in data)
        with page.expect_download() as info:page.locator('#exportCsv').click()
        dl=info.value
        with tempfile.TemporaryDirectory() as td:
            path=Path(td)/dl.suggested_filename;dl.save_as(path)
            data=path.read_bytes().decode('utf-8-sig')
            check('CSV includes headers and rows',len(data.strip().splitlines())==3 and 'UTC開始' in data)
        with page.expect_download() as info:page.locator('#save').click()
        dl=info.value
        with tempfile.TemporaryDirectory() as td:
            settingsfile=Path(td)/dl.suggested_filename;dl.save_as(settingsfile)
            restored=json.loads(settingsfile.read_text('utf-8'))
            check('JSON download valid',restored['weeks']==2 and len(restored['people'])==3)
            check('storage shim write',page.evaluate("JSON.parse(localStorage.getItem('jisa-no-kari-v1')).weeks") == 2)
            page=desktop.new_page()
            load_app(page,{'jisa-no-kari-v1':json.dumps(restored,ensure_ascii=False)})
            check('localStorage restore on reload',page.locator('#weeks').input_value()=='2')
            page.locator('#reset').click()
            check('reset works',page.locator('#weeks').input_value()=='4')
            page.locator('#importFile').set_input_files(str(settingsfile))
            page.wait_for_function("document.getElementById('weeks').value==='2'")
            check('JSON import restores settings',page.locator('#weeks').input_value()=='2')
        first=page.locator('.fieldrow[data-id]').first
        first.locator('input[data-key=start]').fill('20:00')
        first.locator('input[data-key=end]').fill('18:00')
        page.locator('#calculate').click()
        check('invalid hours blocked','勤務終了' in page.locator('#status').inner_text())
        first.locator('input[data-key=start]').fill('09:00')
        page.locator('#calculate').click()
        check('error recovery','候補を計算しました' in page.locator('#status').inner_text())
        check('no JS errors after interactions',not errors)
        mobile=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1,accept_downloads=True)
        mp=mobile.new_page()
        load_app(mp,{})
        check('mobile results visible',mp.locator('#scheduleArea tbody tr').count()==4)
        check('mobile no overall document horizontal overflow',mp.evaluate('document.documentElement.scrollWidth<=window.innerWidth+2'))
        mp.screenshot(path=str(ROOT/'mobile.png'),full_page=True)
        browser.close()
finally:
    pass
print(f'{len(checks)}/{len(checks)} browser checks passed')
for c in checks: print('PASS',c)