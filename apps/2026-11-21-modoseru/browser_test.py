"""Run with python browser_test.py; local Chromium via Playwright."""
from pathlib import Path
from playwright.sync_api import sync_playwright, Error as PWError
import json

root=Path(__file__).resolve().parent
url=(root/'index.html').as_uri()
html=(root/'index.html').read_text()
html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+ (root/'style.css').read_text() + '</style>')
html=html.replace('<script src="engine.js" defer></script>','<script>'+ (root/'engine.js').read_text() + '</script>')
html=html.replace('<script src="app.js" defer></script>','')
html=html.replace('</body>','<script>'+ (root/'app.js').read_text() + '</script></body>')
store_script = "Object.defineProperty(window,'localStorage',{configurable:true,value:{data:{},getItem(k){return this.data[k]||null},setItem(k,v){this.data[k]=String(v)},removeItem(k){delete this.data[k]}}})"
def render_inline(page):
    page.set_content(html,wait_until='load')

checks=[]
def check(cond,label):
    assert cond, label
    checks.append(label)
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    context=browser.new_context(viewport={'width':1450,'height':900},accept_downloads=True,locale='ja-JP')
    page=context.new_page()
    errors=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    # Managed browser blocks local files; run the exact same source inline.
    # The in-memory storage shim tests persistence logic without network or disk.
    page.evaluate(store_script)
    render_inline(page)
    mode='inline, mocked localStorage'
    page.wait_for_selector('.matrix-table tbody tr')
    print('BROWSER MODE:',mode)
    check(page.title().startswith('戻せる？'),'タイトル表示')
    check(page.locator('.stat').count()==4,'サマリー4項目')
    check(page.locator('.data-item').count()==2,'初期データ2件')
    check(page.locator('.copy-card').count()==6,'初期コピー6件')
    check(page.locator('.matrix-table tbody tr').count()>5,'事故シナリオ生成')
    check(page.locator('#scenario option').count()==page.locator('.matrix-table tbody tr').count(),'事故選択肢がマトリクスと一致')
    check(page.locator('.detail-item').count()==2,'事故の対象資産数')
    check(page.locator('.status-pill.stale').count()>0,'期限超過の表示')
    check(page.locator('.status-pill.ready').count()>0,'復元できる候補の表示')
    page.screenshot(path=str(root/'desktop.png'),full_page=True)
    # Edit named copy and see output update
    page.locator('input[data-kind="copy"][data-id="c3"][data-field="name"]').fill('不変クラウドの世代')
    page.locator('input[data-kind="copy"][data-id="c3"][data-field="name"]').press('Tab')
    check(page.get_by_text('不変クラウドの世代',exact=False).count()>0,'コピーの編集反映')
    # Toggle verified copy from yes to no: change result
    page.locator('select[data-id="c3"][data-field="verified"]').select_option('false')
    check(page.locator('.detail-item').first.locator('.status-pill').inner_text()=='復元未検証','検証解除で判定変化')
    page.locator('select[data-id="c3"][data-field="verified"]').select_option('true')
    check(page.locator('.detail-item').first.locator('.status-pill').inner_text()=='復元候補あり','検証復帰で判定戻る')
    # Add a dataset and a copy
    page.locator('#add-dataset').click()
    check(page.locator('.data-item').count()==3,'データ資産追加')
    page.locator('#add-copy').click()
    check(page.locator('.copy-card').count()==7,'コピー追加')
    check(page.locator('.detail-item').count()==3,'追加データの診断')
    # Remove the new dataset, retain existing copies
    page.locator('.data-item').last.locator('[data-remove="dataset"]').click()
    check(page.locator('.data-item').count()==2,'データ資産削除')
    # select another scenario by matrix row
    page.locator('.matrix-table tbody tr').first.click()
    check(page.locator('select#scenario').input_value()!='ransomware:*','行クリックで事故切替')
    check(page.locator('tr.selected').count()==1,'選択行ハイライト')
    # CSV download
    with page.expect_download() as data:
        page.locator('#csv').click()
    download=data.value
    check(download.suggested_filename=='modoseru-report.csv','CSV書き出し')
    # JSON export, then import restore
    with page.expect_download() as dl:
        page.locator('#export-json').click()
    out=dl.value
    path=root/'test-export.json'
    out.save_as(path)
    exported=json.loads(path.read_text())
    check(len(exported['copies'])==7,'JSON書き出し内容')
    page.locator('#import-json').set_input_files(str(path))
    page.wait_for_timeout(100)
    check(page.locator('.copy-card').count()==7,'JSON読込の復元')
    # Persistence
    (page.reload() if mode=='direct file://' else render_inline(page));page.wait_for_selector('.matrix-table')
    check(page.locator('.copy-card').count()==7,'端末保存のリロード維持')
    check(page.locator('select#scenario').input_value()!='ransomware:*','選択シナリオのリロード維持')
    # Print hook
    page.evaluate('window.print=()=>{window.__printed=true}')
    page.locator('#print').click()
    check(page.evaluate('window.__printed===true'),'印刷処理呼出')
    # no PII or external script
    check(page.locator('script[src^="http"]').count()==0,'外部JS読込なし')
    check(len(errors)==0,'JavaScriptコンソール例外なし: '+str(errors))
    # Mobile clean context
    mobile=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1,accept_downloads=True,is_mobile=True,has_touch=True)
    m=mobile.new_page()
    if mode=='direct file://': m.goto(url)
    else: m.evaluate(store_script);render_inline(m)
    m.wait_for_selector('.matrix-table')
    check(m.locator('.stat').count()==4,'モバイル概要表示')
    m.screenshot(path=str(root/'mobile.png'),full_page=True)
    check(m.evaluate('document.documentElement.scrollWidth <= window.innerWidth+3'),'モバイル横はみ出しなし')
    mobile.close();context.close();browser.close()
print(f'BROWSER PASS {len(checks)}/{len(checks)}')
print('\n'.join('PASS '+x for x in checks))
