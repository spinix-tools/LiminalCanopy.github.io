"""Chromium DOM/UI integration tests, using actual source inlined into the document.
The execution environment disallows local file navigation; set_content avoids HTTP access.
"""
import pathlib, json, tempfile
from playwright.sync_api import sync_playwright

base = pathlib.Path(__file__).resolve().parent
html = (base / 'index.html').read_text()
html = html.replace('<link rel="stylesheet" href="./style.css">', '<style>' + (base / 'style.css').read_text() + '</style>')
html = html.replace('</head>', '<script>window.__store={};Object.defineProperty(window,"localStorage",{configurable:true,value:{getItem:k=>window.__store[k]??null,setItem:(k,v)=>{window.__store[k]=String(v)}}});</script></head>')
for name in ['engine.js','app.js']:
    html = html.replace(f'<script src="./{name}"></script>', '<script>' + (base / name).read_text() + '</script>')

def main():
    checks = 0
    def check(value,msg):
        nonlocal checks
        assert value,msg
        checks += 1
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
        context=browser.new_context(accept_downloads=True,viewport={'width':1400,'height':1000},device_scale_factor=1)
        page=context.new_page()
        errors=[]
        page.on('pageerror',lambda err: errors.append(str(err)))
        page.set_content(html,wait_until='load')
        check(page.title().startswith('切手まわし'),'title')
        check(page.locator('#stocks input').count()==8,'stocks 4x2')
        check(page.locator('#mails input').count()==6,'mails 2x3')
        check(page.locator('#results').get_by_text('2通すべての割当').count()==1,'result on load')
        check(page.locator('#results').get_by_text('途中で切手が足りず').count()==1,'greedy fails')
        check(page.locator('.stamp-chip').count()==4,'four allocated stamps')
        check(page.locator('#count-badge').inner_text()=='OPTIMIZED','badge')
        check(page.locator('#result-error').count()==0,'no error')
        check(len(errors)==0,f'no JS errors {errors}')
        page.screenshot(path=str(base/'desktop.png'),full_page=True)
        # Switching objective preserves exact solution.
        page.select_option('#objective','pieces')
        check(page.locator('#count-badge').inner_text()=='READY','invalidate')
        page.click('#calculate')
        check(page.locator('.stamp-chip').count()==4,'recalculate')
        # Confirm and undo exact inventory delta.
        page.click('#commit')
        check(page.locator('#count-badge').inner_text()=='CONFIRMED','confirmed')
        check([x.input_value() for x in page.locator('#stocks input[data-field="count"]').all()]==['0']*4,'stock decremented')
        check(page.locator('#undo').is_enabled(),'undo enabled')
        page.click('#undo')
        check([x.input_value() for x in page.locator('#stocks input[data-field="count"]').all()]==['1']*4,'undo correct')
        check(page.locator('#count-badge').inner_text()=='OPTIMIZED','undo replan')
        # Editable stock and validation.
        page.locator('input[data-kind="stock"][data-index="0"][data-field="count"]').fill('0')
        page.locator('input[data-kind="stock"][data-index="0"][data-field="count"]').press('Tab')
        page.click('#calculate')
        check('計画を確定できません' in page.locator('#results').inner_text(),'invalid result visible')
        page.click('#demo')
        check(page.locator('#count-badge').inner_text()=='OPTIMIZED','demo recovery')
        # Add a mail, remove it.
        page.click('#add-mail')
        check(page.locator('#mails input').count()==9,'new mail')
        page.locator('#mails [data-action="remove-mail"]').last.click()
        check(page.locator('#mails input').count()==6,'remove mail')
        page.click('#add-stock')
        check(page.locator('#stocks input').count()==10,'new stock')
        page.locator('#stocks [data-action="remove-stock"]').last.click()
        check(page.locator('#stocks input').count()==8,'remove stock')
        # CSV injection and downloads.
        page.locator('input[data-kind="mail"][data-index="0"][data-field="label"]').fill('=HYPERLINK("hi")')
        page.locator('input[data-kind="mail"][data-index="0"][data-field="label"]').press('Tab')
        page.click('#calculate')
        check(page.locator('#results').get_by_text('=HYPERLINK').count()>0,'escaped input rendered')
        with page.expect_download() as download_info: page.click('#export-csv')
        download=download_info.value
        check(download.suggested_filename.endswith('.csv'),'CSV download')
        with tempfile.TemporaryDirectory() as t:
            out=pathlib.Path(t)/'data.csv'; download.save_as(out)
            data=out.read_text(encoding='utf-8-sig')
            check('"\'=HYPERLINK' in data,'CSV formula escaped')
        with page.expect_download() as download_info: page.click('#save-json')
        download=download_info.value
        check(download.suggested_filename.endswith('.json'),'JSON download')
        with tempfile.TemporaryDirectory() as t:
            out=pathlib.Path(t)/'saved.json'; download.save_as(out)
            data=json.loads(out.read_text())
            check(data['format']=='kitte-mawashi-v1','JSON format')
            check(data['project']['mails'][0]['label'].startswith('='),'JSON content')
            page.locator('#json-file').set_input_files(str(out))
            check(page.locator('#count-badge').inner_text()=='OPTIMIZED','JSON restore')
        # Invalid JSON import leaves state unchanged.
        with tempfile.TemporaryDirectory() as t:
            path=pathlib.Path(t)/'bad.json';path.write_text('{"format":"bad"}')
            page.locator('#json-file').set_input_files(str(path))
            check(page.locator('#count-badge').inner_text()=='OPTIMIZED','bad import safe')
        check(len(errors)==0,f'no runtime errors {errors}')
        mobile=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1)
        mobile.set_content(html,wait_until='load')
        check(mobile.locator('#count-badge').inner_text()=='OPTIMIZED','mobile calculation')
        check(mobile.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 2'),'no horizontal overflow mobile')
        mobile.screenshot(path=str(base/'mobile.png'),full_page=True)
        print(f'Chromium assertions: {checks}/{checks} passed; page errors: {len(errors)}')
        browser.close()

if __name__=='__main__':main()