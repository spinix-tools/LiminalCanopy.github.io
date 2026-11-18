"""Chromium end-to-end smoke/regression test. Requires Python playwright and Chromium.
Run: python browser_test.py. The managed Chromium environment blocks file://;
this loads the unchanged HTML, CSS and JS inline with a localStorage test double.
"""
from pathlib import Path
from tempfile import TemporaryDirectory
import json
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).parent
SOURCE=(ROOT/'index.html').read_text(encoding='utf-8')
CSS=(ROOT/'style.css').read_text(encoding='utf-8')
ENGINE=(ROOT/'engine.js').read_text(encoding='utf-8')
APP=(ROOT/'app.js').read_text(encoding='utf-8')

def render(page, stored=None):
    """Inline original resources; emulate storage for opaque-origin page."""
    seed=json.dumps(stored or {},ensure_ascii=False)
    shim="""<script>
      (function(){
        var values=SEED;
        Object.defineProperty(window,'localStorage',{configurable:true,value:{
          getItem:function(k){return Object.prototype.hasOwnProperty.call(values,k)?values[k]:null},
          setItem:function(k,v){values[k]=String(v)},
          removeItem:function(k){delete values[k]},
          clear:function(){values={}},
          _dump:function(){return values}
        }});
      })();
    </script>""".replace('SEED',seed)
    page.set_content(SOURCE.replace('<link rel="stylesheet" href="style.css">','<style>'+CSS+'</style>')
      .replace('<script src="engine.js" defer></script>','')
      .replace('<script src="app.js" defer></script>','')
      .replace('</body>',shim+'<script>'+ENGINE+'</script><script>'+APP+'</script></body>'), wait_until='load')

passed=[]

