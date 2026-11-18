"""Actual Chromium interaction smoke tests. python browser_test.py"""
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent
checks=[]
def verify(condition, label):
    checks.append((bool(condition),label))
    if not condition: raise AssertionError(label)

def main():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
        context=browser.new_context(accept_downloads=True,viewport={'width':1440,'height':900})
        page=context.new_page();errors=[]
        page.on('pageerror',lambda e: errors.append(str(e)))
        # The managed Chromium sandbox blocks file:// and local HTTP. Load real file bytes
        # into the browser DOM and use a tiny localStorage surrogate on about:blank.
        html=ROOT.joinpath('index.html').read_text(encoding='utf-8')
        page.set_content(html,wait_until='domcontentloaded')
        page.add_style_tag(content=ROOT.joinpath('style.css').read_text(encoding='utf-8'))
        page.evaluate("""() => { const data={}; Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>data[k]??null,setItem:(k,v)=>data[k]=v,removeItem:k=>delete data[k]}}); }""")
        page.add_script_tag(content=ROOT.joinpath('engine.js').read_text(encoding='utf-8'))
        page.add_script_tag(content=ROOT.joinpath('app.js').read_text(encoding='utf-8'))
        verify(page.title().startswith('音つぎ'),'document title')
        verify(page.locator('.act-tab').count()==3,'sample has three acts')
        verify(page.locator('#patch-table tbody tr').count()==16,'16-channel matrix')
        verify('土曜の3組ライブ' in page.locator('#show-title').input_value(),'sample title')
        verify(page.locator('.change-card').count()==2,'changeover notes present')
        verify(not errors,'no page errors at initial render')
        page.screenshot(path=str(ROOT/'desktop.png'),full_page=True)
        # edit an input, matrix and label must update.
        inp=page.locator('.inputs-table input[data-field="label"]').first
        inp.fill('Kick TEST');inp.press('Tab')
        verify('Kick TEST' in page.locator('#patch-table').inner_text(),'editing re-runs patch')
        # fix a channel and see it reflected
        page.locator('.inputs-table select[data-field="lock"]').nth(2).select_option('8')
        verify('Guitar' in page.locator('#patch-table tbody tr').nth(7).inner_text(),'manual lock applied')
        # remove lock to continue
        page.locator('.inputs-table select[data-field="lock"]').nth(2).select_option('0')
        # select other act, add input
        page.locator('.act-tab').nth(1).click()
        count=page.locator('.inputs-table tbody tr').count()
        page.locator('[data-action="add-input"]').click()
        verify(page.locator('.inputs-table tbody tr').count()==count+1,'add an input')
        verify(page.locator('#patch-table').inner_text().count('Input 5')>=1,'added input appears in patch')
        # Delete an input
        page.locator('[data-action="del-input"]').last.click()
        verify(page.locator('.inputs-table tbody tr').count()==count,'delete an input')
        # reorder acts
        old=page.locator('.act-tab').first.inner_text()
        page.locator('[data-action="up"]').click()
        verify(page.locator('.act-tab').first.inner_text()!=old,'move an act up')
        # add act and duplicate
        page.locator('#add-act').click()
        verify(page.locator('.act-tab').count()==4,'add an act')
        page.locator('[data-action="preset-vocal"]').click()
        verify(page.locator('.inputs-table tbody tr').count()==1,'preset vocal input')
        page.locator('[data-action="duplicate"]').click()
        verify(page.locator('.act-tab').count()==5,'duplicate an act')
        # CSV and JSON downloads
        with page.expect_download() as dl:
            page.locator('#csv-file').click()
        download=dl.value
        verify(download.suggested_filename.endswith('.csv'),'CSV download')
        with page.expect_download() as dl:
            page.locator('#save-file').click()
        verify(dl.value.suggested_filename.endswith('.json'),'JSON download')
        # JSON reimport via file chooser; do this via set_input_files
        project=page.evaluate('JSON.parse(localStorage.getItem("oto-tsugi-v1"))')
        verify(len(project['acts'])==5,'localStorage saved')
        page.locator('#import-file').set_input_files({'name':'test.json','mimeType':'application/json','buffer':__import__('json').dumps(project,ensure_ascii=False).encode('utf-8')})
        verify(page.locator('.act-tab').count()==5,'JSON import works')
        # bad JSON must be handled without destroying data
        page.locator('#import-file').set_input_files({'name':'broken.json','mimeType':'application/json','buffer':b'{'})
        verify('読込失敗' in page.locator('#notice').inner_text(),'invalid JSON warning')
        verify(page.locator('.act-tab').count()==5,'bad JSON keeps plan')
        # screenshot responsive layout
        page.set_viewport_size({'width':390,'height':844})
        page.screenshot(path=str(ROOT/'mobile.png'),full_page=True)
        verify(page.locator('h1').is_visible(),'mobile viewport renders')
        verify(bool(page.evaluate('localStorage.getItem("oto-tsugi-v1")')),'mock local storage records changes')
        # console errors
        verify(not errors,'no browser JS exception')
        browser.close()
    print('Browser tests:',len(checks),'/',len(checks),'PASS')
    for _,name in checks:print('✓',name)
if __name__=='__main__':main()
