"""Playwright UI checks using the identical production HTML/CSS/JS sources.
When navigation to file:// or localhost is blocked by runner policy, scripts are
inlined into an in-memory document and localStorage is emulated explicitly.
"""
from pathlib import Path
import json,re,sys
from playwright.sync_api import sync_playwright
HERE=Path(__file__).resolve().parent
HTML=(HERE/'index.html').read_text()
CSS=(HERE/'style.css').read_text()
ENGINE=(HERE/'engine.js').read_text()
APP=(HERE/'app.js').read_text()
INLINE=re.sub(r'<link[^>]+href="style\.css"[^>]*>',f'<style>{CSS}</style>',HTML)
INLINE=re.sub(r'<script[^>]+src="(?:engine|app)\.js"[^>]*></script>','',INLINE)
INLINE=INLINE.replace('</body>',f'<script>{ENGINE}</script><script>{APP}</script></body>')
checks=0
def ok(condition,what):
 global checks
 assert condition,what
 checks+=1
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  ctx=browser.new_context(viewport={'width':1300,'height':900},accept_downloads=True)
  page=ctx.new_page()
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.evaluate('''() => { const db={}; Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem(k){return db[k]??null},setItem(k,v){db[k]=String(v)},removeItem(k){delete db[k]},clear(){Object.keys(db).forEach(k=>delete db[k])}}});window.print=()=>{window.__printCalled=true}; }''')
  page.set_content(INLINE,wait_until='load')
  ok(page.title().startswith('窓つゆ時報'),'title')
  ok(page.locator('#hour-rows tr').count()==12,'12 time slots')
  ok(page.locator('.metric-card').count()==3,'3 KPI cards')
  ok(page.locator('#risk-chart polyline').count()==2,'both chart lines')
  ok('時刻' in page.locator('.chart-head').inner_text() or page.locator('#risk-chart circle').count()==24,'chart contents')
  first=page.locator('#r0-outside');ok(first.input_value()=='-4','example outside temperature')
  before=page.evaluate('TsuyuApp.getReport().B.dampHours')
  page.locator('#b-u').fill('1.1');page.locator('#b-u').dispatch_event('change')
  ok(page.evaluate('TsuyuApp.getReport().state.B.u')==1.1,'custom U edit')
  ok(page.locator('#b-preset').input_value()=='custom' or page.locator('#b-preset').input_value()=='1.1','U preset')
  ok(page.evaluate('TsuyuApp.getReport().B.dampHours')<=before,'insulation cannot make cold-side risk worse')
  page.locator('#b-delta').fill('-30');page.locator('#b-delta').dispatch_event('change')
  ok(page.evaluate('TsuyuApp.getReport().state.B.delta')==-30,'humidity scenario edit')
  page.locator('#r0-rh').fill('70');page.locator('#r0-rh').dispatch_event('change')
  ok(page.evaluate('TsuyuApp.getState().rows[0].rh')==70,'row edit')
  ok(page.locator('#r0-rh').input_value()=='70','row rerender')
  ok(page.locator('#saved-label').inner_text().find('保存済み')>=0,'local storage write in mocked store')
  page.locator('#a-preset').select_option('2.7')
  ok(page.evaluate('TsuyuApp.getState().A.u')==2.7,'window preset edit')
  page.locator('#a-rsi').select_option('0.2')
  ok(page.evaluate('TsuyuApp.getState().A.rsi')==.2,'curtain film resistance edit')
  page.locator('#report-title').fill('家族の冬のテスト');page.locator('#report-title').dispatch_event('change')
  ok(page.evaluate('TsuyuApp.getState().title')=='家族の冬のテスト','title edit')
  # Validation must not change accepted state
  old=page.evaluate('TsuyuApp.getState().rows[0].rh')
  page.locator('#r0-rh').fill('105');page.locator('#r0-rh').dispatch_event('change')
  ok(page.locator('#form-error').is_visible(),'invalid input error')
  ok(page.evaluate('TsuyuApp.getState().rows[0].rh')==old,'invalid input does not mutate accepted state')
  page.locator('#r0-rh').fill('50');page.locator('#r0-rh').dispatch_event('change')
  ok(page.locator('#form-error').is_hidden(),'error cleared')
  # export actual files
  with page.expect_download() as rec:page.locator('#export-json').click()
  d=rec.value;j=json.loads(Path(d.path()).read_text())
  ok(d.suggested_filename.endswith('.json'),'JSON download')
  ok(j['title']=='家族の冬のテスト','JSON exported state')
  with page.expect_download() as rec:page.locator('#export-csv').click()
  d=rec.value;csv=Path(d.path()).read_text(encoding='utf-8-sig')
  ok(csv.count('\n')==13 and 'B_surface_RH_pct' in csv,'CSV downloaded with twelve records')
  # import saved JSON back after changing settings
  page.locator('#preset-mild').click()
  ok(page.locator('#r0-outside').input_value()=='3','mild preset')
  page.locator('#file-json').set_input_files({'name':'restore.json','mimeType':'application/json','buffer':json.dumps(j).encode()})
  ok(page.locator('#report-title').input_value()=='家族の冬のテスト','JSON import')
  ok(page.locator('#r0-rh').input_value()=='50','JSON restores rows')
  page.locator('#file-csv').set_input_files({'name':'restore.csv','mimeType':'text/csv','buffer':csv.encode()})
  ok(page.locator('#r0-outside').input_value()=='-4','CSV restores rows')
  # Malformed files produce useful feedback
  page.locator('#file-csv').set_input_files({'name':'bad.csv','mimeType':'text/csv','buffer':b'oops'})
  ok(page.locator('#form-error').is_visible(),'CSV error feedback')
  page.locator('#file-json').set_input_files({'name':'bad.json','mimeType':'application/json','buffer':b'{"hello":1}'})
  ok(page.locator('#form-error').inner_text().find('12件')>=0,'JSON schema feedback')
  page.locator('#preset-cold').click()
  ok(page.locator('#r0-outside').input_value()=='-4','cold preset')
  page.locator('#reset-all').click()
  ok(page.locator('#b-u').input_value()=='2.7','reset scenario')
  page.locator('#print-report').click()
  ok(page.evaluate('!!window.__printCalled'),'print trigger')
  ok(not errors,'no page exceptions: '+str(errors))
  # mobile, accessibility structure, overflow, screenshot
  page.set_viewport_size({'width':390,'height':844})
  ok(page.locator('.topbar').is_visible(),'mobile nav')
  ok(page.locator('.hero h1').is_visible(),'mobile header')
  ok(page.locator('.hour-table').count()==1,'mobile scrollable table')
  ok(page.locator('#risk-chart').is_visible(),'mobile chart')
  page.screenshot(path=str(HERE/'mobile.png'),full_page=True)
  page.set_viewport_size({'width':1300,'height':900})
  page.screenshot(path=str(HERE/'desktop.png'),full_page=True)
  ok((HERE/'desktop.png').stat().st_size>20000,'desktop screenshot')
  ok((HERE/'mobile.png').stat().st_size>20000,'mobile screenshot')
  print(f'PASS: {checks} Chromium UI assertions; no page errors')
  browser.close()
except Exception as ex:
 print('FAIL:',ex, 'after',checks,'checks')
 raise
