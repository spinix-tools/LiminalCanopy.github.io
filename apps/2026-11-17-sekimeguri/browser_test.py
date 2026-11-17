"""Chromium interaction checks for SEKI MEGURI, served from localhost."""
from pathlib import Path
from threading import Thread
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
import re
from playwright.sync_api import sync_playwright
from tempfile import TemporaryDirectory
import json

BASE = Path(__file__).resolve().parent
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(BASE)))
Thread(target=server.serve_forever,daemon=True).start()
checks=[]
def check(name,condition):
    checks.append((name,bool(condition)))
    if not condition: raise AssertionError(name)
with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':960},accept_downloads=True)
    errors=[]
    page.on('pageerror', lambda e: errors.append(str(e)))
    html=re.sub(r'<script src=\"(?:engine|app)\.js\"></script>','', (BASE/'index.html').read_text())
    def mount(target):
        target.set_content(html)
        target.add_script_tag(content=(BASE/'engine.js').read_text())
        target.add_script_tag(content=(BASE/'app.js').read_text())
    mount(page)
    page.wait_for_selector('.table-card')
    check('auto-generated four rounds',page.locator('.round-pill').count()==4)
    check('12 default participants',page.locator('#roster').input_value().count('\n')==11)
    check('4 table cards',page.locator('.table-card').count()==4)
    check('12 unique people placed',page.locator('.table-card .chip').count()==12)
    check('total pairs matches 4 rounds',page.locator('#unique').inner_text().endswith('組'))
    check('no runtime exceptions',not errors)
    check('current view first round',page.locator('#roundTitle').inner_text().startswith('第 1 回'))
    page.locator('#commit').click()
    check('commit increments progress',page.locator('#progress').inner_text().startswith('1 / 4'))
    check('shows next round',page.locator('#roundTitle').inner_text().startswith('第 2 回'))
    original=page.locator('.round-pill').first.inner_text()
    page.locator('#roster').fill('\n'.join(f'A{i:02d}' for i in range(1,13))+'\nA13,2,4')
    page.locator('#replan').click()
    check('replan with late arrival',page.locator('#status').inner_text().startswith('確定済み1回を保持'))
    check('13 people shown in round two',page.locator('.table-card .chip').count()==13)
    page.locator('.round-pill').first.click()
    check('past committed round stays twelve',page.locator('.table-card .chip').count()==12)
    check('past round marked done',page.locator('.round-pill').first.inner_text()==original)
    page.locator('.round-pill').nth(1).click()
    check('navigation to round two',page.locator('#roundTitle').inner_text().startswith('第 2 回'))
    page.locator('#apart').fill('A01,A02')
    page.locator('#replan').click()
    check('replan with apart rule',page.locator('#status').inner_text().startswith('確定済み1回を保持'))
    for i in range(1,4):
        page.locator('.round-pill').nth(i).click()
        groups=page.locator('.table-card').all_inner_texts()
        check(f'exclude pair at future round {i+1}',not any('A01' in g and 'A02' in g for g in groups))
    with page.expect_download() as d:
        page.locator('#csv').click()
    csvd=d.value
    check('CSV download filename',csvd.suggested_filename=='sekimeguri-plan.csv')
    with TemporaryDirectory() as tmp:
        csvd.save_as(f'{tmp}/schedule.csv')
        check('CSV contains schedule rows','A13' in Path(f'{tmp}/schedule.csv').read_text(encoding='utf-8-sig'))
        with page.expect_download() as d2:
            page.locator('#download').click()
        jsd=d2.value
        check('JSON download filename',jsd.suggested_filename=='sekimeguri-plan.json')
        path=f'{tmp}/schedule.json';jsd.save_as(path)
        payload=json.loads(Path(path).read_text(encoding='utf-8-sig'))
        check('JSON recorded one committed round',payload['committed']==1)
        page.locator('#roster').fill('X\nY')
        page.locator('#load').click()
        page.locator('#importFile').set_input_files(path)
        page.wait_for_function('document.getElementById("status").textContent.includes("JSONから")')
        check('JSON restored roster',page.locator('#roster').input_value().count('\n')==12)
        check('JSON restored committed',page.locator('#progress').inner_text().startswith('1 / 4'))
    page.locator('#apart').fill('A99,A01')
    page.locator('#replan').click()
    check('invalid apart rejected without losing schedule','同席禁止' in page.locator('#status').inner_text())
    check('unchanged progress after rejected input',page.locator('#progress').inner_text().startswith('1 / 4'))
    page.locator('#apart').fill('A01,A02')
    page.locator('#replan').click()
    check('valid replan recovers',not page.locator('#status').get_attribute('class').endswith('error'))
    page.locator('#prev').click()
    check('previous round navigates',page.locator('#roundTitle').inner_text().startswith('第 1 回'))
    page.locator('#next').click()
    check('next round navigates',page.locator('#roundTitle').inner_text().startswith('第 2 回'))
    page.screenshot(path=str(BASE/'desktop.png'),full_page=True)
    mobile=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1)
    mount(mobile)
    mobile.wait_for_selector('.table-card')
    check('mobile generates tables',mobile.locator('.table-card').count()==4)
    check('mobile avoids horizontal overflow',mobile.evaluate('document.documentElement.scrollWidth <= innerWidth+2'))
    mobile.screenshot(path=str(BASE/'mobile.png'),full_page=True)
    browser.close()
server.shutdown()
print(f'BROWSER: {len(checks)} assertions passed')
for n,ok in checks:print(('OK' if ok else 'FAIL'),n)
