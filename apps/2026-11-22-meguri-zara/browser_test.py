from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from threading import Thread
from pathlib import Path
from functools import partial
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).parent
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *args): pass
server=ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/index.html'
checks=[]
def check(name, ok):
    checks.append((name, bool(ok)))
    if not ok: raise AssertionError(name)
try:
  with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page(viewport={'width':1365,'height':850}, device_scale_factor=1, accept_downloads=True)
    errors=[]; requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:requests.append(r.url) if not r.url.startswith('http://127.0.0.1:') else None)
    # Browser sandbox blocks loopback URLs. Inject the exact HTML + engine.js source
    # as one page; provide deterministic in-memory localStorage for interaction tests.
    html=(ROOT/'index.html').read_text(encoding='utf8').replace(
      '<script src="engine.js"></script>',
      '<script>'+ (ROOT/'engine.js').read_text(encoding='utf8') + '</script>')
    def show_content(saved=None):
      init='''<script>window.__store = JSON.parse(%s);Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>window.__store[k]??null,setItem:(k,v)=>{window.__store[k]=String(v)},removeItem:k=>delete window.__store[k]}})</script>''' % __import__('json').dumps(__import__('json').dumps(saved or {}))
      page.set_content(html.replace('</head>',init+'</head>'),wait_until='load')
    show_content()
    check('full local source loads',page.title().startswith('巡り皿'))
    check('brand visible',page.get_by_text('巡り皿',exact=True).count()>=1)
    check('plan contains demand summary',page.get_by_text('435',exact=False).count()>=1)
    check('shortage initial 15',page.locator('.stat.attention strong').inner_text().strip()=='15個')
    check('initial control 180',page.locator('#p-initial').input_value()=='180')
    check('table has 8 slots',page.locator('tbody tr').count()==8)
    check('bar columns have 8 slots',page.locator('.bar-col').count()==8)
    page.screenshot(path=str(ROOT/'desktop.png'),full_page=True)
    page.get_by_role('button',name='推奨初期在庫 195 個に変更').click()
    check('recommend changes initial',page.locator('#p-initial').input_value()=='195')
    check('no shortage after recommend',page.locator('.stat.attention').count()==0)
    page.locator('#p-rate').fill('100');page.locator('#p-rate').dispatch_event('change')
    check('change return assumption',page.locator('#p-rate').input_value()=='100')
    page.get_by_role('button',name='＋ 時間枠').click()
    check('add slot',page.locator('tbody tr').count()==9)
    page.get_by_role('button',name='－ 最終枠').click()
    check('remove slot',page.locator('tbody tr').count()==8)
    page.locator('[data-slot="0"][data-prop="demand"]').fill('30')
    page.locator('[data-slot="0"][data-prop="demand"]').dispatch_event('change')
    check('demand edit persisted',page.locator('[data-slot="0"][data-prop="demand"]').input_value()=='30')
    saved=page.evaluate("window.__store")
    show_content(saved)
    check('localStorage persists after reload',page.locator('[data-slot="0"][data-prop="demand"]').input_value()=='30')
    with page.expect_download() as dl:
        page.get_by_role('button',name='JSON保存').click()
    check('JSON exported',dl.value.suggested_filename=='meguri-zara-plan.json')
    with page.expect_download() as dl:
        page.get_by_role('button',name='CSV出力').click()
    check('CSV exported',dl.value.suggested_filename=='meguri-zara-report.csv')
    page.locator('[data-tab="ledger"]').click()
    check('ledger started from 180',page.get_by_text('開始清潔在庫').count()>=1)
    check('ledger starts empty',page.get_by_text('取引を入力すると').count()==1)
    page.locator('#log-qty').fill('25')
    page.locator('[data-action="record"]').click()
    check('issue decreases clean',page.locator('.ledger-stats .stat').nth(0).locator('strong').inner_text()=='155 個')
    check('issue increases out',page.locator('.ledger-stats .stat').nth(1).locator('strong').inner_text()=='25 個')
    check('history row added',page.locator('tbody tr').count()==1)
    page.locator('#log-type').select_option('return');page.locator('#log-qty').fill('12');page.locator('[data-action="record"]').click()
    check('return does not increase clean',page.locator('.ledger-stats .stat').nth(0).locator('strong').inner_text()=='155 個')
    check('return increases dirty',page.locator('.ledger-stats .stat').nth(2).locator('strong').inner_text()=='12 個')
    check('return changes deposit held',page.locator('.ledger-stats .stat').nth(3).locator('strong').inner_text()=='2,600 円')
    page.locator('#log-type').select_option('return');page.locator('#log-qty').fill('14');page.locator('[data-action="record"]').click()
    check('invalid over-return blocked',page.locator('tbody tr').count()==2)
    check('error message appears',page.locator('#toast.error').is_visible())
    page.locator('#log-type').select_option('supply');page.locator('#log-qty').fill('30');page.locator('[data-action="record"]').click()
    check('supply adds clean',page.locator('.ledger-stats .stat').nth(0).locator('strong').inner_text()=='185 個')
    page.locator('[data-action="undo"]').click()
    check('undo returns balance',page.locator('.ledger-stats .stat').nth(0).locator('strong').inner_text()=='155 個')
    saved=page.evaluate("window.__store")
    show_content(saved)
    page.locator('[data-tab="ledger"]').click()
    check('ledger persisted through reload',page.locator('tbody tr').count()==2)
    page.locator('[data-tab="help"]').click()
    check('safety guidance visible',page.get_by_text('清潔在庫と返却在庫を混ぜない').count()==1)
    page.locator('[data-tab="plan"]').click()
    page.set_viewport_size({'width':390,'height':844})
    page.screenshot(path=str(ROOT/'mobile.png'),full_page=True)
    print('SCROLL_DEBUG', page.evaluate("({doc:document.documentElement.scrollWidth, vw:window.innerWidth, nodes:[...document.querySelectorAll('*')].filter(x=>x.getBoundingClientRect().right>innerWidth+1).slice(0,12).map(x=>[x.tagName,x.className,x.getBoundingClientRect().right])})"),flush=True)
    check('mobile body no horizontal overflow',page.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'))
    check('mobile plan visible',page.locator('#p-initial').is_visible())
    check('no javascript exceptions',not errors)
    check('no external requests',not requests)
    browser.close()
finally:
  server.shutdown()
for k,v in checks: print(('PASS' if v else 'FAIL'),k)
print(f'BROWSER TESTS: {len(checks)}/{len(checks)} PASS')
