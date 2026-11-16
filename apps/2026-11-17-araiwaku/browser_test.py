"""Browser interaction regression suite for ARAIWAKU.
This runner uses Playwright set_content/add_script_tag because this test environment
blocks Chromium's page.goto for data:, file:, and localhost: URL navigation.
localStorage is replaced by an in-memory implementation; real persistence is untested.
"""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent
HTML=(ROOT/'index.html').read_text(encoding='utf-8')
ENGINE=(ROOT/'engine.js').read_text(encoding='utf-8')
APP=(ROOT/'app.js').read_text(encoding='utf-8')
checks=[]

def check(name,condition):
    assert condition, f'FAIL: {name}'
    checks.append(name)
    print(f'PASS {len(checks):02d} {name}')

def attach(page):
    html=HTML.replace('<script src="engine.js"></script>','').replace('<script src="app.js"></script>','')
    page.set_content(html, wait_until='domcontentloaded')
    page.evaluate("""() => {
       const memory = new Map();
       Object.defineProperty(window,'localStorage',{configurable:true,value:{
         getItem:key=>memory.has(key)?memory.get(key):null,
         setItem:(key,value)=>memory.set(key,String(value)),
         removeItem:key=>memory.delete(key), clear:()=>memory.clear()
       }});
    }""")
    page.add_script_tag(content=ENGINE)
    page.add_script_tag(content=APP)

def main():
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
        context=browser.new_context(accept_downloads=True,viewport={'width':1340,'height':950},device_scale_factor=1)
        page=context.new_page()
        errors=[]
        page.on('pageerror',lambda err:errors.append(str(err)))
        page.on('dialog',lambda dialog:dialog.accept())
        attach(page)
        check('title and initial render',page.title()=='あらいわく | 洗濯物の仕分けを見える化')
        check('8 sample garments',page.locator('.item').count()==8)
        check('initial cycle preview',int(page.locator('#metricCycles').inner_text())>=4)
        check('pending manual-review is visible','確認待ち' in page.locator('#queues').inner_text())
        page.locator('#name').fill('新しいタオル')
        page.locator('#weight').fill('400')
        page.locator('#saveButton').click()
        check('add garment',page.locator('.item').count()==9)
        check('added garment present','新しいタオル' in page.locator('#items').inner_text())
        page.locator('.item').last.locator('button',has_text='編集').click()
        page.locator('#name').fill('変更済みタオル')
        page.locator('#saveButton').click()
        check('edit garment','変更済みタオル' in page.locator('#items').inner_text())
        check('editing resets form',page.locator('#saveButton').inner_text().startswith('＋'))
        page.locator('.item').last.locator('button',has_text='洗濯済みにする').click()
        check('mark done',page.locator('.item.done').count()==1)
        page.locator('.item').last.locator('button',has_text='未洗に戻す').click()
        check('mark undone',page.locator('.item.done').count()==0)
        page.locator('#capacity').fill('0.5')
        page.locator('#capacity').dispatch_event('change')
        check('capacity recalculation',page.locator('#capacity').input_value()=='0.5')
        check('loads larger with lower capacity',int(page.locator('#metricCycles').inner_text())>=5)
        with page.expect_download() as info:
            page.locator('#downloadCsv').click()
        download=info.value
        csv=download.path().read_bytes()
        check('CSV download',download.suggested_filename=='araiwaku-plan.csv' and csv.startswith(b'\xef\xbb\xbf') and '変更済みタオル'.encode('utf-8') in csv)
        with page.expect_download() as info:
            page.locator('#downloadJson').click()
        raw=info.value.path().read_text(encoding='utf-8')
        backup=json.loads(raw)
        check('JSON export schema',backup['version']==1 and len(backup['garments'])==9 and backup['capacity']==500)
        page.locator('.item').last.locator('button',has_text='削除').click()
        check('delete garment',page.locator('.item').count()==8)
        page.locator('#fileImport').set_input_files(files=[{'name':'backup.json','mimeType':'application/json','buffer':raw.encode('utf-8')}])
        check('JSON restore',page.locator('.item').count()==9 and page.locator('#capacity').input_value()=='0.5')
        page.locator('#name').fill('<img src=x onerror=alert(1)>')
        page.locator('#weight').fill('100')
        page.locator('#saveButton').click()
        check('XSS displayed literally','<img src=x onerror=alert(1)>' in page.locator('#items').inner_text() and page.locator('#items img').count()==0)
        page.locator('.item').last.locator('button',has_text='洗濯済みにする').click()
        page.locator('#clearDone').click()
        check('delete completed garments',page.locator('.item').count()==9)
        page.locator('#clearAll').click()
        check('clear all',page.locator('.item').count()==0 and page.locator('#metricCycles').inner_text()=='0')
        page.locator('#demoButton').click()
        check('restore demo',page.locator('.item').count()==8)
        # Unexpected invalid state must not overwrite existing content.
        bad=json.dumps({'version':1,'capacity':0,'garments':[]})
        page.locator('#fileImport').set_input_files(files=[{'name':'bad.json','mimeType':'application/json','buffer':bad.encode()}])
        check('reject invalid import',page.locator('.item').count()==8 and '復元できません' in page.locator('#alert').inner_text())
        check('no JS uncaught errors',not errors)
        # Make the captured preview the clean, initial demonstration state.
        page.locator('#demoButton').click()
        check('successful action clears validation error',not page.locator('#alert').is_visible())
        page.wait_for_timeout(3300)
        page.screenshot(path=str(ROOT/'desktop.png'),full_page=True)
        page.set_viewport_size({'width':390,'height':844})
        page.screenshot(path=str(ROOT/'mobile.png'),full_page=True)
        check('mobile no horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=window.innerWidth'))
        print(f'BROWSER SUMMARY {len(checks)}/{len(checks)} passed, error count={len(errors)}')
        context.close();browser.close()

if __name__=='__main__':main()