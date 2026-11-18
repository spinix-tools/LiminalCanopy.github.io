"""Run with: python browser_test.py (requires playwright + installed chromium)."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json, tempfile

ROOT=Path(__file__).parent
def inline_source():
    html=(ROOT/'index.html').read_text('utf-8')
    html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+(ROOT/'style.css').read_text('utf-8')+'</style>')
    for script in ('engine.js','app.js'):
        html=html.replace(f'<script defer src="{script}"></script>','<script>'+(ROOT/script).read_text('utf-8')+'</script>')
    return html

def init_storage(page):
    page.goto('about:blank')
    page.evaluate("""() => {let data={};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>data[k]??null,setItem:(k,v)=>{data[k]=String(v)},removeItem:k=>delete data[k],clear:()=>{data={}}}})}""")

def run():
    html=inline_source()
    n=0
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
        page=browser.new_page(accept_downloads=True,viewport={'width':1366,'height':900})
        page.on('dialog',lambda d:d.accept())
        console=[]
        page.on('pageerror',lambda e:console.append(str(e)))
        init_storage(page)
        page.set_content(html,wait_until='load')
        def check(expr,label):
            nonlocal n
            assert expr,label
            n+=1
        check(page.title().startswith('そなえ差分'),'title')
        check(page.locator('#inventory-body tr').count()==5,'demo rows')
        check(page.locator('#now-days').inner_text()!='—','score output')
        check(page.locator('#coverage-cards .coverage-card').count()==3,'3 categories')
        check(page.locator('#plan-body tr').count()==3,'3 plan rows')
        check('保存' in page.locator('#status').inner_text(),'local text')
        page.locator('#persons').fill('4');page.locator('#persons').dispatch_event('change')
        check(page.locator('#scenario-label').inner_text().find('目標 7日')!=-1,'persons update triggers')
        check(page.locator('#future-days').inner_text()!='—','recompute')
        page.locator('#budget').fill('0');page.locator('#budget').dispatch_event('change')
        check('0円' in page.locator('#plan-summary').inner_text(),'zero budget')
        page.locator('#budget').fill('9000');page.locator('#budget').dispatch_event('change')
        check('円' in page.locator('#plan-summary').inner_text(),'budget restored')
        target=page.locator('#asof').get_attribute('min')
        page.locator('#asof').fill(target);page.locator('#asof').dispatch_event('change')
        check(target in page.locator('#scenario-label').inner_text(),'scenario date change')
        page.locator('#item-name').fill('ブラウザ試験');page.locator('#item-quantity').fill('6')
        page.locator('#item-form button[type=submit]').click()
        check(page.locator('#inventory-body tr').count()==6,'item add')
        check('ブラウザ試験' in page.locator('#inventory-body').inner_text(),'name display')
        row=page.locator('#inventory-body tr').filter(has_text='ブラウザ試験')
        row.locator('[data-action=use]').click()
        check('5 ' in row.inner_text(),'consume one')
        row.locator('[data-action=delete]').click()
        check(page.locator('#inventory-body tr').count()==5,'delete')
        with page.expect_download() as d:page.locator('#export-csv').click()
        check(d.value.suggested_filename.endswith('.csv'),'csv download')
        with page.expect_download() as d:page.locator('#export-json').click()
        download=d.value;check(download.suggested_filename.endswith('.json'),'json download')
        out=Path(tempfile.mkdtemp())/'backup.json';download.save_as(str(out));
        payload=json.loads(out.read_text('utf-8'))
        check(len(payload['items'])==5,'json content')
        check(payload['asOf']==target,'scenario persisted in backup')
        page.locator('#item-name').fill('復元テスト');page.locator('#item-form button[type=submit]').click()
        check(page.locator('#inventory-body tr').count()==6,'add before import')
        page.locator('#import-file').set_input_files(str(out));page.wait_for_timeout(250)
        check(page.locator('#inventory-body tr').count()==5,'json restore')
        page.set_content(html,wait_until='load')
        check(page.locator('#persons').input_value()=='4','persist reload')
        check(page.locator('#asof').input_value()==target,'scenario reload')
        check(page.locator('#inventory-body tr').count()==5,'persist items')
        page.locator('#sample-reset').click()
        check(page.locator('#persons').input_value()=='2','reset settings')
        check(page.locator('#inventory-body tr').count()==5,'reset items')
        check(len(console)==0,'no JS exception: '+str(console))
        page.screenshot(path=str(ROOT/'desktop.png'),full_page=True)
        mobile=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1)
        init_storage(mobile)
        mobile.set_content(html,wait_until='load')
        check(mobile.evaluate('document.documentElement.scrollWidth <= innerWidth'),'mobile no page overflow')
        check(mobile.locator('#coverage-cards .coverage-card').count()==3,'mobile cards')
        mobile.screenshot(path=str(ROOT/'mobile.png'),full_page=True)
        browser.close()
    print(f'PASS: {n} browser assertions')
if __name__=='__main__':run()