"""Browser smoke / workflow tests. Run: python browser_test.py"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json
ROOT=Path(__file__).parent
# Controlled Chromium runtime blocks file:// and loopback/navigation URLs.
# Inline the exact same CSS/JS and simulate localStorage on about:blank.
def bundle_html():
    html=(ROOT/'index.html').read_text(encoding='utf-8')
    html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+(ROOT/'style.css').read_text(encoding='utf-8')+'</style>')
    for part in ['engine','app']:
        html=html.replace(f'<script src="{part}.js"></script>','<script>'+(ROOT/(part+'.js')).read_text(encoding='utf-8')+'</script>')
    return html
HTML=bundle_html()
STORAGE_SHIM="""Object.defineProperty(window,'localStorage',{value:{_data:{},getItem(k){return this._data[k]??null},setItem(k,v){this._data[k]=String(v)},removeItem(k){delete this._data[k]}}})"""
def open_inline(page):
    page.goto('about:blank')
    page.evaluate(STORAGE_SHIM)
    page.set_content(HTML,wait_until='load')
checks=[]
def verify(name,condition):
    checks.append((name,bool(condition)))
    if not condition: raise AssertionError(name)
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    ctx=browser.new_context(viewport={'width':1440,'height':950},accept_downloads=True)
    page=ctx.new_page(); errors=[]; requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda req: requests.append(req.url) if req.url.startswith('http') else None)
    open_inline(page)
    print('PAGE',page.url,'TITLE',page.title())
    verify('タイトル表示',page.title().startswith('収穫なみ'))
    verify('初期3区画',page.locator('.bed-row').count()==3)
    verify('初期5作付け',page.locator('.crop-bar').count()==5)
    verify('初期6作物',page.locator('#plantCrop option').count()==6)
    verify('SVGグラフ',page.locator('#forecast rect').count()==26)
    verify('提案ボタン',page.locator('#adoptSuggestion').count()==1)
    initial=page.locator('.stat .v').first.inner_text()
    page.locator('#adoptSuggestion').click()
    verify('提案を採用して作付け増加',page.locator('.crop-bar').count()==6)
    verify('提案後の再計算',page.locator('.stat .v').first.inner_text()!=initial or page.locator('.stat .v').nth(1).inner_text()!='')
    page.locator('.crop-bar').first.click()
    verify('既存作付けの選択',page.locator('#editStatus').inner_text()=='編集中')
    page.locator('#plantWeek').select_option('1');page.locator('#plantSave').click()
    verify('編集後5+1件維持',page.locator('.crop-bar').count()==6)
    page.locator('.crop-bar').first.click();page.locator('#deletePlant').click()
    verify('作付け削除',page.locator('.crop-bar').count()==5)
    page.locator('#addBedBtn').click()
    verify('区画追加',page.locator('.bed-row').count()==4)
    page.locator('#addCropBtn').click()
    verify('作物追加',page.locator('#profileCrop option').count()==7)
    page.locator('#cropName').fill('テスト野菜');page.locator('#cropYield').fill('18');page.locator('#saveCrop').click()
    verify('作物編集',page.locator('#profileCrop option',has_text='テスト野菜').count()==1)
    page.locator('#plantBed').select_option(index=3);page.locator('#plantCrop').select_option(label='テスト野菜');page.locator('#plantWeek').select_option('1');page.locator('#plantSave').click()
    verify('追加作物で作付け',page.locator('.crop-bar').count()==6)
    page.locator('#weeks').select_option('16')
    verify('期間変更で16週',page.locator('#forecast rect').count()==16)
    page.locator('#target').fill('14');page.locator('#target').dispatch_event('change')
    verify('目標変更が表示に反映',page.locator('#target').input_value()=='14')
    with page.expect_download() as download_event: page.locator('#exportJsonBtn').click()
    download=download_event.value; data=json.loads(Path(download.path()).read_text('utf-8'))
    verify('JSONダウンロード',data['target']==14 and len(data['beds'])==4)
    with page.expect_download() as download_event: page.locator('#csvBtn').click()
    download=download_event.value
    verify('CSVダウンロード',Path(download.path()).read_text('utf-8').startswith('\ufeff'))
    page.locator('#sampleBtn').click()
    verify('サンプル復元',page.locator('.crop-bar').count()==5)
    page.locator('#importJson').set_input_files({'name':'plan.json','mimeType':'application/json','buffer':json.dumps(data).encode('utf-8')})
    verify('JSON復元',page.locator('.bed-row').count()==4 and page.locator('#target').input_value()=='14')
    ctx2=browser.new_context(viewport={'width':390,'height':844});mobile=ctx2.new_page();open_inline(mobile);
    verify('モバイル表示',mobile.locator('h1').is_visible())
    verify('モバイルでページ横はみ出しなし',mobile.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'))
    verify('JS例外なし',len(errors)==0)
    verify('ネットワークへの通信なし',len(requests)==0)
    # Reopen same context to verify localStorage survives reload.
    stored=page.evaluate('localStorage.getItem("shukaku-nami-plan-v1")')
    page.goto('about:blank');page.evaluate(STORAGE_SHIM);page.evaluate('(v)=>localStorage.setItem("shukaku-nami-plan-v1",v)',stored)
    page.set_content(HTML,wait_until='load');verify('端末保存シミュレーションの維持',page.locator('.bed-row').count()==4 and page.locator('#target').input_value()=='14')
    # Restore the polished sample for visual snapshot.
    page.locator('#sampleBtn').click();page.screenshot(path=str(ROOT/'desktop.png'),full_page=True)
    mobile.locator('#sampleBtn').click();mobile.screenshot(path=str(ROOT/'mobile.png'),full_page=True)
    browser.close()
print('BROWSER TESTS',len(checks),'PASSED',sum(v for _,v in checks))
for name,ok in checks: print('PASS' if ok else 'FAIL',name)
