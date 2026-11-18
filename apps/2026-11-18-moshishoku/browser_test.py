"""Playwright smoke + interaction tests; no paid services."""
from pathlib import Path
from playwright.sync_api import sync_playwright
from urllib.parse import quote
import json

ROOT = Path(__file__).parent
checks=[]
def check(label, actual):
    checks.append((label, bool(actual)))
    if not actual: raise AssertionError(label)

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page=browser.new_page(viewport={'width': 1440,'height':900},accept_downloads=True)
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    mode='file URL'
    try:
        page.goto((ROOT/'index.html').as_uri(),wait_until='load',timeout=7000)
        if page.locator('#coverage').inner_text()=='--': raise Exception('not rendered')
    except Exception as ex:
        mode='injected source (file navigation blocked)'
        html=(ROOT/'index.html').read_text()
        html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+ (ROOT/'style.css').read_text()+'</style>')
        html=html.replace('<script src="engine.js"></script>','<script>'+ (ROOT/'engine.js').read_text()+'</script>')
        html=html.replace('<script src="app.js"></script>','<script>'+ (ROOT/'app.js').read_text()+'</script>')
        page.close()
        page=browser.new_page(viewport={'width': 1440,'height':900},accept_downloads=True)
        page.on('pageerror',lambda e: errors.append(str(e)))
        page.set_content(html,wait_until='load')
    check('page title',page.title().startswith('もし食卓'))
    check('initial example item count',page.locator('.item').count()==6)
    check('coverage present',page.locator('#coverage').inner_text().endswith('%'))
    check('3 day panels',page.locator('.daycard').count()==3)
    check('9 meal rows',page.locator('.meal').count()==9)
    check('preview not empty',page.locator('.mealItems').first.inner_text()!='')
    check('no JS errors',not errors)
    page.screenshot(path=str(ROOT/'desktop.png'),full_page=True)
    # Reset and add food
    page.click('#reset')
    check('reset empty',page.locator('.item').count()==0)
    check('shortage after reset',page.locator('#shortage').inner_text()=='18')
    page.fill('#name','テストごはん')
    page.fill('#portions','18')
    page.select_option('#mode','ready')
    page.click('#add')
    check('item added',page.locator('.item').count()==1)
    check('all portions covered',page.locator('#coverage').inner_text()=='100%')
    page.locator('.itemInfo').first.click()
    check('edit loaded',page.locator('#name').input_value()=='テストごはん')
    page.fill('#portions','9')
    page.click('#add')
    check('edited coverage',page.locator('#coverage').inner_text()=='50%')
    page.click('.delete')
    check('deleted',page.locator('.item').count()==0)
    # Heat constraints
    page.fill('#name','あたため')
    page.fill('#portions','30')
    page.select_option('#mode','heat')
    check('heat input revealed',page.locator('#heatField').is_visible())
    page.click('#add')
    page.fill('#heatSlots','0');page.locator('#heatSlots').dispatch_event('change')
    check('heating disabled',page.locator('#coverage').inner_text()=='0%')
    page.fill('#heatSlots','6');page.locator('#heatSlots').dispatch_event('change')
    check('heating enabled',page.locator('#coverage').inner_text()=='100%')
    # plan download
    with page.expect_download() as d:page.click('#planCsv')
    check('plan csv file',d.value.suggested_filename=='moshishoku-plan.csv')
    with page.expect_download() as d:page.click('#shoppingCsv')
    check('shopping csv file',d.value.suggested_filename=='moshishoku-shopping.csv')
    with page.expect_download() as d:page.click('#save')
    check('JSON export',d.value.suggested_filename.endswith('.json'))
    # Sample reloaded
    page.click('#sample')
    check('sample reloaded',page.locator('.item').count()==6)
    # import file via in-memory payload
    payload={'start':'2026-11-18','people':1,'days':1,'waterL':3,'reserveL':2.5,'cookWaterMl':100,'heatSlots':0,'food':[{'id':'z','name':'インポート缶','portions':3,'mode':'ready','category':'protein','expiry':''}]}
    page.locator('#import').set_input_files({'name':'import.json','mimeType':'application/json','buffer':json.dumps(payload,ensure_ascii=False).encode()})
    check('JSON restored',page.locator('.item').count()==1 and 'インポート缶' in page.locator('.item').first.inner_text())
    check('JSON setting applied',page.locator('#people').input_value()=='1')
    # HTML injection must not execute
    page.fill('#name','<img src=x onerror="window.xss=1">')
    page.fill('#portions','1')
    page.click('#add')
    check('XSS escaped',page.locator('.item img').count()==0 and page.evaluate('window.xss===undefined'))
    check('errors absent after interactions',not errors)
    mobile=browser.new_page(viewport={'width':375,'height':812},device_scale_factor=1)
    if mode=='file URL':mobile.goto((ROOT/'index.html').as_uri(),wait_until='load')
    else:mobile.set_content(html,wait_until='load')
    check('mobile content visible',mobile.locator('#coverage').is_visible())
    check('mobile no horizontal overflow',mobile.evaluate('document.documentElement.scrollWidth <= innerWidth + 2'))
    mobile.screenshot(path=str(ROOT/'mobile.png'),full_page=True)
    browser.close()

print('Mode:',mode)
print('Playwright checks:',len(checks),'/',len(checks))
for label,ok in checks:print(('OK' if ok else 'NG'),label)
