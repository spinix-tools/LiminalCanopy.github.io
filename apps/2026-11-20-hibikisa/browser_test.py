#!/usr/bin/env python3
"""Interactive Chromium smoke test. Uses inlined same source if local navigation is blocked."""
import json
import re
from pathlib import Path
from playwright.sync_api import sync_playwright

HERE=Path(__file__).resolve().parent
checks=0

def check(condition,description):
    global checks
    if not condition:raise AssertionError(description)
    checks+=1

def bundled_html():
    html=(HERE/'index.html').read_text()
    html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+ (HERE/'style.css').read_text()+'</style>')
    html=html.replace('<script src="engine.js" defer></script>', '')
    html=html.replace('<script src="app.js" defer></script>', '')
    html=html.replace('</body>', '<script>'+ (HERE/'engine.js').read_text()+'</script><script>'+ (HERE/'app.js').read_text()+'</script></body>')
    return html

with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    context=browser.new_context(viewport={'width':1440,'height':1000},accept_downloads=True)
    page=context.new_page()
    errors=[]
    page.on('pageerror',lambda err:errors.append(str(err)))
    mode='file-url'
    try:
        page.goto((HERE/'index.html').as_uri(),wait_until='load',timeout=6000)
        page.wait_for_selector('#avgBase',timeout=1500)
        if page.locator('#avgBase').inner_text().strip()=='—':raise RuntimeError('JS not initialized')
    except Exception:
        mode='inline-src'
        try: page.close()
        except Exception: pass
        page=context.new_page()
        page.on('pageerror',lambda err:errors.append(str(err)))
        page.set_content(bundled_html(),wait_until='load')
    page.wait_for_timeout(250)
    check(page.title()=='ひびき差 | Room Echo Lab','title')
    check('m³' in page.locator('#volume').inner_text(),'room volume')
    check('秒' in page.locator('#avgBase').inner_text(),'A initial')
    check('秒' in page.locator('#avgAfter').inner_text(),'B initial')
    check(page.locator('tbody#readings tr').count()==6,'6 band rows')
    check(page.locator('#rtChart rect').count()>=12,'chart bands')
    check(not page.locator('#autoArea').is_disabled(),'auto-area initially available')
    check(page.locator('input[name="focus"]:checked').input_value()=='speech','default focus')
    before=page.locator('#avgAfter').inner_text()
    page.locator('#panelAreaRange').fill('8')
    check('8.00' in page.locator('#panelAreaLabel').inner_text(),'range updates amount')
    check(page.locator('#avgAfter').inner_text()!=before,'range updates calculation')
    page.locator('#panelArea').fill('0')
    check(page.locator('#avgBase').inner_text()==page.locator('#avgAfter').inner_text(),'zero panel no change')
    page.locator('#method').select_option('eyring')
    check('秒' in page.locator('#avgAfter').inner_text(),'eyring redraw')
    page.locator('input[name="focus"][value="all"]').check()
    check(page.locator('input[name="focus"]:checked').input_value()=='all','focus toggle')
    page.locator('#target').fill('0.15')
    check(page.locator('#autoArea').is_disabled(),'infeasible state disables apply')
    check('できません' in page.locator('#suggestion').inner_text() or '目標' in page.locator('#suggestion').inner_text(),'infeasible explanation')
    page.locator('#target').fill('0.75')
    page.locator('input[name="focus"][value="speech"]').check()
    check(not page.locator('#autoArea').is_disabled(),'feasible state')
    page.locator('#autoArea').click()
    check('反映' in page.locator('#status').inner_text(),'recommendation applied')
    check(float(page.locator('#panelArea').input_value())>=0,'area nonnegative')
    page.locator('#width').fill('0')
    check(page.locator('#error').is_visible(),'invalid width flagged')
    check(page.locator('#autoArea').is_disabled(),'error disables apply')
    page.locator('#width').fill('3.2')
    check(page.locator('#error').is_hidden(),'repair input recovers')
    # download tests
    for button,filename,probe in [
       ('#csvBtn','hibikisa-rt60.csv',b'125'),
       ('#jsonBtn','hibikisa-room.json',b'HIBIKISA'),
       ('#svgBtn','hibikisa-rt60.svg',b'<svg')
    ]:
        with page.expect_download() as dinfo:page.locator(button).click()
        d=dinfo.value
        check(d.suggested_filename==filename,'filename '+filename)
        dst=HERE/('test-'+filename)
        d.save_as(str(dst))
        check(probe in dst.read_bytes(),'download content '+filename)
    imported=json.loads((HERE/'test-hibikisa-room.json').read_text())
    check(imported['config']['width']==3.2,'JSON export roundtrip field')
    page.locator('#length').fill('7')
    check(page.locator('#length').input_value()=='7','changed before import')
    page.locator('#importFile').set_input_files(str(HERE/'test-hibikisa-room.json'))
    page.wait_for_function("document.querySelector('#length').value === '4'",timeout=3000)
    check(abs(float(page.locator('#length').input_value())-imported['config']['length'])<1e-8,'JSON restored')
    check('読み込みました' in page.locator('#status').inner_text(),'JSON import status')
    bad=HERE/'bad-test.json';bad.write_text('{"version":1,"app":"HIBIKISA","config":{"length":"1"}}')
    page.locator('#importFile').set_input_files(str(bad))
    page.wait_for_function("document.querySelector('#status').textContent.includes('読込失敗')",timeout=3000)
    check('読込失敗' in page.locator('#status').inner_text(),'invalid JSON rejected')
    page.locator('#resetBtn').click()
    check(page.locator('#length').input_value()=='4','reset works')
    check('初期設定' in page.locator('#status').inner_text(),'reset status')
    check(not errors,'page errors: '+str(errors))
    page.screenshot(path=str(HERE/'desktop.png'),full_page=True)
    mobile=context.new_page();mobile.set_viewport_size({'width':390,'height':844})
    mobile.on('pageerror',lambda err:errors.append(str(err)))
    mobile.set_content(bundled_html(),wait_until='load')
    mobile.wait_for_timeout(200)
    check('秒' in mobile.locator('#avgBase').inner_text(),'mobile calculation')
    check(mobile.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 2'),'mobile no horizontal overflow')
    mobile.screenshot(path=str(HERE/'mobile.png'),full_page=True)
    check(not errors,'no mobile page errors')
    context.close();browser.close()
for p in HERE.glob('test-*'):p.unlink()
if (HERE/'bad-test.json').exists():(HERE/'bad-test.json').unlink()
print(f'Chromium checks PASS: {checks} | browser mode: {mode} | desktop/mobile screenshots saved')
