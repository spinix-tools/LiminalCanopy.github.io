from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).parent
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=b.new_page(viewport={'width':1280,'height':1000},accept_downloads=True)
    errors=[]; external=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    page.on('request',lambda r: external.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.add_init_script('')
    page.evaluate("Object.defineProperty(window, 'localStorage', {value: {getItem:k=>window._stored?.[k]||null,setItem:(k,v)=>{(window._stored ||= {})[k]=v}}})")
    page.set_content((root/'index.html').read_text())
    assert page.locator('#diagram rect').count()>0
    assert page.locator('#compare tr').count()==4
    assert page.locator('#rows tr').count()==42
    page.screenshot(path=str(root/'desktop.png'),full_page=True)
    page.click('#mode'); assert '中央寄せ案' in page.locator('#viewtitle').inner_text()
    with page.expect_download() as dl: page.click('#csv')
    assert dl.value.suggested_filename=='mejiwari-center.csv'
    assert '方向,有効寸法mm' in Path(dl.value.path()).read_text(encoding='utf-8-sig')
    page.click('#rotate'); assert page.input_value('#tw')=='200'
    saved=page.evaluate('window._stored')
    restore=b.new_page(); restore.evaluate("s=>{window._stored=s;Object.defineProperty(window,'localStorage',{value:{getItem:k=>window._stored[k]||null,setItem:(k,v)=>window._stored[k]=v}})}",saved); restore.set_content((root/'index.html').read_text()); assert restore.input_value('#tw')=='200'; restore.close()
    page.fill('#w1','100'); page.click('button.primary'); assert page.locator('#err').inner_text()
    page.click('#reset'); assert page.input_value('#tw')=='300' and page.locator('#err').inner_text()==''
    page.set_viewport_size({'width':390,'height':844}); page.screenshot(path=str(root/'mobile.png'),full_page=True)
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    assert not errors and not external,(errors,external)
    b.close()
print('Chromium inline (mock storage): initial rendering, comparison toggle, CSV contents, rotate, localStorage reload, invalid input, reset, mobile overflow, no JS errors or external HTTP: PASS')
