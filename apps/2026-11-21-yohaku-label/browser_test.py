"""Playwright browser verification: python browser_test.py"""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright

HERE=Path(__file__).resolve().parent
HTML=(HERE/'index.html').read_text(encoding='utf-8')
HTML=HTML.replace('<link rel="stylesheet" href="style.css">','<style>'+ (HERE/'style.css').read_text(encoding='utf-8') + '</style>')
for name in ['engine.js','app.js']:
    HTML=HTML.replace('<script src="'+name+'"></script>','<script>'+ (HERE/name).read_text(encoding='utf-8') + '</script>')
checks=[]
def check(name, condition):
    assert condition, name
    checks.append(name)

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    context=browser.new_context(accept_downloads=True,viewport={'width':1440,'height':1000},device_scale_factor=1)
    def route_request(route):
        from urllib.parse import urlparse
        path=urlparse(route.request.url).path.lstrip('/') or 'index.html'
        if path not in ('index.html','style.css','engine.js','app.js'):
            route.abort()
            return
        mime={'html':'text/html','css':'text/css','js':'application/javascript'}[path.split('.')[-1]]
        route.fulfill(status=200,body=(HERE/path).read_bytes(),content_type=mime)
    context.route('http://local.yohaku.test/**',route_request)
    page=context.new_page()
    errors=[]
    external=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:external.append(r.url) if r.url.startswith(('http:','https:')) and not r.url.startswith('http://local.yohaku.test/') else None)
    page.set_content(HTML,wait_until='load')
    check('page loads',page.title().startswith('余白ラベル'))
    check('first scenario 37 labels',page.locator('#statTotal').inner_text()=='37')
    check('first scenario 2 sheets',page.locator('#statSheets').inner_text()=='2')
    check('first scenario 8 unused cells',page.locator('#statUnused').inner_text()=='8')
    check('sheet has 24 cells in picker',page.locator('#slotPicker button').count()==24)
    check('skip 1-3 selected',page.locator('#slotPicker button.selected').count()==3)
    check('first SVG visible',page.locator('#svgWrap svg').count()==1)
    page.screenshot(path=str(HERE/'desktop.png'),full_page=True)
    page.locator('#nextPage').click()
    check('next page',page.locator('#pageInfo').inner_text().startswith('2 / 2'))
    page.locator('#prevPage').click()
    check('previous page',page.locator('#pageInfo').inner_text().startswith('1 / 2'))
    page.locator('#slotPicker button[data-slot="4"]').click()
    check('picker sets skipped slot',page.locator('#skip').input_value()=='1-4')
    page.locator('#slotPicker button[data-slot="4"]').click()
    check('picker restores skip',page.locator('#skip').input_value()=='1-3')
    page.locator('#mode').select_option('round')
    check('round mode accepted',page.locator('#mode').input_value()=='round')
    page.locator('#orientation').select_option('landscape')
    check('landscape works',page.locator('#svgWrap svg').get_attribute('width')=='297mm')
    page.locator('#orientation').select_option('portrait')
    page.locator('#mode').select_option('group')
    page.locator('#items .item-qty').first.fill('18')
    check('quantity edit recalculates',page.locator('#statTotal').inner_text()=='39')
    page.locator('#items .item-qty').first.fill('16')
    page.locator('#addItem').click()
    check('add item works',page.locator('.item-row').count()==4)
    page.locator('.item-row').last.locator('.item-delete').click()
    check('delete item works',page.locator('.item-row').count()==3)
    page.locator('#skip').fill('99')
    check('bad skip shows warning',not page.locator('#errors').is_hidden())
    check('bad skip disables print',page.locator('#printBtn').is_disabled())
    page.locator('#skip').fill('1-3')
    check('valid skip clears warning',page.locator('#errors').is_hidden())
    for element, expected in [('svgBtn','.svg'),('csvBtn','.csv'),('saveJson','.json')]:
        with page.expect_download() as dl:
            page.locator('#'+element).click()
        d=dl.value
        check(f'{element} downloaded',d.suggested_filename.endswith(expected))
        f=HERE/('test-'+d.suggested_filename)
        d.save_as(str(f))
        check(f'{element} has content',f.stat().st_size>50)
    check('CSV rows 37 + header',len((HERE/'test-yohaku-placement.csv').read_text(encoding='utf-8-sig').splitlines())==38)
    raw=(HERE/'test-yohaku-project.json').read_text(encoding='utf-8')
    check('JSON can be parsed',json.loads(raw)['items'][0]['qty']==16)
    page.locator('#items .item-name').first.fill('書き換えた名前')
    page.locator('#jsonFile').set_input_files(str(HERE/'test-yohaku-project.json'))
    page.wait_for_function("document.querySelector('#items .item-name').value==='青空のしおり'",timeout=3000)
    check('JSON import restores item',page.locator('#items .item-name').first.input_value()=='青空のしおり')
    page.evaluate('window.print=()=>window.__printCalled=true')
    page.locator('#printBtn').click()
    check('print invoked',page.evaluate('window.__printCalled===true'))
    check('all print sheets created',page.locator('#printArea .print-sheet').count()==2)
    check('no uncaught browser errors',len(errors)==0)
    check('no external network requests',len(external)==0)
    mobile=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1,accept_downloads=True)
    mobile.route('http://local.yohaku.test/**',route_request)
    mp=mobile.new_page();mp.set_content(HTML,wait_until='load')
    check('mobile app renders',mp.locator('#statSheets').inner_text()=='2')
    check('mobile no horizontal viewport overflow',mp.evaluate('document.documentElement.scrollWidth<=window.innerWidth'))
    mp.screenshot(path=str(HERE/'mobile.png'),full_page=True)
    print(f'PASS: {len(checks)}/{len(checks)} browser checks, no external requests')
    browser.close()
for f in HERE.glob('test-yohaku*'):f.unlink()
