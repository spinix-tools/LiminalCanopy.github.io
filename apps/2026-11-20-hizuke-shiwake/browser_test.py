"""Functional Playwright smoke test. Uses original shipped HTML, CSS and JS.
Falls back to inlining those bytes if this managed Chromium disallows direct file navigation.
"""
import io, json, re, time, zipfile
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent
checks=[]
def check(condition, text):
    checks.append((bool(condition), text))
    if not condition: raise AssertionError(text)

def wait(page):
    page.wait_for_timeout(170)

def run():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        page=browser.new_page(viewport={'width':1280,'height':900}, accept_downloads=True)
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        navigation='file://'
        try:
            page.goto((ROOT/'index.html').as_uri(),wait_until='load',timeout=5000)
            page.wait_for_selector('#demo:not([disabled])',timeout=1500)
            page.evaluate('window.HizukeCore && true')
        except Exception:
            navigation='inline fallback (direct navigation blocked)'
            page.close()
            page=browser.new_page(viewport={'width':1280,'height':900}, accept_downloads=True)
            page.on('pageerror',lambda e:errors.append(str(e)))
            html=(ROOT/'index.html').read_text()
            html=re.sub(r'<link rel="stylesheet"[^>]*>', '', html)
            html=re.sub(r'<script src="[^"]+"></script>', '', html)
            page.set_content(html,wait_until='domcontentloaded')
            page.add_style_tag(content=(ROOT/'style.css').read_text())
            # about:blank localStorage can be denied; shim preferences only when inaccessible
            page.evaluate('''() => {
                try { localStorage.setItem('_t','1'); localStorage.removeItem('_t') }
                catch(e) { const values={}; Object.defineProperty(window,'localStorage',{value:{
                  getItem:k=>values[k]??null,setItem:(k,v)=>{values[k]=String(v)},
                  removeItem:k=>{delete values[k]}}}) }
            }''')
            page.add_script_tag(content=(ROOT/'engine.js').read_text())
            page.add_script_tag(content=(ROOT/'app.js').read_text())
        check(page.title().startswith('ひづけ仕分け'),'HTML title')
        check(page.locator('#nTotal').inner_text()=='0','empty state starts at 0')
        check(page.locator('#zip').is_disabled(),'export disabled until image loaded')
        page.locator('#demo').click()
        page.wait_for_function("document.querySelector('#nTotal').textContent==='4'",timeout=10000)
        check(page.locator('#nTotal').inner_text()=='4','demo creates 4 images')
        check(page.locator('#nReview').inner_text()=='4','file name guesses pending')
        check(page.locator('#nDuplicate').inner_text()=='1','exact duplicate discovered')
        check(page.locator('.photo-row').count()==4,'four rows visible')
        check(page.locator('.tag.pending').count()==3,'three filename candidate tags')
        check(page.locator('#preview img').count()==1,'preview image displayed')
        check(page.locator('#timeline .bar-row').count()==0,'no confirmed months initially')
        page.locator('.approve').first.click();wait(page)
        check(page.locator('#nReview').inner_text()=='3','accept proposal confirms 1')
        check(page.locator('#timeline .bar-row').count()==1,'timeline shows one month')
        page.locator('#filter').select_option('confirmed')
        check(page.locator('.photo-row').count()==1,'confirmed filter')
        page.locator('#filter').select_option('review')
        check(page.locator('.photo-row').count()==3,'review filter')
        page.locator('#filter').select_option('duplicates')
        check(page.locator('.photo-row').count()==1,'duplicates filter')
        page.locator('#filter').select_option('all')
        page.locator('.photo-row').nth(2).locator('input[type=date]').fill('2022-09-17')
        page.locator('.photo-row').nth(2).locator('input[type=date]').dispatch_event('change');wait(page)
        check(page.locator('#nReview').inner_text()=='2','manual date confirms')
        check('2022-09' in page.locator('#timeline').inner_text(),'manual date adds month')
        page.locator('.photo-row').nth(2).locator('.clear-date').click();wait(page)
        check(page.locator('#nReview').inner_text()=='3','clear date back to pending')
        page.locator('#prefix').fill('family')
        page.locator('#omit').check()
        check('3枚' in page.locator('#summary').inner_text(),'omit duplicate changes archive count')
        with page.expect_download() as info: page.locator('#csv').click()
        dl=info.value
        check(dl.suggested_filename=='hizuke-manifest.csv','CSV filename')
        csv=Path(dl.path()).read_text(encoding='utf-8-sig')
        check('family_2024-04-15' in csv,'CSV approved date filename')
        check('True' if False else 'true' in csv,'CSV skip status')
        with page.expect_download() as info:page.locator('#json').click()
        manifest=json.loads(Path(info.value.path()).read_text(encoding='utf-8'))
        check(len(manifest['files'])==4,'JSON manifest complete')
        check(manifest['files'][3]['skipped'] is True,'JSON duplicate exclusion')
        check('file' not in manifest['files'][0], 'JSON does not contain original binary')
        with page.expect_download(timeout=20000) as info:page.locator('#zip').click()
        out=info.value
        check(out.suggested_filename=='hizuke-shiwake.zip','ZIP filename')
        with zipfile.ZipFile(out.path()) as z:
            names=z.namelist()
            check(len(names)==5,'ZIP has 3 images + 2 manifests')
            check(any(x.startswith('2024/04/') for x in names),'ZIP confirmed date folder')
            check(any(x.startswith('unverified/') for x in names),'ZIP uncertain originals isolated')
            check(z.testzip() is None,'ZIP CRC checks all entries')
            check(z.read('manifest.csv').startswith(b'\xef\xbb\xbf'),'CSV has UTF-8 BOM')
            check(any(i.filename.endswith('.png') and i.file_size>100 for i in z.infolist()),'ZIP contains original image bytes')
        check(page.locator('#notice').inner_text().find('保存しました')!=-1,'export success notice')
        # Capture functional desktop with 4 processed samples, before clearing.
        page.screenshot(path=str(ROOT/'desktop.png'),full_page=True)
        # Additional real upload path: accepted and rejected file data
        page.locator('#files').set_input_files({'name':'2020-08-20_test.png','mimeType':'image/png','buffer':b'\x89PNG\r\n\x1a\n' + bytes(30)})
        page.wait_for_function("document.querySelector('#nTotal').textContent==='5'",timeout=5000)
        check(page.locator('#nTotal').inner_text()=='5','file picker uploads image')
        page.locator('#clear').click()
        check(page.locator('#nTotal').inner_text()=='0','clear removes rows')
        check(page.locator('#zip').is_disabled(),'clear disables export')
        check(not errors,'no JavaScript page errors: '+str(errors))
        # Responsive page must not overflow at narrow width
        mobile=browser.new_page(viewport={'width':390,'height':844},accept_downloads=True)
        if navigation=='file://':
            try: mobile.goto((ROOT/'index.html').as_uri(),wait_until='load',timeout=5000)
            except Exception: navigation='inline fallback (direct navigation blocked)'
        if navigation!='file://':
            html=re.sub(r'<script src="[^"]+"></script>', '', re.sub(r'<link rel="stylesheet"[^>]*>', '', (ROOT/'index.html').read_text()))
            mobile.set_content(html);mobile.add_style_tag(content=(ROOT/'style.css').read_text());mobile.add_script_tag(content=(ROOT/'engine.js').read_text());mobile.add_script_tag(content=(ROOT/'app.js').read_text())
        mobile.locator('#demo').click()
        mobile.wait_for_function("document.querySelector('#nTotal').textContent==='4'",timeout=10000)
        check(mobile.evaluate('document.documentElement.scrollWidth<=window.innerWidth+1'),'390px mobile no horizontal overflow')
        page.set_viewport_size({'width':1280,'height':900})
        mobile.screenshot(path=str(ROOT/'mobile.png'),full_page=True)
        mobile.close();browser.close()
    print('Navigation:',navigation)
    for passed,title in checks: print('PASS' if passed else 'FAIL',title)
    print(f'Browser assertions: {sum(1 for x,_ in checks if x)}/{len(checks)}')

if __name__=='__main__':run()