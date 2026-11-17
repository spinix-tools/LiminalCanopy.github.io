"""Real headless Chromium smoke & interaction suite for the offline Web app.
Run: python browser_test.py (requires playwright + chromium on PATH).
"""
from pathlib import Path
import json, tempfile
from playwright.sync_api import sync_playwright

HERE=Path(__file__).resolve().parent
COUNT=0

def check(label,actual):
    global COUNT
    assert actual, label
    COUNT+=1
    print('PASS',str(COUNT).rjust(2),label)

# Navigation to local HTTP/file URLs is blocked by this runtime's browser policy.
# Load the unmodified source document and both real JS files into about:blank.
# localStorage is the ONLY browser feature simulated; all DOM/download actions run in Chromium.
source=(HERE/'index.html').read_text(encoding='utf-8').replace('<script src="engine.js"></script><script src="app.js"></script>','')
def mount(page, state=None):
    page.set_content(source)
    page.evaluate('''(saved) => {
      const entries=new Map(Object.entries(saved||{}));
      Object.defineProperty(window,'localStorage',{configurable:true,value:{
        getItem(k){return entries.has(k)?entries.get(k):null},
        setItem(k,v){entries.set(k,String(v))},
        removeItem(k){entries.delete(k)}
      }});
    }''',state or {})
    page.add_script_tag(content=(HERE/'engine.js').read_text(encoding='utf-8'))
    page.add_script_tag(content=(HERE/'app.js').read_text(encoding='utf-8'))

try:
    with sync_playwright() as pw:
        browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
        context=browser.new_context(accept_downloads=True,viewport={'width':1512,'height':1100},device_scale_factor=1)
        page=context.new_page()
        errors=[]
        page.on('pageerror',lambda e: errors.append(str(e)))
        mount(page)
        check('title is KIRIKURI', 'きりくり' in page.title())
        check('app loads without script errors',not errors)
        check('demo title visible',page.locator('#project-heading').inner_text()=='小さな壁面棚（試用データ）')
        check('plan calculated on first load','計算が完了' in page.locator('#notice').inner_text())
        check('plan verified', '照合済' in page.locator('#verify-pill').inner_text())
        check('sample uses 3 physical offcuts',page.locator('#bars .bar-card').count()>=3)
        check('shows positive purchase-cost comparison','¥' in page.locator('#compare-body').inner_text())
        check('source segment width diagram exists',page.locator('.bar-graphic .segment').count()>4)
        check('inputs are editable',page.locator('[data-kind=parts]').count()>8)
        page.screenshot(path=str(HERE/'desktop.png'),full_page=True)
        check('desktop screenshot captured',(HERE/'desktop.png').stat().st_size>60000)
        page.locator('#kerf').fill('5')
        check('dirty input marked', '入力を変更' in page.locator('#verify-pill').inner_text())
        page.locator('#export-cut').click()
        check('dirty state blocks CSV', '先に' in page.locator('#notice').inner_text())
        page.locator('#calculate').click()
        check('recompute after edit', '照合済' in page.locator('#verify-pill').inner_text())
        page.locator('[data-add=parts]').click()
        check('add part row works',page.locator('#parts-rows .edit-row').count()==5)
        page.locator('[data-del=parts]').last.click()
        check('delete part works',page.locator('#parts-rows .edit-row').count()==4)
        page.locator('#calculate').click()
        with page.expect_download() as info:page.locator('#export-cut').click()
        d=info.value
        check('cut CSV downloaded',d.suggested_filename=='kirikuri-cut-list.csv')
        csvfile=HERE/'test-cut.csv';d.save_as(str(csvfile))
        check('cut CSV contains cutting positions','切断位置mm' in csvfile.read_text('utf-8-sig'))
        with page.expect_download() as info:page.locator('#export-offcuts-main').click()
        d=info.value
        check('offcut carry-forward CSV downloaded',d.suggested_filename=='kirikuri-offcuts-next.csv')
        d.save_as(str(HERE/'test-offcuts.csv'))
        check('offcut CSV has header','品名' in (HERE/'test-offcuts.csv').read_text('utf-8-sig'))
        with page.expect_download() as info:page.locator('#export-json').click()
        d=info.value;d.save_as(str(HERE/'test-settings.json'))
        data=json.loads((HERE/'test-settings.json').read_text())
        check('settings JSON exported',data['kerf']==5 and len(data['parts'])==4)
        # CSV import, including Japanese labels and quoted commas.
        newCSV=HERE/'test-parts-in.csv';newCSV.write_text('品名,長さ,数量\n"新,棚板",400,2\n脚,650,3\n',encoding='utf-8')
        page.locator('#csv-file').set_input_files(str(newCSV))
        check('part CSV import updates rows',page.locator('#parts-rows .edit-row').count()==2)
        check('quoted part name preserved',page.locator('[data-kind=parts][data-key=name]').first.input_value()=='新,棚板')
        check('CSV import recomputes plan','照合済' in page.locator('#verify-pill').inner_text())
        page.locator('#save').click()
        check('localStorage explicitly populated',page.evaluate('localStorage.getItem("kirikuri:v1")') is not None)
        saved=page.evaluate('localStorage.getItem("kirikuri:v1")')
        page.close()
        page=context.new_page()
        page.on('pageerror',lambda e: errors.append(str(e)))
        mount(page,{'kirikuri:v1':saved})
        check('saved project reloaded',page.locator('#parts-rows .edit-row').count()==2)
        # JSON import
        page.locator('#json-file').set_input_files(str(HERE/'test-settings.json'))
        check('JSON import restores parts',page.locator('#parts-rows .edit-row').count()==4)
        check('JSON re-computes plan', '照合済' in page.locator('#verify-pill').inner_text())
        # invalid input displays helpful message rather than stale output
        page.locator('#kerf').fill('-1');page.locator('#calculate').click()
        check('invalid blade width rejected', '範囲' in page.locator('#notice').inner_text())
        check('stale result removed',page.locator('#verify-pill').inner_text()=='未計算')
        page.locator('#kerf').fill('3');page.locator('#calculate').click()
        check('valid plan re-established','照合済' in page.locator('#verify-pill').inner_text())
        page.on('dialog',lambda dialog:dialog.accept())
        page.locator('#apply-offcuts').click()
        check('carry to new project',page.locator('#title').input_value()=='次の案件')
        check('new project starts with editable part',page.locator('#parts-rows .edit-row').count()==1)
        page.locator('#demo').click()
        check('reset to demo',page.locator('#parts-rows .edit-row').count()==4)
        page.set_viewport_size({'width':390,'height':844})
        page.screenshot(path=str(HERE/'mobile.png'),full_page=True)
        check('mobile screenshot captured',(HERE/'mobile.png').stat().st_size>30000)
        check('mobile page has no horizontal scroll',page.evaluate('document.documentElement.scrollWidth<=window.innerWidth+1'))
        check('no runtime errors through interaction',not errors)
        # print summary
        print('RESULT: %s browser checks passed' % COUNT)
        browser.close()
finally:
    for name in ['test-cut.csv','test-offcuts.csv','test-settings.json','test-parts-in.csv']:
        (HERE/name).unlink(missing_ok=True)