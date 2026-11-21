"""Integration tests against Chromium using exact local files served through Playwright route interception.
The runtime blocks file:// and loopback HTTP, hence a synthetic https origin; no remote calls.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json
import mimetypes
import traceback

ROOT = Path(__file__).parent
from html import escape
checks = []
def check(name, condition):
    if not condition:
        raise AssertionError(name)
    checks.append(name)

def inline_source():
    html=(ROOT/'index.html').read_text(encoding='utf-8')
    html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+ (ROOT/'style.css').read_text(encoding='utf-8')+'</style>')
    for filename in ('engine.js','app.js'):
        html=html.replace('<script src="'+filename+'"></script>','<script>'+ (ROOT/filename).read_text(encoding='utf-8')+'</script>')
    return html

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'])
    context = browser.new_context(viewport={'width':1440,'height':1000},accept_downloads=True)
    page = context.new_page()
    errors=[]; requests=[]
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('request', lambda r: requests.append(r.url))
    page.evaluate('''() => {const data={}; Object.defineProperty(window, 'localStorage',{configurable:true, value:{getItem(k){return data[k] ?? null},setItem(k,v){data[k]=String(v)},removeItem(k){delete data[k]}}});}''')
    page.set_content(inline_source(),wait_until='load')
    check('タイトル',page.title() == '差し替え照合室 | SASHIKAE ROOM')
    check('旧稿読込', '開演は明日' in page.locator('#oldDraft').input_value())
    check('新稿読込', '開演は今夜' in page.locator('#newDraft').input_value())
    check('初回比較',int(page.locator('#mChange').inner_text())>=2)
    check('初回受け検出',int(page.locator('#mCue').inner_text())>=1)
    check('受け候補に渚',page.locator('#cueList').inner_text().find('渚')>=0)
    check('役フィルタ生成',page.get_by_role('button',name='葵',exact=True).count()==1)
    page.get_by_role('button',name='葵',exact=True).click()
    check('役フィルタ適用',page.locator('#reportDesc').inner_text().startswith('葵 担当'))
    check('役フィルタで絞込', '渚 担当' not in page.locator('#reportDesc').inner_text())
    with page.expect_download() as download:
        page.locator('#csvBtn').click()
    content=Path('/mnt/data/sashikae-test-download.csv')
    download.value.save_as(content)
    check('CSVダウンロード',content.read_text(encoding='utf-8-sig').startswith('"種別"'))
    check('CSV役別', '葵' in content.read_text(encoding='utf-8-sig'))
    page.locator('#oldDraft').fill('# 第一場\n葵：まもなく開演です。\n渚：はい。')
    page.locator('#newDraft').fill('# 第一場\n葵：ただいま開演です。\n渚：はい。')
    page.locator('#compareBtn').click()
    check('入力を再計算',page.locator('#mChange').inner_text()=='1')
    check('新たな受けの検出',page.locator('#mCue').inner_text()=='1')
    check('台本文字が描画される',page.locator('#changeList').inner_text().find('ただいま開演')>=0)
    # XSS must remain literal and not be interpreted as markup.
    page.locator('#newDraft').fill('# 第一場\n葵：<img src=x onerror="window.HACKED=true">\n渚：はい。')
    page.locator('#compareBtn').click()
    check('HTML無害化',page.evaluate('window.HACKED === undefined'))
    check('カード内画像タグなし',page.locator('#changeList img').count()==0)
    # project JSON import is local, with schema validation
    project={'schema':1,'old':'葵：朝です','new':'葵：夜です'}
    page.locator('#jsonInput').set_input_files({'name':'sample.json','mimeType':'application/json','buffer':json.dumps(project,ensure_ascii=False).encode('utf-8')})
    check('JSON入力',page.locator('#oldDraft').input_value()=='葵：朝です')
    check('JSON入力後比較',page.locator('#mChange').inner_text()=='1')
    with page.expect_download() as download:
        page.locator('#jsonBtn').click()
    jpath=Path('/mnt/data/sashikae-test-project.json')
    download.value.save_as(jpath)
    check('JSON出力内容',json.loads(jpath.read_text())['new']=='葵：夜です')
    page.locator('#saveBtn').click()
    page.set_content(inline_source(),wait_until='load')
    check('模擬端末保存の再表示',page.locator('#oldDraft').input_value()=='葵：朝です')
    page.on('dialog', lambda dialog: dialog.accept())
    page.locator('#sampleBtn').click()
    check('サンプル復元', '開演は明日' in page.locator('#oldDraft').input_value())
    check('横幅崩れなし',page.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 2'))
    page.screenshot(path=str(ROOT/'desktop.png'),full_page=True)
    # Mobile viewport on same source, check horizontal overflow and controls.
    mobile=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1,accept_downloads=True)
    mp=mobile.new_page(); mp.evaluate('''() => {Object.defineProperty(window, 'localStorage',{configurable:true,value:{getItem:()=>null,setItem:()=>{}}});}'''); mp.set_content(inline_source(),wait_until='load')
    check('モバイル表示の横スクロールなし',mp.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 2'))
    check('モバイル比較ボタン表示',mp.locator('#compareBtn').is_visible())
    mp.locator('#compareBtn').click()
    check('モバイル比較操作',int(mp.locator('#mChange').inner_text())>=1)
    mp.screenshot(path=str(ROOT/'mobile.png'),full_page=True)
    check('外部送信なし',len(requests)==0)
    check('JavaScript例外なし',not errors)
    print(json.dumps({'passed':len(checks),'failed':0,'checks':checks,'script_errors':errors,'requests':requests[:8]},ensure_ascii=False,indent=2))
    mobile.close();context.close();browser.close()
