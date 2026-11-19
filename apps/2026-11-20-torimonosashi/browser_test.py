"""Headless Chromium UI tests. If file:// is disallowed, inject the exact local source files."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json

ROOT = Path(__file__).resolve().parent
assertions = 0

def check(cond, message):
    global assertions
    assert cond, message
    assertions += 1

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    context = browser.new_context(viewport={'width': 1350, 'height': 900}, accept_downloads=True)
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    mode = 'file:// direct'
    try:
        page.goto((ROOT/'index.html').as_uri(), timeout=6000)
    except Exception:
        mode = 'same source injected (file:// blocked)'
        html=(ROOT/'index.html').read_text(encoding='utf-8')
        html=html.replace('<link rel="stylesheet" href="./style.css">','').replace('<script src="./engine.js"></script>','').replace('<script src="./app.js"></script>','')
        page.close()
        page = context.new_page()
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.set_content(html)
        page.evaluate('''() => {const db={}; Object.defineProperty(window, "localStorage", {configurable:true, value:{getItem(k){return db[k]??null},setItem(k,v){db[k]=String(v)},removeItem(k){delete db[k]}}})}''')
        page.add_style_tag(content=(ROOT/'style.css').read_text(encoding='utf-8'))
        page.add_script_tag(content=(ROOT/'engine.js').read_text(encoding='utf-8'))
        page.add_script_tag(content=(ROOT/'app.js').read_text(encoding='utf-8'))
    page.wait_for_timeout(250)
    check(page.locator('h1').count()==1,'hero title')
    check(page.locator('#logBody tr').count()==13,'initial demo 13 logs')
    check('シジュウカラ' in page.locator('#comparison').inner_text(),'first species selected')
    check('66.7%' in page.locator('#comparison').inner_text(),'A presence')
    check('83.3%' in page.locator('#comparison').inner_text(),'B presence')
    check(page.locator('#chart svg rect').count()>1,'monthly SVG is drawn')
    check(page.locator('#logCount').inner_text()=='13件','initial log counter')
    check('部分' in page.locator('#logBody').inner_text(),'partial log displayed')
    # compare site selection and invalid interval
    page.select_option('#siteSelect',label='川沿い')
    check('川沿い' in page.locator('#comparison').inner_text(),'site filtering')
    page.fill('#startA','2026-12-01')
    check('期間を確認' in page.locator('#comparison').inner_text(),'invalid time range error')
    page.fill('#startA','2026-03-01')
    check('期間 A' in page.locator('#comparison').inner_text(),'valid range restored')
    page.select_option('#siteSelect','')
    # Add a complete empty checklist (must affect denominator only)
    page.fill('#date','2026-10-29')
    page.fill('#site','近所の公園')
    page.fill('#minutes','30')
    page.fill('#sightings','')
    page.locator('#submitBtn').click()
    check(page.locator('#logCount').inner_text()=='14件','added empty checklist')
    check('71.4%' in page.locator('#comparison').inner_text(),'complete absence affects B denominator')
    check(page.locator('#notice').inner_text().startswith('観察記録を追加'),'add notification')
    # Add partial checklist with sightings (must be excluded)
    page.fill('#date','2026-10-30')
    page.fill('#sightings','シジュウカラ,99\nスズメ,3')
    page.uncheck('#complete')
    page.locator('#submitBtn').click()
    check(page.locator('#logCount').inner_text()=='15件','partial added')
    check('71.4%' in page.locator('#comparison').inner_text(),'partial excluded from detection')
    # edit this row to full; the 99-count will be included now
    page.locator('#logBody tr').filter(has_text='2026-10-30').locator('button[data-action="edit"]').click()
    check('観察を編集する' in page.locator('#entryTitle').inner_text(),'edit UI')
    check('99' in page.locator('#sightings').input_value(),'edit prefills observations')
    page.check('#complete')
    page.locator('#submitBtn').click()
    check('75.0%' in page.locator('#comparison').inner_text(),'edit affects denominator and numerator')
    # injection inert HTML
    page.fill('#date','2026-11-19')
    page.fill('#site','<img src=x onerror=alert(9)>')
    page.fill('#sightings','<svg onload=alert(9)>,1')
    page.locator('#submitBtn').click()
    check(page.locator('#logCount').inner_text()=='16件','special label valid')
    check(page.locator('#logBody img').count()==0,'escaped HTML in site')
    check(page.locator('#logBody svg').count()==0,'escaped HTML in species')
    # HTML is not evaluated (no alert)
    check(not errors,'no JS errors')
    # JSON export/download
    with page.expect_download() as dl: page.locator('#exportJsonBtn').click()
    d=dl.value
    check(d.suggested_filename=='torimonosashi-backup.json','JSON export named')
    content=json.loads(Path(d.path()).read_text(encoding='utf-8'))
    check(len(content['sessions'])==16,'JSON contains all 16 entries')
    # CSV export
    with page.expect_download() as dl: page.locator('#csvBtn').click()
    csv=Path(dl.value.path()).read_text(encoding='utf-8-sig')
    check('"complete","species"' in csv,'CSV headings')
    check('2026-10-29' in csv,'empty checklist in CSV')
    # SVG export
    with page.expect_download() as dl: page.locator('#svgBtn').click()
    check('<svg' in Path(dl.value.path()).read_text(encoding='utf-8'),'SVG download')
    # Delete 1 new record
    page.locator('#logBody tr').filter(has_text='2026-11-19').locator('button[data-action="delete"]').click()
    check(page.locator('#logCount').inner_text()=='15件','delete log')
    # JSON restore; file chooser can load exported file
    page.set_input_files('#importFile',{'name':'backup.json','mimeType':'application/json','buffer':json.dumps(content,ensure_ascii=False).encode('utf-8')})
    check(page.locator('#logCount').inner_text()=='16件','JSON re-import restored')
    # corrupted backup does not erase data
    page.set_input_files('#importFile',{'name':'bad.json','mimeType':'application/json','buffer':b'{INVALID'})
    check('復元できません' in page.locator('#notice').inner_text(),'bad import message')
    check(page.locator('#logCount').inner_text()=='16件','bad import is atomic')
    # invalid species count rejects and does not write
    page.fill('#date','2026-11-18')
    page.fill('#site','公園')
    page.fill('#sightings','スズメ,-1')
    page.locator('#submitBtn').click()
    check(page.locator('#logCount').inner_text()=='16件','invalid row rejected')
    check('1行目' in page.locator('#notice').inner_text(),'validation visible')
    # restore sample via confirm
    page.on('dialog',lambda dialog:dialog.accept())
    page.locator('#demoBtn').click()
    check(page.locator('#logCount').inner_text()=='13件','demo reset')
    # responsiveness
    page.set_viewport_size({'width':390,'height':844})
    page.wait_for_timeout(180)
    dimensions=page.evaluate('''() => ({sw:document.documentElement.scrollWidth,iw:innerWidth})''')
    check(dimensions['sw']<=dimensions['iw']+1, f'no horizontal body overflow: {dimensions}')
    check(page.locator('#comparison .metric').count()==2,'metrics visible on mobile')
    check(not errors,'no browser exceptions')
    # screenshots
    page.set_viewport_size({'width':1350,'height':900})
    page.wait_for_timeout(150)
    page.screenshot(path=str(ROOT/'desktop.png'),full_page=True)
    page.set_viewport_size({'width':390,'height':844})
    page.wait_for_timeout(100)
    page.screenshot(path=str(ROOT/'mobile.png'),full_page=True)
    context.close();browser.close()
print(f'CHROMIUM: {assertions}/{assertions} assertions PASSED. Load mode: {mode}.')
