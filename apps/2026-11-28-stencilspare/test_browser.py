from pathlib import Path
from playwright.sync_api import sync_playwright
import json
base=Path(__file__).resolve().parent
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1100,'height':1000},accept_downloads=True)
    errors=[]; external=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:external.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((base/'index.html').read_text())
    assert page.locator('#weak').inner_text()=='5'
    assert page.locator('#worst').inner_text()=='18'
    page.locator('#map').click(position={'x':page.locator('#map').bounding_box()['width']*7.5/15,'y':page.locator('#map').bounding_box()['height']*1.5/11})
    assert '18 マス' in page.locator('#detail').inner_text()
    page.click('#suggest'); assert '18 → 0' in page.locator('#proposal').inner_text()
    page.screenshot(path=str(base/'desktop.png'),full_page=True)
    page.click('#apply'); assert page.locator('#weak').inner_text()=='0'
    with page.expect_download() as dl: page.click('#json')
    assert json.loads(dl.value.path().read_text())['audit']['worst']==0
    with page.expect_download() as dl: page.click('#svg')
    assert 'width="30mm"' in dl.value.path().read_text()
    page.fill('#source','bad'); assert page.locator('#json').is_disabled(); page.click('#run'); assert page.locator('#error').inner_text()
    page.click('#sample'); page.set_viewport_size({'width':390,'height':844}); assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.screenshot(path=str(base/'mobile.png'),full_page=True)
    assert not errors and not external,(errors,external)
    browser.close()
print('Chromium: selection, suggestion, apply, JSON/SVG, invalid input, mobile, no external requests or JS errors passed')
