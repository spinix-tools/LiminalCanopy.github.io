"""Chromium UI regression. Uses the original HTML/CSS/JS injected into a document
because the runner blocks file:// and local HTTP navigation. No network calls."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
checks = []

def check(label, value):
    assert value, f'FAILED: {label}'
    checks.append(label)

def inject(page):
    html = (ROOT / 'index.html').read_text()
    html = html.replace('<link rel="stylesheet" href="style.css">', '<style>' + (ROOT / 'style.css').read_text() + '</style>')
    for name in ['engine.js','app.js']:
        html = html.replace('<script src="'+name+'"></script>', '<script>' + (ROOT/name).read_text() + '</script>')
    page.set_content(html, wait_until='load')

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    context = browser.new_context(viewport={'width':1512,'height':960},device_scale_factor=1,accept_downloads=True)
    page = context.new_page()
    errors=[]
    page.on('pageerror', lambda e: errors.append(str(e)))
    inject(page)
    check('title and initial board', '店ミリ' in page.title() and page.locator('#surface [data-id]').count()==5)
    check('no initial warning', page.locator('#statWarn').inner_text()=='0件')
    check('prep list has five',page.locator('#items .itemRow').count()==5)
    check('ready 2/5',page.locator('#statReady').inner_text()=='2 / 5')
    page.screenshot(path=str(ROOT/'desktop.png'),full_page=True)
    check('desktop screenshot created',(ROOT/'desktop.png').stat().st_size>25000)
    # Preset addition, inspector changes and type/quantity
    page.locator('#presets button').first.click()
    check('preset added',page.locator('#items .itemRow').count()==6)
    page.locator('[data-item="name"]').fill('テスト什器')
    page.locator('[data-item="name"]').dispatch_event('change')
    check('name edited',page.locator('#detail [data-item="name"]').input_value()=='テスト什器')
    page.locator('[data-item="w"]').fill('270');page.locator('[data-item="w"]').dispatch_event('change')
    check('width changed',page.locator('[data-item="w"]').input_value()=='270')
    page.locator('[data-act="rotate"]').click()
    check('rotation swaps axes',page.locator('[data-item="d"]').input_value()=='270')
    page.locator('[data-act="duplicate"]').click()
    check('duplicate adds row',page.locator('#items .itemRow').count()==7)
    page.locator('[data-act="delete"]').click()
    check('delete removes row',page.locator('#items .itemRow').count()==6)
    page.locator('#undo').click()
    check('undo restores row',page.locator('#items .itemRow').count()==7)
    # Move selected by 10 mm using keyboard; it should appear in geometry field.
    page.locator('.workspaceHeader h1').click()
    before=int(page.locator('[data-item="x"]').input_value());page.keyboard.press('ArrowRight')
    check('keyboard movement',int(page.locator('[data-item="x"]').input_value())==before+10)
    # Update a table metric, a warning condition and restore
    page.locator('[data-plan="width"]').fill('1000');page.locator('[data-plan="width"]').dispatch_event('change')
    check('wall resize saved in display', '1,000' in page.locator('#sizeSummary').inner_text())
    check('overhang warning displayed',page.locator('.warningBox').count()==1)
    page.locator('#undo').click()
    check('undo resize restores width',page.locator('[data-plan="width"]').input_value()=='1800')
    # Check ready toggle
    old=page.locator('#statReady').inner_text()
    page.locator('[data-ready]').first.check()
    check('ready checkbox updates counter',page.locator('#statReady').inner_text()!=old)
    # auto-arrange tested by UI
    page.locator('#auto').click()
    check('auto arrangement triggers render',page.locator('#surface [data-id]').count()==7)
    # JSON, SVG and CSV downloads
    with page.expect_download() as di:page.locator('#save').click()
    d=di.value;check('JSON exported',d.suggested_filename.endswith('.json'))
    with page.expect_download() as di:page.locator('#csv').click()
    check('CSV exported',di.value.suggested_filename.endswith('.csv'))
    with page.expect_download() as di:page.locator('#svg').click()
    check('SVG exported',di.value.suggested_filename.endswith('.svg'))
    # Load a valid project through file picker
    custom={'version':1,'title':'再読込テスト','width':900,'depth':600,'margin':20,'gap':10,'reach':0,'checkoutWidth':150,'checkoutDepth':140,
            'items':[{'id':'one','name':'テーブル上の棚','x':50,'y':50,'w':250,'d':150,'type':'什器','qty':3,'ready':True}]}
    page.locator('#file').set_input_files({'name':'restore.json','mimeType':'application/json','buffer':json.dumps(custom,ensure_ascii=False).encode()})
    page.wait_for_function("document.querySelector('#titleField').value === '再読込テスト'")
    check('JSON title imported',page.locator('#titleField').input_value()=='再読込テスト')
    check('JSON items restored',page.locator('#items .itemRow').count()==1)
    check('JSON ready status restored',page.locator('#statReady').inner_text()=='1 / 1')
    # Invalid import must not destroy state
    page.locator('#file').set_input_files({'name':'invalid.json','mimeType':'application/json','buffer':b'{bad-json'})
    page.wait_for_function("document.querySelector('#toast').textContent.includes('読み込み失敗')")
    check('bad JSON rejected',page.locator('#titleField').input_value()=='再読込テスト')
    check('error reported to user','読み込み失敗' in page.locator('#toast').inner_text())
    # Drag item from center to right; compare inspector mm
    page.locator('[data-select="one"]').click()
    original=float(page.locator('[data-item="x"]').input_value())
    piece=page.locator('#surface [data-id="one"]')
    box=piece.bounding_box()
    page.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2)
    page.mouse.down();page.mouse.move(box['x']+box['width']/2+42,box['y']+box['height']/2+15,steps=6);page.mouse.up()
    check('pointer drag moves object',float(page.locator('[data-item="x"]').input_value())>original)
    # Print content and checkout warnings
    check('print content contains table',page.locator('#printOnly table tbody tr').count()==1)
    check('no JS runtime errors',not errors)
    # mobile view and horizontal overflow
    mobile=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True)
    mp=mobile.new_page();inject(mp)
    mp.screenshot(path=str(ROOT/'mobile.png'),full_page=True)
    check('mobile screenshot created',(ROOT/'mobile.png').stat().st_size>20000)
    check('no document horizontal overflow',mp.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 2'))
    check('mobile touch board present',mp.locator('#surface [data-id]').count()==5)
    check('mobile buttons operable',mp.locator('#add').is_visible())
    browser.close()
print('Chromium assertions PASSED:',len(checks))
for n,t in enumerate(checks,1):print(f'{n:02d}. {t}')
