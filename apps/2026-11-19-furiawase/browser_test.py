"""Chromium smoke + workflow tests. Uses inline local files; no server/network."""
from pathlib import Path
import shutil
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).parent
html = (ROOT / 'index.html').read_text(encoding='utf-8')
html = html.replace('<link rel="stylesheet" href="style.css">', '<style>'+(ROOT/'style.css').read_text(encoding='utf-8')+'</style>')
for filename in ('engine.js', 'app.js'):
    html = html.replace(f'<script src="{filename}" defer></script>', '')
html = html.replace('</body>', ''.join('<script>'+(ROOT/n).read_text(encoding='utf-8')+'</script>' for n in ('engine.js', 'app.js'))+'</body>')
checks = 0

def check(cond, message):
    global checks
    if not cond:
        raise AssertionError(message)
    checks += 1

with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True, executable_path=(shutil.which('chromium') or shutil.which('google-chrome') or None), args=['--no-sandbox'])
    ctx = browser.new_context(accept_downloads=True, viewport={'width': 1400, 'height': 940})
    page = ctx.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.set_content(html, wait_until='load')
    check(page.title() == 'ふりあわせ｜入金の答え合わせ', 'page title')
    check(page.locator('#m-auto').inner_text() == '—', 'initial empty')
    check(page.locator('#download').is_disabled(), 'download disabled initially')
    page.locator('#demo').click()
    check(page.locator('#m-auto').inner_text() == '2', 'two auto matches')
    check(page.locator('#m-review').inner_text() == '5', 'five require review')
    check(page.locator('#m-bank').inner_text() == '4', 'four bank rows unmatched')
    check(page.locator('.entry').count() == 7, 'seven payouts')
    check(page.locator('.entry.review').count() == 5, 'review styles')
    check(page.locator('#p-map select').count() == 7, 'payout column map')
    check(page.locator('#b-map select').count() == 3, 'bank column map')
    check(page.locator('.bankrow').count() == 4, 'unmatched list')
    check(page.locator('#notice').inner_text().find('自動一致 2件') >= 0, 'status notice')
    page.locator('#filter').select_option('review')
    check(page.locator('.entry').count() == 5, 'review filter')
    page.locator('#filter').select_option('auto')
    check(page.locator('.entry').count() == 2, 'matched filter')
    page.locator('#filter').select_option('all')
    page.locator('#search').fill('SET-G')
    check(page.locator('.entry').count() == 1, 'search filter')
    check('計算の計算不一致' not in page.locator('.entry').inner_text(), 'no accidental label')
    check('精算の計算不一致' in page.locator('.entry').inner_text(), 'mismatch text')
    page.locator('#search').fill('')
    sel = page.locator('select[data-select="2"]')
    sel.select_option('2')
    page.locator('button[data-assign="2"]').click()
    check(page.locator('#m-manual').inner_text() == '1', 'manual match summary')
    check(page.locator('#m-auto').inner_text() == '3', 'ambiguity resolved for other payout')
    check(page.locator('#m-bank').inner_text() == '2', 'manual reserves row')
    check(page.locator('button[data-clear="2"]').count() == 1, 'clear manual visible')
    page.locator('button[data-clear="2"]').click()
    check(page.locator('#m-auto').inner_text() == '2', 'clear restores ambiguity')
    check(page.locator('#m-manual').inner_text() == '0', 'manual removal reflected')
    page.locator('#tolerance').fill('100')
    check(page.locator('#m-auto').inner_text() == '3', '100-yen tolerance recognizes near match')
    page.locator('#tolerance').fill('0')
    with page.expect_download() as d:
        page.locator('#download').click()
    download = d.value
    check(download.suggested_filename == 'furiawase-review.csv', 'download filename')
    path = download.path()
    blob = Path(path).read_bytes().decode('utf-8-sig')
    check('SET-G' in blob and '銀行明細未対応' in blob, 'export has original rows & unmatched')
    # Bank file input with explicit custom mapping, no upload to server.
    data='WHEN,CREDITED,NOTE\n2026-11-03,6780,Custom deposit'.encode('utf-8')
    page.locator('#b-file').set_input_files({'name':'bank.csv','mimeType':'text/csv','buffer':data})
    check('bank.csv' in page.locator('#b-info').inner_text(), 'custom upload')
    check(page.locator('#m-auto').inner_text() == '0', 'unmapped custom bank has no values')
    page.locator('select[data-kind="banks"][data-field="date"]').select_option('0')
    page.locator('select[data-kind="banks"][data-field="amount"]').select_option('1')
    page.locator('select[data-kind="banks"][data-field="memo"]').select_option('2')
    check(page.locator('#m-auto').inner_text() == '1', 'custom mapping leads to exact match')
    check('Custom deposit' in page.locator('.entry.matched').inner_text(), 'bank details rendered')
    page.locator('#reset').click()
    check(page.locator('#download').is_disabled(), 'reset clears data')
    check(page.locator('#m-auto').inner_text() == '—', 'reset clears metrics')
    check(not errors, 'no JS page errors: '+repr(errors))
    page.locator('#demo').click()
    page.screenshot(path=str(ROOT/'desktop.png'), full_page=True)
    page.set_viewport_size({'width':390,'height':844})
    page.screenshot(path=str(ROOT/'mobile.png'), full_page=True)
    check(page.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'), 'mobile no horizontal overflow')
    browser.close()
print(f'PASS: {checks} browser assertions')
