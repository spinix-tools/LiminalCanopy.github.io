"""Playwright Chromium integration checks using inline same-source assets (sandbox URL policy)."""
from pathlib import Path
from playwright.sync_api import sync_playwright

DIR=Path(__file__).parent

def run():
    checks=0
    def check(ok, label):
        nonlocal checks
        assert ok, label
        checks+=1
    html=(DIR/'index.html').read_text()
    html=html.replace('<link rel="stylesheet" href="./style.css">','<style>'+(DIR/'style.css').read_text()+'</style>')
    html=html.replace('<script src="./engine.js"></script>','<script>'+(DIR/'engine.js').read_text()+'</script>')
    html=html.replace('<script src="./app.js"></script>','<script>'+(DIR/'app.js').read_text()+'</script>')
    # Sandboxed Chromium blocks file:// and localhost, so run the exact same source inline.
    # A stateful localStorage mock avoids SecurityError on about:blank.
    localmock='<script>window.__store={};Object.defineProperty(window,"localStorage",{configurable:true,value:{getItem:k=>window.__store[k]??null,setItem:(k,v)=>{window.__store[k]=String(v)}}});</script>'
    html=html.replace('</head>',localmock+'</head>')
    with sync_playwright() as pw:
            browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
            page=browser.new_page(viewport={'width':1440,'height':1024},device_scale_factor=1,accept_downloads=True)
            console=[]
            page.on('pageerror',lambda e: console.append(str(e)))
            page.set_content(html,wait_until='load')
            page.wait_for_selector('.riskRow')
            check(page.title().startswith('棚リズム'),'title')
            check(page.locator('.productTable tbody tr').count()==5,'five sample products')
            check('円' in page.locator('#kpiProfit').inner_text(),'yen KPI')
            check(page.locator('.shelfItem').count()==5,'five shelf blocks')
            check(page.locator('#compare').is_visible(),'suggestion visible')
            oldprofit=page.locator('#kpiProfit').inner_text()
            page.locator('#shelf-days').fill('4')
            page.locator('#shelf-days').dispatch_event('change')
            check(page.locator('#shelf-days').input_value()=='4','day input updates')
            check(oldprofit!=page.locator('#kpiProfit').inner_text(),'day changes output')
            page.locator('#shelf-width').fill('65')
            page.locator('#shelf-width').dispatch_event('change')
            check(page.locator('#alert').is_visible(),'over capacity warning')
            check('陳列幅' in page.locator('#alert').inner_text(),'warning description')
            page.get_by_role('button',name='粗利ベースで最適化').click()
            check(page.locator('#kpiUsage').inner_text()!='—','optimize operates')
            check(not page.locator('#alert').is_visible() or '更新' in page.locator('#alert').inner_text() or '反映' in page.locator('#alert').inner_text(),'optimized shelf now fits')
            before=page.locator('.productTable tbody tr').count()
            page.get_by_role('button',name='商品を追加').click()
            check(page.locator('.productTable tbody tr').count()==before+1,'add product')
            newrow=page.locator('.productTable tbody tr').last
            newrow.locator('input[data-field="name"]').fill('手づくり缶詰')
            newrow.locator('input[data-field="name"]').dispatch_event('change')
            check(page.locator('.productTable tbody tr').last.locator('.nameField').input_value()=='手づくり缶詰','edit name')
            count_before=page.locator('.productTable tbody tr').last.locator('.faceCounter b').inner_text()
            page.locator('.productTable tbody tr').last.locator('[data-action="plus"]').click()
            check(int(page.locator('.productTable tbody tr').last.locator('.faceCounter b').inner_text())==int(count_before)+1,'plus faces')
            page.locator('.productTable tbody tr').last.locator('[data-action="minus"]').click()
            check(int(page.locator('.productTable tbody tr').last.locator('.faceCounter b').inner_text())==int(count_before),'minus faces')
            with page.expect_download() as dl:
                page.get_by_role('button',name='JSON保存').click()
            json_dl=dl.value
            json_path=DIR/'test-download.json';json_dl.save_as(json_path)
            check(json_dl.suggested_filename=='tanarhythm-plan.json','json name')
            check('手づくり缶詰' in json_path.read_text(),'json contains edit')
            with page.expect_download() as dl:
                page.get_by_role('button',name='CSV出力').click()
            csv_dl=dl.value
            csv_path=DIR/'test-download.csv';csv_dl.save_as(csv_path)
            check(csv_dl.suggested_filename.endswith('.csv'),'csv name')
            check('手づくり缶詰' in csv_path.read_text(encoding='utf-8-sig'),'csv contains edit')
            page.get_by_role('button',name='サンプルに戻す').click()
            check(page.locator('.productTable tbody tr').count()==5,'reset sample')
            page.locator('#importJson').set_input_files(str(json_path))
            check(page.locator('.productTable tbody tr').count()==6,'re-import json')
            check(page.locator('.nameField').last.input_value()=='手づくり缶詰','re-import contents')
            previous_store=page.evaluate('window.__store')
            page.set_content(html,wait_until='load')
            page.evaluate('data=>{window.__store=data;localStorage.setItem("tanarhythm.v1",data["tanarhythm.v1"])}',previous_store)
            page.evaluate('()=>{let d=JSON.parse(localStorage.getItem("tanarhythm.v1"));document.querySelector("#resetBtn").click();localStorage.setItem("tanarhythm.v1",JSON.stringify(d))}')
            # Re-render persisted settings by installing storage before app script runs.
            persist_html=html.replace('window.__store={};','window.__store='+__import__('json').dumps(previous_store,ensure_ascii=False)+';')
            page.set_content(persist_html,wait_until='load')
            check(page.locator('.productTable tbody tr').count()==6,'localStorage persistence')
            check(page.locator('.nameField').last.input_value()=='手づくり缶詰','localStorage edit persists')
            page.get_by_role('button',name='サンプルに戻す').click()
            page.screenshot(path=str(DIR/'desktop.png'),full_page=True)
            mobile=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1)
            mobile.set_content(html)
            mobile.wait_for_selector('.riskRow')
            check(mobile.locator('#kpiProfit').is_visible(),'mobile KPI')
            check(mobile.locator('.shelfScene').is_visible(),'mobile scene')
            check(mobile.evaluate('document.documentElement.scrollWidth <= window.innerWidth+1'),'no page-wide horizontal overflow')
            mobile.screenshot(path=str(DIR/'mobile.png'),full_page=True)
            check(not console,'no JS page errors: '+str(console))
            for p in [json_path,csv_path]:p.unlink(missing_ok=True)
            browser.close()
            print(f'PASS: {checks}/{checks} Chromium integration assertions; desktop.png/mobile.png created')
            return checks
if __name__=='__main__':run()
