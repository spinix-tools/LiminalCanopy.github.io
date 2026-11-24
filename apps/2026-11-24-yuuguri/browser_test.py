from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).parent
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1200,'height':1050},accept_downloads=True)
    errors=[]; requests=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    page.on('request',lambda r: requests.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.evaluate("Object.defineProperty(window,'localStorage',{value:{data:{},setItem(k,v){this.data[k]=v},getItem(k){return this.data[k]??null}}})"); page.set_content((root/'index.html').read_text()); assert page.locator('#counts').inner_text()=='2 / 8'
    print('sample',page.locator('#coverage').inner_text(),page.locator('#full').inner_text())
    page.screenshot(path=str(root/'desktop.png'),full_page=True)
    page.click('#save');page.click('#clear');assert page.locator('#counts').inner_text()=='2 / 0'
    page.click('#load');assert page.locator('#counts').inner_text()=='2 / 8'
    with page.expect_download() as d: page.click('#csv')
    assert d.value.suggested_filename=='yuuguri-plan.csv';assert len(Path(d.value.path()).read_text(encoding='utf-8-sig').splitlines())==9
    page.click('#clear');page.select_option('#mode','next');page.locator('.tile:not(.done)').first.click();assert page.locator('#counts').inner_text()=='2 / 1'
    page.locator('.tile.next').click();assert page.locator('#counts').inner_text()=='2 / 0'
    page.fill('#mass','0');page.click('#apply');assert page.locator('#status').get_attribute('class')=='bad'
    page.click('#reset');page.fill('#s0','0');page.fill('#s1','0');page.fill('#s2','0');page.click('#apply');page.click('#auto');assert page.locator('#counts').inner_text()=='2 / 0'
    page.click('#reset');page.set_viewport_size({'width':390,'height':844});page.screenshot(path=str(root/'mobile.png'),full_page=True)
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    assert not errors and not requests,(errors,requests)
    print('Chromium inline / mock storage: sample, save/load, CSV, manual toggle, validation, zero stock, mobile PASS; errors=0 HTTP=0')
    browser.close()
