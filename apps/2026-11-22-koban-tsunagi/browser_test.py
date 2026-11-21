"""Actual Chromium end-to-end smoke/regression tests. Run: python browser_test.py"""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent
# This managed Chromium blocks file:// and localhost navigation. Test exact sources inline.
HTML=(ROOT/'index.html').read_text(encoding='utf-8')
HTML=HTML.replace('<link rel="stylesheet" href="style.css">','<style>'+ (ROOT/'style.css').read_text(encoding='utf-8')+'</style>')
HTML=HTML.replace('<script src="engine.js"></script>','<script>'+(ROOT/'engine.js').read_text(encoding='utf-8')+'</script>')
HTML=HTML.replace('<script src="app.js"></script>','<script>'+(ROOT/'app.js').read_text(encoding='utf-8')+'</script>')
MOCK_STORAGE="""() => {const store={};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:(key)=>store[key]??null,setItem:(key,val)=>{store[key]=String(val)},removeItem:(key)=>{delete store[key]}}});}"""
checks=[]
def check(desc, condition):
    if not condition: raise AssertionError(desc)
    checks.append(desc)

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
    ctx=browser.new_context(viewport={'width':1440,'height':940},accept_downloads=True)
    page=ctx.new_page(); exceptions=[]; outbound=[]
    page.on('pageerror',lambda e:exceptions.append(str(e)))
    page.on('request',lambda r:outbound.append(r.url) if r.url.startswith('http') else None)
    page.evaluate(MOCK_STORAGE)
    page.set_content(HTML,wait_until='load')
    check('Japanese heading rendered',page.locator('h1').inner_text().startswith('この順番で'))
    check('actor sample rendered',page.locator('.actor-row').count()==3)
    check('scene sample rendered',page.locator('.scene-card').count()==6)
    check('timeline blocks populated',page.locator('.block-row').count()>6)
    check('metrics finish computed',':' in page.locator('#metric-end').inner_text())
    check('no external network',outbound==[])
    check('app stylesheet loaded',page.locator('.metrics article').first.evaluate('(el)=>getComputedStyle(el).borderRadius')!='0px')
    page.screenshot(path=str(ROOT/'desktop.png'),full_page=True)
    # change a scene duration and ensure redraw
    page.locator('.scene-card [data-scene-key=duration]').first.fill('95')
    page.locator('.scene-card [data-scene-key=duration]').first.dispatch_event('change')
    check('duration edit saved',page.locator('.scene-card [data-scene-key=duration]').first.input_value()=='95')
    check('duration changed engine project',page.evaluate("JSON.parse(localStorage.getItem('koban-tsunagi-v1')).scenes[0].duration")==95)
    # manual scene move
    original=page.locator('.scene-card [data-scene-key=title]').first.input_value()
    page.locator('.scene-card [data-action=down]').first.click()
    check('move down reorders scenes',page.locator('.scene-card [data-scene-key=title]').nth(1).input_value()==original)
    page.locator('.scene-card [data-action=up]').nth(1).click()
    check('move up restores scenes',page.locator('.scene-card [data-scene-key=title]').first.input_value()==original)
    page.locator('#add-scene').click()
    check('new scene works',page.locator('.scene-card').count()==7)
    page.locator('.scene-card [data-action=remove-scene]').last.click()
    check('remove scene works',page.locator('.scene-card').count()==6)
    page.locator('#add-actor').click()
    check('new actor works',page.locator('.actor-row').count()==4)
    page.locator('.actor-row [data-action=remove-actor]').last.click()
    check('remove actor works',page.locator('.actor-row').count()==3)
    # settings edit updates timeline
    page.locator('#setting-moveMinutes').fill('45')
    page.locator('#setting-moveMinutes').dispatch_event('change')
    check('setting persisted',page.evaluate("JSON.parse(localStorage.getItem('koban-tsunagi-v1')).settings.moveMinutes")==45)
    check('travel block updated',page.locator('.block-row').filter(has_text='移動').first.inner_text().find('45分')>=0)
    # cast checkbox edit
    role=page.locator('.scene-card [data-cast]').first
    role.check()
    check('cast selection recorded',len(page.evaluate("JSON.parse(localStorage.getItem('koban-tsunagi-v1')).scenes[0].cast"))>0)
    role=page.locator('.scene-card [data-cast]').first
    role.uncheck()
    check('cast selection removed',len(page.evaluate("JSON.parse(localStorage.getItem('koban-tsunagi-v1')).scenes[0].cast"))==0)
    # optimize and undo (may not improve sample; create deliberately suboptimal location order)
    page.locator('#setting-moveMinutes').fill('55')
    page.locator('#setting-moveMinutes').dispatch_event('change')
    page.locator('#optimize').click()
    check('optimizer produces comparison',page.locator('#comparison').is_visible())
    check('comparison includes explored count','評価' in page.locator('#comparison').inner_text())
    if page.locator('#undo').is_enabled():
        before=page.evaluate("JSON.parse(localStorage.getItem('koban-tsunagi-v1')).scenes.map(x=>x.id).join(',')")
        page.locator('#undo').click()
        after=page.evaluate("JSON.parse(localStorage.getItem('koban-tsunagi-v1')).scenes.map(x=>x.id).join(',')")
        check('undo restored alternative order',after!=before)
    # JSON export and schema
    with page.expect_download() as dl: page.locator('#export-json').click()
    download=dl.value
    check('JSON download filename',download.suggested_filename=='koban-tsunagi-project.json')
    output=json.loads(Path(download.path()).read_text(encoding='utf-8'))
    check('JSON export contains scenes',len(output['scenes'])==6)
    with page.expect_download() as dl: page.locator('#export-csv').click()
    d=dl.value
    check('CSV download filename',d.suggested_filename.endswith('.csv'))
    csv=Path(d.path()).read_text(encoding='utf-8-sig')
    check('CSV has Japanese header','種類,内容' not in csv and '種類' in csv and '開始' in csv)
    # JSON import
    output['title']='読み込みテスト'
    import_file=ROOT/'_test_import.json';import_file.write_text(json.dumps(output,ensure_ascii=False),encoding='utf-8')
    page.locator('#import-file').set_input_files(str(import_file))
    page.wait_for_function("document.querySelector('#project-title').value === '読み込みテスト'")
    check('JSON import replaces title',page.locator('#project-title').input_value()=='読み込みテスト')
    import_file.unlink()
    # check xss escaped DOM
    page.locator('#project-title').fill('<script>window.bad=true</script>')
    page.locator('#project-title').dispatch_event('change')
    page.locator('.scene-card [data-scene-key=title]').first.fill('<img src=x onerror=alert(1)>')
    page.locator('.scene-card [data-scene-key=title]').first.dispatch_event('change')
    check('scene title is treated as text',page.locator('.block-row img').count()==0)
    check('malicious script never executes',not page.evaluate('Boolean(window.bad)'))
    check('no JavaScript exceptions',not exceptions)
    check('no outbound HTTP requests',not outbound)
    # mobile
    mobile=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1,accept_downloads=True)
    mob=mobile.new_page();mob.evaluate(MOCK_STORAGE);mob.set_content(HTML,wait_until='load')
    check('mobile title visible',mob.locator('h1').is_visible())
    check('mobile controls usable',mob.locator('#optimize').is_visible())
    check('mobile no horizontal overflow',mob.evaluate('document.documentElement.scrollWidth <= window.innerWidth+2'))
    mob.screenshot(path=str(ROOT/'mobile.png'),full_page=True)
    print(f'PASS: {len(checks)} browser checks')
    for i,c in enumerate(checks,1):print(f' {i:02d}. {c}')
    browser.close()
