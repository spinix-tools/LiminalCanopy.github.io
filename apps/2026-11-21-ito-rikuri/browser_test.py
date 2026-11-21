"""ITO RIKURI browser smoke / interaction suite. Run: python browser_test.py"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json
import re

ROOT=Path(__file__).resolve().parent
RESULTS=[]
def check(label,ok):
    assert ok,label
    RESULTS.append(label)

def main():
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
        context=browser.new_context(viewport={"width":1440,"height":1000},accept_downloads=True)
        page=context.new_page()
        errors=[]
        requests=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('request',lambda r:requests.append(r.url) if r.url.startswith('https://') else None)
        launch='file'
        try:
            page.goto((ROOT/'index.html').as_uri(),wait_until='load',timeout=10000)
            page.wait_for_selector('#chart svg',timeout=6000)
        except Exception as e:
            launch='inline fallback'
            html=(ROOT/'index.html').read_text()
            html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+(ROOT/'style.css').read_text()+'</style>')
            html=html.replace('<script defer src="engine.js"></script>','')
            html=html.replace('<script defer src="app.js"></script>','')
            html=html.replace('</body>','<script>'+(ROOT/'engine.js').read_text()+'</script><script>'+(ROOT/'app.js').read_text()+'</script></body>')
            page=context.new_page()
            page.on('pageerror',lambda e:errors.append(str(e)))
            page.set_content(html,wait_until='load')
            page.wait_for_selector('#chart svg',timeout=6000)
        print('launch mode:',launch)
        check('initial title','糸りくり' in page.title())
        check('SVG grid exists',page.locator('#chart svg').count()==1)
        check('6 colors visible',page.locator('.swatch').count()==6)
        check('stock row count',page.locator('.stash-row').count()==6)
        check('initial stitches positive',int(page.locator('#total-stitches').inner_text().replace(',',''))>0)
        check('shortage visible',int(page.locator('#total-missing').inner_text())>=1)
        check('color suggestions present',page.locator('.swap-item').count()>=1)
        check('offline label','端末内で完結' in page.locator('.offline').inner_text())
        check('defaults 28x22','28 × 22' in page.locator('#canvas-summary').inner_text())
        page.screenshot(path=str(ROOT/'desktop.png'),full_page=True)
        # Palette selection
        page.locator('.swatch').nth(2).click()
        check('selection updated',page.locator('.swatch.selected').count()==1 and '若葉' in page.locator('.swatch.selected').inner_text())
        # Drawing gesture on a corner (empty at 0,0)
        def cell_click(x,y):
            page.locator('#chart svg').scroll_into_view_if_needed()
            box=page.locator('#chart svg').bounding_box()
            page.mouse.click(box['x']+(x+.5)*box['width']/28,box['y']+(y+.5)*box['height']/22)
        pre=int(page.locator('#total-stitches').inner_text().replace(',',''))
        cell_click(0,0)
        check('drawing adds a stitch',int(page.locator('#total-stitches').inner_text().replace(',',''))==pre+1)
        page.locator('#undo').click()
        check('undo stroke',int(page.locator('#total-stitches').inner_text().replace(',',''))==pre)
        page.locator('#redo').click()
        check('redo stroke',int(page.locator('#total-stitches').inner_text().replace(',',''))==pre+1)
        # Eraser
        page.locator('#tool-erase').click()
        check('eraser selected',page.locator('#tool-erase').get_attribute('aria-pressed')=='true')
        cell_click(0,0)
        check('eraser removes stitch',int(page.locator('#total-stitches').inner_text().replace(',',''))==pre)
        # Flood fill: corner to background all at once
        page.locator('#tool-fill').click()
        cell_click(0,0)
        check('bucket fills empty region',int(page.locator('#total-stitches').inner_text().replace(',',''))>pre+3)
        page.locator('#undo').click()
        check('undo bucket fill',int(page.locator('#total-stitches').inner_text().replace(',',''))==pre)
        # Change stock, validate shortage
        input0=page.locator('.stock-input').first
        input0.fill('0')
        input0.press('Tab')
        check('stock editable',page.locator('.stock-input').first.input_value()=='0')
        check('shortage recalculated',int(page.locator('#total-missing').inner_text())>=2)
        # Name edit
        name=page.locator('.stash-nameinput').first
        name.fill('新しい色名');name.press('Tab')
        check('color label editing',page.locator('.stash-nameinput').first.input_value()=='新しい色名')
        page.locator('#add-color').click()
        check('add color',page.locator('.swatch').count()==7)
        page.locator('.mini-remove').last.click()
        check('remove unused color',page.locator('.swatch').count()==6)
        # Settings resize
        page.locator('details.options summary').click()
        page.locator('#set-width').fill('16')
        page.locator('#set-height').fill('12')
        page.locator('#set-count').select_option('16')
        page.locator('#set-waste').fill('65')
        page.locator('#apply-settings').click()
        check('resize applied','16 × 12' in page.locator('#canvas-summary').inner_text())
        check('count applied','16ct' in page.locator('#size-preview').inner_text())
        check('viewbox fits',page.locator('#chart svg').get_attribute('viewBox')=='0 0 352 264')
        # Download coverage
        with page.expect_download() as dl:page.locator('#save-json').click()
        d=dl.value
        payload=json.loads(Path(d.path()).read_text())
        check('JSON export complete',payload['width']==16 and payload['height']==12)
        with page.expect_download() as dl:page.locator('#save-svg').click()
        check('SVG exported','<svg' in Path(dl.value.path()).read_text())
        with page.expect_download() as dl:page.locator('#save-csv').click()
        check('CSV exported',Path(dl.value.path()).read_bytes().startswith(b'\xef\xbb\xbf'))
        # JSON round trip after setting change
        page.locator('#set-width').fill('20')
        page.locator('#apply-settings').click()
        check('second resize done','20 × 12' in page.locator('#canvas-summary').inner_text())
        page.locator('#load-json').set_input_files({"name":"test.json","mimeType":"application/json","buffer":json.dumps(payload,ensure_ascii=False).encode()})
        check('JSON restores original grid','16 × 12' in page.locator('#canvas-summary').inner_text())
        # malicious JSON rejected / keep state
        page.locator('#load-json').set_input_files({"name":"evil.json","mimeType":"application/json","buffer":b'{"not":"a project"}'})
        check('malformed import rejected','16 × 12' in page.locator('#canvas-summary').inner_text())
        # Browser localStorage data and no exceptions
        if launch=='file':
            check('localStorage persist',page.evaluate('localStorage.getItem("ito-rikuri-v1") !== null'))
            page.reload()
            check('persistent after reload','16 × 12' in page.locator('#canvas-summary').inner_text())
        check('no JavaScript exceptions',len(errors)==0)
        check('no outgoing HTTPS',len(requests)==0)
        page.screenshot(path=str(ROOT/'desktop-tested.png'),full_page=True)
        mobile=browser.new_context(viewport={"width":390,"height":844},is_mobile=True,has_touch=True,device_scale_factor=1)
        m=mobile.new_page();m.on('pageerror',lambda e:errors.append(str(e)))
        if launch=='file':m.goto((ROOT/'index.html').as_uri(),wait_until='load')
        else:m.set_content(html,wait_until='load')
        m.wait_for_selector('#chart svg')
        check('mobile editor visible',m.locator('#chart svg').is_visible())
        check('mobile single column',m.locator('.editor-panel').bounding_box()['width']>300)
        check('mobile zero horizontal overflow',m.evaluate('document.documentElement.scrollWidth <= window.innerWidth+2'))
        m.screenshot(path=str(ROOT/'mobile.png'),full_page=True)
        browser.close()
    print(f'Chromium browser checks: {len(RESULTS)}/{len(RESULTS)} passed')
    for i,x in enumerate(RESULTS,1):print(f' {i:02d} ✓ {x}')

if __name__=='__main__':main()
