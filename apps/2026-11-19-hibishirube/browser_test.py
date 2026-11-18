"""Browser integration checks against the actual local HTML/CSS/JS files."""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

BASE=Path(__file__).resolve().parent
async def main():
    passed=0
    checks=[]
    def check(ok, name):
        nonlocal passed
        if not ok: raise AssertionError(name)
        passed+=1; checks.append(name)
    async with async_playwright() as p:
        browser=await p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
        context=await browser.new_context(accept_downloads=True,viewport={'width':1365,'height':970})
        page=await context.new_page()
        errors=[]
        page.on('pageerror',lambda e: errors.append(str(e)))
        html=BASE.joinpath('index.html').read_text()
        html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+BASE.joinpath('style.css').read_text()+'</style>')
        for name in ('engine.js','app.js'):
            html=html.replace('<script src="'+name+'"></script>','<script>'+BASE.joinpath(name).read_text()+'</script>')
        storage_script='''() => { window.__stored={};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:(k)=>window.__stored[k]??null,setItem:(k,v)=>{window.__stored[k]=String(v)},removeItem:(k)=>delete window.__stored[k]}}) }'''
        await page.evaluate(storage_script)
        await page.set_content(html,wait_until='load')
        check(await page.title()=='ひびしるべ｜写真で残す住まいの点検','page title')
        check(await page.locator('#photoCount').inner_text()=='0','initial empty')
        await page.locator('#demoBtn').click()
        check(await page.locator('#photoCount').inner_text()=='2','demo creates photos')
        check(await page.locator('#pinCount').inner_text()=='3','demo creates 3 pins')
        check(await page.locator('.pinMarker').count()==1,'selected photo pins')
        await page.locator('.pinMarker').first.click()
        check(await page.locator('#editorTitle').inner_text()=='ピンの編集','select existing pin')
        await page.locator('#pinNote').fill('変更済み・サンプル')
        await page.locator('#severitySelect').select_option('要対応')
        await page.locator('#savePinBtn').click()
        check('変更済み' in await page.locator('#issueList').inner_text(),'edit pin text')
        await page.locator('.photoStage img').click(position={'x':100,'y':90})
        check(await page.locator('#editorTitle').inner_text()=='新しいピン','click to add')
        await page.locator('#kindSelect').select_option('破損')
        await page.locator('#pinNote').fill('扉のヒンジを確認')
        await page.locator('#savePinBtn').click()
        check(await page.locator('#pinCount').inner_text()=='4','pin added')
        check('ヒンジ' in await page.locator('#issueList').inner_text(),'pin memo rendered')
        await page.locator('.pinMarker').last.click()
        await page.locator('#deletePinBtn').click()
        check(await page.locator('#pinCount').inner_text()=='3','delete pin')
        check(await page.locator('#compareView .miniPhoto').count()==2,'compare both phases')
        check(await page.locator('#recordList .recordItem').count()==2,'record list')
        await page.locator('#filterRoom').select_option('キッチン')
        check(await page.locator('#recordList .recordItem').count()==0,'filter by room')
        await page.locator('#filterRoom').select_option('すべて')
        async with page.expect_download() as download:
            await page.locator('#csvBtn').click()
        check((await download.value).suggested_filename.endswith('.csv'),'CSV download')
        async with page.expect_download() as download:
            await page.locator('#saveBtn').click()
        check((await download.value).suggested_filename.endswith('.json'),'JSON download')
        async with page.expect_download() as download:
            await page.locator('#exportPngBtn').click()
        check((await download.value).suggested_filename.endswith('.png'),'annotated PNG')
        # Import a fully configured JSON snapshot through the input.
        obj=await page.evaluate('JSON.stringify(JSON.parse(localStorage.getItem("hibishirube-project-v1")))')
        import tempfile
        with tempfile.TemporaryDirectory() as temp:
            f=Path(temp)/'restore.json';f.write_text(obj,encoding='utf-8')
            await page.locator('#importInput').set_input_files(str(f))
            check(await page.locator('#photoCount').inner_text()=='2','JSON import')
        # Insert actual local PNG (not synthetic application image) and validate composition.
        from PIL import Image
        with tempfile.TemporaryDirectory() as temp:
            f=Path(temp)/'camera.png';Image.new('RGB',(800,400),(190,174,145)).save(f)
            await page.locator('#roomSelect').select_option('玄関')
            await page.locator('#photoInput').set_input_files(str(f))
            await page.wait_for_function('document.querySelector("#photoCount").textContent==="3"',timeout=7000)
            check(await page.locator('#photoCount').inner_text()=='3','PNG photo import')
            check(await page.locator('#recordLabel').input_value()=='camera','photo label')
        # Photo data persisted at least within session after reload.
        saved=await page.evaluate('localStorage.getItem("hibishirube-project-v1")')
        check(bool(saved) and 'camera' in saved,'mock localStorage receives updates')
        restored_page=await context.new_page()
        await restored_page.evaluate(storage_script)
        await restored_page.evaluate('(data) => localStorage.setItem("hibishirube-project-v1",data)',saved)
        await restored_page.set_content(html,wait_until='load')
        check(await restored_page.locator('#photoCount').inner_text()=='3','restore from simulated localStorage')
        async with page.expect_popup() as popup:
            await page.locator('#printBtn').click()
        report=await popup.value
        check('写真台帳' in await report.title(),'print report opened')
        check(await report.locator('.photoReport').count()==3,'report pages')
        check('撮影日時では' in await report.locator('body').inner_text(),'report date caveat')
        check(len(errors)==0,f'no JavaScript page errors {errors}')
        # Responsive
        mobile=await browser.new_page(viewport={'width':390,'height':844})
        await mobile.evaluate(storage_script)
        await mobile.set_content(html,wait_until='load')
        check(await mobile.locator('.sidebar').is_visible(),'mobile sidebar visible')
        check(await mobile.locator('.mainpanel').is_visible(),'mobile editor visible')
        check(await mobile.locator('.reportPanel').is_visible(),'mobile compare visible')
        check(await mobile.evaluate('document.documentElement.scrollWidth <= innerWidth + 3'),'no mobile horizontal overflow')
        await page.locator('[data-record="sample-out"]').click()
        await page.wait_for_timeout(3500)
        await mobile.locator('#demoBtn').click()
        await mobile.wait_for_timeout(300)
        await page.screenshot(path=str(BASE/'desktop.png'),full_page=True)
        await mobile.screenshot(path=str(BASE/'mobile.png'),full_page=True)
        await browser.close()
    print(f'Browser integration: {passed}/{passed} PASS')
    for c in checks: print('  OK',c)

if __name__=='__main__': asyncio.run(main())
