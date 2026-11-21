"""Browser integration smoke test for ROKO DANDORI. Requires playwright + chromium."""
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from threading import Thread
import json, tempfile, os, re
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
CHECKS = []

def check(cond, name):
    assert cond, name
    CHECKS.append(name)

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args): pass

def main():
    old = os.getcwd()
    os.chdir(ROOT)
    server = ThreadingHTTPServer(('127.0.0.1', 0), QuietHandler)
    t = Thread(target=server.serve_forever, daemon=True); t.start()
    url = f'http://127.0.0.1:{server.server_address[1]}/index.html'
    errors = []
    requests = []
    try:
      with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox','--no-proxy-server'])
        context = browser.new_context(accept_downloads=True, viewport={'width':1440,'height':1000}, device_scale_factor=1)
        page = context.new_page()
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('request', lambda r: requests.append(r.url))
        try:
            page.goto(url, wait_until='load', timeout=7000)
        except Exception as e:
            if 'ERR_BLOCKED_BY_ADMINISTRATOR' not in str(e): raise
            page.close(); page = context.new_page()
            page.on('pageerror', lambda e: errors.append(str(e)))
            # Managed Chromium forbids file:// and localhost. Test the same source
            # in a non-network document; simulate localStorage only for this harness.
            html = (ROOT/'index.html').read_text(encoding='utf-8')
            html = re.sub(r'<link rel="stylesheet" href="style.css">', '', html)
            html = re.sub(r'<script src="(?:engine|app).js"></script>', '', html)
            html = html.replace('</head>', '<style>'+ (ROOT/'style.css').read_text(encoding='utf-8') + '</style></head>')
            page.set_content(html, wait_until='load')
            page.evaluate('''() => {
                const data={};
                Object.defineProperty(window,'localStorage',{configurable:true,value:{
                   setItem(k,v){data[k]=String(v)},getItem(k){return data[k]??null},removeItem(k){delete data[k]}
                }});
            }''')
            page.add_script_tag(content=(ROOT/'engine.js').read_text(encoding='utf-8'))
            page.add_script_tag(content=(ROOT/'app.js').read_text(encoding='utf-8'))
        check(page.title() == '露光段取り / ROKO DANDORI', 'title')
        check(page.locator('#totalTime').inner_text() != '—', 'initial computed total')
        check(page.locator('.shot-card').count()==3, 'three sample scenes')
        check(page.locator('.frame').count()==7, 'initial bracket scenes generate 7 frames')
        check('SCENE 01' in page.locator('.shot-head').first.inner_text(), 'scene ordering')
        check(page.locator('#endTime').inner_text().startswith('17:'), 'end time computed')
        check(page.locator('#timeline svg rect').count() > 0, 'visual timeline rendered')
        check(page.locator('#timerFrame option').count()==7, 'timer select follows frames')
        check(page.locator('.error').count()==1 and not page.locator('#error').is_visible(), 'no initial error')
        page.screenshot(path=str(ROOT/'desktop.png'), full_page=True)
        # Update scene and ensure output is escaped.
        name = page.locator('input[aria-label="撮影名"]').first
        name.fill('<img src=x onerror=alert(1)>')
        check(page.locator('img').count()==0, 'untrusted text never becomes HTML')
        check('<img' in page.locator('.frame').first.inner_text(), 'user text displayed literally')
        name.fill('新しい港の景色')
        # ND changes exposure duration while keeping stable frame count.
        before = page.locator('.frame-time strong').first.inner_text()
        page.locator('select[aria-label="NDフィルター 1"]').first.select_option('64')
        after = page.locator('.frame-time strong').first.inner_text()
        check(before != after, 'ND selection updates result')
        # Invalid meter must show an error and block exports.
        meter = page.locator('input[aria-label="測光時間（秒）"]').first
        meter.fill('not a number')
        check(page.locator('#error').is_visible(), 'invalid meter warned')
        check(page.locator('#totalTime').inner_text()=='—', 'invalid result is suppressed')
        meter.fill('1/125')
        check(not page.locator('#error').is_visible(), 'corrected input clears error')
        # Test editing and ordering.
        page.get_by_role('button', name='＋ シーン追加').click()
        check(page.locator('.shot-card').count()==4, 'add scene')
        page.locator('.shot-controls button[title="複製"]').first.click()
        check(page.locator('.shot-card').count()==5, 'duplicate scene')
        page.locator('.shot-controls button[title="下に移動"]').first.click()
        check('コピー' in page.locator('input[aria-label="撮影名"]').first.input_value(), 'move scene')
        page.locator('.shot-controls button[title="削除"]').first.click()
        check(page.locator('.shot-card').count()==4, 'delete scene')
        # Change time budget and clock rollover.
        page.locator('#start').fill('23:59')
        page.locator('#gap').fill('40')
        check('(+1日)' in page.locator('#endTime').inner_text(), 'rollover midnight')
        page.locator('#budget').fill('1')
        check('超過' in page.locator('#budgetDetail').inner_text(), 'budget exceeded warning')
        # Timer: start / pause / reset.
        page.locator('#timerFrame').select_option('5')
        page.locator('#timerStart').click()
        check(page.locator('#timerStatus').inner_text()=='EXPOSING', 'timer starts')
        page.wait_for_timeout(300)
        page.locator('#timerPause').click()
        check(page.locator('#timerStatus').inner_text()=='PAUSED', 'timer pauses')
        page.locator('#timerReset').click()
        check(page.locator('#timerStatus').inner_text()=='READY', 'timer resets')
        # Explicit local storage only; import restores state.
        page.locator('#saveBtn').click()
        check(bool(page.evaluate('localStorage.getItem("roko-dandori-v1")')), 'explicit local save')
        page.locator('input[aria-label="撮影名"]').first.fill('あとで変更')
        page.locator('#loadBtn').click()
        check(page.locator('input[aria-label="撮影名"]').first.input_value()!='あとで変更', 'restore local plan')
        with page.expect_download() as event:
            page.locator('#csvBtn').click()
        csv = event.value.path().read_text(encoding='utf-8-sig')
        check('コマ番号' in csv, 'CSV header')
        check('新しい港の景色' in csv, 'CSV edited contents')
        with page.expect_download() as event:
            page.locator('#jsonBtn').click()
        saved_plan = json.loads(event.value.path().read_text(encoding='utf-8'))
        check(saved_plan['shots'][0]['name']!='あとで変更', 'JSON export')
        page.locator('input[aria-label="撮影名"]').first.fill('temporary')
        page.locator('#jsonFile').set_input_files(files=[{'name':'plan.json','mimeType':'application/json','buffer':json.dumps(saved_plan,ensure_ascii=False).encode('utf-8')}])
        page.get_by_text('JSONから計画を復元しました。').wait_for(state='visible', timeout=4000)
        check(page.locator('input[aria-label="撮影名"]').first.input_value()==saved_plan['shots'][0]['name'], 'JSON import')
        # Reject malformed JSON without replacing previous working plan.
        page.locator('#jsonFile').set_input_files(files=[{'name':'invalid.json','mimeType':'application/json','buffer':b'{"bad":true}'}])
        page.locator('#error').wait_for(state='visible', timeout=3500)
        check('JSON読込' in page.locator('#error').inner_text(), 'reject corrupt import')
        check(page.locator('.shot-card').count()==4, 'corrupt import does not overwrite plan')
        page.locator('#gap').fill('20')
        # Mobile layout.
        page.set_viewport_size({'width':390,'height':844})
        page.wait_for_timeout(150)
        overflow=page.evaluate('document.documentElement.scrollWidth - window.innerWidth')
        check(overflow <= 2, f'mobile viewport horizontal overflow {overflow}px')
        check(page.locator('#timerStart').is_visible(), 'mobile timer visible')
        check(page.locator('.frame').count()>0, 'mobile frames visible')
        page.screenshot(path=str(ROOT/'mobile.png'), full_page=True)
        check(len(errors)==0, 'zero uncaught JavaScript errors')
        check(all(u.startswith('http://127.0.0.1:') for u in requests), 'no external network requests')
        browser.close()
    finally:
      server.shutdown(); server.server_close(); os.chdir(old)
    print(f'CHROMIUM: {len(CHECKS)}/{len(CHECKS)} checks passed')
    for i, name in enumerate(CHECKS,1): print(f'  {i:02d}. {name}')

if __name__ == '__main__': main()
