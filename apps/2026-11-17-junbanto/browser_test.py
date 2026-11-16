"""Browser smoke tests for JUNBANTO. `python browser_test.py`"""
from pathlib import Path
from tempfile import TemporaryDirectory
from playwright.sync_api import sync_playwright
import json

ROOT=Path(__file__).resolve().parent
def run():
    checks=[]
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
            context=browser.new_context(accept_downloads=True,viewport={'width':1180,'height':800})
            context.on('page', lambda x: None)
            page=context.new_page()
            page.set_default_timeout(4500)
            errors=[]
            page.on('pageerror',lambda x:errors.append(str(x)))
            page.goto('about:blank')
            page.evaluate("""() => {const data={};Object.defineProperty(window,'localStorage',{value:{getItem:k=>Object.prototype.hasOwnProperty.call(data,k)?data[k]:null,setItem:(k,v)=>{data[k]=String(v)},removeItem:k=>{delete data[k]}},configurable:true});}""")
            html=(ROOT/'index.html').read_text().replace('<script src="engine.js"></script>','').replace('<script src="app.js"></script>','')
            page.set_content(html,wait_until='load')
            page.add_script_tag(content=(ROOT/'engine.js').read_text())
            page.add_script_tag(content=(ROOT/'app.js').read_text())
            assert page.get_by_text('イベント受付の準備').count()==1
            checks.append('初期手順書を表示')
            page.locator('button[data-action="start"][data-id="example-event"]').click()
            assert '0 / 5 実施済' in page.locator('#app').inner_text()
            assert not page.locator('button[data-action="complete"]').is_enabled()
            checks.append('実行開始・未着手の完了禁止')
            # log blocker; verify no false completion
            page.locator('button[data-action="status"][data-id="e1"][data-value="blocked"]').click()
            assert '1' in page.locator('.stat').filter(has_text='要対応').inner_text()
            assert not page.locator('button[data-action="complete"]').is_enabled()
            checks.append('要対応登録・完了抑止')
            # mark first as done and others except e3 (optional) as done
            page.locator('button[data-action="status"][data-id="e1"][data-value="done"]').click()
            for key in ['e2','e4','e5']:
                page.locator(f'button[data-action="status"][data-id="{key}"][data-value="done"]').click()
            assert not page.locator('button[data-action="complete"]').is_enabled()
            # skip without a reason should error
            page.locator('button[data-action="status"][data-id="e3"][data-value="skipped"]').click()
            assert '理由を書いてください' in page.locator('#toast').inner_text()
            assert not page.locator('button[data-action="complete"]').is_enabled()
            checks.append('通常項目の理由なし対象外を拒否')
            page.locator('#note-e3').fill('会場に掲示物を置けないため、スタッフが案内')
            page.locator('button[data-action="status"][data-id="e3"][data-value="skipped"]').click()
            assert page.locator('button[data-action="complete"]').is_enabled()
            page.locator('button[data-action="complete"]').click()
            assert '実行記録' in page.locator('#app').inner_text()
            assert page.locator('.pill').filter(has_text='完了').count()>=1
            checks.append('理由付き対象外・完了・履歴表示')
            with page.expect_download() as download:
                page.locator('button[data-action="report"]').click()
            artifact=download.value
            assert artifact.suggested_filename.endswith('.md')
            with TemporaryDirectory() as d:
                target=Path(d)/artifact.suggested_filename
                artifact.save_as(target)
                assert '会場に掲示物' in target.read_text()
            checks.append('Markdown報告書の出力・メモ保存')
            page.locator('button[data-view="home"]').first.click()
            page.locator('button[data-action="edit-template"][data-id="example-shoot"]').click()
            page.locator('#template-title').fill('引き継ぎ／試験 <script>alert(1)</script>')
            page.locator('button[data-action="save-template"]').click()
            page.locator('button[data-action="add-step"]').click()
            assert page.locator('[data-edit-step]').count()==6
            checks.append('手順書編集・項目追加')
            page.locator('button[data-view="home"]').last.click()
            assert page.locator('script').count()==2  # static engine and app only, unsafe text is escaped
            assert page.get_by_text('引き継ぎ／試験 <script>alert(1)</script>').count()==1
            checks.append('ユーザー入力のHTMLエスケープ')
            page.locator('button[data-action="start"][data-id="example-shoot"]').click()
            page.locator('button[data-action="status"][data-id="p1"][data-value="blocked"]').click()
            page.on('dialog',lambda d:d.accept())
            page.locator('button[data-action="incomplete"]').click()
            assert page.get_by_text('未完了',exact=True).count()>0
            checks.append('未解決のまま終了・未完了表示')
            page.locator('button[data-view="backup"]').click()
            with page.expect_download() as download:
                page.locator('button[data-action="export"]').click()
            dl=download.value
            with TemporaryDirectory() as d:
                target=Path(d)/'backup.json'
                dl.save_as(target)
                data=json.loads(target.read_text())
                assert len(data['runs'])==2
                assert any(v['status']=='incomplete' for v in data['runs'])
                assert len(data['templates'])==2
                # Create extra template; importing must replace it with the older saved snapshot.
                page.locator('button[data-view="home"]').click()
                page.locator('button[data-action="create-template"]').click()
                page.locator('button[data-view="home"]').last.click()
                assert page.locator('button[data-action="start"]').count()==3
                page.locator('button[data-view="backup"]').click()
                page.locator('#import-file').set_input_files(str(target))
                page.locator('button[data-view="home"]').click()
                assert page.locator('button[data-action="start"]').count()==2
                assert page.get_by_text('引き継ぎ／試験 <script>alert(1)</script>').count()==1
            checks.append('JSONエクスポート・インポート・記録復元')
            page.set_viewport_size({'width':390,'height':844})
            assert page.locator('button[data-action="start"]').count()==2
            assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1')
            checks.append('390pxモバイル・横はみ出しなし')
            assert not errors,errors
            checks.append('ブラウザ実行時エラーなし')
            context.close()
            browser.close()
    finally:
        pass
    for i,x in enumerate(checks,1):
        print(f'PASS {i:02d} {x}')
    print(f'Browser tests: {len(checks)}/{len(checks)}')

if __name__=='__main__':
    run()