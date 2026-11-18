#!/usr/bin/env python3
"""Playwright smoke/interaction test. Install playwright and Chromium first."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

HERE=Path(__file__).resolve().parent
checks=[]
def ok(name,predicate):
    if not predicate: raise AssertionError(name)
    checks.append(name)

def run():
  with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page(viewport={'width':1440,'height':940},device_scale_factor=1,accept_downloads=True)
    errors=[]
    page.on('pageerror',lambda error: errors.append(str(error)))
    page.on('dialog',lambda dialog: dialog.accept())
    try:
      page.goto(HERE.joinpath('index.html').as_uri(),wait_until='load',timeout=12000)
    except Exception as e:
      # Some sandboxes disallow local navigations. Load identical sources in-memory.
      html=(HERE/'index.html').read_text()
      css=(HERE/'style.css').read_text()
      engine=(HERE/'engine.js').read_text()
      app=(HERE/'app.js').read_text()
      html=html.replace('<link rel="stylesheet" href="style.css">',f'<style>{css}</style>').replace('<script src="engine.js"></script>',f'<script>{engine}</script>').replace('<script src="app.js"></script>',f'<script>{app}</script>')
      page.wait_for_timeout(300);page.set_content(html,wait_until='load')
      print('MODE inline-fallback:',str(e)[:140])
    page.wait_for_timeout(200)
    ok('title', 'きりしろ' in page.title())
    ok('sample stock rows',page.locator('#stocksRows tr').count()==4)
    ok('sample parts rows',page.locator('#partsRows tr').count()==3)
    ok('sample plan generated',page.locator('.board-card').count()>0)
    ok('sample summary shows yen','￥' in page.locator('#heroTotal').inner_text() or '¥' in page.locator('#heroTotal').inner_text())
    ok('all parts fitted','配置完了' in page.locator('#resultStatus').inner_text())
    ok('sample purchase memo',page.locator('.purchase-row').count()>0)
    ok('sample cutbar',page.locator('.segment').count()>0)
    ok('sample comparison', '端材を使わない' in page.locator('#comparison').inner_text())
    ok('storage local indicator','端末' in page.locator('#storageStatus').inner_text())
    page.screenshot(path=str(HERE/'desktop.png'),full_page=True)
    # Numerical input change recalculates: restrict carry to 1000 mm so 6ft+8ft excluded.
    page.locator('[data-setting="carry"]').fill('1000');page.locator('[data-setting="carry"]').press('Tab')
    ok('carry restriction creates shortage',page.locator('#warning').inner_text().find('配置できません')>=0)
    ok('apply disabled on shortage',page.locator('#applyBtn').is_disabled())
    page.locator('[data-setting="carry"]').fill('2450');page.locator('[data-setting="carry"]').press('Tab')
    ok('carry restores plan',page.locator('#warning').inner_text()=='')
    ok('apply re-enabled',page.locator('#applyBtn').is_enabled())
    # Add parts and change names to test safe rendering.
    page.locator('#addPart').click()
    ok('add part',page.locator('#partsRows tr').count()==4)
    page.locator('#partsRows tr').last.locator('input[data-field="name"]').fill('<試験&>')
    page.locator('#partsRows tr').last.locator('input[data-field="name"]').press('Tab')
    ok('html-safe name shown as text',page.locator('#partsRows tr').last.locator('input[data-field="name"]').input_value()=='<試験&>')
    ok('no injected elements',page.locator('試験').count()==0)
    page.locator('#partsRows tr').last.locator('[data-remove="part"]').click()
    ok('remove part',page.locator('#partsRows tr').count()==3)
    # Add an offcut and modify its length.
    page.locator('#addStock').click()
    ok('add stock',page.locator('#stocksRows tr').count()==5)
    page.locator('#stocksRows tr').last.locator('input[data-field="length"]').fill('740')
    page.locator('#stocksRows tr').last.locator('input[data-field="length"]').press('Tab')
    ok('stock editable',page.locator('#stocksRows tr').last.locator('input[data-field="length"]').input_value()=='740')
    page.locator('#stocksRows tr').last.locator('[data-remove="stock"]').click()
    ok('remove stock',page.locator('#stocksRows tr').count()==4)
    # Export real files from the page
    with page.expect_download() as d:page.locator('#exportJsonBtn').click()
    jsdl=d.value;ok('JSON download',jsdl.suggested_filename.endswith('.json'))
    with page.expect_download() as d:page.locator('#csvBtn').click()
    ok('CSV download',d.value.suggested_filename.endswith('.csv'))
    with page.expect_download() as d:page.locator('#svgBtn').click()
    ok('SVG download',d.value.suggested_filename.endswith('.svg'))
    ok('no runtime error before inventory action',len(errors)==0)
    # inventory update, then undo
    oldstock=page.locator('#stocksRows tr').count()
    page.locator('#applyBtn').click()
    ok('inventory update event', '端材台帳を更新' in page.locator('#storageStatus').inner_text())
    ok('undo shown',page.locator('#undoBtn').is_visible())
    page.locator('#undoBtn').click()
    ok('undo hidden',not page.locator('#undoBtn').is_visible())
    ok('restored stock count',page.locator('#stocksRows tr').count()==oldstock)
    # JSON import and state restore
    data={'settings':{'kerf':2,'trim':1,'fee':30,'offcutMin':150,'carry':1800},'parts':[{'id':'pImported','name':'読込の棚板','length':500,'qty':2}], 'stocks':[{'id':'sImported','name':'市販 910','kind':'new','length':910,'qty':3,'price':200}]}
    page.locator('#importFile').set_input_files({'name':'import.json','mimeType':'application/json','buffer':json.dumps(data).encode()})
    ok('JSON imported',page.locator('#partsRows tr').count()==1)
    ok('JSON values imported',page.locator('#partsRows input[data-field="name"]').input_value()=='読込の棚板')
    ok('JSON plan recalculated',page.locator('#resultStatus').inner_text()=='配置完了')
    # invalid JSON refuses modification
    page.locator('#importFile').set_input_files({'name':'bad.json','mimeType':'application/json','buffer':b'not valid json'})
    ok('invalid import error', '読込に失敗' in page.locator('#errorBox').inner_text())
    ok('invalid import no mutation',page.locator('#partsRows input[data-field="name"]').input_value()=='読込の棚板')
    # warn on malformed input
    page.locator('#partsRows input[data-field="length"]').fill('0')
    page.locator('#partsRows input[data-field="length"]').press('Tab')
    ok('input invalid warning',page.locator('#errorBox').is_visible())
    ok('invalid disables apply',page.locator('#applyBtn').is_disabled())
    page.locator('#partsRows input[data-field="length"]').fill('500')
    page.locator('#partsRows input[data-field="length"]').press('Tab')
    ok('input corrected',page.locator('#errorBox').is_hidden())
    # visual tests
    page.locator('#resetBtn').click()
    page.set_viewport_size({'width':390,'height':844})
    page.screenshot(path=str(HERE/'mobile.png'),full_page=True)
    ok('no page-level horizontal overflow', page.evaluate('document.body.scrollWidth<=window.innerWidth+1'))
    ok('no runtime errors',len(errors)==0)
    print('Browser checks: %d/%d passed'%(len(checks),len(checks)))
    browser.close()
if __name__=='__main__':run()
