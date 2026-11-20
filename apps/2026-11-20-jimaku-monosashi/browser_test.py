"""Chromium smoke + functional E2E; launch: python browser_test.py"""
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE=Path(__file__).parent
checks=[]
def load_inline(page):
    # Managed Chromium forbids file://; test the exact local CSS and JS by embedding them.
    html=(BASE/'index.html').read_text(encoding='utf-8')
    html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+ (BASE/'style.css').read_text(encoding='utf-8')+'</style>')
    for name in ('engine.js','app.js'):
        html=html.replace('<script src="'+name+'"></script>','<script>'+ (BASE/name).read_text(encoding='utf-8')+'</script>')
    page.set_content(html,wait_until='load')

def check(label, condition):
    if not condition:
        raise AssertionError(label)
    checks.append(label)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox','--disable-dev-shm-usage'])
    context=browser.new_context(viewport={'width':1440,'height':1000},accept_downloads=True,locale='ja-JP', device_scale_factor=1)
    page=context.new_page()
    errors=[]
    page.on('pageerror',lambda err: errors.append(str(err)))
    load_inline(page)
    page.wait_for_timeout(350)
    check('document loads',page.title().startswith('字幕ものさし'))
    check('sample loaded',page.locator('#statTotal').inner_text()=='5')
    check('sample overlap flagged',int(page.locator('#statErrors').inner_text())>=1)
    check('editable cues',page.locator('.cue-item').count()==5)
    check('download buttons present',page.locator('#srtBtn').is_visible() and page.locator('#vttBtn').is_visible())
    page.screenshot(path=str(BASE/'desktop.png'),full_page=True)
    page.locator('#tabProblem').click()
    check('problems filter works',0<page.locator('.cue-item').count()<5)
    page.locator('#tabAll').click()
    check('all filter restores list',page.locator('.cue-item').count()==5)
    page.locator('#preset').select_option('strict')
    check('preset changes rules',page.locator('#ruleCps').input_value()=='4')
    page.locator('#preset').select_option('jp')
    page.locator('#ruleCps').fill('5')
    page.locator('#ruleCps').dispatch_event('change')
    check('custom rules change',page.locator('#ruleCps').input_value()=='5')
    page.locator('#ruleCps').fill('6');page.locator('#ruleCps').dispatch_event('change')
    before=page.locator('.cue-item').first.locator('.cue-text').inner_text()
    page.locator('#editText').fill('手動で内容を修正しました。')
    page.locator('#saveCue').click()
    check('manual text editing',page.locator('.cue-item').first.locator('.cue-text').inner_text()=='手動で内容を修正しました。')
    page.locator('#undoBtn').click()
    check('undo manual edit',page.locator('.cue-item').first.locator('.cue-text').inner_text()==before)
    page.locator('#overlapBtn').click()
    check('auto overlap repaired',page.locator('#statErrors').inner_text()=='0')
    check('changes logged',int(page.locator('#logCount').inner_text().split(' ')[1].replace('件',''))>=1)
    page.locator('#undoBtn').click()
    check('undo restores overlap',int(page.locator('#statErrors').inner_text())>=1)
    page.locator('#wrapBtn').click()
    check('auto line wrap logs changes',not page.locator('#undoBtn').is_disabled())
    check('preview shows active cue',bool(page.locator('#previewText').inner_text()))
    with page.expect_download() as info:
        page.locator('#srtBtn').click()
    path=BASE/'sample_export.srt';info.value.save_as(path)
    text=path.read_text(encoding='utf-8')
    check('SRT download content',text.startswith('1\n00:00:01,000 -->'))
    with page.expect_download() as info:
        page.locator('#vttBtn').click()
    path=BASE/'sample_export.vtt';info.value.save_as(path)
    check('VTT download content',path.read_text(encoding='utf-8').startswith('WEBVTT\n\n'))
    with page.expect_download() as info:
        page.locator('#csvBtn').click()
    path=BASE/'sample_report.csv';info.value.save_as(path)
    check('CSV download content', '指摘数' in path.read_text(encoding='utf-8-sig'))
    page.locator('#pasteToggle').click()
    check('paste panel expands',page.locator('#pastePanel').is_visible())
    page.locator('#pasteText').fill('WEBVTT\n\n00:00:01.000 --> 00:00:02.800\n新しい字幕\n\n00:00:03.000 --> 00:00:05.000\n完了です。')
    page.locator('#pasteLoad').click()
    check('VTT pasted import',page.locator('#statTotal').inner_text()=='2')
    page.locator('#pasteToggle').click()
    page.locator('#pasteText').fill('malformed subtitle file')
    page.locator('#pasteLoad').click()
    check('malformed import error surfaced', '読み込み' not in page.locator('#status').inner_text() and page.locator('#status').get_attribute('class')=='status bad')
    check('malformed import keeps prior state',page.locator('#statTotal').inner_text()=='2')
    page.locator('#pasteCancel').click()
    # verify that untrusted source is inserted as text, not HTML
    page.locator('#editText').fill('<img src=x onerror=alert(7)>')
    page.locator('#saveCue').click()
    check('injected HTML remains text',page.locator('.cue-item').first.locator('img').count()==0)
    check('preview uses text, no HTML',page.locator('#previewText img').count()==0)
    check('no console page errors',not errors)
    mobile=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1,accept_downloads=True)
    mp=mobile.new_page();load_inline(mp)
    mp.wait_for_timeout(200)
    check('mobile load',mp.locator('#statTotal').inner_text()=='5')
    check('mobile no horizontal overflow',mp.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 2'))
    mp.screenshot(path=str(BASE/'mobile.png'),full_page=True)
    check('mobile edit button visible',mp.locator('#saveCue').is_visible())
    mobile.close();context.close();browser.close()
print(f'CHROMIUM: {len(checks)}/{len(checks)} PASS')
for label in checks: print('  OK',label)
