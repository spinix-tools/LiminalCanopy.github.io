from pathlib import Path
from playwright.sync_api import sync_playwright
import json
base=Path(__file__).resolve().parent
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1100,'height':900},accept_downloads=True)
    errors=[]; external=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:external.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((base/'index.html').read_text())
    def get_report():
        with page.expect_download() as dl: page.click('#export')
        return json.loads(dl.value.path().read_text())
    page.select_option('#alias','--surface'); r=get_report()
    assert r['before'][1]['--surface']=='#176b53' and r['before'][2]['--surface']=='#176b53'
    assert r['after'][1]['--surface']=='#b45b32' and r['after'][2]['--surface']=='#b45b32'
    assert r['after'][2]['--card']=='#176b53' and r['changedCells']==2
    page.screenshot(path=str(base/'desktop.png'),full_page=True)
    page.select_option('#scope','2'); r=get_report(); assert r['after'][2]['--surface']=='#3159a0' and r['changedCells']==1
    page.fill('#root','--a: var(--b);\n--b: var(--a);\n--c: var(--a, 8px);'); assert page.locator('#export').is_disabled()
    page.fill('#theme','--b: 4px;'); page.fill('#component',''); page.click('#run'); r=get_report()
    assert r['before'][0]['--a']=='' and r['before'][0]['--c']=='8px' and r['before'][1]['--a']==''
    page.select_option('#scope','1'); page.select_option('#alias','--a'); r=get_report(); assert r['after'][1]['--a']=='4px'
    for bad in ['--x: url(https://example.com/a);','--x: red;\n--x: blue;','body { color: red; }']:
        page.fill('#root',bad); page.click('#run'); assert page.locator('#error').inner_text() and page.locator('#export').is_disabled()
    page.click('#sample'); page.set_viewport_size({'width':390,'height':844}); assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.screenshot(path=str(base/'mobile.png'),full_page=True)
    assert not errors and not external,(errors,external)
    browser.close()
print('PASS: inheritance, rebind at 2 levels, alias chain, cycle/fallback, 3 invalid inputs, JSON download, mobile, no JS errors or external HTTP')
