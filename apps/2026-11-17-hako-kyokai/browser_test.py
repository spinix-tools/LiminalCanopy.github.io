"""Offline UI smoke tests. Run: python browser_test.py (needs Playwright + Chromium)."""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parent
HTML=(ROOT/'index.html').read_text().replace('<script src="engine.js"></script>','').replace('<script src="app.js"></script>','')
ENGINE=(ROOT/'engine.js').read_text()
APP=(ROOT/'app.js').read_text()
async def mount(page):
    # Admin policy blocks file:// and localhost navigation; load the actual files into about:blank.
    await page.set_content(HTML,wait_until='load')
    await page.evaluate("""() => {
      window.__savedData = window.__savedData || {};
      Object.defineProperty(window,'localStorage',{configurable:true,value:{
        getItem:k=>Object.prototype.hasOwnProperty.call(window.__savedData,k)?window.__savedData[k]:null,
        setItem:(k,v)=>{window.__savedData[k]=String(v)},
        removeItem:k=>{delete window.__savedData[k]}
      }});
    }""")
    await page.add_script_tag(content=ENGINE)
    await page.add_script_tag(content=APP)


async def run():
    passed=[]
    async with async_playwright() as p:
        browser=await p.chromium.launch(headless=True, executable_path='/usr/bin/chromium',args=['--no-sandbox'])
        ctx=await browser.new_context(viewport={'width':1440,'height':920},accept_downloads=True)
        page=await ctx.new_page()
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        await mount(page)
        await page.locator('#planList button').first.wait_for()
        assert await page.locator('#itemList .item').count()==3;passed.append('商品サンプル3種')
        assert await page.locator('#boxList .item').count()==3;passed.append('箱サンプル3種')
        assert await page.locator('#heroBoxCount').inner_text()=='3 種類';passed.append('候補箱件数')
        assert await page.locator('#planList button').count()==3;passed.append('3候補の計算')
        assert 'mm' in await page.locator('#drawingCaption').inner_text();passed.append('寸法図')
        assert await page.locator('#drawing svg polygon').count()>1;passed.append('配置SVG生成')
        assert await page.locator('#stepBody tr').count()>=1;passed.append('配置一覧')
        assert await page.locator('#metricSize').inner_text()!='—';passed.append('外寸計算')
        await page.screenshot(path=str(ROOT/'desktop.png'),full_page=True);passed.append('デスクトップ画像')
        # edit item via UI
        await page.locator('#itemList button[data-action="edit"]').first.click()
        assert await page.locator('#itemSubmit').inner_text()=='変更を保存';passed.append('編集フォーム表示')
        await page.locator('#itemForm input[name="name"]').fill('改良陶器箱')
        await page.locator('#itemSubmit').click()
        assert '改良陶器箱' in await page.locator('#itemList').inner_text();passed.append('商品編集保存')
        await page.locator('#itemForm input[name="name"]').fill('試験用ケース')
        await page.locator('#itemForm input[name="l"]').fill('40')
        await page.locator('#itemForm input[name="w"]').fill('40')
        await page.locator('#itemForm input[name="h"]').fill('40')
        await page.locator('#itemForm input[name="qty"]').fill('1')
        await page.locator('#itemForm input[name="weight"]').fill('50')
        await page.locator('#itemSubmit').click()
        assert await page.locator('#itemList .item').count()==4;passed.append('商品追加')
        await page.locator('#itemList button[data-action="delete"]').last.click()
        assert await page.locator('#itemList .item').count()==3;passed.append('商品削除')
        await page.locator('#boxForm input[name="name"]').fill('新しい箱')
        await page.locator('#boxSubmit').click()
        assert await page.locator('#boxList .item').count()==4;passed.append('箱追加')
        await page.locator('#boxList button[data-action="edit"]').last.click()
        await page.locator('#boxForm input[name="wall"]').fill('9')
        await page.locator('#boxSubmit').click()
        assert '厚 9 mm' in await page.locator('#boxList').inner_text();passed.append('箱編集')
        await page.locator('#boxList button[data-action="delete"]').last.click()
        assert await page.locator('#boxList .item').count()==3;passed.append('箱削除')
        await page.locator('#padding').fill('12')
        assert await page.locator('#paddingLabel').inner_text()=='12 mm';passed.append('余白変更')
        await page.locator('#planList button').last.click()
        assert await page.locator('#planList button.active').count()==1;passed.append('候補選択')
        await mount(page)
        assert await page.locator('#paddingLabel').inner_text()=='12 mm';passed.append('再読込後の保存')
        assert '改良陶器箱' in await page.locator('#itemList').inner_text();passed.append('再読込後の編集')
        async with page.expect_download() as d:
            await page.locator('#downloadBackup').click()
        backup=await d.value
        assert backup.suggested_filename=='hako-kyokai-backup.json';passed.append('JSONバックアップ')
        saved=ROOT/'test-backup.json';await backup.save_as(str(saved))
        async with page.expect_download() as d:
            await page.locator('#csvExport').click()
        csv=await d.value
        assert csv.suggested_filename.endswith('.csv');passed.append('配置CSV出力')
        await page.locator('#restoreFile').set_input_files(str(saved))
        assert '改良陶器箱' in await page.locator('#itemList').inner_text();passed.append('JSON復元')
        page.on('dialog', lambda dialog: asyncio.create_task(dialog.accept()))
        await page.locator('#reset').click()
        assert '陶器の小箱' in await page.locator('#itemList').inner_text();passed.append('サンプルに戻す')
        mobile=await browser.new_context(viewport={'width':390,'height':844},is_mobile=True,device_scale_factor=1)
        pm=await mobile.new_page();await mount(pm)
        await pm.locator('#planList button').first.wait_for()
        assert await pm.locator('body').evaluate('(e)=>e.scrollWidth <= innerWidth+1');passed.append('モバイル横はみ出しなし')
        await pm.screenshot(path=str(ROOT/'mobile.png'),full_page=True);passed.append('モバイル画像')
        assert not errors,errors
        passed.append('JS実行エラーなし')
        await browser.close()
    print(f'PASS {len(passed)} UI checks: '+', '.join(passed))
    return passed
if __name__=='__main__':asyncio.run(run())