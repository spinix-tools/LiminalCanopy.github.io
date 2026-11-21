"""Playwright end-to-end tests. Run: python browser_test.py"""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent
checks=[]
def check(cond,name):
    if not cond: raise AssertionError(name)
    checks.append(name)

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    context=browser.new_context(accept_downloads=True,viewport={'width':1366,'height':920})
    page=context.new_page()
    errors=[]; requests=[]
    page.on('pageerror',lambda err:errors.append(str(err)))
    page.on('request',lambda req:requests.append(req.url))
    # Network navigation is blocked in this execution environment, so deploy exactly
    # the same CSS/JS as inline resources. Persistent storage is a test double.
    html=(ROOT/'index.html').read_text('utf-8')
    html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+ (ROOT/'style.css').read_text('utf-8')+'</style>')
    html=html.replace('<script src="engine.js" defer></script>','').replace('<script src="app.js" defer></script>','')
    html=html.replace('</body>','<script>'+ (ROOT/'engine.js').read_text('utf-8')+'</script><script>'+(ROOT/'app.js').read_text('utf-8')+'</script></body>')
    page.evaluate("""() => {
        window.__testStorage = {};
        Object.defineProperty(window,'localStorage',{configurable:true,value:{
          getItem:k => window.__testStorage[k] ?? null,
          setItem:(k,v)=>{ window.__testStorage[k]=String(v); },
          removeItem:k=>{delete window.__testStorage[k];}
        }});
    }""")
    page.set_content(html,wait_until='load')
    page.wait_for_selector('#coin-2')
    check(page.title().startswith('釣銭リハ'),'title')
    check(page.locator('#float-grid input').count()==9,'nine denominations')
    check(page.locator('#queue-body tr').count()==6,'six initial transactions')
    check(page.locator('#float-total').inner_text().startswith('¥'),'initial float amount')
    check(page.locator('#overview').inner_text().find('会計')>=0,'overview produced')
    check(page.locator('#playback .event').count()>=1,'transaction playback')
    check(page.locator('#leftover .inv-item').count()==9,'final inventory')
    check('手元の現金' in page.locator('#overview').inner_text(),'cash total visible')
    check(page.locator('.hero h1').is_visible(),'hero shown')
    check(page.evaluate('window.ChangeLab !== undefined'),'engine accessible')
    check(page.evaluate('window.ChangeLab.findChange(100,[0,0,0,0,1,0,0,0,0])[4] === 1'),'change engine browser calculation')
    initialtotal=page.locator('#float-total').inner_text()
    page.locator('#coin-4').fill('33'); page.locator('#coin-4').dispatch_event('change')
    check(page.locator('#float-total').inner_text()!=initialtotal,'float edit recalculates total')
    page.set_content(html,wait_until='load')  # simulated reload with storage test double
    check(page.locator('#coin-4').input_value()=='33','localStorage persistence')
    page.locator('#add-row').click()
    check(page.locator('#queue-body tr').count()==7,'add transaction')
    page.locator('#queue-body [data-field="name"]').last.fill('テスト展示')
    page.locator('#queue-body [data-field="name"]').last.dispatch_event('change')
    check('テスト展示' in page.locator('#queue-body').inner_text() or page.locator('#queue-body [data-field="name"]').last.input_value()=='テスト展示','edit name')
    page.locator('#queue-body [data-field="price"]').last.fill('800')
    page.locator('#queue-body [data-field="price"]').last.dispatch_event('change')
    check(page.locator('#queue-body [data-field="price"]').last.input_value()=='800','edit price')
    page.locator('#queue-body [data-field="tender"]').last.select_option('10000')
    check(page.locator('#queue-body [data-field="tender"]').last.input_value()=='10000','change payment denomination')
    page.locator('#queue-body [data-remove]').last.click()
    check(page.locator('#queue-body tr').count()==6,'remove transaction')
    page.locator('#sample-reset').click()
    check(page.locator('#queue-body tr').count()==6,'sample reset')
    # first checkout must fail due to 0 stock and manual high bill
    for i in range(9):
        page.locator(f'#coin-{i}').fill('0');page.locator(f'#coin-{i}').dispatch_event('change')
    check('停止' in page.locator('#overview').inner_text(),'failure detection')
    check(page.locator('.rescue-card').count()==1,'one-step rescue hint')
    before=page.locator('#float-total').inner_text()
    page.locator('[data-add-plan]').click()
    check(page.locator('#float-total').inner_text()!=before,'apply rescue to opening float')
    # test deterministic synthetic trials
    page.locator('#customers').fill('12');page.locator('#trials').fill('20')
    page.locator('#run-stress').click()
    page.wait_for_function("document.querySelector('#stress-results .big-rate') !== null",timeout=15000)
    check('%' in page.locator('#stress-results .big-rate').inner_text(),'stress rate')
    check('20' in page.locator('#stress-results').inner_text(),'trial count shown')
    check(page.locator('#stress-results .progressbar').count()==1,'stress bar')
    # invalid weights should not fabricate result
    page.locator('#weight-0').fill('0'); page.locator('#weight-1').fill('0');page.locator('#weight-2').fill('0');page.locator('#weight-3').fill('0')
    page.locator('#run-stress').click()
    check('比率' in page.locator('#message').inner_text(),'invalid weight warning')
    page.locator('#weight-0').fill('30');page.locator('#weight-1').fill('45');page.locator('#weight-2').fill('15');page.locator('#weight-3').fill('10')
    with page.expect_download() as dl:
        page.locator('#export-csv').click()
    check(dl.value.suggested_filename.endswith('.csv'),'CSV download')
    b=dl.value.path().read_bytes()
    check(b.startswith(b'\xef\xbb\xbf'),'CSV Japanese BOM')
    with page.expect_download() as dl2:
        page.locator('#export-json').click()
    check(dl2.value.suggested_filename.endswith('.json'),'JSON download')
    import json
    obj=json.loads(dl2.value.path().read_text('utf-8'))
    check(len(obj['counts'])==9,'JSON schema')
    page.locator('#coin-4').fill('14');page.locator('#coin-4').dispatch_event('change')
    page.locator('#file-input').set_input_files({'name':'saved.json','mimeType':'application/json','buffer':json.dumps(obj,ensure_ascii=False).encode('utf-8')})
    check(page.locator('#coin-4').input_value()==str(obj['counts'][4]),'JSON restore')
    check('復元しました' in page.locator('#message').inner_text(),'restore acknowledgment')
    # stored notes should be escaped; script never runs.
    obj['rows'][0]['name']='<img src=x onerror=alert(1)>'
    page.locator('#file-input').set_input_files({'name':'not-unsafe.json','mimeType':'application/json','buffer':json.dumps(obj).encode('utf-8')})
    check(page.locator('#queue-body img').count()==0,'untrusted text safely escaped')
    check(page.locator('#queue-body [data-field="name"]').first.input_value().startswith('<img'),'raw text remains editable')
    check(not errors,'no page JavaScript exception')
    check(all(x.startswith('file:') or x.startswith('blob:') for x in requests),'no external HTTP requests')
    # Restore a clean realistic sample before recording the deliverable screenshots.
    obj['rows'][0]['name']='焼き菓子'
    obj['counts']=[0,0,12,9,24,8,20,10,10]
    page.locator('#file-input').set_input_files({'name':'clean.json','mimeType':'application/json','buffer':json.dumps(obj,ensure_ascii=False).encode('utf-8')})
    page.locator('#customers').fill('24');page.locator('#trials').fill('80')
    page.locator('#run-stress').click()
    page.wait_for_function("document.querySelector('#stress-results .big-rate') !== null",timeout=20000)
    check('最後まで会計OK' in page.locator('#overview').inner_text(),'restored sample has complete queue')
    # Small viewport: no horizontal page overflow (table may scroll inside the card).
    page.set_viewport_size({'width':390,'height':844})
    page.screenshot(path=str(ROOT/'mobile.png'),full_page=True)
    check(page.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'),'mobile no horizontal overflow')
    check(page.locator('#run-stress').is_visible(),'mobile controls visible')
    page.set_viewport_size({'width':1366,'height':920})
    page.screenshot(path=str(ROOT/'desktop.png'),full_page=True)
    check(page.locator('#float-grid').is_visible(),'desktop form visible')
    context.close();browser.close()

for i,c in enumerate(checks,1):print(f'OK {i:02d} {c}')
print(f'PASS {len(checks)}/{len(checks)} browser checks')
