"""Run with: python browser_test.py (uses installed Chromium + Playwright)."""
from pathlib import Path
import json, tempfile
from playwright.sync_api import sync_playwright

HERE=Path(__file__).resolve().parent
HTML=(HERE/'index.html').read_text(encoding='utf-8')
CSS=(HERE/'style.css').read_text(encoding='utf-8')
ENGINE=(HERE/'engine.js').read_text(encoding='utf-8')
APP=(HERE/'app.js').read_text(encoding='utf-8')
def load(page, stored=None):
    page.goto('about:blank')
    page.set_content(HTML)
    page.add_style_tag(content=CSS)
    page.add_script_tag(content='Object.defineProperty(window, \"localStorage\", {configurable:true,value:{data:{},getItem(k){return this.data[k]||null},setItem(k,v){this.data[k]=String(v)}}});')
    if stored:
        page.evaluate('(s)=>{window.localStorage.data=s}', stored)
    page.add_script_tag(content=ENGINE)
    page.add_script_tag(content=APP)

count=0

def check(pred, message):
    global count
    assert pred, message
    count+=1

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page(viewport={'width':1440,'height':1000}, device_scale_factor=1, accept_downloads=True)
    issues=[]
    page.on('pageerror', lambda e: issues.append(str(e)))
    load(page)
    check(page.title().startswith('あみかえ'), 'title')
    check(page.locator('.scenario').count()==2,'comparison cards')
    check(page.locator('#currentrow').inner_text()=='0','counter default')
    check(page.locator('#totalrows').inner_text()=='96','default rows')
    check(page.locator('#events .event').count()==18,'shaping events in A')
    check(page.locator('#map svg rect').count()==96,'row chart cells')
    check(page.locator('#explanation').is_visible(),'explanation')
    page.locator('#plus').click()
    check(page.locator('#currentrow').inner_text()=='1','advance')
    page.locator('#minus').click()
    check(page.locator('#currentrow').inner_text()=='0','rewind')
    page.locator('#useB').click()
    check(page.locator('#totalrows').inner_text()=='90','change gauge')
    check(page.locator('#useB').get_attribute('class')=='active','gauge active')
    check(page.locator('#map svg rect').count()==90,'changed chart')
    page.locator('[name="sourceRows"]').fill('112')
    check(page.locator('#totalrows').inner_text()=='120','live recompute')
    page.locator('[name="sourceRows"]').fill('84')
    check(page.locator('#totalrows').inner_text()=='90','recompute restore')
    page.locator('[name="multiple"]').fill('4')
    page.locator('[name="offset"]').fill('9')
    check(page.locator('#error').is_visible(),'invalid constraint message')
    page.locator('[name="offset"]').fill('2')
    check(not page.locator('#error').is_visible(),'valid constraint message resolves')
    with page.expect_download() as download_info:
        page.locator('#export').click()
    download=download_info.value
    check(download.suggested_filename=='amikae-plan.json','json download')
    export_path=Path(tempfile.mkdtemp())/'plan.json'
    download.save_as(export_path)
    exported=json.loads(export_path.read_text('utf-8'))
    check(exported['app']=='amikae' and exported['selection']=='B','exported metadata')
    check(exported['input']['multiple']==4,'exported input')
    with page.expect_download() as csv_info:
        page.locator('#csv').click()
    csv_download=csv_info.value
    check(csv_download.suggested_filename=='amikae-B-rows.csv','csv filename')
    csv_path=export_path.with_suffix('.csv');csv_download.save_as(csv_path)
    check(len(csv_path.read_text(encoding='utf-8-sig').splitlines())==91,'csv row count')
    snapshot=page.evaluate('window.localStorage.data')
    load(page,snapshot)
    check(page.locator('#useB').get_attribute('class')=='active','persisted selection')
    check(page.locator('[name="multiple"]').input_value()=='4','persisted input')
    page.locator('#reset').click()
    check(page.locator('[name="multiple"]').input_value()=='2','reset field')
    check(page.locator('#totalrows').inner_text()=='96','reset result')
    page.locator('#import').set_input_files(str(export_path))
    check(page.locator('#useB').get_attribute('class')=='active','import gauge')
    check(page.locator('[name="multiple"]').input_value()=='4','import field')
    check(page.locator('#events .event').count()>0,'import events')
    page.locator('[name="title"]').fill('<img src=x onerror=alert(1)>')
    check(page.locator('img').count()==0,'html escaping')
    check(len(issues)==0,'javascript page errors: '+str(issues))
    page.locator('#reset').click()
    page.screenshot(path=str(HERE/'desktop.png'), full_page=True)
    mobile=browser.new_page(viewport={'width':390,'height':844}, device_scale_factor=1)
    load(mobile)
    check(mobile.locator('.scenario').count()==2,'mobile render')
    check(mobile.evaluate('document.documentElement.scrollWidth <= innerWidth+1'),'no mobile horizontal overflow')
    mobile.screenshot(path=str(HERE/'mobile.png'),full_page=True)
    browser.close()
print(f'PASS {count}/{count} Playwright Chromium assertions')
