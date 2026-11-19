"""Playwright end-to-end exercise. Run: python browser_test.py"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json

ROOT=Path(__file__).resolve().parent
checks=[]
def check(name, condition):
    checks.append((name,bool(condition)))
    if not condition: raise AssertionError(name)

with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page(viewport={'width':1450,'height':1000},accept_downloads=True)
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    html=(ROOT/'index.html').read_text()
    html=html.replace('<link rel="stylesheet" href="style.css">','').replace('<script src="engine.js"></script>','').replace('<script src="app.js"></script>','')
    # Restricted environment blocks file:// navigation. Load the exact CSS/JS inline;
    # localStorage is simulated and NOT a persistence test in a normal browser.
    def load_app(p):
        p.set_content(html)
        p.add_style_tag(content=(ROOT/'style.css').read_text())
        p.evaluate("""() => { const store={};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=v},removeItem:k=>{delete store[k]}}}) }""")
        p.add_script_tag(content=(ROOT/'engine.js').read_text())
        p.add_script_tag(content=(ROOT/'app.js').read_text())
    load_app(page)
    page.wait_for_selector('#mapA svg')
    check('title',page.title().startswith('電波ふた案'))
    check('two map SVGs',page.locator('.map-area svg').count()==2)
    check('initial wall count',page.locator('#wallCount').inner_text()=='3')
    check('initial zone count',page.locator('#zoneCount').inner_text()=='3')
    check('two scores', '%' in page.locator('#scoreA').inner_text() and '%' in page.locator('#scoreB').inner_text())
    check('zone rows',page.locator('#zoneResults tr').count()==3)
    check('AP controls',page.locator('[data-ap-coordinate]').count()==6)
    check('SVG heatmap present',page.locator('#mapA svg rect').count()>600)
    s0=page.evaluate('window.__DENPA_TEST__.getState()')
    # Move the selected A router by clicking the map.
    bb=page.locator('#mapA svg').bounding_box()
    page.mouse.click(bb['x']+bb['width']*.58,bb['y']+bb['height']*.42)
    s1=page.evaluate('window.__DENPA_TEST__.getState()')
    check('A router relocated by click',abs(s1['plans'][0]['aps'][0]['x']-s0['plans'][0]['aps'][0]['x'])>.1)
    # Draw wall in B chart
    page.locator('[data-mode="wall"]').click()
    bb=page.locator('#mapB svg').bounding_box()
    page.mouse.move(bb['x']+bb['width']*.3,bb['y']+bb['height']*.25)
    page.mouse.down();page.mouse.move(bb['x']+bb['width']*.3,bb['y']+bb['height']*.7,steps=5);page.mouse.up()
    check('wall drawn',page.locator('#wallCount').inner_text()=='4')
    # Modify wall material and delete new wall
    page.locator('[data-wall-material="3"]').select_option('metal')
    check('wall material changed',page.evaluate('window.__DENPA_TEST__.getState().walls[3].material')=='metal')
    page.locator('[data-delete-wall="3"]').click()
    check('wall deleted',page.locator('#wallCount').inner_text()=='3')
    # Add zone
    page.locator('[data-mode="zone"]').click()
    bb=page.locator('#mapA svg').bounding_box()
    page.mouse.move(bb['x']+bb['width']*.18,bb['y']+bb['height']*.16)
    page.mouse.down();page.mouse.move(bb['x']+bb['width']*.30,bb['y']+bb['height']*.32,steps=5);page.mouse.up()
    check('zone drawn',page.locator('#zoneCount').inner_text()=='4')
    page.locator('[data-zone-name="3"]').fill('テスト作業室')
    page.locator('[data-zone-name="3"]').press('Tab')
    check('zone rename',page.locator('#zoneResults').inner_text().find('テスト作業室')>=0)
    page.locator('[data-zone-priority="3"]').select_option('3')
    check('zone priority',page.evaluate('window.__DENPA_TEST__.getState().zones[3].priority')==3)
    page.locator('[data-delete-zone="3"]').click()
    check('zone deleted',page.locator('#zoneCount').inner_text()=='3')
    # Add second AP to B, move by numeric editing, delete.
    page.locator('#addB').click()
    check('add AP B',page.evaluate('window.__DENPA_TEST__.getState().plans[1].aps.length')==2)
    page.locator('[data-ap-coordinate="1:1:power"]').fill('18')
    page.locator('[data-ap-coordinate="1:1:power"]').press('Tab')
    check('AP power changed',page.evaluate('window.__DENPA_TEST__.getState().plans[1].aps[1].power')==18)
    page.locator('[data-delete-ap="1:1"]').click()
    check('delete AP B',page.evaluate('window.__DENPA_TEST__.getState().plans[1].aps.length')==1)
    # Band and threshold switch, dimension scaling.
    page.locator('#band').select_option('2.4')
    check('band switched',page.evaluate('window.__DENPA_TEST__.getState().band')=='2.4')
    page.locator('#threshold').select_option('-72')
    check('threshold switched',page.evaluate('window.__DENPA_TEST__.getState().threshold')==-72)
    page.locator('#width').fill('14')
    page.locator('#width').press('Tab')
    check('floor resized',page.evaluate('window.__DENPA_TEST__.getState().width')==14)
    # Downloads
    for selector,suffix in [('#exportBtn','.json'),('#csvBtn','.csv'),('#svgBtn','.svg')]:
        with page.expect_download() as dl:page.locator(selector).click()
        d=dl.value
        check('download '+suffix,d.suggested_filename.endswith(suffix))
    # Restore via JSON upload
    filedata=json.dumps(s0,ensure_ascii=False)
    page.locator('#importFile').set_input_files({'name':'sample.json','mimeType':'application/json','buffer':filedata.encode()})
    check('JSON restores width',page.evaluate('window.__DENPA_TEST__.getState().width')==12)
    # Saved browser persistence
    page.locator('#saveBtn').click()
    check('localStorage save is invoked (mocked)',page.evaluate("JSON.parse(window.localStorage.getItem('denpa-futaan-v1')).walls.length")==3)
    check('no JS errors',not errors)
    page.screenshot(path=str(ROOT/'desktop.png'),full_page=True)
    mobile=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1)
    load_app(mobile)
    mobile.wait_for_selector('#mapB svg')
    check('mobile map visible',mobile.locator('#mapB svg').is_visible())
    check('mobile no horizontal overflow',mobile.evaluate('document.documentElement.scrollWidth <= window.innerWidth+1'))
    mobile.screenshot(path=str(ROOT/'mobile.png'),full_page=True)
    browser.close()
print('\n'.join(('PASS ' if ok else 'FAIL ')+label for label,ok in checks))
print(f'BROWSER TEST RESULTS: {sum(v for _,v in checks)}/{len(checks)} passed')
