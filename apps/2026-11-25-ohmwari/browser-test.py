from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=b.new_page(viewport={'width':1200,'height':900},accept_downloads=True)
    errors=[]; requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:requests.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((root/'index.html').read_text())
    assert page.locator('.metric strong').all_text_contents()==['3 / 3','2 / 3','5 本']
    page.screenshot(path=str(root/'desktop.png'),full_page=True)
    with page.expect_download() as d: page.locator('#csv').click()
    assert '300Ω' in Path(d.value.path()).read_text(encoding='utf-8-sig')
    page.locator('#stock').fill('100,5,1')
    assert page.locator('#result').is_hidden() and page.locator('#csv').is_disabled()
    page.locator('#run').click(); assert page.locator('#error').inner_text()
    page.locator('#stock').fill('100,0,1');page.locator('#run').click()
    assert page.locator('.metric strong').first.inner_text()=='0 / 3'
    page.locator('#reset').click();assert page.locator('.metric strong').first.inner_text()=='3 / 3'
    page.set_viewport_size({'width':390,'height':844})
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.screenshot(path=str(root/'mobile.png'),full_page=True)
    assert not errors and not requests,(errors,requests)
    b.close()
print('Chromium: sample, actual CSV download, invalidation, invalid input, zero stock, reset, 390px, no JS errors or external HTTP requests passed.')
