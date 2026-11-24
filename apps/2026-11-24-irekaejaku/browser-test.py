from pathlib import Path
from playwright.sync_api import sync_playwright
base=Path(__file__).parent
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1200,'height':960},accept_downloads=True)
    errors=[];external=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    page.on('request',lambda r: external.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((base/'index.html').read_text(encoding='utf-8'))
    page.click('#compare');assert page.locator('#comparison tbody tr').count()==5
    assert page.locator('#comparison tbody tr').last.locator('td').nth(1).inner_text()=='15'
    with page.expect_download() as d: page.click('#csv')
    assert 'unreachable' in Path(d.value.path()).read_text(encoding='utf-8-sig')
    page.screenshot(path=str(base/'desktop.png'),full_page=True)
    page.locator('#comparison [data-row="4"]').click();assert page.input_value('#caps')=='5 3 3 3'
    page.click('#hint');assert page.inner_text('#remaining')=='15'
    page.click('#apply');assert page.inner_text('#count')=='1'
    page.click('#undo');assert page.inner_text('#count')=='0'
    page.click('#solve')
    for _ in range(15): page.click('#step')
    assert page.inner_text('#remaining')=='0' and '完成' in page.inner_text('#notice')
    page.fill('#initial','AA///');page.click('#load');assert '前の条件' in page.inner_text('#error')
    page.click('#sample');page.set_viewport_size({'width':390,'height':844});page.click('#compare')
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.screenshot(path=str(base/'mobile.png'),full_page=True)
    assert not errors and not external,(errors,external)
    browser.close()
print('Chromium: comparison, CSV, extension, hint, manual, undo, 15-step completion, invalid input, mobile, no JS exceptions or HTTP requests: PASS')
