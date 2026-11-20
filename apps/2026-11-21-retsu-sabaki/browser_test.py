"""Chromium E2E against exactly the same app sources, inlined because sandbox blocks http/file navigation."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
BASE=Path(__file__).resolve().parent
html=(BASE/'index.html').read_text()
html=html.replace('<link rel="stylesheet" href="style.css">', '<style>'+(BASE/'style.css').read_text()+'</style>')
html=html.replace('<script src="engine.js"></script>', '<script>'+(BASE/'engine.js').read_text()+'</script>')
html=html.replace('<script src="app.js"></script>', '<script>'+(BASE/'app.js').read_text()+'</script>')
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page(viewport={'width':1440,'height':1100},device_scale_factor=1,accept_downloads=True)
    errors=[]; page.on('pageerror',lambda e:errors.append(str(e)))
    # about:blank has no storage origin; use session shim to exercise IO paths.
    page.goto('about:blank')
    page.evaluate("""() => { window.__memory={};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>window.__memory[k]??null,setItem:(k,v)=>window.__memory[k]=v,removeItem:k=>delete window.__memory[k]}}); }""")
    page.set_content(html,wait_until='load')
    assert page.title().startswith('列さばき')
    assert page.locator('#slots tr').count()==6
    assert page.locator('#chart svg').count()==1
    assert page.locator('#p90-base').inner_text()!='—'
    page.locator('[data-kind="arrivals"][data-i="0"]').fill('120')
    page.locator('#calculate').click()
    assert page.locator('[data-kind="arrivals"][data-i="0"]').input_value()=='120'
    page.locator('#suggest').click()
    with page.expect_download() as dl: page.locator('#exportCSV').click()
    assert dl.value.suggested_filename.endswith('.csv')
    with page.expect_download() as dl: page.locator('#exportJSON').click()
    fname=BASE/'settings-export-test.json';dl.value.save_as(str(fname))
    parsed=json.loads(fname.read_text());assert parsed['config']['arrivals'][0]==120
    page.locator('#reset').click()
    assert page.locator('[data-kind="arrivals"][data-i="0"]').input_value()=='17'
    page.locator('#importJSON').set_input_files(str(fname))
    page.wait_for_function("document.querySelector('[data-kind=arrivals][data-i=\"0\"]').value === '120'")
    assert '120' in page.evaluate('localStorage.getItem("retsu-sabaki-v1")')
    page.screenshot(path=str(BASE/'desktop.png'),full_page=True)
    mobile=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1,accept_downloads=True)
    mobile.goto('about:blank');mobile.set_content(html,wait_until='load')
    assert mobile.locator('#chart svg').count()==1
    assert mobile.evaluate('document.documentElement.scrollWidth <= window.innerWidth+1')
    mobile.screenshot(path=str(BASE/'mobile.png'),full_page=True)
    assert not errors,errors
    print('BROWSER TEST PASS: initial load, calculation, edit, suggestion, CSV download, JSON export/import, reset, simulated storage, mobile layout, no JS errors')
    browser.close()