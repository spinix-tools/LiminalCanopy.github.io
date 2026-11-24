from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1120,'height':1080},accept_downloads=True)
    errors=[]; external=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    page.on('request',lambda r: external.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((root/'index.html').read_text(encoding='utf-8'))
    assert page.locator('#plans .metric strong').all_text_contents()==['3','0','3','0','2','2']
    page.screenshot(path=str(root/'desktop.png'),full_page=True)
    page.get_by_role('button',name='この計画を表示').click()
    assert 'A / 朝' in page.locator('#detail').inner_text()
    with page.expect_download() as download:
        page.locator('#csv').click()
    assert 'A","朝","2","3","1","30","3' in Path(download.value.path()).read_text(encoding='utf-8-sig')
    page.locator('#budget').fill('-1'); assert page.locator('#results').is_hidden()
    page.locator('#calc').click(); assert page.locator('#error').inner_text()
    page.locator('#reset').click(); page.locator('#add').click(); assert page.locator('.entry').count()==7
    page.locator('.entry').last.get_by_role('button',name='削除').click(); assert page.locator('.entry').count()==6
    page.locator('#calc').click(); assert page.locator('#results').is_visible()
    page.set_viewport_size({'width':390,'height':844}); assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.screenshot(path=str(root/'mobile.png'),full_page=True)
    assert not errors and not external,(errors,external)
    browser.close()
    print('Chromium inline HTML: initial sample, plan switch, CSV, invalidation, validation, add/remove, reset, 390px, 0 page errors, 0 HTTP requests: PASS')
