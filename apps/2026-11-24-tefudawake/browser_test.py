from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=b.new_page(viewport={'width':1280,'height':1000},accept_downloads=True)
    errors=[]; remote=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:remote.append(r.url) if r.url.startswith(('http://','https://')) else None)
    try:
        page.goto((root/'index.html').as_uri())
        mode='file URL'
    except Exception:
        page.close();page=b.new_page(viewport={'width':1280,'height':1000},accept_downloads=True);page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:remote.append(r.url) if r.url.startswith(('http://','https://')) else None);page.set_content((root/'index.html').read_text());mode='inline fallback'
    assert page.locator('.big').count()==2
    assert page.locator('.big').nth(1).inner_text()=='60.67%'
    page.screenshot(path=str(root/'desktop.png'),full_page=True)
    page.locator('#swaps button').first.click()
    assert page.locator('#n0').input_value()=='27' and page.locator('#n7').input_value()=='2'
    assert page.locator('.big').nth(1).inner_text()=='65.37%'
    page.locator('#undo').click()
    assert page.locator('#n0').input_value()=='28' and page.locator('#n7').input_value()=='1'
    page.locator('#l0').check(); assert page.locator('#csv').is_disabled();page.locator('#run').click()
    assert all('Other' not in x for x in page.locator('#swaps tbody tr').all_inner_texts())
    page.locator('#mode').select_option('shared');page.locator('#run').click()
    with page.expect_download() as d:page.locator('#csv').click()
    assert d.value.suggested_filename=='tefudawake-swaps.csv'
    assert 'shared' in Path(d.value.path()).read_text()
    page.locator('#draw').fill('');page.locator('#run').click();assert 'Invalid input' in page.locator('#error').inner_text()
    page.locator('#sample').click();assert page.locator('#error').inner_text()==''
    page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.screenshot(path=str(root/'mobile.png'),full_page=True)
    assert not errors and not remote,(errors,remote)
    print('browser checks passed; '+mode+'; 0 page errors and HTTP requests')
    b.close()
