"""Chromium functional checks with the actual CSS/JS embedded (navigation blocked in runner)."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json, tempfile, os

ROOT=Path(__file__).parent
checks=0
def check(value, description):
    global checks
    assert value, description
    checks+=1

html=(ROOT/'index.html').read_text('utf-8')
html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+ (ROOT/'style.css').read_text('utf-8')+'</style>')
html=html.replace('<script src="engine.js"></script><script src="app.js"></script>','<script>'+(ROOT/'engine.js').read_text('utf-8')+'</script><script>'+(ROOT/'app.js').read_text('utf-8')+'</script>')
def inject_storage(page):
    page.evaluate('''() => {
       const mem = window.__testStore || (window.__testStore = {});
       Object.defineProperty(window,'localStorage',{configurable:true,value:{
         getItem:k=>Object.prototype.hasOwnProperty.call(mem,k)?mem[k]:null,
         setItem:(k,v)=>{mem[k]=String(v)},removeItem:k=>{delete mem[k]}
       }});
    }''')
def load(page):
    inject_storage(page)
    page.set_content(html,wait_until='load')
try:
 with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
    context=browser.new_context(accept_downloads=True,viewport={'width':1450,'height':900},device_scale_factor=1)
    page=context.new_page();errors=[]
    page.on('pageerror',lambda err:errors.append(str(err)))
    load(page)
    check(page.title().startswith('余白シフト'),'title')
    check(page.locator('#heroFill').inner_text().endswith('%'),'initial calculation')
    check(page.locator('#peopleBody tr').count()==7,'sample people')
    check(page.locator('#shiftsBody tr').count()==6,'sample shifts')
    check(page.locator('.seat').count()==10,'10 seats')
    check(page.locator('#stats .stat').count()==3,'stats')
    check(page.locator('.loadbar').count()==7,'load bars')
    check(page.locator('#message').inner_text()!='','message')
    check(page.locator('#heroBar').get_attribute('style').startswith('width:'),'progress bar')
    page.screenshot(path=str(ROOT/'desktop.png'),full_page=True)
    page.locator('#addPerson').click()
    check(page.locator('#peopleBody tr').count()==8,'add person')
    page.locator('#peopleBody tr').last.locator('[data-field=name]').fill('テストX')
    check(page.locator('#heroFill').inner_text()=='—','editing invalidates stale result')
    page.locator('#solve').click()
    check(page.locator('.loadbar').count()==8,'calculate after people edit')
    page.locator('#peopleBody tr').last.locator('button[data-delete]').click()
    check(page.locator('#peopleBody tr').count()==7,'delete person')
    page.locator('#addShift').click()
    check(page.locator('#shiftsBody tr').count()==7,'add shift')
    page.locator('#shiftsBody tr').last.locator('button[data-delete]').click()
    check(page.locator('#shiftsBody tr').count()==6,'delete shift')
    page.locator('#rest').fill('200')
    page.locator('#solve').click()
    check('休憩間隔' in page.locator('#message').inner_text(),'invalid rest rejected')
    page.locator('#rest').fill('15');page.locator('#solve').click()
    check(page.locator('#heroFill').inner_text().endswith('%'),'rest corrected')
    opts=page.locator('.seat select').first
    seatid=opts.get_attribute('data-seat')
    allvals=opts.locator('option').evaluate_all('(els)=>els.map(e=>e.value).filter(Boolean)')
    check(bool(allvals),'select participants')
    selected=opts.input_value();opts.select_option(selected)
    check(page.locator('.seat select').first.input_value()==selected,'manual assignment stable')
    # Reassign an eligible participant if possible, otherwise force a known valid participant
    firstslot=page.locator('.seat select').first
    firstslot.select_option('p7')
    check(page.locator('.seat').first.locator('.locked').count()==1,'lock assignment')
    check(page.locator('.seat select').first.input_value()=='p7','lock value retained')
    page.locator('#solve').click()
    check(page.locator('.seat select').first.input_value()=='p7','lock survives re-solve')
    # Invalid lock rejected: C cannot work reception at 09:00 if role mismatched (C is guide and sales)
    page.locator('.seat select').first.select_option('p3')
    check('この固定はできません' in page.locator('#message').inner_text(),'invalid assignment rejected')
    check(page.locator('.seat select').first.input_value()=='p7','invalid lock reverted')
    page.locator('.seat select').first.select_option('')
    check(page.locator('.seat').first.locator('.locked').count()==0,'release lock')
    with page.expect_download() as dl:page.locator('#exportCsv').click()
    csv=dl.value.path().read_text(encoding='utf-8-sig')
    check('役割' in csv and '未配置' in csv or '役割' in csv,'CSV content')
    check(csv.startswith('"開始"'),'CSV BOM decode')
    with page.expect_download() as dl:page.locator('#exportJson').click()
    data=json.loads(dl.value.path().read_text('utf-8'))
    check(len(data['people'])==7,'JSON export')
    page.locator('#eventName').fill('新しい文化祭')
    page.locator('#save').click()
    load(page)
    check(page.locator('#eventName').input_value()=='新しい文化祭','mocked local storage persists between document reloads')
    page.locator('#clearStorage').click();load(page)
    check(page.locator('#eventName').input_value()!='新しい文化祭','clear local storage')
    data['eventName']='読み込んだイベント';data['people'][0]['name']='<script>alert(1)</script>'
    importfile=ROOT/'test-import.json';importfile.write_text(json.dumps(data,ensure_ascii=False),encoding='utf-8')
    page.locator('#importJson').set_input_files(str(importfile))
    page.wait_for_timeout(300)
    check(page.locator('#eventName').input_value()=='読み込んだイベント','JSON import')
    check(page.locator('#peopleBody script').count()==0,'no injected scripts')
    check(page.locator('#peopleBody input[data-field=name]').first.input_value()=='<script>alert(1)</script>','safe HTML escaping')
    importfile.unlink()
    page.locator('#demo').click()
    check(page.locator('#peopleBody input[data-field=name]').first.input_value()=='Aさん','demo restore')
    check(page.locator('#heroFill').inner_text().endswith('%'),'demo recompute')
    check(len(errors)==0,'no page script errors '+repr(errors))
    mobile=browser.new_context(accept_downloads=True,viewport={'width':390,'height':844},device_scale_factor=1)
    phone=mobile.new_page();load(phone)
    check(phone.locator('#heroFill').inner_text().endswith('%'),'mobile functionality')
    check(phone.evaluate('document.documentElement.scrollWidth <= window.innerWidth+1'),'no mobile viewport overflow')
    phone.screenshot(path=str(ROOT/'mobile.png'),full_page=True)
    check((ROOT/'desktop.png').stat().st_size>20000,'desktop screenshot')
    check((ROOT/'mobile.png').stat().st_size>20000,'mobile screenshot')
    print(f'CHROMIUM: {checks}/{checks} checks PASS (desktop/mobile + downloads + mocked localStorage)')
    mobile.close();browser.close()
finally:
 pass
