"""End-to-end UI smoke test with Playwright Chromium, localhost HTTP server."""
import pathlib, json
from playwright.sync_api import sync_playwright
BASE=pathlib.Path(__file__).parent
# The managed Chromium blocks file:// and localhost. Use exact production sources, inline.
html=(BASE/'index.html').read_text(encoding='utf-8')
html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+ (BASE/'style.css').read_text(encoding='utf-8') + '</style>')
for js in ['engine.js','app.js']:
    html=html.replace('<script src="'+js+'"></script>','<script>'+ (BASE/js).read_text(encoding='utf-8') + '</script>')
def load_page(page):
    page.goto('about:blank')
    page.evaluate('''() => { const store = window.__testStorage || {}; window.__testStorage = store; Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=String(v)},removeItem:k=>{delete store[k]}}}); }''')
    page.set_content(html, wait_until='load')
passed=[]
def check(name, value):
    assert value,name
    passed.append(name)
with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':1440,'height':1000},accept_downloads=True)
    page=context.new_page()
    errors=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    load_page(page)
    check('page loaded',page.title().startswith('ばんまる'))
    check('no JS errors',not errors)
    check('initial rows',page.locator('#memberRows tr').count()==8 and page.locator('#shiftRows tr').count()==6)
    check('initial filled',page.locator('#filled').inner_text().startswith('12 / 12'))
    check('initial zero missing',page.locator('#missing').inner_text()=='0')
    check('roster six rows',page.locator('.rosterrow').count()==6)
    check('member bars',page.locator('.loadrow').count()==8)
    page.screenshot(path=str(BASE/'desktop.png'),full_page=True)
    page.locator('#exclude').select_option('P03');page.locator('#simulate').click()
    check('scenario available', 'メンバー03 を除いた場合' in page.locator('#whatifResult').inner_text())
    page.locator('#addMember').click()
    check('member add',page.locator('#memberRows tr').count()==9)
    page.locator('#memberRows tr').last.locator('button').click()
    check('member remove',page.locator('#memberRows tr').count()==8)
    page.locator('#addShift').click()
    check('shift add',page.locator('#shiftRows tr').count()==7)
    page.locator('#shiftRows tr').last.locator('button').click()
    check('shift remove',page.locator('#shiftRows tr').count()==6)
    gap=page.locator('#gapText').inner_text();page.locator('#gapPlus').click()
    check('gap increase',page.locator('#gapText').inner_text()!=gap)
    page.locator('#gapMinus').click();check('gap decrease',page.locator('#gapText').inner_text()==gap)
    page.locator('#memberRows input[data-field="unavailable"]').first.fill('2026-12-05')
    page.locator('#generate').click()
    check('validation of fixed unavailable',not page.locator('#error').is_hidden() and '不可日' in page.locator('#error').inner_text())
    page.locator('#memberRows input[data-field="unavailable"]').first.fill('2026-12-12')
    page.locator('#generate').click()
    check('rerun after fix',page.locator('#error').is_hidden())
    # no overlap by checking sample actual assignment (engine already tested)
    with page.expect_download() as d:
        page.locator('#save').click()
    check('JSON download',d.value.suggested_filename=='banmaru-settings.json')
    with page.expect_download() as d:
        page.locator('#exportCsv').click()
    check('CSV download',d.value.suggested_filename=='banmaru-roster.csv')
    # reload page and ensure localStorage persistence
    page.locator('#memberRows input[data-field="name"]').first.fill('テスト匿名')
    page.set_content(html,wait_until='load')
    check('localStorage persisted',page.locator('#memberRows input[data-field="name"]').first.input_value()=='テスト匿名')
    # import JSON and assert restoration
    import_file=BASE/'fixture-import.json'
    sample=json.loads(page.evaluate('localStorage.getItem("banmaru-settings-v1")'))
    sample['members'][0]['name']='復元された人'
    import_file.write_text(json.dumps(sample,ensure_ascii=False),encoding='utf-8')
    page.locator('#loadFile').set_input_files(str(import_file))
    check('JSON import',page.locator('#memberRows input[data-field="name"]').first.input_value()=='復元された人')
    # invalid JSON shows error instead of replacing working state
    invalid=BASE/'fixture-invalid.json';invalid.write_text('{',encoding='utf-8')
    page.locator('#loadFile').set_input_files(str(invalid))
    check('invalid JSON error',not page.locator('#error').is_hidden())
    page.once('dialog',lambda d:d.accept());page.locator('#reset').click()
    check('reset restored',page.locator('#memberRows input[data-field="name"]').first.input_value()=='メンバー01')
    context.close()
    mobile=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True)
    mobile_page=mobile.new_page();load_page(mobile_page)
    check('mobile loaded',mobile_page.locator('#filled').inner_text().startswith('12 / 12'))
    check('mobile no global horizontal overflow',mobile_page.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'))
    mobile_page.screenshot(path=str(BASE/'mobile.png'),full_page=True)
    browser.close()

(BASE/'browser-test-results.json').write_text(json.dumps({'passed':len(passed),'checks':passed,'page_errors':errors},ensure_ascii=False,indent=2),encoding='utf-8')
print(f'Chromium E2E: {len(passed)}/{len(passed)} passed')
for x in passed: print('✓',x)