def check(name, condition):
    assert condition, name
    passed.append(name)

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox','--disable-dev-shm-usage'])
    context=browser.new_context(viewport={'width':1440,'height':900}, accept_downloads=True, permissions=['clipboard-read','clipboard-write'])
    page=context.new_page()
    errors=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    render(page)
    page.locator('.strategy').first.wait_for()
    check('document title', '時差てんびん' in page.title())
    check('three baseline options', page.locator('.strategy').count()==3)
    check('three default locations', page.locator('.person').count()==3)
    check('six weekly sessions', page.locator('#week-table tbody tr').count()==6)
    check('48 preview slots', page.locator('.slot').count()==48)
    check('rotation selected initially', page.locator('.strategy.active').get_attribute('data-plan')=='rotate')
    check('rotation default has best worst burden', page.locator('#metrics .metric').first.locator('strong').inner_text()=='5.5')
    check('no initial errors', page.locator('#errors').is_hidden())
    page.screenshot(path=str(ROOT/'desktop.png'),full_page=True)
    page.locator('[data-plan="anchor"]').click()
    check('baseline selection changes result',page.locator('#selected-title').inner_text()=='主催地の時刻を固定')
    check('baseline worst burden expected',page.locator('#metrics .metric').first.locator('strong').inner_text()=='10.8')
    page.locator('[data-plan="utc"]').click()
    check('UTC baseline selection',page.locator('#selected-title').inner_text()=='UTC時刻を固定')
    page.locator('[data-plan="rotate"]').click()
    check('rotation can be reselected',page.locator('#selected-title').inner_text()=='負担をならす輪番')

    # Click candidates and pin baseline wall-clock time
    page.locator('.slot[data-minute="660"]').click()
    check('slot preview is interactive','11:00' in page.locator('#slot-preview').inner_text())
    page.locator('#pin-slot').click()
    check('pinned slot flagged',page.locator('.slot[data-minute="660"]').evaluate('(e)=>e.classList.contains("pinned")'))
    page.locator('[data-plan="anchor"]').click()
    check('anchored plan uses pinned local hour','11:00' in page.locator('#week-table tbody tr').first.locator('td').first.inner_text())
    page.locator('#clear-pin').click()
    check('clear pin restores automatic baseline',page.locator('.slot.pinned').count()==0)

    # Participants add/remove and edit
    page.locator('#add-person').click()
    check('adding a fourth region',page.locator('.person').count()==4)
    page.locator('.person').last.locator('[data-field="name"]').fill('シンガポール窓口')
    page.locator('.person').last.locator('[data-field="name"]').dispatch_event('change')
    check('renamed member reflected in table','シンガポール窓口' in page.locator('#week-table thead').inner_text())
    page.locator('.person').last.locator('[data-field="history"]').fill('8')
    page.locator('.person').last.locator('[data-field="history"]').dispatch_event('change')
    check('past-burden edit updates chart','過去 8.0' in page.locator('#burden-bars').inner_text())
    page.locator('.person').last.locator('.remove').click()
    check('participant removal works',page.locator('.person').count()==3)

    # Change starting date / duration / week count / anchor across DST
    page.locator('#meeting-date').fill('2026-03-04')
    page.locator('#meeting-date').dispatch_event('change')
    page.locator('#weeks').select_option('4')
    page.locator('#anchor').select_option('America/New_York')
    page.locator('[data-plan="utc"]').click()
    check('4 week input updates table',page.locator('#week-table tbody tr').count()==4)
    check('DST marker appears in March',page.locator('#week-table .dst').count()>=1)
    check('NY zone is the organizer timezone',page.locator('#week-table thead').inner_text().find('New York')>=0)
    page.locator('#duration').select_option('90')
    check('90 minute duration selected',page.locator('#duration').input_value()=='90')
    stored=page.evaluate("window.localStorage._dump()")
    render(page, stored)
    page.locator('.strategy').first.wait_for()
    check('localStorage persisted meeting date',page.locator('#meeting-date').input_value()=='2026-03-04')
    check('localStorage persisted duration',page.locator('#duration').input_value()=='90')

    # Export valid real downloadable calendar & CSV
    with page.expect_download() as d:
        page.locator('#export-ics').click()
    icsd=d.value
    check('ICS download filename',icsd.suggested_filename.endswith('.ics'))
    with TemporaryDirectory() as tmp:
        path=Path(tmp)/'plan.ics';icsd.save_as(path)
        ics=path.read_text('utf-8')
    check('ICS contains four VEVENT records',ics.count('BEGIN:VEVENT')==4)
    check('ICS uses UTC calendar data','DTSTART:' in ics and 'Z' in ics)
    with page.expect_download() as d:
        page.locator('#export-csv').click()
    csvd=d.value
    with TemporaryDirectory() as tmp:
        path=Path(tmp)/'plan.csv';csvd.save_as(path)
        csv=path.read_text('utf-8-sig')
    check('CSV header plus 4 meeting lines',len(csv.splitlines())==5)
    check('CSV includes local time label','現地時刻' in csv)
    with page.expect_download() as d:
        page.locator('#export-json').click()
    jsond=d.value
    with TemporaryDirectory() as tmp:
        path=Path(tmp)/'config.json';jsond.save_as(path)
        saved=json.loads(path.read_text('utf-8'))
    check('JSON backup includes config and schema',saved['schema']==1 and saved['anchor']=='America/New_York')

    # JSON import restoration and malformed rejection
    with TemporaryDirectory() as tmp:
        target=Path(tmp)/'import.json'
        saved['people'][0]['name']='東京研究拠点'
        target.write_text(json.dumps(saved,ensure_ascii=False),encoding='utf-8')
        page.locator('#import-file').set_input_files(str(target))
    page.wait_for_function("document.querySelector('.person [data-field=name]').value.includes('東京研究拠点')")
    check('JSON import restores modified member','東京研究拠点' in page.locator('.person').first.inner_text())
    with TemporaryDirectory() as tmp:
        bad=Path(tmp)/'broken.json';bad.write_text('{"schema": 1,"people": []}',encoding='utf-8')
        page.locator('#import-file').set_input_files(str(bad))
    check('invalid backup rejected without state change', '東京研究拠点' in page.locator('.person').first.inner_text())
    check('error is communicated', '復元できません' in page.locator('#toast').inner_text())

    page.once('dialog', lambda d: d.accept())
    page.locator('#reset').click()
    check('reset restores default regions',page.locator('.person').count()==3 and '東京' in page.locator('.person').first.inner_text())
    check('reset restores 6 weeks',page.locator('#week-table tbody tr').count()==6)
    check('no JS pageerrors',not errors)

    mobile=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1)
    m=mobile.new_page()
    render(m)
    m.locator('.strategy').first.wait_for()
    check('mobile has active interactive strategies',m.locator('.strategy').count()==3)
    check('mobile main document not horizontally overflowing',m.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
    m.screenshot(path=str(ROOT/'mobile.png'),full_page=True)
    m.locator('#add-person').click()
    check('mobile add participant works',m.locator('.person').count()==4)
    mobile.close();context.close();browser.close()

print(f'PASS {len(passed)}/{len(passed)} Chromium functional assertions')
for i,x in enumerate(passed,1):print(f' {i:02d} {x}')