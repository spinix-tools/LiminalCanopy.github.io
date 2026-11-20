"""Playwright integration test using inlined exact production CSS/JS; local URL is administrator-blocked."""
import asyncio, json, os, subprocess, time, urllib.request
from pathlib import Path
from playwright.async_api import async_playwright
ROOT = Path(__file__).parent
PORT = 18741

async def main():
    html=(ROOT/"index.html").read_text(encoding="utf8")
    html=html.replace('<link rel="stylesheet" href="style.css">',"<style>"+(ROOT/"style.css").read_text(encoding="utf8")+"</style>")
    for fn in ["engine.js","app.js"]:
        html=html.replace(f'<script src="{fn}"></script>',"<script>"+(ROOT/fn).read_text(encoding="utf8")+"</script>")
    done=[]; errors=[]
    def check(v, label):
        assert v, label
        done.append(label)
    try:
        async with async_playwright() as p:
            browser=await p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
            context=await browser.new_context(viewport={'width':1720,'height':1100},accept_downloads=True)
            page=await context.new_page()
            page.on('pageerror',lambda e:errors.append(str(e)))
            await page.goto('about:blank')
            await page.evaluate("""() => { const bag={}; Object.defineProperty(window, 'localStorage', { configurable:true, value:{ getItem:k=>bag[k]??null, setItem:(k,v)=>bag[k]=String(v),removeItem:k=>delete bag[k] }}); }""")
            await page.set_content(html)
            await page.wait_for_selector('#floor g[data-drag]')
            check(await page.title()=='SIGN SIKAI — サイン視界','title')
            check(await page.locator('.metric').count()==4,'four summary metrics')
            check(await page.locator('#floor').get_attribute('viewBox') is not None,'svg rendered')
            check(await page.locator('#list-signs .obj').count()==2,'two demo signs')
            check(await page.locator('#list-visitors .obj').count()==3,'three demo viewing points')
            check(await page.locator('#list-obstacles .obj').count()==2,'two demo obstacles')
            check(await page.locator('#diagnosis .diag-card').count()==3,'per-view diagnostic cards')
            check(await page.locator('#selected-metrics b').count()==3,'diagnostic category counters')
            check(await page.locator('#recommendations').inner_text()!='','improvement suggestions generated')
            await page.screenshot(path=str(ROOT/'desktop.png'),full_page=True)
            await page.locator('#btn-rays').click()
            check(await page.locator('#btn-rays').get_attribute('aria-pressed')=='false','toggle visibility rays')
            await page.locator('#btn-rays').click()
            await page.locator('#btn-labels').click()
            check(await page.locator('#btn-labels').get_attribute('aria-pressed')=='false','toggle labels')
            await page.locator('#btn-labels').click()
            # Editing project metadata
            await page.locator('[data-top="name"]').fill('夏の展示チェック')
            await page.locator('[data-top="name"]').press('Tab')
            check(await page.locator('[data-top="name"]').input_value()=='夏の展示チェック','edit project name')
            await page.locator('[data-top="settings.minAngle"]').fill('42')
            await page.locator('[data-top="settings.minAngle"]').press('Tab')
            check(await page.locator('[data-top="settings.minAngle"]').input_value()=='42','edit angular criterion')
            # Add and edit entities
            await page.locator('[data-add="visitors"]').click()
            check(await page.locator('#list-visitors .obj').count()==4,'add visitor')
            await page.locator('[data-add="signs"]').click()
            check(await page.locator('#list-signs .obj').count()==3,'add sign')
            await page.locator('[data-add="obstacles"]').click()
            check(await page.locator('#list-obstacles .obj').count()==3,'add obstacle')
            await page.locator('[data-kind="signs"][data-field="name"]').last.fill('図書コーナー')
            await page.locator('[data-kind="signs"][data-field="name"]').last.press('Tab')
            check('図書コーナー' in (await page.locator('#selected-sign').inner_text()),'rename sign')
            check(await page.locator('#diagnosis .diag-card').count()==4,'new visitor included')
            # Drag a sign in the real SVG
            sign = page.locator('#floor [data-drag="signs"][data-id="s3"] circle').first
            await sign.scroll_into_view_if_needed()
            bb=await sign.bounding_box()
            initial=await page.locator('[data-kind="signs"][data-id="s3"][data-field="x"]').input_value()
            await page.mouse.move(bb['x']+bb['width']/2,bb['y']+bb['height']/2)
            await page.mouse.down()
            await page.mouse.move(bb['x']+bb['width']/2+44,bb['y']+bb['height']/2+20,steps=10)
            await page.mouse.up()
            check(initial!=await page.locator('[data-kind="signs"][data-id="s3"][data-field="x"]').input_value(),'drag sign on plan')
            # Export real downloads
            async with page.expect_download() as info: await page.locator('#btn-export-json').click()
            dl=await info.value
            saved=ROOT/'test-export.json';await dl.save_as(str(saved))
            content=json.loads(saved.read_text())
            check(content['name']=='夏の展示チェック','JSON export content')
            async with page.expect_download() as info: await page.locator('#btn-csv').click()
            dl=await info.value;fn=ROOT/'test-report.csv';await dl.save_as(str(fn))
            check('図書コーナー' in fn.read_text(encoding='utf-8-sig'),'CSV report content')
            async with page.expect_download() as info: await page.locator('#btn-svg').click()
            dl=await info.value;fn=ROOT/'test-floor.svg';await dl.save_as(str(fn))
            check('<svg' in fn.read_text(encoding='utf-8'),'SVG diagram downloaded')
            # JSON import and persistence
            await page.locator('[data-kind="signs"][data-id="s3"][data-field="name"]').fill('一時的な名前')
            await page.locator('[data-kind="signs"][data-id="s3"][data-field="name"]').press('Tab')
            await page.locator('#file-json').set_input_files(str(saved))
            await page.wait_for_function("document.querySelector('#selected-sign').textContent.includes('図書コーナー')")
            check('図書コーナー' in (await page.locator('#selected-sign').inner_text()),'JSON import restores name')
            await page.set_content(html)
            check('夏の展示チェック'==await page.locator('[data-top="name"]').input_value(),'mocked localStorage survives document replacement')
            # Invalid JSON must not corrupt state
            invalid=ROOT/'test-invalid.json';invalid.write_text('{"broken":',encoding='utf8')
            await page.locator('#file-json').set_input_files(str(invalid))
            check('夏の展示チェック'==await page.locator('[data-top="name"]').input_value(),'invalid JSON rejected')
            # Delete without deleting last mandatory item
            await page.locator('[data-kind="visitors"][data-del]').last.click()
            check(await page.locator('#list-visitors .obj').count()==3,'delete visitor')
            # Reset confirmation
            page.once('dialog',lambda dialog: asyncio.create_task(dialog.accept()))
            await page.locator('#btn-reset').click()
            check(await page.locator('#list-signs .obj').count()==2,'reset demo')
            check(await page.locator('[data-top="name"]').input_value()=='小さな展示室の案内計画','reset project metadata')
            # XSS escaping through project field
            await page.locator('[data-kind="signs"][data-id="s1"][data-field="name"]').fill('<img src=x onerror=alert(1)>')
            await page.locator('[data-kind="signs"][data-id="s1"][data-field="name"]').press('Tab')
            check(await page.locator('img[src="x"]').count()==0,'untrusted label escaped')
            # Small viewport
            mobile=await browser.new_context(viewport={'width':390,'height':844},accept_downloads=True)
            mp=await mobile.new_page()
            await mp.goto('about:blank')
            await mp.evaluate("""() => { const bag={}; Object.defineProperty(window, 'localStorage', {configurable:true, value:{getItem:k=>bag[k]??null,setItem:(k,v)=>bag[k]=String(v),removeItem:k=>delete bag[k]}}); }""")
            await mp.set_content(html)
            await mp.wait_for_selector('#floor')
            check(await mp.locator('#summary .metric').count()==4,'mobile layout content')
            check(await mp.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 2'),'mobile no horizontal overflow')
            await mp.screenshot(path=str(ROOT/'mobile.png'),full_page=True)
            await mobile.close()
            check(not errors,'no uncaught page JavaScript errors')
            await context.close(); await browser.close()
    finally:
        pass
    print('BROWSER_TESTS',len(done),'PASSED');print('\n'.join(f'{i+1:02d}. {s}' for i,s in enumerate(done)))

if __name__=='__main__':asyncio.run(main())
