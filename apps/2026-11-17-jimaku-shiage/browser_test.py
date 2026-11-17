"""Chromium E2E checks; requires playwright and system Chromium.
Run: python browser_test.py
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json

ROOT = Path(__file__).resolve().parent
checks=[]
def ok(name, cond):
    assert cond, name
    checks.append(name)
    print('PASS',len(checks),name)

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':1000},accept_downloads=True)
    errors=[]
    page.on('pageerror', lambda e: errors.append(str(e)))
    mode='file'
    try:
        page.goto(ROOT.joinpath('index.html').as_uri(),wait_until='load',timeout=10000)
        page.wait_for_function("!!window.JimakuEngine && document.getElementById('maxCps').value !== ''", timeout=3000)
    except Exception:
        mode='injected'
        html=(ROOT/'index.html').read_text()
        html=html.replace('<script src="engine.js"></script><script src="app.js"></script>','')
        page.close()
        page=browser.new_page(viewport={'width':1440,'height':1000},accept_downloads=True)
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.set_content(html)
        # Storage simulation for about:blank when file navigation is prohibited.
        page.evaluate('''() => {const d=new Map(); Object.defineProperty(window,"localStorage",{value:{getItem:k=>d.get(k)||null,setItem:(k,v)=>d.set(k,String(v)),removeItem:k=>d.delete(k)},configurable:true});}''')
        page.add_script_tag(path=str(ROOT/'engine.js'))
        page.add_script_tag(path=str(ROOT/'app.js'))
    print('MODE',mode)
    ok('title', '字幕しあげ' in page.title())
    ok('default profile',page.locator('#maxCps').input_value()=='10')
    ok('empty start',page.locator('#totalCount').inner_text()=='0')
    page.locator('#sampleBtn').click()
    ok('sample loaded',page.locator('#totalCount').inner_text()=='3')
    ok('flagged count',int(page.locator('#flaggedCount').inner_text())>=1)
    ok('rendered 3 cues',page.locator('.cue').count()==3)
    ok('selected first',page.locator('#selectedName').inner_text().startswith('#1'))
    ok('reading speed shown', '文字/秒' in page.locator('#editStats').inner_text())
    page.screenshot(path=str(ROOT/'desktop.png'),full_page=True)
    page.locator('#breakBtn').click()
    ok('break suggestion', '\n' in page.locator('#editText').input_value())
    page.locator('#saveCueBtn').click()
    ok('break saved', '\n' in page.locator('.cue').first.locator('.cue-body').inner_text())
    page.locator('#overlapBtn').click()
    ok('overlap fixed', '短縮' in page.locator('#status').inner_text())
    ok('overlap gone', '次の字幕と重複' not in page.locator('.cue').first.inner_text())
    page.locator('#filter').select_option('flagged')
    ok('issue filter',page.locator('.cue').count()<=3)
    page.locator('#filter').select_option('all')
    page.locator('#preset').select_option('horizontal')
    ok('wide viewport',page.locator('#videoWrap').evaluate('(e)=>e.classList.contains("wide")'))
    ok('preset updates',page.locator('#maxLine').input_value()=='22')
    page.locator('.cue').last.click()
    ok('cue selection',page.locator('#selectedName').inner_text().startswith('#3'))
    page.locator('#editText').fill('字幕の内容を編集')
    page.locator('#startTime').fill('00:00:04,000')
    page.locator('#endTime').fill('00:00:05,200')
    page.locator('#saveCueBtn').click()
    ok('text edit saved','字幕の内容を編集' in page.locator('.cue').last.inner_text())
    with page.expect_download() as d:
        page.locator('#srtBtn').click()
    download=d.value
    path=ROOT/'browser-export.srt'
    download.save_as(path)
    ok('download SRT', path.read_text().startswith('1\n00:'))
    with page.expect_download() as d:
        page.locator('#vttBtn').click()
    download=d.value
    path=ROOT/'browser-export.vtt';download.save_as(path)
    ok('download VTT',path.read_text().startswith('WEBVTT'))
    with page.expect_download() as d:
        page.locator('#csvBtn').click()
    download=d.value
    path=ROOT/'browser-report.csv';download.save_as(path)
    ok('download CSV','issues' in path.read_text(encoding='utf-8-sig'))
    with page.expect_download() as d:
        page.locator('#jsonBtn').click()
    download=d.value
    json_path=ROOT/'browser-project.json';download.save_as(json_path)
    ok('download JSON',len(json.loads(json_path.read_text())['cues'])==3)
    page.locator('#addCueBtn').click()
    ok('create cue',page.locator('#totalCount').inner_text()=='4')
    page.locator('#deleteCueBtn').click()
    ok('delete cue',page.locator('#totalCount').inner_text()=='3')
    page.locator('#saveLocalBtn').click()
    ok('local save','保存しました' in page.locator('#status').inner_text())
    page.locator('#clearBtn').click()
    ok('clear',page.locator('#totalCount').inner_text()=='0')
    page.locator('#loadLocalBtn').click()
    ok('restore local',page.locator('#totalCount').inner_text()=='3')
    page.locator('#clearBtn').click()
    page.locator('#jsonInput').set_input_files(str(json_path))
    ok('JSON file restore',page.locator('#totalCount').inner_text()=='3')
    page.locator('#clearBtn').click()
    bad='1\n00:00:02,000 --> 00:00:01,000\nInvalid'
    page.locator('#source').fill(bad)
    page.locator('#parseBtn').click()
    ok('invalid blocks rejected',page.locator('#parseError').is_visible())
    ok('invalid import no partial success',page.locator('#totalCount').inner_text()=='0')
    page.locator('#source').fill('1\n00:00:00,000 --> 00:00:03,000\n<img src=x onerror=alert(1)>')
    page.locator('#parseBtn').click()
    ok('XSS not interpreted',page.locator('.cue img').count()==0)
    ok('no JS errors',not errors)
    page.set_viewport_size({'width':390,'height':850})
    page.screenshot(path=str(ROOT/'mobile.png'),full_page=True)
    ok('mobile no overflow',page.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 2'))
    browser.close()
print('SUMMARY',len(checks),'/',len(checks),'passed, mode:',mode)
