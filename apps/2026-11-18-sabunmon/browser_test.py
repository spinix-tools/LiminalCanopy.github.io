"""Browser E2E for SABUNMON. Loads actual source strings in Chromium.
Local HTTP/file navigation is blocked by the managed browser in this environment.
"""
from pathlib import Path
from tempfile import TemporaryDirectory
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from threading import Thread
from contextlib import contextmanager
import csv, io, os
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent
PASS=0

def check(condition, desc):
    global PASS
    assert condition, desc
    PASS+=1
    print(f"PASS {PASS:02} | {desc}")

@contextmanager
def webserver():
    class Handler(SimpleHTTPRequestHandler):
        def __init__(self,*args,**kwargs): super().__init__(*args,directory=str(ROOT),**kwargs)
        def log_message(self,*args):pass
    server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
    thread=Thread(target=server.serve_forever,daemon=True)
    thread.start()
    try: yield f'http://127.0.0.1:{server.server_address[1]}/index.html'
    finally:server.shutdown();thread.join(timeout=5);server.server_close()

with webserver() as url, sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
    context=browser.new_context(viewport={'width':1440,'height':980},device_scale_factor=1,accept_downloads=True)
    page=context.new_page()
    errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    def load_source(tab):
        html=(ROOT/'index.html').read_text(encoding='utf-8')
        html=html.replace('<link rel="stylesheet" href="style.css">','').replace('<script src="engine.js"></script><script src="app.js"></script>','')
        tab.set_content(html,wait_until='load')
        tab.add_style_tag(content=(ROOT/'style.css').read_text(encoding='utf-8'))
        tab.add_script_tag(content=(ROOT/'engine.js').read_text(encoding='utf-8'))
        tab.add_script_tag(content=(ROOT/'app.js').read_text(encoding='utf-8'))
    load_source(page)
    check(page.title().startswith('差分門'), '実HTML/CSS/JSをブラウザに読み込む')
    check(page.locator('#mModified').inner_text()=='4','初期デモで変更4件を検出')
    check(page.locator('#mAdded').inner_text()=='1','追加1件')
    check(page.locator('#mRemoved').inner_text()=='1','削除1件')
    check(page.locator('#mDanger').inner_text()=='3','要注意3件')
    check(page.locator('.change-card').count()==6,'変更6件をカード表示')
    check(page.locator('.change-card.high').count()==3,'高リスクをカードで表示')
    check('90.0%' in page.locator('.review-list').inner_text(),'大幅値下げ警告')
    check(page.locator('#keySelect').input_value()=='商品コード','キー列を自動推定')
    check(page.locator('#priceSelect').input_value()=='販売価格','価格列を自動推定')
    check(page.locator('#stockSelect').input_value()=='在庫数','在庫列を自動推定')
    page.screenshot(path=str(ROOT/'desktop.png'),full_page=True)
    page.locator('#approveSafeBtn').click()
    check(page.locator('#approvalCount').inner_text()=='3 / 6','安全側の一括承認は3件')
    check(page.locator('.change-card.high input:checked').count()==0,'高リスクは自動承認されない')
    with page.expect_download() as ev:page.locator('#exportStagedBtn').click()
    dl=ev.value
    with TemporaryDirectory() as temp:
        fname=Path(temp)/dl.suggested_filename
        dl.save_as(fname)
        raw=fname.read_bytes()
        check(raw.startswith(b'\xef\xbb\xbf'),'エクスポートにUTF-8 BOM')
        rows=list(csv.DictReader(io.StringIO(raw.decode('utf-8-sig'))))
        check(len(rows)==7,'旧6件＋承認済み追加1件を出力')
        index={r['商品コード']:r for r in rows}
        check(index['A-001']['販売価格']=='1080','通常の価格改定は承認反映')
        check(index['A-002']['販売価格']=='1800','未承認の値下げは差し戻し')
        check(index['A-003']['在庫数']=='9','未承認の在庫0は差し戻し')
        check('A-005' in index,'未承認削除の商品は保持')
        check('A-007' in index,'承認済みの追加商品は採用')
    page.locator('button[data-filter="danger"]').click()
    check(page.locator('.change-card').count()==3,'要注意フィルタに切替')
    page.locator('#searchBox').fill('A-002')
    check(page.locator('.change-card').count()==1,'検索でSKU絞り込み')
    page.locator('.change-card input[type=checkbox]').check()
    check(page.locator('#approvalCount').inner_text()=='4 / 6','高リスクは個別に承認できる')
    page.locator('#searchBox').fill('')
    page.locator('button[data-filter="approved"]').click()
    check(page.locator('.change-card').count()==4,'承認済みフィルタ')
    with page.expect_download() as ev:page.locator('#exportAuditBtn').click()
    dl=ev.value
    with TemporaryDirectory() as temp:
        path=Path(temp)/dl.suggested_filename;dl.save_as(path)
        audit=list(csv.DictReader(io.StringIO(path.read_text(encoding='utf-8-sig'))))
        check(any(r['商品コード']=='A-002' and r['承認']=='承認' for r in audit),'監査CSVに個別承認を記録')
        check(any(r['商品コード']=='A-003' and r['承認']=='未承認' for r in audit),'監査CSVに未承認を記録')
    with page.expect_download() as ev:page.locator('#exportOriginalBtn').click()
    with TemporaryDirectory() as temp:
        path=Path(temp)/ev.value.suggested_filename;ev.value.save_as(path)
        check('A-005' in path.read_text(encoding='utf-8-sig'),'変更前バックアップの書き出し')
    page.locator('#demoBtn').click()
    check(page.locator('#approvalCount').inner_text()=='0 / 6','サンプル再読込で承認状態をリセット')
    page.locator('#threshold').fill('80')
    page.locator('#threshold').dispatch_event('change')
    check(page.locator('#mModified').inner_text()=='—','設定変更で旧結果を無効化')
    page.locator('#compareBtn').click()
    check(page.locator('#mModified').inner_text()=='4','設定変更後の再比較')
    page.locator('#newCsv').fill('商品コード,商品名,販売価格,在庫数,カテゴリ\nA-001,柚子ジャム,abc,9,食品')
    page.locator('#compareBtn').click()
    check(page.locator('.change-card.blocked').count()==1,'不正価格をブロック表示')
    check(page.locator('.change-card.blocked input:disabled').count()==1,'不正価格の承認操作を無効化')
    with page.expect_download() as ev:page.locator('#exportStagedBtn').click()
    with TemporaryDirectory() as temp:
        path=Path(temp)/ev.value.suggested_filename;ev.value.save_as(path)
        out=list(csv.DictReader(io.StringIO(path.read_text(encoding='utf-8-sig'))))
        check(out[0]['販売価格']=='980','不正値は更新案に含めない')
    page.locator('#newCsv').fill('商品コード,商品名,販売価格,在庫数,カテゴリ\nA-001,柚子ジャム,10,9,食品\nA-001,重複,20,3,食品')
    page.locator('#compareBtn').click()
    check('重複' in page.locator('#message').inner_text(),'キー重複の診断を確認')
    check(page.locator('#exportStagedBtn').is_disabled(),'エラー時は書き出し禁止')
    page.locator('#demoBtn').click()
    page.locator('#searchBox').fill('<img src=x onerror=alert(1)>')
    check(page.locator('.change-card').count()==0,'検索にHTMLタグを含めても安全')
    page.locator('#searchBox').fill('')
    page.locator('#oldCsv').fill('商品コード,商品名,販売価格,在庫数\n0001,商品A,100,5')
    page.locator('#newCsv').fill('商品コード,商品名,販売価格,在庫数\n0001,<img src=x onerror=alert(1)>,100,5')
    page.locator('#compareBtn').click()
    check(page.locator('img').count()==0,'CSV由来HTMLを実行しない')
    page.locator('#demoBtn').click()
    context2=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1)
    mobile=context2.new_page();load_source(mobile)
    check(mobile.locator('#mModified').inner_text()=='4','スマホでも計算ができる')
    check(mobile.evaluate('document.documentElement.scrollWidth <= window.innerWidth+1'),'スマホで横スクロールなし')
    mobile.screenshot(path=str(ROOT/'mobile.png'),full_page=True)
    check(not errors,'ブラウザ内JavaScriptエラーなし')
    context2.close();context.close();browser.close()
print(f'BROWSER PASS {PASS}/{PASS}')
