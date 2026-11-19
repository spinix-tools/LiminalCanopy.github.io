"""Chromium E2E using the exact local source embedded in an about:blank page.
Admin policy blocks navigation to file:// and localhost. localStorage is simulated.
"""
import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright

HERE = Path(__file__).resolve().parent
def inline_html(saved=None):
    document=(HERE/'index.html').read_text(encoding='utf-8')
    document=document.replace('<link rel="stylesheet" href="style.css" />', '<style>'+ (HERE/'style.css').read_text(encoding='utf-8') + '</style>')
    store=json.dumps({'dengen-dandori-v1':saved} if saved else {},ensure_ascii=False)
    patch='''<script>window.__store=DATA_HERE;Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem(k){return window.__store[k]||null},setItem(k,v){window.__store[k]=String(v)},removeItem(k){delete window.__store[k]}}});</script>'''.replace('DATA_HERE',store.replace('</','<\\/'))
    document=document.replace('<script src="engine.js"></script>',patch+'<script>'+ (HERE/'engine.js').read_text(encoding='utf-8') + '</script>')
    document=document.replace('<script src="app.js"></script>', '<script>'+(HERE/'app.js').read_text(encoding='utf-8')+'</script>')
    return document

async def main():
    checks=[]
    def check(condition, label):
        assert condition, label
        checks.append(label)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        context = await browser.new_context(viewport={'width':1440,'height':1024}, accept_downloads=True)
        page = await context.new_page()
        errors=[]
        page.on('pageerror', lambda e: errors.append(str(e)))
        await page.set_content(inline_html(), wait_until='load')
        check(await page.title()=='電源段取り | DENGEN DANDORI','page-title')
        check(await page.locator('[data-load-row]').count()==6,'demo-has-six-loads')
        check(await page.locator('[data-report]').count()==2,'two-comparison-cards')
        check(await page.locator('#chart svg').count()==1,'svg-report-rendered')
        check(await page.locator('.summary-card.a').inner_text() != await page.locator('.summary-card.b').inner_text(),'scenarios-differ')
        check(not errors,'initial-render-console-clean')
        await page.screenshot(path=str(HERE/'desktop.png'), full_page=True)
        # Change station capacity, calculate again and verify persisted value.
        await page.locator('#A_capacity').fill('2400')
        await page.locator('#A_capacity').dispatch_event('change')
        check(await page.locator('#A_capacity').input_value()=='2400','station-edit')
        saved=await page.evaluate("window.__store['dengen-dandori-v1']")
        await page.set_content(inline_html(saved), wait_until='load')
        check(await page.locator('#A_capacity').input_value()=='2400','persistence-after-reload')
        # return demo, test scheduling and undo.
        await page.locator('#btnReset').click()
        before=await page.locator('[data-id="l2"][data-load-field="start"]').input_value()
        await page.locator('#btnOptimize').click()
        status=await page.locator('#status').inner_text()
        check('件の開始時刻を変更' in status, 'automatic-shifting-ran')
        check(await page.locator('#btnUndo').is_enabled(),'undo-available')
        after=await page.locator('[data-id="l2"][data-load-field="start"]').input_value()
        check(after!=before or await page.locator('[data-id="l3"][data-load-field="start"]').input_value()!='12:00','some-flexible-device-shifted')
        check(await page.locator('[data-id="l1"][data-load-field="start"]').input_value()=='09:00','fixed-device-unchanged')
        await page.locator('#btnUndo').click()
        check(await page.locator('[data-id="l2"][data-load-field="start"]').input_value()==before,'undo-restores-original-start')
        # Insert, edit, remove.
        await page.locator('#btnAdd').click()
        check(await page.locator('[data-load-row]').count()==7,'add-device')
        row=page.locator('[data-load-row]').last
        await row.locator('[data-load-field="name"]').fill('試験用充電器')
        await row.locator('[data-load-field="name"]').dispatch_event('change')
        check(await page.locator('[data-load-row]').last.locator('[data-load-field="name"]').input_value()=='試験用充電器','edit-device-name')
        await page.locator('[data-load-row]').last.locator('[data-remove]').click()
        check(await page.locator('[data-load-row]').count()==6,'remove-device')
        # Both scenario target switches.
        await page.locator('#target').select_option('B')
        check(await page.locator('#target').input_value()=='B','target-switch')
        # CSV, SVG and JSON exports validated from the actual downloadable bytes.
        async with page.expect_download() as info:
            await page.locator('#btnCSV').click()
        csv=await (await info.value).path()
        check(Path(csv).read_bytes().startswith(b'\xef\xbb\xbf'),'csv-bom')
        check('電気ケトル' in Path(csv).read_text(encoding='utf-8-sig'),'csv-has-loads')
        async with page.expect_download() as info:
            await page.locator('#btnSVG').click()
        svg=Path(await (await info.value).path()).read_text()
        check('<svg' in svg and '<polyline' in svg,'svg-download')
        async with page.expect_download() as info:
            await page.locator('#btnJSON').click()
        j=Path(await (await info.value).path()).read_text()
        plan=json.loads(j)
        check(plan['target']=='B' and len(plan['loads'])==6,'json-download')
        # Import JSON using file chooser and use safely escaped string.
        plan['loads'][0]['name']='<img src=x onerror=alert(1)>'
        target=HERE/'_fixture_import.json'
        target.write_text(json.dumps(plan, ensure_ascii=False), encoding='utf-8')
        await page.locator('#importFile').set_input_files(str(target))
        check((await page.locator('[data-load-row]').first.locator('[data-load-field="name"]').input_value()).startswith('<img'),'json-import')
        check(await page.locator('img').count()==0,'import-escapes-html')
        check(not errors,'no-browser-js-exception')
        target.unlink()
        # fresh mobile context, independent storage; check no viewport overflow except intentionally scrollable table.
        mobile=await browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True)
        m=await mobile.new_page()
        await m.set_content(inline_html(),wait_until='load')
        check(await m.locator('#chart svg').count()==1,'mobile-renders')
        pagewidth=await m.evaluate('document.documentElement.scrollWidth')
        check(pagewidth<=400, f'mobile-no-overflow-{pagewidth}')
        await m.screenshot(path=str(HERE/'mobile.png'), full_page=True)
        await mobile.close()
        await browser.close()
    print(f'PASS: {len(checks)}/{len(checks)} Chromium UI assertions (inlined local source; mocked storage)')
    for x in checks: print(' ✓',x)

if __name__=='__main__':
    asyncio.run(main())
