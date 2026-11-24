from playwright.sync_api import sync_playwright
from pathlib import Path
from PIL import Image
import tempfile
root=Path(__file__).resolve().parent
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1200,'height':900},accept_downloads=True)
    errors=[]; requests=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    page.on('request',lambda r: requests.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((root/'index.html').read_text());page.wait_for_selector('#rows tr')
    print('sample',page.locator('#detail').inner_text(),page.locator('#summary').inner_text())
    assert page.locator('#rows tr').count()==4
    page.screenshot(path=str(root/'desktop.png'),full_page=True)
    page.locator('#trap').select_option('0');page.locator('#worst').click();assert '接合欠け' in page.locator('#position').inner_text()
    for button,name in [('csv','hanawase.csv'),('png','plate-a-proof.png'),('bpng','plate-b-proof.png')]:
        with page.expect_download() as dl:page.locator('#'+button).click()
        d=dl.value;assert d.suggested_filename==name
        if name.endswith('.png'):
            with Image.open(d.path()) as im:assert im.size==(80,56)
        else:assert 'gap_max' in Path(d.path()).read_text()
    page.locator('#radius').fill('6');page.locator('#run').click();assert '範囲' in page.locator('#status').inner_text()
    page.locator('#radius').fill('2');page.locator('#run').click();assert page.locator('#rows tr').count()==3
    page.locator('#clear').click();assert '再検査' in page.locator('#summary').inner_text();page.locator('#run').click();assert '接合域なし' in page.locator('#summary').inner_text()
    with tempfile.TemporaryDirectory() as td:
        for name,rect in [('A',(12,12,39,40)),('B',(40,12,65,40))]:
            from PIL import ImageDraw
            im=Image.new('RGB',(80,56),'white');ImageDraw.Draw(im).rectangle(rect,fill='black');f=Path(td)/(name+'.png');im.save(f);page.locator('#file'+name).set_input_files(str(f));page.wait_for_function("document.querySelector('#file%s').value===''"%name)
        page.locator('#run').click();assert '推奨' in page.locator('#summary').inner_text()
    page.locator('#edit').click(position={'x':20,'y':20});assert '再検査' in page.locator('#summary').inner_text()
    page.locator('#sample').click();page.set_viewport_size({'width':390,'height':844});page.screenshot(path=str(root/'mobile.png'),full_page=True)
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    assert not errors,errors;assert not requests,requests
    print('Chromium: inline HTML, sample, sliders, worst case, CSV, two PNGs, validation, clear, import, edit, 390px, no HTTP / errors: PASS')
    browser.close()
