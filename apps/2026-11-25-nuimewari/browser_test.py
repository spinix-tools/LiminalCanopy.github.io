from pathlib import Path
from playwright.sync_api import sync_playwright
import tempfile
root=Path(__file__).resolve().parent
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=b.new_page(viewport={'width':1200,'height':1050},accept_downloads=True)
    errors=[]; external=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:external.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((root/'index.html').read_text())
    assert page.locator('#count').inner_text()=='6'
    assert page.locator('#base').inner_text()=='46' and page.locator('#best').inner_text()=='0'
    page.screenshot(path=str(root/'desktop.png'),full_page=True)
    page.select_option('#mode','base');page.select_option('#pick','1')
    assert '列 13–22' in page.locator('#page h3').inner_text()
    assert page.locator('#page .repeat').count()>0
    with page.expect_download() as d: page.click('#csv')
    assert '2,13,22,1,12,11,1' in Path(d.value.path()).read_text()
    page.evaluate('window.print=()=>window.printCalled=true')
    page.click('#print');assert page.locator('#printArea .sheet').count()==6
    assert page.evaluate('window.printCalled')
    page.emulate_media(media='print');assert page.locator('#printArea').is_visible();assert not page.locator('main').is_visible()
    # Chromium actual print-to-PDF, verify page count separately if available
    with tempfile.TemporaryDirectory() as tmp:
        f=Path(tmp)/'proof.pdf';page.pdf(path=str(f),prefer_css_page_size=True,print_background=True)
        import subprocess
        info=subprocess.check_output(['pdfinfo',str(f)],text=True)
        assert any(l.split()[-1]=='6' for l in info.splitlines() if l.startswith('Pages:'))
    page.emulate_media(media='screen')
    page.fill('#pattern','AA\nA');page.click('#run');assert page.locator('#error').inner_text();assert page.locator('#csv').is_disabled()
    page.click('#sample');assert page.locator('#best').inner_text()=='0'
    page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.screenshot(path=str(root/'mobile.png'),full_page=True)
    assert not errors and not external,(errors,external)
    b.close()
print('Chromium inline HTML: initial metrics, mode/page switch, overlap, CSV download, print handler and 6-page PDF, invalid input/reset, mobile width; 0 page errors/external HTTP requests')
