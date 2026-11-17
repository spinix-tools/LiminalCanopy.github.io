"""Chromium UI smoke/integration test. Run: python browser_test.py"""
from pathlib import Path
import json, tempfile
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent

def open_app(page, previous=None):
    # Admin-managed Chromium blocks navigation. Mount the actual HTML and scripts
    # into about:blank, with a deterministic in-memory localStorage replacement.
    html=(ROOT/'index.html').read_text(encoding='utf-8')
    html=html.replace('<script src="engine.js"></script><script src="app.js"></script>', '')
    page.set_content(html, wait_until='load')
    page.evaluate('''(data) => {
      const values = Object.assign({}, data || {});
      Object.defineProperty(window,'localStorage',{configurable:true,value:{
        getItem:k => Object.prototype.hasOwnProperty.call(values,k)?values[k]:null,
        setItem:(k,v)=>{values[k]=String(v);},
        removeItem:k=>{delete values[k];},
        clear:()=>{Object.keys(values).forEach(k=>delete values[k]);},
        key:i=>Object.keys(values)[i]||null,
        get length(){return Object.keys(values).length;}
      }});
    }''', previous)
    page.add_script_tag(content=(ROOT/'engine.js').read_text(encoding='utf-8'))
    page.add_script_tag(content=(ROOT/'app.js').read_text(encoding='utf-8'))

count=0
def check(label, cond):
    global count
    assert cond, label
    count+=1
    print('OK', count, label)

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':960},accept_downloads=True)
    page.on('dialog',lambda d:d.accept())
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    open_app(page)
    check('document title', '畑リレー' in page.title())
    check('initial 4 beds',page.locator('.bedrow').count()==4)
    check('initial 4 wishes',page.locator('.wishrow').count()==4)
    check('initial score',page.locator('#metrics').inner_text().find('316')>=0)
    check('initial assigned plots',page.locator('.plot').count()==4)
    check('current 2027',page.locator('#year').input_value()=='2027')
    page.locator('#solve').click()
    check('proposal visible',page.locator('#proposalArea #apply').count()==1)
    check('score improves in proposal', '316 → 32' in page.locator('#proposalArea').inner_text())
    page.locator('#apply').click()
    check('applied score', '32' in page.locator('#metrics').inner_text())
    check('proposal closes', page.locator('#proposalArea #apply').count()==0)
    check('assignment updated',page.locator('tr[data-wish="w1"] [data-role="assign"]').input_value()=='b2')
    page.locator('tr[data-wish="w1"] [data-role="lock"]').check()
    check('lock stored',page.evaluate('JSON.parse(localStorage.getItem("hatake-relay-v1")).locks.w1')=='b2')
    page.locator('#solve').click()
    check('proposal respects lock', 'トマト → 中央の畝' in page.locator('#proposalArea').inner_text())
    page.locator('#dismiss').click()
    check('dismiss proposal',page.locator('#proposalArea #apply').count()==0)
    page.locator('.bedrow').first.locator('select[data-role="history"]').first.select_option('ast')
    check('history updated',page.evaluate('JSON.parse(localStorage.getItem("hatake-relay-v1")).beds[0].history[0]')=='ast')
    page.locator('#year').fill('2028')
    page.locator('#year').press('Tab')
    check('year changed', '2027年' in page.locator('.bedrow').first.inner_text())
    check('new year persists',page.evaluate('JSON.parse(localStorage.getItem("hatake-relay-v1")).year')==2028)
    page.locator('#newCrop').select_option('pepper')
    page.locator('#addWant').click()
    check('new wish added',page.locator('.wishrow').count()==5)
    check('unassigned because beds full',page.locator('#metrics').inner_text().find('4/5')>=0)
    page.locator('#solve').click()
    check('too many crops error', '作物数が区画数を超えています' in page.locator('#toast').inner_text())
    page.locator('#wants .wishrow').last.locator('[data-action="remove-wish"]').click()
    check('wish removed',page.locator('.wishrow').count()==4)
    page.locator('#addBed').click()
    check('bed added',page.locator('.bedrow').count()==5)
    page.locator('.bedrow').last.locator('[data-role="bed-name"]').fill('東の畝')
    page.locator('.bedrow').last.locator('[data-role="bed-name"]').press('Tab')
    check('name edited', '東の畝' in page.locator('#plots').inner_text())
    page.locator('.bedrow').last.locator('[data-role="bed-area"]').fill('2.3')
    page.locator('.bedrow').last.locator('[data-role="bed-area"]').press('Tab')
    check('area edited', '2.3㎡' in page.locator('#plots').inner_text())
    page.locator('.bedrow').last.locator('[data-action="remove-bed"]').click()
    check('bed removed',page.locator('.bedrow').count()==4)
    with page.expect_download() as info: page.locator('#save').click()
    download=info.value
    check('JSON download name',download.suggested_filename=='hatake-relay-2028.json')
    saved=Path(tempfile.gettempdir())/'hatake-relay-browser-import.json'
    download.save_as(saved)
    check('JSON valid',json.loads(saved.read_text())['year']==2028)
    with page.expect_download() as info:page.locator('#csv').click()
    check('CSV download name',info.value.suggested_filename=='hatake-relay-2028.csv')
    page.locator('#demo').click()
    check('demo restores defaults',page.locator('#year').input_value()=='2027')
    page.locator('#load').click()
    page.locator('#file').set_input_files(str(saved))
    check('JSON import year',page.locator('#year').input_value()=='2028')
    check('JSON import history',page.locator('.bedrow').first.locator('select[data-role="history"]').first.input_value()=='ast')
    # persistence test with real browser localStorage (file:// on Chromium)
    old=page.evaluate('({"hatake-relay-v1":localStorage.getItem("hatake-relay-v1")})');open_app(page,old)
    check('reload persists year',page.locator('#year').input_value()=='2028')
    page.screenshot(path=str(ROOT/'desktop.png'),full_page=True)
    mobile=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1,accept_downloads=True)
    open_app(mobile)
    check('mobile functional',mobile.locator('#solve').is_visible())
    check('no horizontal overflow mobile',mobile.evaluate('document.documentElement.scrollWidth <= window.innerWidth+2'))
    mobile.screenshot(path=str(ROOT/'mobile.png'),full_page=True)
    page.locator('#clear').click()
    check('clear empties beds',page.locator('.bedrow').count()==0)
    check('clear empties wants',page.locator('.wishrow').count()==0)
    check('clear storage',page.evaluate('JSON.parse(localStorage.getItem("hatake-relay-v1")).beds.length')==0)
    check('no JavaScript exceptions',not errors)
    browser.close()
print('BROWSER CHECKS PASSED:',count)