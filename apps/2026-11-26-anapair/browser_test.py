from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1280,'height':900},accept_downloads=True)
    errors=[]; network=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    page.on('request',lambda r: network.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((root/'index.html').read_text(encoding='utf-8'))
    assert page.locator('.metric b').first.inner_text()=='35'
    page.screenshot(path=str(root/'desktop.png'),full_page=True)
    with page.expect_download() as d: page.click('#csv')
    data=Path(d.value.path()).read_text(encoding='utf-8-sig')
    assert data.splitlines()[-1]=='35,132.000,136.000,3'
    page.fill('#target','34');assert page.locator('#csv').is_disabled();page.click('#run')
    assert page.locator('.metric b').first.inner_text()=='34'
    page.fill('#segments','20,30,0');page.fill('#tol','5');page.fill('#target','0');page.click('#run');assert '共通間隔数がない' in page.locator('#status').inner_text();assert page.locator('#csv').is_disabled()
    page.fill('#segments','20,abc,0');page.click('#run');assert '不正' in page.locator('#status').inner_text()
    page.click('#reset');assert page.locator('.metric b').first.inner_text()=='35'
    page.set_viewport_size({'width':390,'height':844});page.screenshot(path=str(root/'mobile.png'),full_page=True)
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    assert not errors and not network,(errors,network)
    print('Chromium: initial / CSV / target / invalidation / no solution / invalid input / reset / mobile / zero exceptions and external HTTP passed')
    browser.close()
