"""Browser-level checks. Requires playwright and chromium. Run: python browser_test.py"""
from pathlib import Path
import tempfile
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parent
def inline_page():
    html=(ROOT/'index.html').read_text()
    html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+ (ROOT/'style.css').read_text() +'</style>')
    for name in ('engine.js','app.js'):
        html=html.replace('<script src="'+name+'"></script>', '<script>'+ (ROOT/name).read_text()+'</script>')
    return html
HTML=inline_page()
def load(page):
    page.evaluate('''() => { const store = window.__mockStorage || {}; window.__mockStorage = store;
        Object.defineProperty(window, 'localStorage', {configurable: true, value:{
          getItem: key => store[key] ?? null, setItem: (key,val) => {store[key]=String(val)},
          removeItem: key => {delete store[key]}, clear:()=>{for(const key of Object.keys(store))delete store[key]}
        }});
    }''')
    page.set_content(HTML,wait_until='load')

checks=[]
def check(name, condition):
    assert condition, name
    checks.append(name)
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':1440,'height':950},accept_downloads=True)
    page=context.new_page()
    errors=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    load(page)
    check('title',page.title().startswith('字幕の間'))
    check('empty state',page.locator('#statTotal').inner_text()=='0')
    page.locator('#demoBtn').click()
    check('demo loaded',page.locator('#statTotal').inner_text()=='4')
    check('issues diagnosed',int(page.locator('#statProblems').inner_text())>=2)
    check('cue text appears',page.locator('.cue-text').count()==4)
    page.locator('#preset').select_option('strict')
    check('strict preset 4 cps',page.locator('#cps').input_value()=='4')
    page.locator('#preset').select_option('casual')
    before=page.locator('.cue-text').nth(0).input_value()
    page.locator('.cue').first.locator('[data-action=wrap]').click()
    after=page.locator('.cue-text').nth(0).input_value()
    check('wrap preserves letters',before.replace('\n','')==after.replace('\n',''))
    check('wrap added a newline', '\n' in after)
    page.locator('#undoBtn').click()
    check('undo restored',page.locator('.cue-text').nth(0).input_value()==before)
    page.locator('.cue').first.locator('[data-action=split]').click()
    check('split creates cue',page.locator('#statTotal').inner_text()=='5')
    page.locator('#undoBtn').click()
    check('split undo',page.locator('#statTotal').inner_text()=='4')
    page.locator('#addBtn').click()
    check('add cue',page.locator('#statTotal').inner_text()=='5')
    page.locator('.cue').last.locator('[data-action=delete]').click()
    check('delete cue',page.locator('#statTotal').inner_text()=='4')
    page.locator('.cue-text').first.fill('新しい編集済み字幕')
    page.locator('.cue-text').first.blur()
    check('text editing',page.locator('.cue-text').first.input_value()=='新しい編集済み字幕')
    page.locator('.cue-times input').first.fill('00:00:00.500')
    page.locator('.cue-times input').first.blur()
    check('timestamp editable',page.locator('.cue-times input').first.input_value()=='00:00:00.500')
    page.locator('#shiftMs').fill('250')
    page.locator('#shiftBtn').click()
    check('offset works',page.locator('.cue-times input').first.input_value()=='00:00:00.750')
    page.locator('#seek').fill('200')
    page.locator('#playBtn').click()
    check('play button toggles',page.locator('#playBtn').inner_text().startswith('Ⅱ'))
    page.locator('#playBtn').click()
    check('pause toggles',page.locator('#playBtn').inner_text().startswith('▶'))
    with page.expect_download() as dl: page.locator('#saveSrtBtn').click()
    d=dl.value
    check('SRT download',d.suggested_filename.endswith('.srt'))
    with tempfile.TemporaryDirectory() as directory:
        path=Path(directory)/d.suggested_filename;d.save_as(path)
        check('SRT format', ' --> ' in path.read_text(encoding='utf-8-sig'))
    with page.expect_download() as dl: page.locator('#saveVttBtn').click()
    check('VTT download',dl.value.suggested_filename.endswith('.vtt'))
    with page.expect_download() as dl: page.locator('#saveJsonBtn').click()
    d=dl.value
    with tempfile.TemporaryDirectory() as directory:
        path=Path(directory)/d.suggested_filename;d.save_as(path)
        check('JSON export', 'JIMAKU-MA' in path.read_text(encoding='utf-8-sig'))
        page.locator('#jsonInput').set_input_files(path)
        check('JSON import',page.locator('#statTotal').inner_text()=='4')
    load(page)
    check('localStorage persistence',page.locator('#statTotal').inner_text()=='4')
    page.screenshot(path=str(ROOT/'desktop.png'),full_page=True)
    context2=browser.new_context(viewport={'width':390,'height':844},accept_downloads=True)
    mob=context2.new_page();load(mob)
    mob.locator('#demoBtn').click()
    check('mobile cards',mob.locator('.cue').count()==4)
    check('mobile no horizontal overflow',mob.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'))
    mob.screenshot(path=str(ROOT/'mobile.png'),full_page=True)
    check('no browser errors',len(errors)==0)
    browser.close()
print(f'{len(checks)}/{len(checks)} browser assertions passed')
for name in checks:print('PASS',name)
