"""MAGARI PASS Chromium smoke tests. Run: python browser_test.py"""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).parent
counts=[]
def check(label,condition):
    assert condition,label
    counts.append(label)

def main():
    with sync_playwright() as sp:
        browser=sp.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
        context=browser.new_context(accept_downloads=True,viewport={'width':1440,'height':940})
        page=context.new_page()
        errors=[]
        page.on('pageerror',lambda e: errors.append(str(e)))
        address=(ROOT/'index.html').resolve().as_uri()
        mode='file://'
        try:
            page.goto(address,wait_until='load',timeout=7000)
            page.wait_for_selector('#comparison button',timeout=4000)
        except Exception:
            mode='inline fallback'
            try: page.close()
            except Exception: pass
            page=context.new_page()
            page.on('pageerror',lambda e: errors.append(str(e)))
            html=(ROOT/'index.html').read_text()
            css=(ROOT/'style.css').read_text()
            engine=(ROOT/'engine.js').read_text()
            app=(ROOT/'app.js').read_text()
            html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+css+'</style>')
            html=html.replace('<script src="engine.js"></script><script src="app.js"></script>','<script>'+engine+'</script><script>'+app+'</script>')
            page.set_content(html,wait_until='load')
            page.wait_for_selector('#comparison button')
        check('app title',page.title().startswith('曲がりPASS'))
        check('comparison has two options',page.locator('#comparison button').count()==2)
        check('normal found',page.locator('[data-mode="normal"] .option-status').inner_text()=='候補あり')
        check('side found',page.locator('[data-mode="side"] .option-status').inner_text()=='候補あり')
        check('svg plan rendered',page.locator('#diagram svg polygon').count()>=2)
        check('path route rendered',page.locator('#diagram svg polyline').count()==1)
        check('step slider exists',int(page.locator('#stepRange').get_attribute('max'))>1)
        check('pose shown', ' / ' in page.locator('#poseLabel').inner_text())
        check('item visible',page.locator('#moving-item polygon').count()==1)
        page.locator('#prevPose').click()
        check('previous moves pose',not page.locator('#nextPose').is_disabled())
        page.locator('#stepRange').fill('0')
        check('step0 display', '1 /' in page.locator('#poseLabel').inner_text())
        page.locator('[data-mode="side"]').click()
        check('side selection changes heading','横倒し' in page.locator('#diagramTitle').inner_text())
        check('side footprint width','91' in page.locator('[data-mode="side"] .option-number').inner_text())
        page.locator('[data-preset="fridge"]').click()
        check('fridge preset',page.locator('#itemLength').input_value()=='68')
        check('fridge height',page.locator('#itemHeight').input_value()=='175')
        page.locator('[data-preset="box"]').click()
        check('box preset',page.locator('#itemLength').input_value()=='90')
        page.locator('#hallWidth').fill('85')
        page.locator('#turnWidth').fill('85')
        page.locator('#calculate').click()
        check('calc rerendered',page.locator('#comparison button').count()==2)
        page.locator('#hallWidth').fill('1000')
        page.locator('#calculate').click()
        check('invalid validation visible','hallWidth' in page.locator('#feedback').inner_text())
        page.locator('#hallWidth').fill('150')
        page.locator('#turnWidth').fill('150')
        page.locator('#calculate').click()
        check('validation clears',page.locator('#feedback').inner_text()=='')
        page.locator('summary').click()
        page.locator('#obstacleEnabled').check()
        page.locator('#calculate').click()
        check('obstacle rendered',page.locator('#diagram svg rect[fill="#bc6e51"]').count()==1)
        page.locator('#obstacleEnabled').uncheck()
        page.locator('#calculate').click()
        check('obstacle cleared',page.locator('#diagram svg rect[fill="#bc6e51"]').count()==0)
        with page.expect_download() as d:page.locator('#exportJson').click()
        dl=d.value
        check('JSON download filename',dl.suggested_filename=='magari-pass-project.json')
        json_file=ROOT/'_test_export.json';dl.save_as(str(json_file))
        data=json.loads(json_file.read_text())
        check('JSON schema and data',data['app']=='magari-pass' and data['project']['itemLength']==90)
        page.locator('#itemLength').fill('120')
        page.locator('#calculate').click()
        page.locator('#importJson').set_input_files(str(json_file))
        page.wait_for_function("document.getElementById('itemLength').value === '90' || document.getElementById('feedback').textContent.includes('失敗')",timeout=4000)
        check('JSON restored value',page.locator('#itemLength').input_value()=='90')
        with page.expect_download() as d:page.locator('#downloadSvg').click()
        svg=d.value
        check('SVG download filename',svg.suggested_filename=='magari-pass-route.svg')
        svg_file=ROOT/'_test_export.svg';svg.save_as(str(svg_file))
        check('SVG export valid tag','<svg' in svg_file.read_text())
        if mode=='file://':
            page.reload(wait_until='load')
            check('real localStorage persists',page.locator('#itemLength').input_value()=='90')
        else:
            check('inline JS stayed usable',page.locator('#comparison button').count()==2)
        page.screenshot(path=str(ROOT/'desktop.png'),full_page=True)
        mobile=context.new_page();mobile.set_viewport_size({'width':390,'height':844})
        if mode=='file://':mobile.goto(address,wait_until='load')
        else:mobile.set_content(html,wait_until='load')
        mobile.screenshot(path=str(ROOT/'mobile.png'),full_page=True)
        check('mobile app mounted',mobile.locator('#comparison button').count()==2)
        check('mobile no body horizontal overflow',mobile.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 2'))
        check('no desktop JS exceptions',not errors)
        print(json.dumps({'browser_mode':mode,'count':len(counts),'passed':counts,'pageerrors':errors},ensure_ascii=False,indent=2))
        browser.close()
        for f in ROOT.glob('_test_export.*'):f.unlink()

if __name__=='__main__':main()