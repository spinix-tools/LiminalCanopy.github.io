"""Run with: python browser_test.py (Playwright Chromium required)."""
from pathlib import Path
from playwright.sync_api import sync_playwright
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
import json

ROOT = Path(__file__).parent
server = ThreadingHTTPServer(('127.0.0.1', 0), partial(SimpleHTTPRequestHandler, directory=str(ROOT)))
server_thread = Thread(target=server.serve_forever, daemon=True)
server_thread.start()
checks = 0
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        page = browser.new_page(viewport={'width': 1440, 'height': 900}, accept_downloads=True)
        errors = []
        page.on('pageerror', lambda exc: errors.append(str(exc)))
        page.set_content((ROOT/'index.html').read_text().replace('<script src="engine.js"></script>', '<script>'+(ROOT/'engine.js').read_text()+'</script>'), wait_until='load')
        assert page.title().startswith('箱たしかめ'); checks += 1
        assert page.locator('#metric-boxes').inner_text() != '—'; checks += 1
        assert page.locator('#visualization svg').count() == 1; checks += 1
        assert len(page.locator('#items-table tr').all()) == 3; checks += 1
        page.screenshot(path=str(ROOT/'desktop.png'), full_page=True)
        page.locator('[data-add="items"]').click()
        assert page.locator('#items-table tr').count() == 4; checks += 1
        page.locator('#items-table tr').last.locator('[data-prop="w"]').fill('14')
        page.locator('#items-table tr').last.locator('[data-prop="w"]').dispatch_event('change')
        assert page.locator('#items-table tr').last.locator('[data-prop="w"]').input_value() == '14'; checks += 1
        page.locator('#items-table tr').last.locator('[data-remove="items"]').click()
        assert page.locator('#items-table tr').count() == 3; checks += 1
        page.locator('#tab-count').click()
        assert page.locator('#tab-count').get_attribute('aria-pressed') == 'true'; checks += 1
        page.locator('#tab-cost').click()
        assert page.locator('#tab-cost').get_attribute('aria-pressed') == 'true'; checks += 1
        page.locator('#padding').fill('1')
        page.locator('#padding').dispatch_event('change')
        assert 'cm' in page.locator('#parcel-info').inner_text(); checks += 1
        with page.expect_download() as info:
            page.locator('#save').click()
        d=info.value
        assert d.suggested_filename.endswith('.json'); checks += 1
        with page.expect_download() as info:
            page.locator('#exportcsv').click()
        assert info.value.suggested_filename.endswith('.csv'); checks += 1
        page.locator('#items-table tr').first.locator('[data-prop="w"]').fill('-10')
        page.locator('#items-table tr').first.locator('[data-prop="w"]').dispatch_event('change')
        assert '入力エラー' in page.locator('#status').inner_text(); checks += 1
        page.locator('#items-table tr').first.locator('[data-prop="w"]').fill('11')
        page.locator('#items-table tr').first.locator('[data-prop="w"]').dispatch_event('change')
        assert '入力エラー' not in page.locator('#status').inner_text(); checks += 1
        assert page.locator('#padding').input_value() == '1'; checks += 1
        page.on('dialog', lambda d: d.accept())
        page.locator('#demo').click()
        assert page.locator('#padding').input_value() == '0.5'; checks += 1
        bad={'items':[],'boxes':[],'rates':[]}
        page.locator('#importfile').set_input_files({'name':'bad.json','mimeType':'application/json','buffer':json.dumps(bad).encode()})
        assert '読込失敗' in page.locator('.toast').last.inner_text(); checks += 1
        page.set_viewport_size({'width':390,'height':844})
        assert page.locator('#visualization svg').count() == 1; checks += 1
        page.screenshot(path=str(ROOT/'mobile.png'), full_page=True)
        assert not errors, errors; checks += 1
        browser.close()
finally:
    server.shutdown()
print(f'Browser checks passed: {checks}/{checks}')