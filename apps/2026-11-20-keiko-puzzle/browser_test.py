"""Offline Chromium UI smoke test, run: python browser_test.py"""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent
checks=[]
def inline_html():
    html=(ROOT/'index.html').read_text()
    engine=(ROOT/'engine.js').read_text().replace('</script>', r'<\/script>')
    return html.replace('<script src="./engine.js"></script>', f'<script>{engine}</script>')
def check(label,func):
    func();checks.append(label)

def run():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-gpu'])
        ctx=browser.new_context(viewport={'width':1440,'height':960},accept_downloads=True)
        page=ctx.new_page()
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('dialog',lambda dialog: dialog.accept())
        page.goto('about:blank')
        page.evaluate("""() => {let obj={};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem(k){return obj[k]??null},setItem(k,v){obj[k]=String(v)},removeItem(k){delete obj[k]}}})}""")
        page.set_content(inline_html(),wait_until='load')
        check('見出し表示',lambda:assert_true(page.locator('h1').count()==1))
        check('統計描画',lambda:assert_true(page.locator('#stats .stat').count()==4))
        check('稽古枠3件表示',lambda:assert_true(page.locator('.plan-slot').count()==3))
        check('初期サンプルの場面数',lambda:assert_true(page.locator('.scene').count()==4))
        check('初期の固定割当表示',lambda:assert_true(page.locator('.lockbtn.on').count()>0))
        check('出欠マトリクス',lambda:assert_true(page.locator('.att').count()==12))
        page.screenshot(path=str(ROOT/'desktop.png'),full_page=True)
        # toggle absence and make sure conflicts show for fixed allocation
        page.locator('.att').first.click()
        check('欠席変更が警告へ反映',lambda:assert_true('欠席と衝突' in page.locator('#audit').inner_text()))
        page.locator('.att').first.click()
        check('欠席を戻すと警告解消',lambda:assert_true('欠席と衝突' not in page.locator('#audit').inner_text()))
        page.locator('#newperson').fill('新しい役')
        page.locator('[data-action="add-person"]').click()
        check('出演者追加',lambda:assert_true(page.locator('#people input[data-type="person"]').count()==5))
        page.locator('[data-action="add-scene"]').click()
        check('場面追加',lambda:assert_true(page.locator('.scene').count()==5))
        page.locator('#newslot').fill('追加稽古枠')
        page.locator('[data-action="add-slot"]').click()
        check('稽古枠追加',lambda:assert_true(page.locator('.plan-slot').count()==4))
        page.locator('#optimize').click()
        check('再編表示',lambda:assert_true('自動再編しました' in page.locator('#status').inner_text()))
        check('固定維持',lambda:assert_true(page.locator('.lockbtn.on').count()>0))
        page.locator('#checkslot').select_option(index=1)
        check('当日チェック',lambda:assert_true(page.locator('#candidates').inner_text().strip()!=''))
        with page.expect_download() as info:page.locator('#exportCsv').click()
        check('CSVダウンロード',lambda:assert_true(info.value.suggested_filename.endswith('.csv')))
        with page.expect_download() as info:page.locator('#exportJson').click()
        jsonpath=ROOT/'tmp-test-import.json'; info.value.save_as(str(jsonpath))
        check('JSONダウンロード',lambda:assert_true(jsonpath.stat().st_size>100))
        page.set_content(inline_html(),wait_until="load")
        check('localStorage保存/再読込',lambda:assert_true(page.locator('#people input[data-type="person"]').count()==5))
        page.locator('#importJson').set_input_files(str(jsonpath))
        check('JSON読み込み',lambda:assert_true('読み込みました' in page.locator('#status').inner_text()))
        jsonpath.unlink()
        check('JavaScript例外なし',lambda:assert_true(not errors,f'javascript errors: {errors}'))
        page.locator('#reset').click()
        check('サンプルリセット',lambda:assert_true(page.locator('.scene').count()==4))
        page.close();ctx.close()
        mctx=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1)
        mobile=mctx.new_page(); mobile.goto('about:blank'); mobile.set_content(inline_html(),wait_until='load')
        mobile.screenshot(path=str(ROOT/'mobile.png'),full_page=True)
        check('モバイル横幅収まる',lambda:assert_true(mobile.evaluate('document.documentElement.scrollWidth <= innerWidth + 3')))
        check('モバイルで計画確認',lambda:assert_true(mobile.locator('.plan-slot').count()==3))
        check('モバイル例外なし',lambda:assert_true(not errors))
        mctx.close();browser.close()
    print('Browser tests:',len(checks),'passed')
    for c in checks:print(' ✓',c)

def assert_true(test,msg='test failed'):
    if not test: raise AssertionError(msg)

if __name__=='__main__':run()
