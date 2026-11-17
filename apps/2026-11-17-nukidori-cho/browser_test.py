"""Playwright smoke test: inject local HTML/JS, simulate storage for blocked navigation."""
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).parent
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--allow-file-access-from-files','--no-sandbox'])
    page=browser.new_page(accept_downloads=True,viewport={'width':1280,'height':860})
    checks=[]
    def check(label, cond):
        assert cond,label
        checks.append(label)
    # The sandbox blocks file:// and localhost navigation; inject exact HTML and JS.
    html=(root/'index.html').read_text(encoding='utf-8').replace('<script src="engine.js"></script><script src="app.js"></script>', '')
    jsengine=(root/'engine.js').read_text(encoding='utf-8')
    jsapp=(root/'app.js').read_text(encoding='utf-8')
    def boot():
        page.set_content(html)
        page.evaluate("""() => { if (!window.__saved) window.__saved={};
          Object.defineProperty(window,'localStorage',{configurable:true,value:{
            setItem:(key,value)=>window.__saved[key]=value,
            getItem:(key)=>window.__saved[key]||null
          }}); }""")
        page.add_script_tag(content=jsengine)
        page.add_script_tag(content=jsapp)
    boot()
    page.wait_for_selector('.summary')
    check('title', 'ぬきどり帳' in page.title())
    check('plan rendered', page.locator('.summary .stat').count()==3)
    check('risk figure', '生産者危険' in page.locator('#plan').inner_text())
    check('chart', page.locator('#plan svg path').count()>=4)
    check('plan exists', '上限を両方満たしています' in page.locator('#plan').inner_text())
    page.locator('#draw').click()
    page.wait_for_selector('.unit')
    total=page.locator('.unit').count()
    check('generated N items',total>5)
    check('unconfirmed starts',f'0/{total}' in page.locator('#work').inner_text())
    page.locator('.unit button.ok').first.click()
    check('mark good', '良品 1' in page.locator('#work').inner_text())
    page.locator('.unit button.ok').first.click()
    check('toggle unset','良品 0' in page.locator('#work').inner_text())
    # All NG up to c+1 yields early rejection
    text=page.locator('#plan').inner_text(); c=int(page.locator('.stat').nth(1).locator('strong').inner_text().split(' ')[0]);
    for i in range(c+1): page.locator('.unit button.ng').nth(i).click()
    check('early reject','不合格（上限超過）' in page.locator('#work').inner_text())
    with page.expect_download() as dl: page.locator('#csv').click()
    d=dl.value; csv=d.path().read_text(encoding='utf-8-sig')
    check('csv content','抽出番号' in csv and '不良' in csv)
    with page.expect_download() as dl2: page.locator('#json').click()
    check('json download',dl2.value.suggested_filename.endswith('.json'))
    boot();page.wait_for_selector('.unit')
    check('reload persistence','不合格（上限超過）' in page.locator('#work').inner_text())
    page.locator('#good').fill('80')
    page.locator('#calculate').click()
    check('invalid threshold warning','良品側の率は不良側より小さくしてください' in page.locator('#error').inner_text())
    page.locator('#good').fill('1')
    page.locator('#maxN').fill('2')
    page.locator('#alpha').fill('5')
    page.locator('#beta').fill('5')
    page.locator('#calculate').click()
    check('unmet criteria warning','満たす計画は見つかりません' in page.locator('#plan').inner_text())
    # mobile screen horizontal overflow
    page.set_viewport_size({'width':390,'height':844})
    check('mobile width',page.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'))
    page.screenshot(path=str(root/'mobile.png'),full_page=True)
    page.set_viewport_size({'width':1280,'height':900})
    page.locator('#alpha').fill('15');page.locator('#beta').fill('20');page.locator('#maxN').fill('160');page.locator('#calculate').click()
    page.locator('#draw').click()
    page.screenshot(path=str(root/'desktop.png'),full_page=True)
    browser.close()
    print(f'PASS {len(checks)}/{len(checks)} browser checks:', ', '.join(checks))