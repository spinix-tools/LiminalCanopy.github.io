"""End-to-end Chromium checks for BANZURE LAB using local file:// source."""
import asyncio
from pathlib import Path
from PIL import Image
from playwright.async_api import async_playwright

ROOT = Path(__file__).parent
async def run():
    image = ROOT / '_test_input.png'
    Image.new('RGBA',(80,120),(15,130,190,255)).save(image)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        ctx = await browser.new_context(accept_downloads=True, viewport={'width':1420,'height':940}, device_scale_factor=1)
        page = await ctx.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        html=(ROOT/'index.html').read_text().replace('<script src="engine.js"></script>','<script>'+(ROOT/'engine.js').read_text()+'</script>')
        await page.set_content(html)
        await page.wait_for_function("document.querySelector('#status').textContent.includes('処理完了')", timeout=45000)
        assert await page.locator('#statA').inner_text() != '—'
        assert await page.locator('#statB').inner_text() != '—'
        assert await page.locator('#previewCanvas').evaluate('(el)=>el.width')==600
        await page.screenshot(path=str(ROOT/'desktop.png'), full_page=True)
        count=4
        await page.locator('#inkB').select_option('teal')
        await page.wait_for_function("document.querySelector('#status').textContent.includes('処理完了')")
        assert await page.locator('#swB').evaluate('(el)=>el.style.background')
        count+=1
        await page.locator('#contrast').fill('130')
        await page.wait_for_timeout(700)
        assert await page.locator('#contrastOut').inner_text()=='130%'
        count+=1
        await page.locator('#shiftX').fill('8')
        assert await page.locator('#shiftXOut').inner_text()=='8 px'
        count+=1
        await page.locator('[data-mode="b"]').click()
        assert await page.locator('[data-mode="b"]').get_attribute('aria-pressed')=='true'
        count+=1
        await page.locator('#resetShift').click()
        assert await page.locator('#shiftXOut').inner_text()=='0 px'
        count+=1
        for selector, suffix in [('#saveA','plate-1.png'),('#saveB','plate-2.png'),('#saveComposite','b.png')]:
            async with page.expect_download(timeout=30000) as d:
                await page.locator(selector).click()
            dl=await d.value
            assert dl.suggested_filename.endswith(suffix),dl.suggested_filename
            await dl.save_as(str(ROOT/('_test_'+suffix)))
            count+=1
        async with page.expect_download(timeout=30000) as d:
            await page.locator('#saveProject').click()
        project=await d.value
        path=ROOT/'_test_project.json';await project.save_as(str(path))
        assert path.stat().st_size>1000
        count+=1
        await page.locator('#imageFile').set_input_files(str(image))
        await page.wait_for_function("document.querySelector('#status').textContent.includes('処理完了')")
        assert await page.locator('#originalCanvas').evaluate('(el)=>el.width')==80
        count+=1
        await page.locator('#projectFile').set_input_files(str(path))
        await page.wait_for_function("document.querySelector('#status').textContent.includes('処理完了') && document.querySelector('#originalCanvas').width===600")
        count+=1
        await page.locator('#resolution').select_option('1200')
        await page.wait_for_function("document.querySelector('#status').textContent.includes('処理完了') && document.querySelector('#originalCanvas').width===600")
        count+=1
        assert not errors,errors
        count+=1
        mobile=await browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1)
        mp=await mobile.new_page()
        await mp.set_content(html)
        await mp.wait_for_function("document.querySelector('#status').textContent.includes('処理完了')", timeout=45000)
        await mp.screenshot(path=str(ROOT/'mobile.png'),full_page=True)
        assert await mp.evaluate('document.documentElement.scrollWidth<=window.innerWidth+1')
        count+=1
        await browser.close()
    image.unlink(missing_ok=True)
    for x in ROOT.glob('_test_*'):
        if x.is_file(): x.unlink()
    print(f'BROWSER_OK {count} checks; screenshots desktop.png mobile.png')

if __name__ == '__main__': asyncio.run(run())
