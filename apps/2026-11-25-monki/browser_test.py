from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1200,'height':1000},accept_downloads=True)
    errors=[]; remote=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:remote.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((root/'index.html').read_text())
    assert page.locator('#total').inner_text()=='6'
    assert page.locator('#overlap').inner_text()=='5'
    page.screenshot(path=str(root/'desktop.png'),full_page=True)
    page.locator('#next').click();assert page.locator('#position').inner_text().startswith('1 /')
    page.locator('#end').click();assert '候補なし' in page.locator('#state').inner_text()
    page.locator('#bank').fill('A|abc\nB|abc\nC|ab');assert page.locator('#csv').is_disabled()
    page.locator('#run').click();assert page.locator('#blocked').inner_text()=='3'
    page.locator('#end').click();assert '1問' in page.locator('#state').inner_text()
    page.locator('#pick').select_option('2');page.locator('#end').click();assert '候補なし' in page.locator('#state').inner_text()
    with page.expect_download() as d:page.locator('#csv').click()
    assert '同一文・分岐不可' in Path(d.value.path()).read_text(encoding='utf-8-sig')
    page.locator('#bank').fill('bad');page.locator('#run').click();assert page.locator('#error').inner_text() and page.locator('#csv').is_disabled()
    page.locator('#sample').click();assert page.locator('#total').inner_text()=='6'
    page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.screenshot(path=str(root/'mobile.png'),full_page=True)
    assert not errors and not remote,(errors,remote)
    browser.close()
print('Chromium inline: sample, navigation, prefix/end/identical, stale state, CSV, invalid input, reset, 390px, no JS errors or HTTP requests: PASS')
