from pathlib import Path
import shutil
from playwright.sync_api import sync_playwright
p=Path(__file__).resolve().parent
with sync_playwright() as pw:
    b=pw.chromium.launch(headless=True,executable_path=shutil.which('chromium') or None,args=['--no-sandbox'])
    page=b.new_page(viewport={'width':1200,'height':850},accept_downloads=True)
    errors=[]; requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:requests.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((p/'index.html').read_text())
    assert page.locator('.event').count()==6
    assert '48 → 60' in page.locator('#status').inner_text()
    page.screenshot(path=str(p/'desktop.png'),full_page=True)
    with page.expect_download() as d: page.locator('#save').click()
    assert Path(d.value.path()).read_text(encoding='utf-8-sig').splitlines()[-1]=='32,0,60'
    page.locator('#G').fill('300'); assert page.locator('#save').is_disabled()
    page.get_by_role('button',name='計画を計算').click(); assert 'ありません' in page.locator('#status').inner_text()
    page.locator('#sampleBtn').click(); assert page.locator('.event').count()==6
    page.locator('#L').fill('1');page.get_by_role('button',name='計画を計算').click();assert '重複' in page.locator('#status').inner_text()
    page.locator('#sampleBtn').click();page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.screenshot(path=str(p/'mobile.png'),full_page=True)
    assert not errors and not requests,(errors,requests)
    b.close()
print('Chromium: sample, CSV, stale result, impossible, reset, invalid lock, mobile, no JS/network errors passed')
