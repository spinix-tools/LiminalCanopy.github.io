"""Chromium smoke test. Under restricted navigation, inject exact source inline."""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

ROOT=Path(__file__).resolve().parent
html=(ROOT/'index.html').read_text(encoding='utf-8')
core=(ROOT/'engine.js').read_text(encoding='utf-8')
html=html.replace('<script src="engine.js"></script>','<script>\n'+core.replace('</script>','<\\/script>')+'\n</script>')
checks=[]
def check(value,desc):
    assert value,desc
    checks.append(desc)

async def main():
    async with async_playwright() as p:
        browser=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True, args=['--no-sandbox'])
        page=await browser.new_page(viewport={'width':1400,'height':920},device_scale_factor=1,accept_downloads=True)
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        await page.set_content(html,wait_until='load')
        check(await page.title() == '異本しおり — 本文を混ぜずに校異を確かめる','title loads')
        check(await page.locator('#aText').input_value() != '','demo loaded')
        check(await page.locator('#results tr').count() >= 3,'diff rows displayed')
        check(int(await page.locator('#sVar').inner_text()) >= 3,'variant count')
        check(await page.locator('#results tr .kind.surface').count() >= 1,'surface difference')
        check(await page.locator('#results tr .kind.added').count() >= 1,'addition flagged')
        await page.locator('#filter').select_option('all')
        check(await page.locator('#results tr .kind.same').count() >= 1,'unchanged rows can be displayed')
        await page.locator('#filter').select_option('variants')
        first=page.locator('#results tr').first
        await first.locator('select').select_option('原資料を再確認')
        await first.locator('input').fill('原稿の綴りを原本画像で照合')
        check((await page.locator('#sReviewed').inner_text()).startswith('1/'),'review progress updates')
        async with page.expect_download() as info:
            await page.locator('#csvBtn').click()
        download=await info.value
        out=ROOT/'test-variants.csv'
        await download.save_as(out)
        csv=out.read_text(encoding='utf-8-sig')
        check('原稿の綴りを原本画像で照合' in csv,'CSV includes reviewer notes')
        check('原資料を再確認' in csv,'CSV preserves status')
        check('A行,B行' not in csv and '"A行"' in csv,'CSV headers quoted')
        async with page.expect_download() as info:
            await page.locator('#mdBtn').click()
        md_dl=await info.value
        await md_dl.save_as(ROOT/'test-notes.md')
        md=(ROOT/'test-notes.md').read_text(encoding='utf-8')
        check('原稿の綴りを原本画像で照合' in md,'Markdown contains note')
        check('架空短編' in md,'Markdown metadata preserved')
        async with page.expect_download() as info:
            await page.locator('#jsonBtn').click()
        json_dl=await info.value
        await json_dl.save_as(ROOT/'test-project.json')
        import json
        data=json.loads((ROOT/'test-project.json').read_text(encoding='utf-8'))
        check('textA' in data and len(data['notes']) >=1,'JSON project includes source and notes')
        await page.locator('#bText').fill('一行だけを置く。')
        await page.locator('#compareBtn').click()
        check(await page.locator('#sVar').inner_text() != '0','manual edits reanalyzed')
        await page.locator('#demoBtn').click()
        check('駅前の灯' in await page.locator('#bText').input_value(),'demo restore')
        await page.locator('#filter').select_option('surface')
        check(await page.locator('#results tr .kind.surface').count() >=1,'surface filter works')
        await page.locator('#filter').select_option('reviewed')
        check(await page.locator('#results tr').count()==1 and '表示条件' in await page.locator('#results').inner_text(),'empty filter state')
        await page.locator('#filter').select_option('variants')
        await page.screenshot(path=str(ROOT/'desktop.png'),full_page=True)
        mobile=await browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1)
        mobile.on('pageerror',lambda e:errors.append(str(e)))
        await mobile.set_content(html,wait_until='load')
        check(await mobile.locator('#sVar').inner_text() != '–','mobile application executes')
        check(await mobile.evaluate('document.documentElement.scrollWidth <= innerWidth+1'),'mobile page has no horizontal overflow')
        await mobile.screenshot(path=str(ROOT/'mobile.png'),full_page=True)
        check(not errors,'no JS page errors: '+str(errors))
        for f in ('test-variants.csv','test-notes.md','test-project.json'):(ROOT/f).unlink(missing_ok=True)
        print(f'Chromium PASS {len(checks)}/{len(checks)}')
        for x in checks: print('  PASS',x)
        await browser.close()

if __name__=='__main__': asyncio.run(main())
