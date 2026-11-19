"""Playwright smoke/regression test for the exact local HTML/CSS/JS files."""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

BASE=Path(__file__).parent.resolve()
async def run():
    checks=0
    async with async_playwright() as p:
        browser=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
        context=await browser.new_context(accept_downloads=True, viewport={'width':1440,'height':1000})
        page=await context.new_page()
        errors=[]
        page.on('pageerror',lambda exc: errors.append(str(exc)))
        # This runner blocks file:// and localhost navigation; execute the same
        # unmodified source files inline, with a minimal in-memory storage stub.
        await page.goto('about:blank')
        await page.evaluate("""() => {
          const store = {};
          Object.defineProperty(window, 'localStorage', {configurable:true,value:{
            getItem:k=>store[k] ?? null, setItem:(k,v)=>{store[k]=String(v)},
            removeItem:k=>delete store[k], clear:()=>Object.keys(store).forEach(k=>delete store[k])
          }});
        }""")
        markup=(BASE/'index.html').read_text(encoding='utf-8')
        markup=markup.replace('<link rel="stylesheet" href="style.css">', '<style>'+ (BASE/'style.css').read_text() + '</style>')
        markup=markup.replace('<script src="engine.js" defer></script>','')
        markup=markup.replace('<script src="app.js" defer></script>','')
        markup=markup.replace('</body>', '<script>' + (BASE/'engine.js').read_text() + '</script><script>' + (BASE/'app.js').read_text() + '</script></body>')
        await page.set_content(markup,wait_until='load')
        assert await page.title()=='おりまえ | コピー本の印刷前チェック'; checks+=1
        assert await page.locator('#mPages').inner_text()=='16';checks+=1
        assert await page.locator('#mSheets').inner_text()=='4';checks+=1
        assert '2' in await page.locator('#mBlank').inner_text();checks+=1
        assert await page.locator('.sheet-item').count()==4;checks+=1
        await page.locator('[data-sheet="2"]').click()
        assert await page.locator('#detailTitle').inner_text()=='02 / 枚目';checks+=1
        await page.locator('#verified').check()
        assert '1/4' in await page.locator('#verifyCount').inner_text();checks+=1
        await page.locator('#pages').fill('8')
        assert await page.locator('#mPages').inner_text()=='8';checks+=1
        assert await page.locator('.sheet-item').count()==2;checks+=1
        assert '0/2' in await page.locator('#verifyCount').inner_text();checks+=1
        assert await page.locator('#previewFront .page-tile strong').all_inner_texts()==['3','6'];checks+=1
        await page.locator('#binding').select_option('left')
        assert await page.locator('#previewFront .page-tile strong').all_inner_texts()==['6','3'];checks+=1
        await page.locator('#copies').fill('10')
        await page.locator('#testSheets').fill('2')
        await page.locator('#paperPerSheet').fill('3')
        await page.locator('#inkPerSide').fill('8')
        assert await page.locator('#mPhysical').inner_text()=='22';checks+=1
        assert await page.locator('#mCost').inner_text()=='418';checks+=1
        async with page.expect_download() as dl:
            await page.locator('#downloadCSV').click()
        file=await dl.value
        assert file.suggested_filename=='orimae-imposition-8p.csv';checks+=1
        await file.save_as(str(BASE/'test-export.csv'))
        data=(BASE/'test-export.csv').read_text(encoding='utf-8-sig')
        assert '1,front,8,1,no,no' in data;checks+=1
        async with page.expect_download() as dl:
            await page.locator('#downloadAll').click()
        file=await dl.value
        await file.save_as(str(BASE/'test-dummy.html'))
        dummy=(BASE/'test-dummy.html').read_text()
        assert dummy.count('<article class="sheet')==4;checks+=1
        assert '@page { size: 297mm 210mm;' in dummy;checks+=1
        await page.locator('#backRotate').check()
        async with page.expect_download() as dl:await page.locator('#downloadBack').click()
        file=await dl.value
        await file.save_as(str(BASE/'test-backs.html'))
        assert (BASE/'test-backs.html').read_text().count('class="sheet rotated"')==2;checks+=1
        # Recreating the document keeps the simulated browser storage.
        await page.set_content(markup,wait_until='load')
        assert await page.locator('#pages').input_value()=='8';checks+=1
        assert await page.locator('#copies').input_value()=='10';checks+=1
        assert await page.locator('#backRotate').is_checked();checks+=1
        await page.set_viewport_size({'width':390,'height':844})
        await page.screenshot(path=str(BASE/'mobile.png'),full_page=True)
        width=await page.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1')
        assert width, f'Mobile overflow {await page.evaluate("document.documentElement.scrollWidth")}';checks+=1
        assert not errors, errors;checks+=1
        await page.set_viewport_size({'width':1440,'height':1000})
        await page.evaluate('window.scrollTo(0,0)')
        await page.screenshot(path=str(BASE/'desktop.png'),full_page=True)
        # test saved printable document is parseable and has correct number of print sheets
        await page.set_content(dummy)
        assert await page.locator('article.sheet').count()==4;checks+=1
        await browser.close()
        for pth in ('test-export.csv','test-dummy.html','test-backs.html'):
            (BASE/pth).unlink(missing_ok=True)
    print(f'PASS browser assertions {checks}/{checks}')

if __name__=='__main__':asyncio.run(run())
