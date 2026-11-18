"""Self-contained browser tests. Run: python browser_test.py (requires playwright + Chromium)."""
from pathlib import Path
import json, tempfile
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent

checks=0
def verify(value,description):
    global checks
    assert value,description
    checks+=1
    print(f"PASS {checks:02d} {description}")

def inline_html(saved=None):
    html=(ROOT/'index.html').read_text(encoding='utf-8')
    css=(ROOT/'style.css').read_text(encoding='utf-8')
    engine=(ROOT/'engine.js').read_text(encoding='utf-8')
    app=(ROOT/'app.js').read_text(encoding='utf-8')
    store={}
    if saved is not None: store['zurashibata-project-v1']=saved
    shim="<script>window.__simStore="+json.dumps(store,ensure_ascii=False)+";Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>window.__simStore[k]??null,setItem:(k,v)=>{window.__simStore[k]=v;},removeItem:k=>{delete window.__simStore[k];}}});</script>"
    return (html.replace('<link rel="stylesheet" href="style.css">','<style>'+css+'</style>')
            .replace('<script src="engine.js"></script>','<script>'+engine+'</script>')
            .replace('<script src="app.js"></script>','<script>'+app+'</script>')
            .replace('<script src="engine.js">',shim+'<script src="engine.js">')
            .replace('<script>'+engine+'</script>',shim+'<script>'+engine+'</script>'))

if True:
  with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    context=browser.new_context(accept_downloads=True,viewport={'width':1400,'height':940},device_scale_factor=1)
    page=context.new_page()
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(inline_html(),wait_until='load')
    verify(page.title().startswith('ずらし畑'),'page title set')
    verify(page.locator('.stat-card').count()==4,'four metric cards rendered')
    verify('5件' in page.locator('#batch-count').inner_text(),'example has five sowings')
    verify(page.locator('#chart .bar-slot').count()==16,'weekly graph has 16 columns')
    verify('0件' in page.locator('.stat-card').nth(3).inner_text(),'example has no plot overlaps')
    verify(page.locator('#batch-rows tr').count()==5,'five schedule rows')
    page.screenshot(path=str(ROOT/'desktop.png'),full_page=True)
    page.locator('#compare-btn').click()
    verify(page.locator('.comparison').count()>=5,'compares at least five spacings')
    verify(page.locator('.comparison button').count()>=5,'comparison cards have action')
    verify('最上位' in page.locator('.comparison').first.inner_text(),'best candidate noted')
    page.locator('.comparison button').first.click()
    verify('9件' in page.locator('#batch-count').inner_text(),'candidate appends four sowings')
    verify(page.locator('#batch-rows tr').count()==9,'all added rows visible')
    page.locator('#batch-rows button[data-action=edit]').first.click()
    verify(page.locator('#batch-submit').inner_text()=='編集を保存','edit form loads selection')
    page.locator('#b-crop').fill('改訂コマツナ')
    page.locator('#batch-submit').click()
    verify('改訂コマツナ' in page.locator('#batch-rows').inner_text(),'editing saved')
    page.locator('#batch-rows button[data-action=remove]').first.click()
    verify('8件' in page.locator('#batch-count').inner_text(),'removal updates count')
    page.locator('#p-title').fill('春の菜園・改訂')
    page.locator('#p-target').fill('11')
    page.locator('#p-horizon').select_option('8')
    page.locator('#settings-form button').click()
    verify('春の菜園・改訂' in page.title(),'settings name updated')
    verify(page.locator('#chart .bar-slot').count()==8,'horizon updated')
    verify('目標 11' in page.locator('#chart').inner_text(),'target updated')
    stored=page.evaluate("localStorage.getItem('zurashibata-project-v1')")
    page.set_content(inline_html(stored),wait_until='load')
    verify('8件' in page.locator('#batch-count').inner_text(),'localStorage persistence across reload')
    verify(page.locator('#p-target').input_value()=='11','settings persisted')
    with page.expect_download() as d:
      page.locator('#json-btn').click()
    dl=d.value
    verify(dl.suggested_filename.endswith('.json'),'JSON is downloadable')
    with tempfile.TemporaryDirectory() as tmp:
      f=Path(tmp)/'saved.json';dl.save_as(str(f))
      saved=json.loads(f.read_text(encoding='utf-8'))
      verify(saved['title']=='春の菜園・改訂' and len(saved['batches'])==8,'JSON payload complete')
      with page.expect_download() as c: page.locator('#csv-btn').click()
      verify(c.value.suggested_filename.endswith('.csv'),'batch CSV downloads')
      with page.expect_download() as c: page.locator('#weekly-btn').click()
      verify(c.value.suggested_filename.endswith('.csv'),'weekly CSV downloads')
      with page.expect_download() as c: page.locator('#svg-btn').click()
      verify(c.value.suggested_filename.endswith('.svg'),'SVG chart downloads')
      page.locator('#clear-btn').click()
      # confirm dialog is dismissed by default: count unchanged
      verify('8件' in page.locator('#batch-count').inner_text(),'clear requires confirmation')
      page.once('dialog',lambda dialog:dialog.accept())
      page.locator('#clear-btn').click()
      verify('0件' in page.locator('#batch-count').inner_text(),'confirmed clear removes all')
      page.locator('#json-import').set_input_files(str(f))
      page.wait_for_function("document.querySelector('#batch-count').textContent.includes('8件')")
      verify('8件' in page.locator('#batch-count').inner_text(),'JSON restores data')
      malformed=Path(tmp)/'bad.json';malformed.write_text('{ this is broken',encoding='utf-8')
      page.locator('#json-import').set_input_files(str(malformed))
      verify('読み込み失敗' in page.locator('#toast').inner_text(),'malformed JSON handled gracefully')
      verify('8件' in page.locator('#batch-count').inner_text(),'bad import does not erase data')
    page.locator('#b-crop').fill('<img src=x onerror=alert(1)>')
    page.locator('#b-bed').select_option('0')
    page.locator('#b-sow').fill('2027-06-30')
    page.locator('#batch-submit').click()
    verify(page.locator('#batch-rows img').count()==0,'crop name HTML escaped')
    verify('9件' in page.locator('#batch-count').inner_text(),'single batch append functional')
    verify(not errors,'no uncaught browser errors')
    page.set_viewport_size({'width':390,'height':844})
    stored=page.evaluate("localStorage.getItem('zurashibata-project-v1')")
    page.set_content(inline_html(stored),wait_until='load')
    verify(page.locator('.stat-card').count()==4,'mobile renders stat cards')
    verify(page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'mobile page has no horizontal viewport overflow')
    page.screenshot(path=str(ROOT/'mobile.png'),full_page=True)
    browser.close()
print(f'BROWSER RESULT: {checks}/{checks} passed')
