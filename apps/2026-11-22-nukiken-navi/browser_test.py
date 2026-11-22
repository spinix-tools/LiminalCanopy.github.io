"""Real Chromium UI tests for the split-file static application. python browser_test.py"""
from pathlib import Path
import json, re, time
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent
checks=[]
def check(condition, label):
    checks.append((bool(condition),label))
    if not condition: raise AssertionError(label)

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
    context=browser.new_context(viewport={'width':1360,'height':950},accept_downloads=True)
    page=context.new_page()
    errors=[]; externals=[]
    page.on('pageerror',lambda exc: errors.append(str(exc)))
    page.on('request',lambda request: externals.append(request.url) if not request.url.startswith('file:') else None)
    def load_app(target, saved=None):
        # The browser policy blocks file:// and HTTP navigation. Inject exact source,
        # replacing only localStorage with a deterministic per-page implementation.
        target.set_content((ROOT/'index.html').read_text(encoding='utf-8'))
        target.evaluate('''(saved) => {
          const store = saved || {};
          Object.defineProperty(window, 'localStorage', {configurable: true,
            value: { getItem: k => store[k] ?? null, setItem: (k,v) => {store[k]=String(v)},
                     removeItem:k=>{delete store[k]} }});
          window.__testStore = store;
        }''', saved)
        target.add_style_tag(content=(ROOT/'style.css').read_text(encoding='utf-8'))
        target.add_script_tag(content=(ROOT/'engine.js').read_text(encoding='utf-8'))
        target.add_script_tag(content=(ROOT/'app.js').read_text(encoding='utf-8'))
    load_app(page)
    page.wait_for_timeout(250)
    check(page.title().startswith('抜検ナビ'),'page title')
    check(page.locator('#consumer-risk').inner_text().endswith('%'),'risk calculated')
    check(page.locator('#risk-chart path').count()==1,'SVG chart')
    check(page.locator('#producer-detail').inner_text().find('個不良')>=0,'good scenario shown')
    check(page.locator('#formula').inner_text().find('四捨五入')>=0,'rounding disclosed')
    check(page.locator('#decision').inner_text()=='未抽出','no initial decision')
    page.screenshot(path=str(ROOT/'desktop.png'),full_page=True)
    page.locator('#draw').click()
    check(page.locator('.sample-card').count()==32,'32 drawn samples')
    ids=page.locator('.sample-id').all_inner_texts()
    check(len(set(ids))==32,'distinct labels')
    check(page.locator('#decision').inner_text()=='未確定','uninspected unresolved')
    page.locator('.sample-card').first.locator('button[data-state="bad"]').click()
    check(page.locator('#bad-count').inner_text()=='1','one defect')
    check(page.locator('#decision').inner_text()=='未確定','still unresolved before all checked')
    page.locator('.sample-card').nth(0).locator('button[data-state="ok"]').click()
    check(page.locator('#bad-count').inner_text()=='0','toggle inspection')
    page.locator('.sample-card').nth(0).locator('button[data-state="pending"]').click()
    check(page.locator('#done-count').inner_text()=='0 / 32','pending supported')
    for i in range(32): page.locator('.sample-card').nth(i).locator('button[data-state="ok"]').click()
    check(page.locator('#decision').inner_text()=='合格','all good accepted')
    check(page.locator('#progress-bar').get_attribute('style').find('100%')>=0,'full progress')
    page.locator('.sample-card').nth(0).locator('button[data-state="bad"]').click()
    check(page.locator('#decision').inner_text()=='不合格','one defect rejects with c0')
    with page.expect_download() as di: page.locator('#export-csv').click()
    download=di.value; check(download.suggested_filename=='nukiken-inspection.csv','csv download name')
    with page.expect_download() as di: page.locator('#export-json').click()
    jd=di.value; jd.save_as(str(ROOT/'browser-export.json'))
    exported=json.loads((ROOT/'browser-export.json').read_text())
    check(exported['sample']['statuses'][0]=='bad','json contains inspection data')
    check(len(exported['sample']['ids'])==32,'json exact draw')
    page.locator('#n').fill('8');page.locator('#recalc').click()
    check(page.locator('#sample-card').count()==0 if page.locator('#sample-card').count()==0 else False,'stale plan check placeholder') if False else None
    check(page.locator('.sample-card').count()==0,'plan change clears old sample')
    check(page.locator('#decision').inner_text()=='未抽出','decision reset after plan change')
    page.locator('#import-json').set_input_files(str(ROOT/'browser-export.json'))
    check(page.locator('.sample-card').count()==32,'json restores draw')
    check(page.locator('#decision').inner_text()=='不合格','json restores decision')
    saved=page.evaluate('({...window.__testStore})')
    restored=context.new_page()
    restored.on('pageerror',lambda exc: errors.append(str(exc)))
    load_app(restored,saved)
    check(restored.locator('.sample-card').count()==32,'saved state restores in new page (mock storage)')
    page=restored
    page.locator('#n').fill('0');page.locator('#recalc').click()
    check(page.locator('#form-message').inner_text().find('抽出数')>=0,'input validation')
    check(page.locator('#consumer-risk').inner_text()=='—','invalid plan hides stale risk')
    page.locator('#n').fill('32');page.locator('#c').fill('1');page.locator('#recalc').click()
    check(page.locator('#consumer-risk').inner_text().endswith('%'),'recompute with c1')
    page.locator('#suggest').click()
    check('最小抽出数' in page.locator('#form-message').inner_text() or '上限' in page.locator('#form-message').inner_text(),'sample target optimization responds')
    page.on('dialog', lambda d: d.accept())
    page.locator('#reset').click()
    check(page.locator('#n').input_value()=='32','reset defaults')
    mobile=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1,accept_downloads=True)
    small=mobile.new_page();small.on('pageerror',lambda exc: errors.append(str(exc)))
    load_app(small);small.wait_for_timeout(100)
    check(small.locator('#consumer-risk').is_visible(),'mobile results visible')
    check(small.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'),'mobile no horizontal overflow')
    small.screenshot(path=str(ROOT/'mobile.png'),full_page=True)
    check(len(errors)==0,'no JavaScript exceptions')
    check(len(externals)==0,'no external HTTP requests')
    browser.close()
for passed,name in checks: print(('PASS' if passed else 'FAIL'),name)
print(f'BROWSER CHECKS: {len(checks)}/{len(checks)} PASS')
