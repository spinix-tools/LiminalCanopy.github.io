"""Chromium tests: same local source inline because file:// navigation is blocked by administrator."""
from pathlib import Path
import os
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent

def load_page(page):
    content=(ROOT/'index.html').read_text()
    content=content.replace('<link rel="stylesheet" href="style.css">','<style>'+ (ROOT/'style.css').read_text() + '</style>')
    for filename in ['engine.js','app.js']:
        content=content.replace('<script src="'+filename+'"></script>','<script>'+ (ROOT/filename).read_text() + '</script>')
    page.set_content(content,wait_until='load')

checks=0

def check(cond,label):
    global checks
    assert cond, label
    checks+=1
    print('PASS',label)

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page(viewport={'width':1440,'height':970},accept_downloads=True,device_scale_factor=1)
    errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    load_page(page)
    check(page.title().startswith('じまく整え'),'HTML and actual CSS/JS inline load')
    check(page.locator('#totalStat').inner_text()=='0','empty initial state')
    page.locator('#sampleBtn').click()
    page.screenshot(path=str(ROOT/'desktop.png'),full_page=True)
    check(page.locator('#totalStat').inner_text()=='4','sample loads 4 cues')
    check(page.locator('#errorsStat').inner_text()!='0','sample detects overlap')
    check(page.locator('#warningsStat').inner_text()!='0','sample detects warnings')
    check(page.locator('.cue-row').count()==4,'four editable rows')
    check('みなさん' in page.locator('#previewText').inner_text(),'preview follows first cue')
    page.locator('[data-filter="issues"]').click()
    count=page.locator('.cue-row').count()
    check(count>=2,'issues filter works')
    page.locator('[data-filter="all"]').click()
    check(page.locator('.cue-row').count()==4,'all filter restores rows')
    page.locator('#fixBtn').click()
    check('行分割' in page.locator('#fixFeedback').inner_text(),'fix summary shown')
    check(page.locator('#undoBtn').is_enabled(),'undo enabled after fix')
    page.locator('#undoBtn').click()
    check('ひとつ前' in page.locator('#fixFeedback').inner_text(),'undo feedback')
    page.locator('#ruleCps').fill('5')
    page.locator('#ruleCps').dispatch_event('change')
    check(int(page.locator('#warningsStat').inner_text())>0,'custom CPS threshold changes QA')
    page.locator('#addCueBtn').click()
    check(page.locator('#totalStat').inner_text()=='5','add cue')
    page.locator('.cue-row').last.locator('textarea').fill('テストの字幕')
    page.locator('.cue-row').last.locator('textarea').dispatch_event('change')
    check('テストの字幕' in page.locator('.cue-row').last.locator('textarea').input_value(),'edit text')
    page.locator('.cue-row').last.locator('input[data-key="start"]').fill('00:00:12,000')
    page.locator('.cue-row').last.locator('input[data-key="start"]').dispatch_event('change')
    check(page.locator('.cue-row').last.locator('input[data-key="start"]').input_value()=='00:00:12,000','edit start')
    page.locator('.cue-row').last.locator('[data-action="delete"]').click()
    check(page.locator('#totalStat').inner_text()=='4','delete cue')
    page.locator('#seekSlider').fill('1800')
    check(page.locator('#currentTime').inner_text()=='00:01.8','preview seek')
    with page.expect_download() as d:
        page.locator('#exportSrt').click()
    dl=d.value
    srtpath=ROOT/'download-test.srt'
    dl.save_as(str(srtpath))
    check(dl.suggested_filename=='jimaku-totoe.srt','SRT download filename')
    check('-->' in srtpath.read_text(encoding='utf-8-sig'),'SRT downloadable contents')
    with page.expect_download() as d: page.locator('#exportVtt').click()
    vtt=ROOT/'download-test.vtt';d.value.save_as(str(vtt))
    check(vtt.read_text(encoding='utf-8-sig').startswith('WEBVTT'),'WebVTT output')
    with page.expect_download() as d: page.locator('#exportCsv').click()
    csv=ROOT/'download-test.csv';d.value.save_as(str(csv))
    check('字/秒' in csv.read_text(encoding='utf-8-sig'),'CSV report')
    page.locator('#sourceInput').fill('WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nブラウザ字幕')
    page.locator('#parseBtn').click()
    check(page.locator('#totalStat').inner_text()=='1','VTT import via text')
    check('WebVTT' in page.locator('#formatChip').inner_text(),'VTT format shown')
    check(page.locator('#previewText').count()==1,'preview mounted')
    page.locator('#playBtn').click()
    check(page.locator('#playBtn').get_attribute('aria-label')=='一時停止','preview playing')
    page.locator('#playBtn').click()
    check(page.locator('#playBtn').get_attribute('aria-label')=='再生','preview paused')
    check(not errors, 'no JavaScript page errors: '+str(errors))
    # Mobile viewport tested against the same local files inlined.
    mobile=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1)
    load_page(mobile)
    mobile.screenshot(path=str(ROOT/'mobile.png'),full_page=True)
    check(mobile.locator('html').evaluate('(el)=>el.scrollWidth<=window.innerWidth+1'),'mobile layout no horizontal overflow')
    mobile.locator('#sampleBtn').click()
    check(mobile.locator('#totalStat').inner_text()=='4','mobile sample works')
    print(f'PASSED {checks} browser checks')
    browser.close()
