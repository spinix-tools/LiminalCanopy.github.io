from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1200,'height':900},accept_downloads=True)
    errors=[]; requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:requests.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((root/'index.html').read_text(encoding='utf-8')); assert '750 秒' in page.locator('#output').inner_text()
    page.locator('#split').check(); assert page.locator('#export').is_disabled(); page.locator('#run').click()
    assert '270 秒' in page.locator('#output').inner_text(); assert page.locator('tbody tr').count()==9
    with page.expect_download() as info: page.locator('#export').click()
    assert '赤' in Path(info.value.path()).read_text(encoding='utf-8-sig'); assert len(Path(info.value.path()).read_text(encoding='utf-8-sig').splitlines())==10
    page.screenshot(path=str(root/'desktop.png'),full_page=True)
    page.set_viewport_size({'width':390,'height':844}); assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'); page.screenshot(path=str(root/'mobile.png'),full_page=True)
    page.locator('#jobs').fill(''); page.locator('#run').click(); assert page.locator('#export').is_disabled(); assert '1〜4' in page.locator('#status').inner_text()
    page.locator('#reset').click(); assert not page.locator('#split').is_checked(); assert '750 秒' in page.locator('#output').inner_text()
    page.locator('#thread').fill(''); page.locator('#run').click(); assert '入力範囲外' in page.locator('#status').inner_text(); assert page.locator('#export').is_disabled()
    assert not errors and not requests; print('Chromium inline: optimization, CSV, 390px, reset, validation, stale result, 0 JS errors/HTTP requests: PASS')
    browser.close()
