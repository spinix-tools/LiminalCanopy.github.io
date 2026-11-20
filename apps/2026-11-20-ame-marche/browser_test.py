#!/usr/bin/env python3
"""Offline Chromium smoke/integration tests. Run: python browser_test.py"""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
# Restricted Chromium environment blocks all URL navigation. Inline EXACT local
# script/style contents into the HTML and mock localStorage only for integration.
html = (ROOT/'index.html').read_text(encoding='utf8')
html = html.replace('<link rel="stylesheet" href="style.css">', '<style>'+(ROOT/'style.css').read_text(encoding='utf8')+'</style>')
for name in ('engine.js', 'app.js'):
    html = html.replace(f'<script src="{name}"></script>', '<script>'+(ROOT/name).read_text(encoding='utf8')+'</script>')
checks = []
def ok(name, truth):
    if not truth: raise AssertionError(name)
    checks.append(name)
    print('PASS', name)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox','--allow-file-access-from-files'])
    page = browser.new_page(viewport={'width':1365,'height':900}, device_scale_factor=1, accept_downloads=True)
    errors = []
    page.on('pageerror',lambda err:errors.append(str(err)))
    page.evaluate("""() => { const memory = {}; Object.defineProperty(window, 'localStorage', {configurable:true, value:{getItem:k=>memory[k]||null, setItem:(k,v)=>{memory[k]=v},removeItem:k=>delete memory[k]}}); }""")
    page.set_content(html,wait_until='load')
    page.locator('.summary-tile').first.wait_for(timeout=20000)
    ok('local sources inline, app mounted', page.title().startswith('雨マルシェ'))
    ok('two plans displayed',page.locator('.plan-card').count()==2)
    ok('three demo products displayed',page.locator('#product-rows tr').count()==3)
    ok('all four summary metrics rendered',page.locator('.summary-tile').count()==4)
    ok('profit chart rendered', page.locator('#profit-chart line').count()>=5)
    ok('sensitivity chart rendered',page.locator('#sensitivity-chart polyline').count()==2)
    ok('sun/rain scenario table',page.locator('#scenario tr').count()==2)
    ok('default probability 35',page.locator('#rain-label').inner_text()=='35%')
    initial=page.locator('.summary-tile').first.locator('.value').inner_text()
    page.locator('#rain').fill('80')
    ok('rain probability changes',page.locator('#rain-label').inner_text()=='80%')
    ok('rain affects profit',page.locator('.summary-tile').first.locator('.value').inner_text()!=initial)
    page.locator('#plan-0-booth').fill('9000');page.locator('#plan-0-booth').dispatch_event('change')
    ok('plan costs update', '11,250' in page.locator('#cost-0').inner_text())
    page.locator('#add-product').click()
    ok('add product works',page.locator('#product-rows tr').count()==4)
    page.locator('#product-rows tr').last.locator('input[data-key="name"]').fill('手染め布バッグ')
    page.locator('#product-rows tr').last.locator('input[data-key="name"]').dispatch_event('change')
    ok('product rename works', page.locator('#product-rows tr').last.locator('input[data-key="name"]').input_value()=='手染め布バッグ')
    page.locator('#product-rows tr').last.locator('input[data-key="stock"]').fill('27')
    page.locator('#product-rows tr').last.locator('input[data-key="stock"]').dispatch_event('change')
    ok('product stock edit works',page.locator('#product-rows tr').last.locator('input[data-key="stock"]').input_value()=='27')
    page.locator('#product-rows tr').last.locator('button').click()
    ok('remove product works',page.locator('#product-rows tr').count()==3)
    page.locator('#hourly-goal').fill('3000');page.locator('#hourly-goal').dispatch_event('change')
    ok('goal wage edit works',page.locator('#hourly-goal').input_value()=='3000')
    with page.expect_download() as dl: page.locator('#export-json').click()
    downloaded=dl.value
    ok('JSON export',downloaded.suggested_filename=='ame-marche-plan.json')
    path=ROOT/'_test-plan.json';downloaded.save_as(path)
    obj=json.loads(path.read_text(encoding='utf8'))
    ok('JSON export contains user edits',obj['rain']==80 and obj['plans'][0]['booth']==9000 and obj['hourlyGoal']==3000)
    with page.expect_download() as dl: page.locator('#export-csv').click()
    downloaded=dl.value
    ok('CSV export',downloaded.suggested_filename.endswith('.csv'))
    out=ROOT/'_test-results.csv';downloaded.save_as(out)
    ok('CSV includes event scenarios', '晴れ' in out.read_text('utf-8-sig') and '赤字率' in out.read_text('utf-8-sig'))
    page.set_content(html,wait_until="load")
    ok('localStorage persist', page.locator('#rain-label').inner_text()=='80%' and page.locator('#plan-0-booth').input_value()=='9000')
    page.on('dialog',lambda d:d.accept())
    page.locator('#reset').click()
    ok('reset confirmation and defaults',page.locator('#rain-label').inner_text()=='35%')
    page.locator('#import-file').set_input_files(str(path))
    ok('JSON restore',page.locator('#rain-label').inner_text()=='80%' and page.locator('#hourly-goal').input_value()=='3000')
    ok('restored plan cost',page.locator('#plan-0-booth').input_value()=='9000')
    page.locator('#import-file').set_input_files({'name':'broken.json','mimeType':'application/json','buffer':b'{INVALID'})
    ok('invalid import handled without app crash','復元失敗' in page.locator('#save-status').inner_text())
    ok('no uncaught JS errors',len(errors)==0)
    page.locator('#reset').click()
    page.screenshot(path=str(ROOT/'desktop.png'), full_page=True)
    mobile=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1)
    mobile.set_content(html,wait_until='load')
    mobile.locator('.summary-tile').first.wait_for(timeout=20000)
    ok('mobile app renders',mobile.locator('.plan-card').count()==2)
    width=mobile.evaluate('document.documentElement.scrollWidth')
    ok('no page-wide horizontal scroll on mobile',width<=391)
    mobile.screenshot(path=str(ROOT/'mobile.png'),full_page=True)
    for t in [path,out]: t.unlink(missing_ok=True)
    browser.close()
print(f'\nTOTAL {len(checks)}/{len(checks)} integration checks passed')
