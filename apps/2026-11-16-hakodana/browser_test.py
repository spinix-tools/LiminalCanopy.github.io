from pathlib import Path
import json, re
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).parent
html=(ROOT/'index.html').read_text().replace('<script src="./engine.js"></script>', '<script>'+ (ROOT/'engine.js').read_text() + '</script>')
passes=[]
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    ctx=browser.new_context(viewport={'width':1280,'height':850},accept_downloads=True)
    page=ctx.new_page()
    errors=[]
    page.on('pageerror',lambda err:errors.append(str(err)))
    page.evaluate("""() => { const mem = new Map(); Object.defineProperty(window, 'localStorage', {configurable:true,value:{getItem:k=>mem.has(k)?mem.get(k):null,setItem:(k,v)=>mem.set(k,String(v)),removeItem:k=>mem.delete(k),clear:()=>mem.clear()}}); }""")
    page.set_content(html)
    assert page.title().startswith('箱棚 HAKODANA')
    assert page.locator('.fitcard').count()==5
    assert '小箱・60' in page.locator('.heroresult').inner_text()
    passes.append('初期表示・5種類の箱と第一候補の計算')

    page.locator('#fee60').fill('750')
    page.locator('#fee80').fill('870')
    page.locator('#fee100').fill('1070')
    assert '全候補の送料入力済み' in page.locator('.heroresult').inner_text()
    assert '798円' in page.locator('.heroresult').inner_text()
    passes.append('送料入力→箱代含む総額比較（750+48）')

    # Editing an existing box must update cost and ranking.
    page.get_by_role('button',name='小箱・60を編集').click()
    page.locator('#boxCost').fill('350')
    page.get_by_role('button',name='変更を保存').click()
    assert '中箱・80' in page.locator('.heroresult').inner_text() or '小箱・60' not in page.locator('.heroresult').inner_text()
    # With the demonstration set: small box 1100 vs 80 box 946; 80 box preferred.
    passes.append('箱の編集・費用に基づく推薦の更新')

    page.locator('#boxName').fill('<img src=x onerror=alert(1)>')
    for k,v in {'boxL':'25','boxW':'20','boxH':'12','boxWall':'0.2','boxKg':'0.1','boxCost':'0'}.items():page.locator('#'+k).fill(v)
    page.get_by_role('button',name='この箱を追加').click()
    assert page.locator('.boxline').count()==6
    assert page.locator('.boxline img').count()==0
    assert page.locator('.boxline').filter(has_text='<img src=x onerror=alert(1)>').count()==1
    passes.append('箱追加・ユーザー名のHTMLエスケープ')

    page.get_by_role('button',name='<img src=x onerror=alert(1)>を削除').click()
    assert page.locator('.boxline').count()==5
    passes.append('箱削除')

    page.locator('#padding').fill('20')
    assert '現在の条件で入る箱がありません' in page.locator('#resultArea').inner_text()
    page.locator('#padding').fill('1')
    passes.append('緩衝材の数値変更・不適合の表示')

    with page.expect_download() as dl:
        page.locator('#exportBtn').click()
    download=dl.value
    saved=ROOT/'test-backup.json'
    download.save_as(saved)
    data=json.loads(saved.read_text())
    assert data['version']==1 and len(data['boxes'])==5
    page.locator('#itemL').fill('99')
    assert '現在の条件で入る箱がありません' in page.locator('#resultArea').inner_text()
    page.locator('#fileInput').set_input_files(str(saved))
    page.wait_for_function("document.getElementById('itemL').value === '22'", timeout=4000)
    assert page.locator('.boxline').count()==5
    passes.append('JSONダウンロード・バックアップ復元')

    page.set_content(html)
    assert page.locator('#fee60').input_value()=='750'
    assert page.locator('.boxline').count()==5
    passes.append('再読み込み後のlocalStorage保存')

    page.screenshot(path=str(ROOT/'desktop.png'),full_page=True)
    mobile=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True)
    mp=mobile.new_page()
    mp.set_content(html)
    mp.screenshot(path=str(ROOT/'mobile.png'),full_page=True)
    assert mp.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
    assert mp.locator('.fitcard').count()==5
    passes.append('390pxモバイル表示・横スクロールなし')

    assert not errors, errors
    passes.append('JavaScript pageerrorなし')
    mobile.close()
    browser.close()

(ROOT/'test-backup.json').unlink(missing_ok=True)
for x in passes: print('PASS',x)
print(f'TOTAL {len(passes)} browser checks passed')