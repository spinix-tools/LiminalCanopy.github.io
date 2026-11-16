"""Run via: python browser_test.py — requires Playwright and Chromium."""
from pathlib import Path
import os
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
HTML = (HERE/'index.html').read_text(encoding='utf-8')
HTML = HTML.replace('<script src="engine.js"></script><script src="app.js"></script>', '')
ENGINE = (HERE/'engine.js').read_text(encoding='utf-8')
APP = (HERE/'app.js').read_text(encoding='utf-8')

def load(page, storage=True):
    page.set_content(HTML, wait_until='load')
    if storage:
        page.evaluate("""() => { if (!window.__store) window.__store={}; Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:(k)=>window.__store[k]??null,setItem:(k,v)=>{window.__store[k]=v},removeItem:(k)=>{delete window.__store[k]}}}); }""")
    page.add_script_tag(content=ENGINE)
    page.add_script_tag(content=APP)

checks = []
def ok(message, condition):
    assert condition, message
    checks.append(message)

with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True, executable_path=os.environ.get('CHROMIUM_BIN','/usr/bin/chromium'), args=['--no-sandbox'])
    context = browser.new_context(accept_downloads=True, locale='ja-JP')
    page = context.new_page()
    errors=[]
    page.on('pageerror', lambda e: errors.append(str(e)))
    load(page)
    ok('initial seed rows are displayed', page.locator('#parts .item-row').count()==3 and page.locator('#products .item-row').count()==2)
    ok('not showing stale output on load', page.locator('#output').is_hidden())
    page.locator('#calculate').click()
    ok('calculation produces bars and metrics',page.locator('#output').is_visible() and page.locator('.stock-visual').count()>=2)
    ok('result shows cost', '¥' in page.locator('#metrics').inner_text())
    page.locator('#add-part').click()
    ok('can add part',page.locator('#parts .item-row').count()==4)
    page.locator('#parts .item-row').last.locator('button.trash').click()
    ok('can remove part',page.locator('#parts .item-row').count()==3)
    page.locator('#parts .item-row').first.locator('input[data-key=label]').fill('<img src=x onerror=alert(1)>')
    page.locator('#calculate').click()
    ok('user labels are escaped',page.locator('#bars img').count()==0 and '<img src=x onerror=alert(1)>' in page.locator('#bars').inner_text())
    page.locator('#save').click()
    load(page)
    ok('saved project restored with simulated browser storage',page.locator('#parts .item-row').first.locator('input[data-key=label]').input_value()=='<img src=x onerror=alert(1)>')
    with page.expect_download() as dl:
        page.locator('#export').click()
    ok('JSON download works',dl.value.suggested_filename=='kirishiro-project.json')
    page.locator('#calculate').click()
    with page.expect_download() as dl:
        page.locator('#csv').click()
    ok('CSV download works',dl.value.suggested_filename=='kirishiro-plan.csv')
    page.locator('#parts .item-row').first.locator('input[data-key=length]').fill('99999')
    page.locator('#calculate').click()
    ok('impossible cut correctly rejected',page.locator('#status').get_attribute('class')=='status error')
    page.on('dialog',lambda d:d.accept())
    page.locator('#reset').click()
    ok('reset restores demo values',page.locator('#parts .item-row').first.locator('input[data-key=label]').input_value()=='棚板')
    context.close()
    mobile=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,device_scale_factor=1)
    p=mobile.new_page()
    load(p)
    p.locator('#calculate').click()
    ok('mobile calculation succeeds',p.locator('.stock-visual').count()>=2)
    widths=p.evaluate('({scroll:document.documentElement.scrollWidth, client:document.documentElement.clientWidth})')
    ok('mobile has no horizontal overflow',widths['scroll']<=widths['client']+2)
    ok('no browser JS exceptions',errors==[])
    mobile.close()
    browser.close()
print(f'BROWSER: {len(checks)}/{len(checks)} passed')
for i,x in enumerate(checks,1):print(f'{i:02d}. {x}')