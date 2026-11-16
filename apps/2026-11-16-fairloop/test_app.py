from playwright.sync_api import sync_playwright
from pathlib import Path
import json
import http.server
import functools
import threading

handler=functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(Path(__file__).resolve().parent))
server=http.server.ThreadingHTTPServer(("127.0.0.1",0),handler)
threading.Thread(target=server.serve_forever,daemon=True).start()

path=Path(__file__).resolve().parent/'index.html'
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1280,'height':1000}, accept_downloads=True)
    errors=[]
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.set_content(path.read_text(encoding="utf-8"),wait_until="load")
    page.wait_for_selector('#tbody tr')
    assert page.locator('#tbody tr').count()==4, 'default 4 weeks'
    assert page.locator('.person').count()==3, 'default three members'
    assert page.locator('#mWeeks').inner_text()=='4'
    assert page.locator('#mSum').inner_text().isdigit(), 'burden numeric'
    print('default-app PASS, 4 weekly suggestions, 3 members; burden=',page.locator('#mSum').inner_text())

    result=page.evaluate('''() => {
      const c=window.FairLoopCore;
      const tokyo=c.zoned(Date.parse('2026-11-16T03:00:00Z'),'Asia/Tokyo');
      const nyWinter=c.zoned(Date.parse('2026-11-16T15:00:00Z'),'America/New_York');
      const nySummer=c.zoned(Date.parse('2026-07-16T15:00:00Z'),'America/New_York');
      const londonWinter=c.zoned(Date.parse('2026-11-16T15:00:00Z'),'Europe/London');
      const londonSummer=c.zoned(Date.parse('2026-07-16T15:00:00Z'),'Europe/London');
      const p=[{name:'Tokyo',zone:'Asia/Tokyo',from:9,to:18,weekend:false},{name:'NY',zone:'America/New_York',from:9,to:18,weekend:false}];
      const x=c.buildPlan(p,'2026-11-16',4,60,'fair');
      const ics=c.icsContent(x);
      const csv=c.csvContent(x);
      return {tokyo:tokyo.hour,nyWinter:nyWinter.hour,nySummer:nySummer.hour,londonWinter:londonWinter.hour,londonSummer:londonSummer.hour,slotCount:x.chosen.length,starts:x.chosen.map(t=>new Date(t.ms).toISOString()),icsEvents:(ics.match(/BEGIN:VEVENT/g)||[]).length,icsUTC:ics.includes('DTSTART:2026'),csvLines:csv.split('\\r\\n').length,acc:x.acc};
    }''')
    print('timezone-DST-exports:', json.dumps(result,ensure_ascii=False))
    assert result['tokyo']==12
    assert (result['nyWinter'],result['nySummer'])==(10,11)
    assert (result['londonWinter'],result['londonSummer'])==(15,16)
    assert result['icsEvents']==4 and result['icsUTC'] and result['slotCount']==4

    page.locator('#weeks').select_option('8')
    page.locator('#duration').select_option('90')
    assert page.locator('#tbody tr').count()==8, '8 weeks recalculated'
    page.locator('#add').click()
    assert page.locator('.person').count()==4
    page.locator('.person input[type="text"]').count() # input no type okay query below
    page.locator('.person').nth(3).locator('input').first.fill('<b>不正</b>')
    assert '<b>不正</b>' in page.locator('#thead').inner_text(), 'user text escaped not lost'
    assert page.locator('#thead b').count()==0, 'no injected markup'
    page.locator('.person').nth(3).locator('button').click()
    assert page.locator('.person').count()==3
    print('interaction PASS, editing/add/remove/update, safe display')

    with page.expect_download() as ev:
        page.locator('#ics').click()
    d=ev.value
    assert d.suggested_filename.endswith('.ics')
    contents=Path(d.path()).read_text()
    assert contents.count('BEGIN:VEVENT')==8
    assert contents.count('DTSTART:')==8
    print('ICS download PASS, 8 UTC events')

    with page.expect_download() as ev:
        page.locator('#csv').click()
    csv=Path(ev.value.path()).read_text(encoding='utf-8-sig')
    assert csv.count('\n')==9
    print('CSV download PASS, 8 rows')

    page.locator('#reset').click()
    assert page.locator('#tbody tr').count()==4
    page.set_content(path.read_text(encoding="utf-8"),wait_until="load")
    assert page.locator('#tbody tr').count()==4
    print('persistence/reset PASS')
    page.screenshot(path=str(path.parent/'desktop.png'),full_page=True)
    mobile=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1)
    mobile.set_content(path.read_text(encoding="utf-8"),wait_until="load");mobile.wait_for_selector('#tbody tr')
    mobile.screenshot(path=str(path.parent/'mobile.png'),full_page=True)
    print('mobile PASS width=390; errors=',errors)
    assert not errors, errors
    browser.close()