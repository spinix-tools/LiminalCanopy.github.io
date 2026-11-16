"""End-to-end checks for the exact index.html + engine.js + app.js in this directory.
Browser navigation is restricted in the execution environment, so scripts are injected
into a real Chromium DOM and localStorage is simulated in memory.
Run: python browser_test.py (requires playwright and system Chromium).
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
HTML=(ROOT/'index.html').read_text('utf-8').replace('<script src="./engine.js"></script><script src="./app.js"></script>','')
ENGINE=(ROOT/'engine.js').read_text('utf-8')
APP=(ROOT/'app.js').read_text('utf-8')
checks = []

def ok(name, predicate=True):
    assert predicate, name
    checks.append(name)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    ctx = browser.new_context(viewport={'width': 1280, 'height': 850}, accept_downloads=True)
    page = ctx.new_page()
    js_errors=[]
    page.on('pageerror', lambda err: js_errors.append(str(err)))
    page.on('dialog', lambda dialog: dialog.accept())
    page.set_content(HTML)
    page.evaluate("""() => { const mem={}; Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>(k in mem ? mem[k]:null),setItem:(k,v)=>{mem[k]=String(v)},removeItem:k=>{delete mem[k]}}}); }""")
    page.add_script_tag(content=ENGINE)
    page.add_script_tag(content=APP)
    ok('initial empty view', page.locator('#empty').is_visible() and page.locator('#claims .claim-card').count() == 0)
    page.get_by_role('button',name='架空デモを見る').click()
    ok('demo loads four sources', page.locator('.record').count()==4)
    ok('independent roots show two', page.locator('#metrics .num').nth(1).inner_text()=='2')
    ok('unknown-origin source is separate', page.locator('#unknown .record').count()==1)
    page.set_content(HTML)
    page.add_script_tag(content=ENGINE)
    page.add_script_tag(content=APP)
    ok('mocked localStorage persists across reinjection', page.locator('.record').count()==4)
    page.get_by_role('button',name='＋ 追加').first.click()
    page.locator('#f-title').fill('検証用の論点')
    page.locator('#f-note').fill('手動入力による検証')
    page.locator('#edit-form button[type=submit]').click()
    ok('new claim created',page.locator('#claim-title').inner_text()=='検証用の論点')
    page.locator('#add-source').click()
    page.locator('#f-title').fill('独立資料 A')
    page.locator('#f-origin').select_option('original')
    page.locator('#f-stance').select_option('support')
    page.locator('#edit-form button[type=submit]').click()
    ok('independent original source created', page.locator('#metrics .num').nth(1).inner_text()=='1')
    page.locator('#add-source').click()
    page.locator('#f-title').fill('引用記事 B')
    page.locator('#f-origin').select_option('derived')
    page.locator('#f-stance').select_option('support')
    page.locator('#f-parent').select_option(label='独立資料 A')
    page.locator('#edit-form button[type=submit]').click()
    ok('derived article does not increase root count',page.locator('#metrics .num').nth(1).inner_text()=='1' and page.locator('.record').count()==2)
    page.locator('#add-source').click()
    page.locator('#f-title').fill('出所不明 D')
    page.locator('#f-origin').select_option('unknown')
    page.locator('#f-stance').select_option('support')
    page.locator('#edit-form button[type=submit]').click()
    ok('unknown excluded',page.locator('#metrics .num').nth(3).inner_text()=='1' and page.locator('#metrics .num').nth(1).inner_text()=='1')
    page.locator('#add-source').click()
    page.locator('#f-title').fill('悪いURL')
    page.locator('#f-url').fill('javascript:alert(1)')
    page.locator('#edit-form button[type=submit]').click()
    ok('unsafe URL rejected',page.locator('#editor-error').is_visible())
    page.locator('#editor-close').click()
    page.locator('#families .record').nth(1).get_by_role('button',name='編集').click()
    page.locator('#f-stance').select_option('refute')
    page.locator('#edit-form button[type=submit]').click()
    ok('one family can contain both stances',page.locator('.family-header .tag.mixed').count()==1)
    with page.expect_download() as d:
        page.get_by_role('button',name='Markdown保存').click()
    report = d.value
    ok('markdown export',report.suggested_filename.endswith('.md'))
    with page.expect_download() as d:
        page.get_by_role('button',name='JSON保存').click()
    json_dl=d.value
    exported_json=ROOT/'_exported_for_test.json'
    json_dl.save_as(exported_json)
    ok('json export created',exported_json.exists() and '検証用の論点' in exported_json.read_text('utf-8'))
    page.get_by_role('button',name='全消去').click()
    ok('reset removes all claims',page.locator('#claims .claim-card').count()==0)
    with page.expect_file_chooser() as chooser:
        page.get_by_role('button',name='JSON読込').click()
    chooser.value.set_files(str(exported_json))
    page.wait_for_function("document.querySelectorAll('#claims .claim-card').length === 2")
    ok('import restores claims',page.locator('#claims .claim-card').count()==2)
    page.get_by_role('button',name='＋ 追加').first.click()
    page.locator('#f-title').fill('<img src=x onerror="alert(1)">')
    page.locator('#edit-form button[type=submit]').click()
    ok('markup in claim title remains inert',page.locator('#claim-title img').count()==0 and '<img' in page.locator('#claim-title').inner_text())
    page.locator('#claims .claim-card').first.click()
    page.screenshot(path=str(ROOT/'desktop.png'),full_page=True)
    # Browser in actual mobile viewport, no mocked DOM or storage.
    page.set_viewport_size({'width':390,'height':844})
    page.screenshot(path=str(ROOT/'mobile.png'),full_page=True)
    ok('mobile viewport has no horizontal overflow',page.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'))
    ok('no uncaught JavaScript errors',not js_errors)
    exported_json.unlink(missing_ok=True)
    print(f'Browser checks passed: {len(checks)}/{len(checks)}')
    for i, name in enumerate(checks, 1): print(f'{i:02d}. {name}')
    browser.close()

