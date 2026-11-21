#!/usr/bin/env python3
"""End-to-end smoke/integration tests for the actual split-file app."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json
import re

ROOT = Path(__file__).resolve().parent
URI = (ROOT/'index.html').as_uri()
def app_markup():
    html=(ROOT/'index.html').read_text()
    style=(ROOT/'style.css').read_text()
    html=html.replace('<link rel="stylesheet" href="./style.css">','<style>'+style+'</style>')
    for name in ['engine.js','app.js']:
        html=html.replace('<script src="./'+name+'"></script>', '<script>'+ (ROOT/name).read_text() + '</script>')
    return html
MOCK_STORE = """() => {const m=new Map();Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)}})}"""

passes=[]
def check(condition, text):
    if not condition: raise AssertionError(text)
    passes.append(text)

def run():
  with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
    ctx=browser.new_context(viewport={'width':1440,'height':1000},accept_downloads=True,locale='ja-JP')
    page=ctx.new_page()
    issues=[];requests=[]
    page.on('pageerror',lambda exc:issues.append(str(exc)))
    page.on('request',lambda r:requests.append(r.url) if r.url.startswith('http:') or r.url.startswith('https:') else None)
    # Browser sandbox blocks all navigate() URLs, including file:/ and localhost.
    # Inline the exact source bytes for browser execution, with an in-memory localStorage stub.
    page.evaluate(MOCK_STORE)
    page.set_content(app_markup(),wait_until='load')
    check(page.title().startswith('窯みち'),'元ソースのHTML/CSS/JSをインライン実行')
    check(page.locator('#jobs tr').count()==6,'初期6バッチを表示')
    check(page.locator('#timeline .t-row').count()==6,'実績計算結果の6行タイムライン')
    check(page.locator('#strategy').inner_text().startswith('採用方式'), '自動比較の採用方式を表示')
    check(page.locator('#finish').inner_text()!='—','冷却終了時刻を算出')
    check(page.locator('.t-block.bake').count()>0,'焼成ブロックを表示')
    check(page.locator('.t-block.proof').count()>0,'発酵ブロックを表示')
    check(page.locator('.t-block.prep').count()>0,'仕込みブロックを表示')
    check(page.locator('.t-block.cool').count()>0,'冷却ブロックを表示')
    check(page.locator('#alerts').count()==1,'警告パネルを表示')
    check(page.locator('#whatif').inner_text().strip()!='','窯の天板増枠比較を算出')
    page.screenshot(path=str(ROOT/'desktop.png'),full_page=True)
    page.locator('#mode').select_option('manual')
    check('入力順' in page.locator('#strategy').inner_text(),'入力順モードへ切替')
    page.locator('#mode').select_option('proof')
    check('発酵上限優先' in page.locator('#strategy').inner_text(),'発酵上限優先モードへ切替')
    page.locator('#mode').select_option('due')
    check('完成期限優先' in page.locator('#strategy').inner_text(),'完成期限優先モードへ切替')
    page.locator('#add').click()
    check(page.locator('#jobs tr').count()==7,'バッチ追加')
    page.locator('input[data-field="name"]').last.fill('試験パン')
    page.locator('input[data-field="name"]').last.dispatch_event('change')
    check('試験パン' in page.locator('#timeline').inner_text(),'製品名変更が結果に反映')
    page.locator('#jobs tr').last.locator('button').click()
    check(page.locator('#jobs tr').count()==6,'バッチ削除')
    page.locator('#oven').fill('5'); page.locator('#oven').dispatch_event('change')
    check('天板5枚' in page.locator('#strategy').inner_text(),'窯容量変更の反映')
    page.locator('#start').fill('05:30');page.locator('#start').dispatch_event('change')
    check(page.locator('#start').input_value()=='05:30','仕込み開始時刻を変更')
    page.locator('#jobs tr').first.locator('input[data-field="trays"]').fill('99')
    page.locator('#jobs tr').first.locator('input[data-field="trays"]').dispatch_event('change')
    check(page.locator('#error').is_visible(),'不正な容量をエラー表示')
    check(page.locator('#csv').is_disabled(),'入力エラー時にCSV出力を無効化')
    page.locator('#jobs tr').first.locator('input[data-field="trays"]').fill('3')
    page.locator('#jobs tr').first.locator('input[data-field="trays"]').dispatch_event('change')
    check(not page.locator('#error').is_visible(),'入力修正で復帰')
    page.locator('#jobs tr').first.locator('input[data-field="name"]').fill('<script>alert(1)</script>')
    page.locator('#jobs tr').first.locator('input[data-field="name"]').dispatch_event('change')
    check(page.locator('#timeline script').count()==0,'製品名のHTML注入を防止')
    check('<script>' in page.locator('#timeline').inner_text(),'記号をテキストとして表示')
    with page.expect_download() as dl:
        page.locator('#csv').click()
    csv_dl=dl.value
    check(csv_dl.suggested_filename=='kamamichi-plan.csv','CSV予定表をダウンロード')
    csv_file=ROOT/'test-plan.csv';csv_dl.save_as(csv_file)
    check(csv_file.read_bytes().startswith(b'\xef\xbb\xbf'),'CSVがExcel向けBOM形式')
    with page.expect_download() as dl:page.locator('#json').click()
    json_dl=dl.value;json_path=ROOT/'test-settings.json';json_dl.save_as(json_path)
    snap=json.loads(json_path.read_text())
    check(snap['data']['oven']==5,'JSONに編集後の窯容量を保存')
    check(snap['data']['jobs'][0]['name']=='<script>alert(1)</script>','JSONに編集後の製品名を保存')
    page.locator('#sample').click()
    check(page.locator('#oven').input_value()=='4','デモへ初期化')
    page.locator('#import').set_input_files(str(json_path))
    check(page.locator('#oven').input_value()=='5','JSON読込で設備設定を復元')
    check(page.locator('input[data-field="name"]').first.input_value()=='<script>alert(1)</script>','JSON読込で製品名を復元')
    check(page.locator('#mode').input_value()=='due','JSON読込でモードを復元')
    page.set_content(app_markup(),wait_until='load')
    check(page.locator('#oven').input_value()=='5','同一環境で再初期化後も模擬端末保存を保持')
    check(page.locator('#mode').input_value()=='due','再初期化後もモードを保持')
    page.locator('#clear').click()
    check('削除しました' in page.locator('#saveState').inner_text(),'端末保存削除を実行')
    check(page.evaluate("localStorage.getItem('kamamichi.20261122.v1')") is None,'端末保存データは実際に削除済み')
    check(not issues,'JSページ例外なし: '+str(issues))
    check(not requests,'外部HTTP(S)通信なし: '+str(requests))
    mctx=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1,has_touch=True,is_mobile=True,locale='ja-JP')
    mob=mctx.new_page();mob.evaluate(MOCK_STORE);mob.set_content(app_markup(),wait_until='load')
    check(mob.locator('#jobs tr').count()==6,'モバイル初期表示')
    check(mob.locator('.topbar').is_visible(),'モバイルヘッダー表示')
    check(mob.locator('#timeline').is_visible(),'モバイル工程表表示')
    mob.screenshot(path=str(ROOT/'mobile.png'),full_page=True)
    check(mob.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 3'),'モバイルでページ全体が横にはみ出ない')
    mctx.close();ctx.close();browser.close()
  for i, item in enumerate(passes,1):print(f'PASS {i:02d} {item}')
  print(f'Browser checks passed: {len(passes)} / {len(passes)}')

if __name__=='__main__':run()
