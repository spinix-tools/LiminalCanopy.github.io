"""Chromium end-to-end tests, using exact local project files. Run python browser_test.py."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json, tempfile

ROOT=Path(__file__).resolve().parent
checks=[]
def check(name, ok):
    checks.append((name, bool(ok)))
    if not ok: raise AssertionError(name)

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
    context=browser.new_context(accept_downloads=True, viewport={'width':1390,'height':970})
    page=context.new_page()
    mode='direct file://'
    try:
        page.goto((ROOT/'index.html').as_uri(),wait_until='load',timeout=12000)
        page.locator('#chartHost svg').wait_for(timeout=5000)
    except Exception as e:
        # Runtime navigation restrictions: inline identical source, preserving browser DOM/JS execution.
        mode='set_content from same source (file navigation blocked)'
        try: page.close()
        except Exception: pass
        page=context.new_page()
        html=(ROOT/'index.html').read_text().replace('<link rel="stylesheet" href="style.css">','<style>'+(ROOT/'style.css').read_text()+'</style>')
        html=html.replace('<script src="engine.js"></script>','<script>'+(ROOT/'engine.js').read_text()+'</script>').replace('<script src="app.js"></script>','<script>'+(ROOT/'app.js').read_text()+'</script>')
        page.set_content(html,wait_until='load')
        page.locator('#chartHost svg').wait_for(timeout=5000)
    check('page has title', '刷り分け' in page.title())
    check('svg visible',page.locator('#chartHost svg').count()==1)
    check('4 sample rows',page.locator('#editTable tbody tr').count()==4)
    check('2 sample series',page.locator('#editTable thead input').count()==2)
    check('default monochrome selected',page.locator('[data-mono="true"]').get_attribute('aria-pressed')=='true')
    check('pattern definitions',page.locator('#chartHost svg pattern').count()==2)
    check('success message visible', '表示可能' in page.locator('#alerts').inner_text())
    check('read table created',page.locator('#readTable tbody tr').count()==4)
    page.locator('#title').fill('市民向け配布物データ')
    check('title changes SVG', '市民向け' in page.locator('#chartHost svg title').text_content())
    page.locator('[data-mode="stacked"]').click()
    check('stacked mode selected',page.locator('[data-mode="stacked"]').get_attribute('aria-pressed')=='true')
    check('stacked legend totals', '合計' in page.locator('#chartHost svg').text_content())
    page.locator('[data-mono="false"]').click()
    check('color view selected',page.locator('[data-mono="false"]').get_attribute('aria-pressed')=='true')
    check('colors appear', '#a9c4ef' in page.locator('#chartHost svg').evaluate('(el) => el.outerHTML'))
    page.locator('#addCategory').click()
    check('add category',page.locator('#editTable tbody tr').count()==5)
    page.locator('#addSeries').click()
    check('add series',page.locator('#editTable thead input').count()==3)
    page.locator('#editTable input[data-role="value"][data-row="0"][data-col="0"]').fill('75.5')
    check('value edit seen in summary', '75.5' in page.locator('#readTable').inner_text())
    page.locator('#editTable input[data-role="value"][data-row="0"][data-col="0"]').fill('-12')
    check('invalid numeric flagged','数値は0以上' in page.locator('#alerts').inner_text())
    check('export disabled invalid',page.locator('#exportSvg').is_disabled())
    page.locator('#editTable input[data-role="value"][data-row="0"][data-col="0"]').fill('75.5')
    check('export returns enabled',not page.locator('#exportSvg').is_disabled())
    # prevent input of scripts from getting interpreted as HTML
    page.locator('#editTable input[data-role="category"][data-row="0"]').fill('<img src=x onerror=alert(2)>')
    check('escaped text safe',page.locator('#chartHost img').count()==0)
    with page.expect_download() as info: page.locator('#exportSvg').click()
    dl=info.value; svg_path=ROOT/'_browser_export.svg';dl.save_as(svg_path)
    data=svg_path.read_text()
    check('SVG download valid',data.startswith('<?xml') and '<svg' in data and '</svg>' in data)
    check('SVG exported text escaped','&lt;img' in data and '<img ' not in data)
    svg_path.unlink()
    with page.expect_download() as info: page.locator('#exportCsv').click()
    dl=info.value; out=ROOT/'_browser_export.csv';dl.save_as(out)
    check('CSV has BOM',out.read_bytes().startswith(b'\xef\xbb\xbf'))
    out.unlink()
    with page.expect_download() as info: page.locator('#exportJson').click()
    dl=info.value; out=ROOT/'_browser_export.json';dl.save_as(out)
    obj=json.loads(out.read_text())
    check('JSON export saved state',obj['mode']=='stacked' and len(obj['series'])==3)
    out.unlink()
    page.locator('#editTable button[data-remove="0"]').click()
    check('row deletion',page.locator('#editTable tbody tr').count()==4)
    page.locator('#removeSeries').click()
    check('series deletion',page.locator('#editTable thead input').count()==2)
    # Import CSV without touching the default branch/network.
    csv='項目,東,西\n駅前,12,23\n公園,3,9\n'.encode('utf-8')
    page.locator('#importCsv').set_input_files({'name':'graph.csv','mimeType':'text/csv','buffer':csv})
    check('CSV import rows',page.locator('#editTable tbody tr').count()==2)
    check('CSV import values','23' in page.locator('#readTable').inner_text())
    # JSON import state restores all labels + data
    restored={'version':1,'title':'復元した図','note':'架空データ','mode':'grouped','monochrome':True,'series':['A'],
              'categories':[{'label':'機関','values':[15.25]}]}
    page.locator('#importJson').set_input_files({'name':'state.json','mimeType':'application/json','buffer':json.dumps(restored,ensure_ascii=False).encode()})
    check('JSON import title',page.locator('#title').input_value()=='復元した図')
    check('JSON import bars',page.locator('#editTable tbody tr').count()==1)
    check('delete disabled last row',page.locator('#editTable button[data-remove="0"]').is_disabled())
    check('error-free after import','表示可能' in page.locator('#alerts').inner_text())
    # snapshot in original sample state, desktop+mobile
    # Accept deliberate reset confirmation.
    page.once('dialog',lambda d:d.accept())
    page.locator('#reset').click()
    check('reset restores four rows',page.locator('#editTable tbody tr').count()==4)
    page.screenshot(path=str(ROOT/'desktop.png'),full_page=True)
    page.set_viewport_size({'width':390,'height':844})
    page.screenshot(path=str(ROOT/'mobile.png'),full_page=True)
    check('mobile viewport',page.evaluate('window.innerWidth')==390)
    check('mobile no body horizontal overflow',page.evaluate('document.documentElement.scrollWidth <= window.innerWidth+1'))
    context.close();browser.close()
print(f'Chromium environment: {mode}')
for n,v in checks: print(('PASS' if v else 'FAIL')+' '+n)
print(f'{sum(v for _,v in checks)}/{len(checks)} browser checks passed')
