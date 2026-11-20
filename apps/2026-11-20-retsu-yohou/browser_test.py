"""RETSU YOHOU local file browser smoke and interaction tests (no web server)."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json

HERE=Path(__file__).resolve().parent

def render(page):
    # The managed Chromium blocks file://, localhost and https navigation.
    # Inline the exact release assets without altering their JavaScript behavior.
    html=(HERE/'index.html').read_text('utf-8')
    html=html.replace('<link rel="stylesheet" href="style.css">', '<style>'+(HERE/'style.css').read_text('utf-8')+'</style>')
    for asset in ['engine.js','app.js']:
        html=html.replace(f'<script src="{asset}"></script>', '<script>'+(HERE/asset).read_text('utf-8')+'</script>')
    page.set_content(html,wait_until='load')

def mock_storage(page):
    # Browser storage for about:blank is not permitted. Emulate it in-memory for interaction tests.
    page.evaluate("""() => {
      window.__memoryStorage={};
      Object.defineProperty(window,'localStorage',{configurable:true,value:{
        getItem(k){return window.__memoryStorage[k] ?? null},
        setItem(k,v){window.__memoryStorage[k]=String(v)}
      }});
    }""")
checks=[]
def check(condition, name):
    assert condition, name
    checks.append(name)

def main():
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,
            args=['--no-sandbox','--disable-dev-shm-usage'])
        ctx=browser.new_context(viewport={'width':1440,'height':1000},accept_downloads=True,device_scale_factor=1)
        page=ctx.new_page()
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        mock_storage(page)
        render(page)
        page.wait_for_selector('#slotRows input')
        check(page.title()=='列予報 | RETSU YOHO','page title')
        check(page.locator('#slotRows tr').count()==12,'12 time blocks')
        check(page.locator('#queueChart svg').count()==1,'chart generated')
        check(int(page.locator('#p95A').inner_text()) > int(page.locator('#p95B').inner_text()),'baseline scenario B faster')
        check('334' in page.locator('#totalArrivals').inner_text(),'visitor total')
        check(not errors,'no browser errors on startup')
        page.screenshot(path=str(HERE/'desktop.png'),full_page=True)
        # Editable arrivals reflow summary and graph.
        first=page.locator('input[data-slot="0"][data-field="arrivals"]')
        first.fill('40');first.press('Tab')
        check('362' in page.locator('#totalArrivals').inner_text(),'arrival edit recalculated')
        page.locator('#copyBtn').click()
        check(page.locator('#p95A').inner_text()==page.locator('#p95B').inner_text(),'copy A to B')
        page.locator('#suggestBtn').click()
        check('増員' in page.locator('#planNotice').inner_text(),'automatic staffing suggestion')
        check(int(page.locator('#p95B').inner_text())<=15,'auto plan reaches target')
        check(page.locator('#slotRows input[data-field="b"]').count()==12,'suggestion fills 12 slots')
        # Download actual bytes.
        with page.expect_download() as dl:
            page.locator('#downloadJson').click()
        path=dl.value.path();payload=json.loads(Path(path).read_text('utf-8'))
        check(payload['slots'][0]['arrivals']==40,'JSON download records updates')
        with page.expect_download() as dl:
            page.locator('#downloadCsv').click()
        body=Path(dl.value.path()).read_text('utf-8-sig')
        check('時刻' in body and '10:00' in body and len(body.splitlines())==13,'CSV has 12 data rows')
        # Restore from downloaded configuration by file picker.
        page.locator('input[data-slot="0"][data-field="arrivals"]').fill('1')
        page.locator('input[data-slot="0"][data-field="arrivals"]').press('Tab')
        check('323' in page.locator('#totalArrivals').inner_text(),'temporary edit')
        page.locator('#importFile').set_input_files({'name':'plan.json','mimeType':'application/json','buffer':Path(path).read_bytes()})
        check('362' in page.locator('#totalArrivals').inner_text(),'JSON restore')
        check('復元' in page.locator('#planNotice').inner_text(),'restore confirmation')
        render(page)
        check('362' in page.locator('#totalArrivals').inner_text(),'memory-storage state survives re-render')
        check(not errors,'no browser errors after interaction')
        page.on('dialog',lambda d:d.accept())
        page.locator('#resetBtn').click()
        check('334' in page.locator('#totalArrivals').inner_text(),'reset sample')
        page.locator('#serviceInput').fill('3.5');page.locator('#serviceInput').press('Tab')
        check(page.locator('#serviceInput').input_value()=='3.5','service speed edited')
        # safety warnings: zero staffed cannot be declared as zero wait.
        page.evaluate("""() => {
          const json=JSON.parse(localStorage.getItem('retsu-yohou-v1'));
          json.slots.forEach(s=>{s.a=0;s.b=0});
          localStorage.setItem('retsu-yohou-v1',JSON.stringify(json));
        }""")
        render(page)
        check('未処理' in page.locator('#warnings').inner_text(),'zero staff shows backlog warning')
        check(page.locator('#p95A').inner_text()=='—','P95 missing when nobody completed')
        # mobile test; also screenshot without excessive horizontal page overflow.
        mctx=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1)
        mobile=mctx.new_page();mock_storage(mobile);render(mobile)
        mobile.screenshot(path=str(HERE/'mobile.png'),full_page=True)
        check(mobile.locator('#slotRows input').count()==36,'mobile table inputs operational')
        width=mobile.evaluate('document.documentElement.scrollWidth')
        check(width<=390,'mobile has no body overflow (table scrolls within panel)')
        check(not errors,'no console runtime errors')
        browser.close()
    print(f'BROWSER TESTS PASSED {len(checks)}/{len(checks)}')
    for c in checks:print('  ✓',c)
if __name__=='__main__':main()