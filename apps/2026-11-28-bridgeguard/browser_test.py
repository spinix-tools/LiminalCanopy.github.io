from pathlib import Path
from playwright.sync_api import sync_playwright
import json
p=Path(__file__).parent
with sync_playwright() as s:
    b=s.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=b.new_page(viewport={'width':1200,'height':900},accept_downloads=True)
    errs=[]; network=[]
    page.on('pageerror',lambda e:errs.append(str(e)))
    page.on('request',lambda r:network.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((p/'index.html').read_text())
    assert page.locator('#worst').inner_text()=='17'
    page.locator('#rank button').first.click()
    assert page.locator('.lost').count()==17
    page.screenshot(path=str(p/'desktop.png'),full_page=True)
    with page.expect_download() as d: page.locator('#json').click()
    assert len(json.loads(Path(d.value.path()).read_text())['additionalLoss'])==17
    with page.expect_download() as d: page.locator('#png').click()
    assert Path(d.value.path()).read_bytes().startswith(b'\x89PNG')
    page.locator('#resolution').fill('12')
    page.locator('#image').set_input_files({'name':'sample.png','mimeType':'image/png','buffer':Path(d.value.path()).read_bytes()})
    page.wait_for_function("document.querySelector('#image').value==='' && document.querySelector('#worst').textContent==='17'")
    page.locator('#edit').click();page.locator('.cell').nth(42).click()
    assert page.locator('#risks').inner_text()=='0'
    page.locator('#grid').fill('1\n0');assert page.locator('#json').is_disabled();page.locator('#run').click();assert page.locator('#error').inner_text()
    page.locator('#sample').click();page.set_viewport_size({'width':390,'height':844});page.screenshot(path=str(p/'mobile.png'),full_page=True)
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    assert not errs and not network,(errs,network)
    b.close()
print('Chromium: initial, loss overlay, JSON/PNG download, PNG import, edit, invalidation, mobile, no JS errors or HTTP requests: PASS')
