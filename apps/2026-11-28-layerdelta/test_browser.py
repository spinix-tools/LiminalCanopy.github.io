"""Run with Python + Playwright + Chromium. Tests exact HTML via set_content."""
import json, os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parent

def completed(page):
    expect(page.locator("#run")).to_be_enabled(timeout=15000)
    assert '検査完了' in page.locator('#status').inner_text(), page.locator('#status').inner_text()

def report(page):
    with page.expect_download() as d:
        page.locator('#export').click()
    return json.loads(Path(d.value.path()).read_text())

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.getenv('CHROMIUM','/usr/bin/chromium'),args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1200,'height':1000},accept_downloads=True)
    errors=[]; requests=[]; blocked=[]; responses=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:requests.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.on('requestfailed',lambda r:blocked.append((r.url,r.failure)) if r.url.startswith(('http:','https:')) else None)
    page.on('response',lambda r:responses.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((ROOT/'index.html').read_text());completed(page)
    r=report(page); assert len(r['rows'])==16 and sum(x['changed'] for x in r['rows'])==4
    for x in r['rows']:
        if x['prop']=='color':
            expected=('rgb(255, 255, 255)','rgb(34, 51, 85)') if x['name']=='通常ボタン' else ('rgb(255, 0, 0)','rgb(0, 0, 255)')
            assert (x['before'],x['after'])==expected
        if x['prop']=='font-size' and x['width']==800: assert x['after']=='20px'
    print('PASS sample / normal + important layer reversal / media query / JSON')
    page.locator('#only').uncheck();assert page.locator('tbody tr').count()==16;page.locator('#only').check();assert page.locator('tbody tr').count()==4
    page.screenshot(path=str(ROOT/'desktop.png'),full_page=True)
    page.locator('#after').fill(r['config']['before']);assert page.locator('#export').is_disabled();page.locator('#run').click();completed(page);assert page.locator('#changed').inner_text()=='0'
    print('PASS filter / identical CSS / stale result invalidation')
    page.locator('#widths').fill('0');page.locator('#run').click();assert 'エラー' in page.locator('#status').inner_text();assert page.locator('#export').is_disabled()
    page.locator('#reset').click();completed(page)
    page.locator('#fixtures').fill('[{"tag":"script","name":"x"}]');page.locator('#run').click();assert 'エラー' in page.locator('#status').inner_text()
    print('PASS invalid width / forbidden fixture')
    page.locator('#reset').click();completed(page)
    page.locator('#before').fill('@import url("https://example.invalid/a.css"); button { background-image:url("https://example.invalid/a.png"); color:red }')
    page.locator('#after').fill('button { color:blue }');page.locator('#fixtures').fill(json.dumps([{'name':'<img src=x onerror=alert(1)>','tag':'button','text':'<script>alert(1)</script>'}]))
    page.locator('#run').click();completed(page);assert page.locator('tbody img').count()==0;assert len(requests)==len(blocked) and all(f=='csp' for _,f in blocked) and not responses
    print('PASS blocked external requests / text escaping')
    page.locator('#before').fill('div {color:red}');page.locator('#after').fill('div {color:blue}');page.locator('#fixtures').fill(json.dumps([{'tag':'div','name':str(i)} for i in range(100)]));page.locator('#widths').fill('240,360,480,800,1200,2000');page.locator('#props').fill('color,background-color,font-size,padding-left,padding-right,padding-top,padding-bottom,margin-left,margin-right,margin-top,margin-bottom,width,height,display,position,opacity,line-height,font-weight,border-top-width,box-sizing');page.locator('#run').click();completed(page);assert page.locator('#total').inner_text()=='12000';assert page.locator('#changed').inner_text()=='600'
    print('PASS 12,000 measurements (100 × 6 × 20)')
    page.set_viewport_size({'width':390,'height':844});page.locator('#reset').click();completed(page);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.screenshot(path=str(ROOT/'mobile.png'),full_page=True)
    assert not errors,errors; assert not responses,responses; assert len(requests)==len(blocked) and all(f=='csp' for _,f in blocked)
    print('PASS 390px / zero JS errors / zero external HTTP responses; all attempted resource requests blocked by CSP')
    browser.close()
