from pathlib import Path
from playwright.sync_api import sync_playwright
p=Path(__file__).resolve().parent
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1200,'height':900},accept_downloads=True)
    errors=[]; external=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:external.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((p/'index.html').read_text(encoding='utf-8'))
    assert page.locator('#status').inner_text()=='計算完了：12段'
    print('sample:',page.locator('.metric').all_inner_texts());print(page.locator('#frontier').inner_text())
    page.screenshot(path=str(p/'desktop.png'),full_page=True)
    with page.expect_download() as d: page.locator('#download').click()
    assert '譜めくり' in Path(d.value.path()).read_text(encoding='utf-8-sig')
    page.locator('#mode').select_option('all');assert page.locator('#download').is_disabled();page.locator('#run').click();assert page.locator('#download').is_enabled()
    page.locator('#data').fill('bad');page.locator('#run').click();assert '形式' in page.locator('#status').inner_text();assert page.locator('#download').is_disabled()
    page.locator('#data').fill('a,8,0,禁止\nb,8,0,自由');page.locator('#run').click();assert '配置なし' in page.locator('#status').inner_text()
    page.locator('#reset').click();assert page.locator('#download').is_enabled()
    page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.screenshot(path=str(p/'mobile.png'),full_page=True)
    assert not errors and not external,(errors,external)
    browser.close()
print('Chromium: sample, CSV download, mode change, invalidation, invalid input, infeasible case, reset, mobile width, zero errors and external requests: PASS')
