"""Browser acceptance tests for the exact four-file app, opened from file://."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent
checks=[]
def inline_source():
    markup=(ROOT/'index.html').read_text(encoding='utf-8')
    markup=markup.replace('<link rel="stylesheet" href="./style.css">','<style>'+ (ROOT/'style.css').read_text(encoding='utf-8') + '</style>')
    for f in ['engine.js','app.js']:
        markup=markup.replace('<script src="./'+f+'"></script>','<script>'+ (ROOT/f).read_text(encoding='utf-8') + '</script>')
    return markup

def setup_storage(page):
    page.evaluate('''window.__storageMock = window.__storageMock || new Map();Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>window.__storageMock.has(k)?window.__storageMock.get(k):null,setItem:(k,v)=>window.__storageMock.set(k,String(v)),removeItem:k=>window.__storageMock.delete(k)}});''')
def ck(cond,message):
    if not cond: raise AssertionError(message)
    checks.append(message)
    print('PASS',message)

def run():
  with sync_playwright() as p:
    browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    ctx=browser.new_context(viewport={'width':1440,'height':1000},device_scale_factor=1,accept_downloads=True)
    page=ctx.new_page(); errors=[]; requests=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.on('request',lambda request:requests.append(request.url) if request.url.startswith('http:') or request.url.startswith('https:') else None)
    page.on('dialog',lambda dialog:dialog.accept())
    setup_storage(page)
    page.set_content(inline_source(),wait_until='load')
    ck(page.title()=='訳幅ものさし | 多言語レイアウトQA','タイトル')
    ck(page.locator('.element').count()==5,'初期5要素')
    ck(page.locator('.preview-card').count()==6,'初期6言語プレビュー')
    ck(page.locator('#countAll').inner_text()=='30','初期30点検')
    ck(int(page.locator('#countOver').inner_text())>=1,'初期に発見可能なあふれ')
    ck(page.locator('textarea[data-lang="ja"]').input_value()=='こちらが入口です','日本語の初期内容')
    page.locator('#elementList button[data-index="2"]').click()
    ck(page.locator('input[data-field="label"]').input_value()=='バリアフリー経路','別要素選択')
    page.locator('textarea[data-lang="en"]').fill('X'*150)
    ck(page.locator('#countOver').inner_text().isdigit(),'入力即時集計')
    ck(page.locator('.preview-card').nth(1).locator('.preview-box').inner_text()=='X'*150,'入力即時プレビュー')
    old_width=float(page.locator('[data-field="width"]').input_value())
    page.locator('[data-field="width"]').fill('320')
    ck(page.locator('[data-field="width"]').input_value()=='320','幅変更')
    page.locator('[data-field="height"]').fill('100')
    ck(abs(page.locator('.preview-card').nth(1).locator('.preview-box').evaluate('(e)=>e.getBoundingClientRect().height')-100)<1.5,'プレビュー高100px')
    page.locator('#languageToggles input[value="fr"]').uncheck()
    ck(page.locator('#countAll').inner_text()=='25','言語を減らすと点検数も減る')
    page.locator('#languageToggles input[value="fr"]').check()
    ck(page.locator('#countAll').inner_text()=='30','言語を復帰')
    page.locator('#duplicateItem').click()
    ck(page.locator('.element').count()==6,'要素複製')
    page.locator('#addItem').click()
    ck(page.locator('.element').count()==7,'新規要素追加')
    ck(page.locator('textarea[data-lang="en"]').input_value()=='','新規翻訳は空欄')
    page.locator('textarea[data-lang="ja"]').fill('新しい案内表示')
    page.locator('#filterStatus').select_option('missing')
    ck(page.locator('.element').count()>=1,'未入力フィルタ')
    page.locator('#filterStatus').select_option('all')
    page.locator('#deleteItem').click()
    ck(page.locator('.element').count()==6,'要素削除')
    page.locator('#projectTitle').fill('施設A テスト')
    with page.expect_download() as d:
        page.locator('#saveJson').click()
    dl=d.value; ck(dl.suggested_filename=='yakuhaba-project.json','JSON保存名')
    tmp=ROOT/'test-project.json';dl.save_as(str(tmp))
    data=json.loads(tmp.read_text())
    ck(len(data['items'])==6 and data['title']=='施設A テスト','JSON保存内容')
    with page.expect_download() as d:
        page.locator('#exportCsv').click()
    dl=d.value;ck(dl.suggested_filename=='yakuhaba-strings.csv','CSV保存名')
    cp=ROOT/'test-strings.csv';dl.save_as(str(cp));ck('id,label,width' in cp.read_text(encoding='utf-8-sig'),'CSVヘッダ')
    with page.expect_download() as d:
        page.locator('#exportIssues').click()
    report=ROOT/'test-report.csv';d.value.save_as(str(report));ck('overflow' in report.read_text(encoding='utf-8-sig'),'問題CSVの出力')
    page.set_content(inline_source(),wait_until='load')
    ck(page.locator('#projectTitle').input_value()=='施設A テスト','端末保存と再読込')
    ck(page.locator('.element').count()==6,'要素も端末保存')
    page.locator('#fileInput').set_input_files(str(tmp))
    ck(page.locator('.element').count()==6,'JSON読込')
    page.locator('#fileInput').set_input_files(str(cp))
    ck(page.locator('.element').count()==6,'CSV読込')
    ck(page.locator('#projectTitle').input_value()=='test-strings','CSV読込はファイル名を反映')
    page.locator('#fileInput').set_input_files({'name':'broken.csv','mimeType':'text/csv','buffer':b'abc,def\n1,2'})
    ck('読込失敗' in page.locator('#toast').inner_text(),'不正CSVのエラー表示')
    page.locator('#resetDemo').click()
    ck(page.locator('.element').count()==5,'サンプル復元')
    page.locator('#elementList button[data-index="2"]').click()
    # On a wide enough box the resize helper is offered; otherwise disabled with a clear note.
    ck(page.locator('#fitHeight').count()==1 and page.locator('#fitWidth').count()==1,'寸法調整ボタン')
    # User text is never treated as HTML.
    page.locator('textarea[data-lang="en"]').fill('<img src=x onerror=alert(1)>')
    ck(page.locator('.preview-box img').count()==0,'翻訳入力のHTML無害化')
    ck(not errors,'ブラウザJSエラー 0件')
    ck(not requests,'外部HTTP通信 0件')
    page.locator('#resetDemo').click()
    page.screenshot(path=str(ROOT/'desktop.png'),full_page=True)
    mobile=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True)
    m=mobile.new_page(); setup_storage(m);m.set_content(inline_source())
    ck(m.locator('.element').count()==5,'モバイル表示')
    ck(m.locator('.preview-card').count()==6,'モバイル多言語プレビュー')
    ck(m.evaluate('document.documentElement.scrollWidth<=innerWidth+2'),'モバイル横スクロールなし')
    m.screenshot(path=str(ROOT/'mobile.png'),full_page=True)
    mobile.close();ctx.close();browser.close()
  for f in ['test-project.json','test-strings.csv','test-report.csv']:
      (ROOT/f).unlink(missing_ok=True)
  print('TOTAL',len(checks),'passed')
if __name__=='__main__':run()
