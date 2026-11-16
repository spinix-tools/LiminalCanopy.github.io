import asyncio, json, pathlib
from playwright.async_api import async_playwright

BASE=pathlib.Path(__file__).resolve().parents[1]
HTML=(BASE/'index.html').read_text(encoding='utf-8')
STORAGE_MOCK="""() => {Object.defineProperty(window,'localStorage',{configurable:true,value:{v:{},getItem(k){return this.v[k]??null},setItem(k,v){this.v[k]=v},clear(){this.v={}},removeItem(k){delete this.v[k]}}})}"""
OUT=BASE

async def main():
    async with async_playwright() as p:
        browser=await p.chromium.launch(headless=True, executable_path='/usr/bin/chromium' if pathlib.Path('/usr/bin/chromium').exists() else None, args=['--no-sandbox'])
        context=await browser.new_context(accept_downloads=True, viewport={'width':1280,'height':900})
        page=await context.new_page()
        errors=[]; external=[]
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('request', lambda r: external.append(r.url) if r.url.startswith('http') else None)
        await page.evaluate(STORAGE_MOCK)
        await page.set_content(HTML)
        await page.wait_for_timeout(200)
        assert await page.locator('#stat-total').inner_text() == '0'
        assert await page.get_by_text('まだ、期限はありません').count()==1
        await page.locator('#demo-btn').click()
        assert await page.locator('#stat-total').inner_text() == '3'
        assert await page.locator('.item').count()==3
        # search and filtering
        await page.locator('#search').fill('イヤホン')
        assert await page.locator('.item').count()==1
        await page.locator('#search').fill('')
        # edit existing
        await page.locator('.item').first.get_by_text('編集',exact=True).click()
        assert await page.locator('#editor').is_visible()
        await page.locator('#item-title').fill('修正した期限')
        await page.locator('#item-lead').select_option('7')
        assert '7 日前' in await page.locator('#date-preview').inner_text()
        await page.locator('#record-form button[type=submit]').click()
        assert await page.get_by_text('修正した期限',exact=True).count()==1
        # add with HTML payload - must display as text only, no injected DOM
        await page.locator('#new-btn').click()
        await page.locator('#item-title').fill('<img src=x onerror=alert(1)>')
        await page.locator('#item-deadline').fill('2026-12-29')
        await page.locator('#item-memo').fill('<script>alert(2)</script>')
        await page.locator('#record-form button[type=submit]').click()
        assert await page.locator('#stat-total').inner_text() == '4'
        assert await page.locator('.item img').count()==0
        assert await page.locator('.item script').count()==0
        # toggling status and filtering
        await page.locator('.item').filter(has_text='<img src=x').get_by_text('手続き結果を確認した').click()
        await page.locator('[data-filter="done"]').click()
        assert await page.locator('.item').count()==1
        await page.locator('[data-filter="all"]').click()
        # exported json
        async with page.expect_download() as dl:
            await page.locator('#export-json').click()
        download=await dl.value
        saved=pathlib.Path(OUT)/'browser-export.json'; await download.save_as(str(saved))
        data=json.loads(saved.read_text()); assert len(data['records'])==4
        assert data['version']==1
        # export ics, test UTF8 folding and ending
        async with page.expect_download() as dl:
            await page.locator('#export-ics').click()
        d2=await dl.value
        ics=pathlib.Path(OUT)/'browser-calendar.ics'; await d2.save_as(str(ics))
        raw=ics.read_bytes(); assert raw.startswith(b'BEGIN:VCALENDAR\r\n'); assert raw.endswith(b'END:VCALENDAR\r\n')
        assert raw.count(b'BEGIN:VEVENT')==3
        assert all(len(line)<=75 for line in raw.split(b'\r\n'))
        # reload-like reinitialization with mocked localStorage; no true disk persistence assertion
        await page.set_content(HTML);assert await page.locator('#stat-total').inner_text()=='4'
        # import overwrite with backup
        page.once('dialog',lambda dialog: asyncio.create_task(dialog.accept()))
        await page.locator('.item').first.get_by_text('削除',exact=True).click()
        assert await page.locator('#stat-total').inner_text()=='3'
        page.once('dialog',lambda dialog: asyncio.create_task(dialog.accept()))
        await page.locator('#import-file').set_input_files(str(saved))
        await page.wait_for_timeout(150)
        assert await page.locator('#stat-total').inner_text()=='4'
        # functional pure tests
        result=await page.evaluate('''() => {const T=MANIAU_TEST; return {leap:T.addDays('2028-03-01',-1), newyear:T.addDays('2026-01-01',-1), badDate:T.dateParts('2026-02-30'), now:T.status({done:false,deadline:'2026-11-20',lead:4},'2026-11-16'), past:T.status({done:false,deadline:'2026-11-01',lead:0},'2026-11-16'), importFail:(()=>{try{T.parseImport({version:1,records:[{title:'oops'}]});return false;}catch(e){return true;}})()}}''')
        assert result=={'leap':'2028-02-29','newyear':'2025-12-31','badDate':None,'now':'now','past':'past','importFail':True}, result
        await page.screenshot(path=str(pathlib.Path(OUT)/'desktop.png'),full_page=True)
        mobile=await browser.new_context(viewport={'width':390,'height':844}, device_scale_factor=1, is_mobile=True,has_touch=True)
        mp=await mobile.new_page();await mp.evaluate(STORAGE_MOCK);await mp.set_content(HTML)
        await mp.screenshot(path=str(pathlib.Path(OUT)/'mobile.png'),full_page=True)
        metrics=await mp.evaluate('''() => ({width:document.documentElement.scrollWidth, viewport:window.innerWidth, h1:getComputedStyle(document.querySelector('h1')).fontSize})''')
        assert metrics['width']<=metrics['viewport']+1,metrics
        assert not errors,errors
        assert not external,external
        print('PASS: empty/sample/search/edit/add/XSS/complete/JSON export/ICS export/mocked state persistence/delete/import/date arithmetic/mobile/no external requests')
        print('MOBILE:',metrics)
        print('FILES:',str(saved),str(ics))
        await browser.close()

asyncio.run(main())