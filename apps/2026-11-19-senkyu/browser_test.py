"""Playwright/Chromium operational tests, same HTML/CSS/JS injected when file/http nav is sandbox-blocked."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,sys
ROOT=Path(__file__).resolve().parent
checks=[]
def ck(name, condition):
    if not condition: raise AssertionError(name)
    checks.append(name)

def boot(page):
    page.goto('about:blank')
    page.add_init_script('window.__notused=1')
    # sandbox blocks file navigation; setting content preserves exactly HTML markup.
    html=(ROOT/'index.html').read_text()
    page.set_content(html, wait_until='domcontentloaded')
    page.add_style_tag(content=(ROOT/'style.css').read_text())
    page.evaluate('''() => { const data = {}; Object.defineProperty(window,'localStorage',{ configurable:true, value:{getItem:k=>data[k]??null,setItem:(k,v)=>data[k]=String(v),removeItem:k=>delete data[k]} }); }''')
    page.add_script_tag(content=(ROOT/'engine.js').read_text())
    page.add_script_tag(content=(ROOT/'app.js').read_text())

def run():
  with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    context=browser.new_context(viewport={'width':1500,'height':980},accept_downloads=True,device_scale_factor=1)
    page=context.new_page(); errors=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    boot(page)
    ck('desktop title',page.title().startswith('線究'))
    ck('initial 5 devices',page.locator('.deviceItem').count()==5)
    ck('initial 3 cables',page.locator('.cableItem').count()==3)
    ck('initial SVG diagram visible',page.locator('#svgMount svg rect').count()>=5)
    ck('initial shortage detected',page.locator('.cableItem.bad').count()==1)
    ck('two sink statuses listed', 'プロジェクター' in page.locator('#impact').inner_text() and '確認モニター' in page.locator('#impact').inner_text())
    ck('initial no JS errors',not errors)
    # Change project name and verify persistent snapshot.
    page.locator('#projectName').fill('AVデモ 2026');page.locator('#projectName').press('Tab')
    ck('project title edited',page.locator('#projectName').input_value()=='AVデモ 2026')
    ck('save called via browser storage',bool(page.evaluate("localStorage.getItem('senkyu:project:v1')")))
    # cable length fixes the sample shortage.
    page.locator('.cableItem').nth(2).locator('[data-field="stock"]').fill('30')
    page.locator('.cableItem').nth(2).locator('[data-field="stock"]').press('Tab')
    ck('stock edit resolves shortage',page.locator('.cableItem.bad').count()==0)
    # Click fail cable 1. 2 sinks should stay stable in base model but one be affected.
    page.locator('#failed').select_option(index=1)
    ck('unplug simulation impact', 'プロジェクター' in page.locator('#impact').inner_text() and '1件' in page.locator('#impact').inner_text())
    ck('removed cable rendered dashed',page.locator('#svgMount svg path[stroke-dasharray="9 7"]').count()==1)
    page.locator('#failed').select_option('')
    # Add a source and edit name, ports, coordinates.
    page.locator('#preset').select_option('mic');page.locator('#btnAddDevice').click()
    ck('device added',page.locator('.deviceItem').count()==6)
    page.locator('#editName').fill('予備マイク');page.locator('#editName').press('Tab')
    ck('device renamed','予備マイク' in page.locator('#deviceList').inner_text())
    page.locator('#editX').fill('500');page.locator('#editX').press('Tab')
    ck('device position edited',page.locator('#editX').input_value()=='500')
    page.locator('#newPortName').fill('TEST OUT');page.locator('#newPortType').select_option('XLR');page.locator('#newPortDir').select_option('out');page.locator('#btnAddPort').click()
    ck('custom port added','TEST OUT' in page.locator('#portsList').inner_text())
    page.locator('.portItem').last.locator('[data-rmport]').click()
    ck('custom port deleted','TEST OUT' not in page.locator('#portsList').inner_text())
    # Input selector -> add cable (candidate from mic to amplifier speaker).
    page.locator('#fromDev').select_option(page.evaluate("() => window.Senkyu && JSON.parse(localStorage.getItem('senkyu:project:v1')).devices.find(d=>d.name==='予備マイク').id"))
    speaker_id=page.evaluate("() => JSON.parse(localStorage.getItem('senkyu:project:v1')).devices.find(d=>d.name==='予備マイク').id")
    page.locator('#preset').select_option('speaker');page.locator('#btnAddDevice').click()
    ck('speaker added',page.locator('.deviceItem').count()==7)
    target_id=page.evaluate("() => JSON.parse(localStorage.getItem('senkyu:project:v1')).devices.find(d=>d.kind==='sink'&&d.name==='アンプ内蔵SP').id")
    page.locator('#fromDev').select_option(speaker_id);page.locator('#toDev').select_option(target_id)
    page.locator('#route').fill('3');page.locator('#stock').fill('5');page.locator('#btnAddCable').click()
    ck('new cable added',page.locator('.cableItem').count()==4)
    ck('new speaker reachable','アンプ内蔵SP：推定到達' in page.locator('#impact').inner_text())
    # guide and slack configurable
    page.locator('#slack').fill('50');page.locator('#slack').press('Tab')
    ck('slack edited',page.locator('#slack').input_value()=='50')
    page.locator('#guideGrid [data-guide="HDMI"]').fill('1');page.locator('#guideGrid [data-guide="HDMI"]').press('Tab')
    ck('guide change triggers warning','距離ガイドを超過' in page.locator('#cableList').inner_text())
    # User input escaped in SVG and device view.
    page.locator('#editName').fill('<img src=x onerror=alert(1)>');page.locator('#editName').press('Tab')
    ck('escaped untrusted equipment text',page.locator('#svgMount img').count()==0 and '&lt;img' in page.locator('#svgMount').inner_html())
    # export all and restore JSON
    for button,ending in [('btnExport','.json'),('btnCsv','.csv'),('btnSvg','.svg')]:
        with page.expect_download() as d: page.locator('#'+button).click()
        artifact=d.value
        ck(button+' download generated',artifact.suggested_filename.endswith(ending))
        if button=='btnExport': artifact.save_as(str(ROOT/'browser-project-export.json'))
    # Remove one device; all referenced cables auto-delete when endpoint removed.
    before=page.locator('.cableItem').count();page.locator('#deviceList [data-rmdev]').last.click()
    ck('device removal drops related cable',page.locator('.cableItem').count()==before-1)
    page.locator('#btnNew').click();ck('new clears project',page.locator('.deviceItem').count()==0)
    page.locator('#btnImport').click();page.locator('#fileInput').set_input_files(str(ROOT/'browser-project-export.json'))
    page.wait_for_function("document.querySelectorAll('.deviceItem').length===7",timeout=5000)
    ck('JSON import restores 7 devices',page.locator('.deviceItem').count()==7)
    ck('JSON import restores 4 cables',page.locator('.cableItem').count()==4)
    page.locator('#btnSample').click();ck('sample reset',page.locator('.deviceItem').count()==5)
    page.screenshot(path=str(ROOT/'desktop.png'),full_page=True)
    ck('no JS errors on desktop',not errors)
    mobile=context.new_page();mobile.set_viewport_size({'width':390,'height':820});mobile.on('pageerror',lambda e: errors.append(str(e)));boot(mobile)
    ck('mobile title',mobile.locator('h1').is_visible())
    ck('mobile canvas scrollable',mobile.locator('#canvasScroll').evaluate('(el)=>el.scrollWidth>el.clientWidth'))
    ck('mobile page fits viewport',mobile.evaluate('document.documentElement.scrollWidth <= innerWidth + 2'))
    mobile.locator('#failed').select_option(index=2)
    ck('mobile simulation works','プロジェクター' in mobile.locator('#impact').inner_text())
    mobile.screenshot(path=str(ROOT/'mobile.png'),full_page=True)
    ck('no JS errors on mobile',not errors)
    browser.close()
  print(f'CHROMIUM CHECKS: {len(checks)}/{len(checks)} PASS')
  for i,x in enumerate(checks,1):print(f' {i:02} OK {x}')
  return len(checks)
if __name__=='__main__':
  try:run()
  except Exception as e:print('FAILED:',repr(e));raise
