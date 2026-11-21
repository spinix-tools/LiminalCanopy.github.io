#!/usr/bin/env python3
"""Browser E2E smoke/functional checks of the exact split-source app over localhost."""
import json, os, time, re
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent
# The browser sandbox blocks all file/localhost navigation. Recreate the exact
# HTML/CSS/JS in a single document for functional verification.
def inline_html():
    html=(ROOT/'index.html').read_text(encoding='utf-8')
    css=(ROOT/'style.css').read_text(encoding='utf-8')
    engine=(ROOT/'engine.js').read_text(encoding='utf-8')
    app=(ROOT/'app.js').read_text(encoding='utf-8')
    html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+css+'</style>')
    html=html.replace('<script src="engine.js"></script>','<script>'+engine+'</script>')
    html=html.replace('<script src="app.js"></script>','<script>'+app+'</script>')
    return html
HTML=inline_html()
passed=0

def check(condition,label):
    global passed
    assert condition,label
    passed+=1
    print(f'PASS {passed:02d} {label}')

try:
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
        context=browser.new_context(viewport={'width':1440,'height':900},accept_downloads=True)
        page=context.new_page()
        errors=[]; extern=[]
        page.on('pageerror',lambda e: errors.append(str(e)))
        page.on('request',lambda r: extern.append(r.url) if not r.url.startswith(('http://127.0.0.1:8765/','data:','blob:')) else None)
        page.evaluate("""() => { const box={}; Object.defineProperty(window,'localStorage',{ configurable:true, value:{getItem(k){return box[k]??null},setItem(k,v){box[k]=String(v)},removeItem(k){delete box[k]}}}); }""")
        page.set_content(HTML,wait_until='load')
        check(page.locator('h1').count()==1,'ドキュメント読込')
        check(page.title().startswith('分岐灯'),'ページタイトル')
        check(page.locator('.stat').count()==4,'統計カード4枚')
        check(page.locator('.question-card').count()==6,'初期質問6件')
        check('CYCLE' in page.locator('#issue-list').inner_text(),'循環を検出')
        check('UNREACHABLE' in page.locator('#issue-list').inner_text(),'未到達を検出')
        check(page.locator('.case').count()>0,'経路テストケース生成')
        check(page.locator('.run-choice').count()==2,'回答者モード選択肢')
        check(not errors,'初期JavaScript例外なし')
        check(not extern,'外部リクエストなし')
        page.screenshot(path=str(ROOT/'desktop.png'),full_page=True)
        # Running a short completion path: q1 -> q4 -> q5 -> END
        page.locator('.run-choice').nth(1).click()
        check('q4' in page.locator('#run-panel .run-meta').inner_text(),'オンライン参加でq4へ')
        page.locator('.run-choice').nth(0).click()
        check('q5' in page.locator('#run-panel .run-meta').inner_text(),'q4からq5へ')
        page.locator('.run-choice').nth(0).click()
        check('完了に到達' in page.locator('#run-panel').inner_text(),'完了判定')
        page.locator('#restart-run').click()
        check('q1' in page.locator('#run-panel .run-meta').inner_text(),'回答者モード再開始')
        page.locator('.run-choice').nth(0).click()
        page.locator('.run-choice').nth(0).click()
        page.locator('.run-choice').nth(1).click()
        page.locator('.run-choice').nth(1).click()
        check('経路が停止' in page.locator('#run-panel').inner_text(),'q5自己ループで停止')
        # Repair demo loop: q5 second answer routes to END.
        page.locator('[data-field="next"][data-id="q5"][data-index="1"]').select_option('END')
        check('CYCLE' not in page.locator('#issue-list').inner_text(),'ループ解消に診断追従')
        check('UNREACHABLE' in page.locator('#issue-list').inner_text(),'未到達は残る')
        # Connect q6 via q5 second answer.
        page.locator('[data-field="next"][data-id="q5"][data-index="1"]').select_option('q6')
        check('UNREACHABLE' not in page.locator('#issue-list').inner_text(),'孤立の解消')
        check('問題なし' in page.locator('#audit-status').inner_text(),'全体チェック正常')
        # Change title (change event on blur)
        title=page.locator('[data-field="title"][data-id="q3"]')
        title.fill('テスト改名「&」')
        title.press('Tab')
        check('テスト改名「&」' in page.locator('#route-map').inner_text(),'質問名変更反映')
        page.locator('[data-action="add-option"][data-id="q2"]').click()
        check(page.locator('.question-card[data-qcard="q2"] .choice-row').count()==3,'選択肢追加')
        check('BROKEN_EDGE' in page.locator('#issue-list').inner_text(),'選択肢追加時に未設定警告')
        page.locator('[data-field="next"][data-id="q2"][data-index="2"]').select_option('END')
        check('BROKEN_EDGE' not in page.locator('#issue-list').inner_text(),'選択肢リンクの修正')
        page.locator('[data-action="delete-option"][data-id="q2"][data-index="2"]').click()
        check(page.locator('.question-card[data-qcard="q2"] .choice-row').count()==2,'選択肢削除')
        page.locator('#add-question').click()
        check(page.locator('.question-card').count()==7,'質問追加')
        check('UNREACHABLE' in page.locator('#issue-list').inner_text(),'新規質問は孤立')
        page.locator('[data-action="delete-question"][data-id="q7"]').click()
        check(page.locator('.question-card').count()==6,'質問削除')
        # Export & inspect JSON/CSV
        with page.expect_download() as info:
            page.locator('#export-json').click()
        file=info.value
        check(file.suggested_filename.endswith('.json'),'JSONエクスポート')
        data=json.loads(Path(file.path()).read_text(encoding='utf-8'))
        check(len(data['questions'])==6,'JSONに6問')
        check(data['questions'][2]['title']=='テスト改名「&」','JSONの内容照合')
        with page.expect_download() as info2:
            page.locator('#export-csv').click()
        d2=info2.value
        check(d2.suggested_filename.endswith('.csv'),'CSVエクスポート')
        check('経路' in Path(d2.path()).read_text(encoding='utf-8-sig'),'CSVのテスト経路')
        # Save survives reload, then import previous demo.
        page.set_content(HTML,wait_until='load')
        check('テスト改名「&」' in page.locator('#route-map').inner_text(),'リロード後の端末保存')
        demo=ROOT/'test-import.json';demo.write_text(json.dumps(data,ensure_ascii=False),encoding='utf-8')
        page.locator('#file-input').set_input_files(str(demo))
        check('JSONを読み込みました' in page.locator('#flash').inner_text(),'JSONインポート')
        demo.unlink()
        page.locator('#new-project').click()
        check(page.locator('.question-card').count()==1,'新規作成')
        check('問題なし' in page.locator('#audit-status').inner_text(),'新規作成の正常診断')
        page.locator('#reset-demo').click()
        check(page.locator('.question-card').count()==6,'サンプル復元')
        # Responsive view and XSS escape: malicious HTML stays plain text.
        page.locator('[data-field="title"][data-id="q1"]').fill('<img src=x onerror=alert(1)>')
        page.locator('[data-field="title"][data-id="q1"]').press('Tab')
        check(page.locator('#route-map img').count()==0,'HTMLエスケープ')
        mobile=context.new_page();mobile.set_viewport_size({'width':390,'height':844})
        mobile.evaluate("""() => {Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem(){return null},setItem(){}}})}""")
        mobile.set_content(HTML,wait_until='load')
        check(mobile.evaluate('document.documentElement.scrollWidth <= window.innerWidth'),'モバイル横スクロールなし')
        check(mobile.locator('.question-card').count()==6,'モバイル質問の描画')
        mobile.screenshot(path=str(ROOT/'mobile.png'),full_page=True)
        check(len(errors)==0,'ブラウザJSエラー0件')
        check(len(extern)==0,'外部リクエスト0件')
        mobile.close();context.close();browser.close()
finally:
    pass
print(f'BROWSER PASS: {passed}/{passed}')
