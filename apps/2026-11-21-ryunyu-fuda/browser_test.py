"""Chromium integration smoke test; tests same source under sandbox restrictions."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
checks = 0

def check(condition, label):
    global checks
    assert condition, label
    checks += 1
    print(f'PASS {checks:02d} {label}')

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    context = browser.new_context(viewport={'width': 1440, 'height': 930}, accept_downloads=True)
    page = context.new_page()
    errors = []
    outgoing = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('request', lambda r: outgoing.append(r.url) if r.url.startswith(('http://','https://')) else None)
    mode = 'file navigation'
    try:
        page.goto((ROOT / 'index.html').as_uri(), timeout=7000, wait_until='load')
        page.locator('#countTotal').wait_for(timeout=1000)
    except Exception as e:
        mode = 'inline source injection (file:// blocked)'
        page.close()
        page = context.new_page()
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('request', lambda r: outgoing.append(r.url) if r.url.startswith(('http://','https://')) else None)
        html = (ROOT / 'index.html').read_text(encoding='utf-8')
        # Browser's managed environment blocks direct local file navigation.
        # Replace only external local CSS/JS tags; inject byte-identical app source.
        html = html.replace('<link rel="stylesheet" href="style.css">', '')
        html = html.replace('<script src="engine.js"></script><script src="app.js"></script>', '')
        page.set_content(html)
        page.add_style_tag(content=(ROOT / 'style.css').read_text(encoding='utf-8'))
        page.add_script_tag(content=(ROOT / 'engine.js').read_text(encoding='utf-8'))
        page.add_script_tag(content=(ROOT / 'app.js').read_text(encoding='utf-8'))
    print('MODE:', mode)
    check(page.title().startswith('流入札'), 'page title')
    check(page.locator('.placement').count() == 5, 'initial five placements')
    check(page.locator('#countTotal').inner_text() == '5', 'initial total count')
    check(page.locator('#countError').inner_text() == '0', 'initial error count')
    check(page.locator('#collisions .collision-item').count() == 1, 'initial report-group collision')
    check(page.locator('.result-card').count() == 5, 'initial five report cards')
    check('utm_campaign=winter_market_2026' in page.locator('.result-link code').first.inner_text(), 'initial URLs are built')
    check('#apply' in page.locator('.result-link code').first.inner_text(), 'fragment is preserved')
    check('lang=ja' in page.locator('.result-link code').first.inner_text(), 'unrelated query preserved')
    page.locator('#campaign').fill('test_campaign_26')
    check('utm_campaign=test_campaign_26' in page.locator('.result-link code').first.inner_text(), 'campaign edit recalculates URL')
    page.locator('#campaign').fill('')
    check(page.locator('#countError').inner_text() == '5', 'empty campaign catches all missing tags')
    check(page.locator('.result-link.missing').count() == 5, 'invalid rows are not silently exported as URLs')
    page.locator('#campaign').fill('winter_market_2026')
    page.locator('#filter').select_option('error')
    check(page.locator('.result-empty').count() == 1, 'status filter empty result')
    page.locator('#filter').select_option('warning')
    check(page.locator('.result-card').count() >= 1, 'status filter warning result')
    page.locator('#filter').select_option('all')
    page.locator('#addBtn').click()
    check(page.locator('.placement').count() == 6, 'add placement')
    check(page.locator('#countError').inner_text() == '1', 'new row missing tags is an error')
    last = page.locator('.placement').last
    last.locator('input[name=label]').fill('テスト投稿')
    last.locator('input[name=source]').fill('line')
    last.locator('input[name=medium]').fill('social')
    last.locator('input[name=content]').fill('message_1')
    check(page.locator('#countError').inner_text() == '0', 'editing fields resolves error')
    check('utm_source=line' in page.locator('.result-link code').last.inner_text(), 'new row has correct URL')
    last.locator('input[name=destination]').fill('javascript:alert(1)')
    check(page.locator('#countError').inner_text() == '1', 'unsafe destination rejected')
    last.locator('input[name=destination]').fill('https://example.net/landing?utm_source=other&ref=ok#top')
    check(page.locator('#countError').inner_text() == '0', 'valid destination accepted')
    check(page.get_by_text('REPLACE', exact=False).count() >= 1, 'existing UTM warning shown')
    check('#top' in page.locator('.result-link code').last.inner_text(), 'per-row fragment preserved')
    last.get_by_role('button', name='削除').click()
    check(page.locator('.placement').count() == 5, 'delete placement')
    page.locator('details.bulk-panel summary').click()
    page.locator('#bulkInput').fill('TEST A\ttwitter\tsocial\tpost_a\nTEST B\tgoogle\tcpc\tbanner_b')
    page.locator('#bulkBtn').click()
    check(page.locator('.placement').count() == 7, 'bulk tab import adds two rows')
    check(page.locator('#bulkInput').input_value() == '', 'bulk field cleared')
    check('utm_source=twitter' in page.locator('.result-link code').nth(5).inner_text(), 'bulk rows build links')
    page.locator('#bulkInput').fill('badly formatted input')
    page.locator('#bulkBtn').click()
    check(page.locator('.placement').count() == 7, 'malformed bulk content rejected')
    # XSS attempt must display text without creating tags or scripting.
    page.locator('.placement').first.locator('input[name=label]').fill('<img src=x onerror=alert(1)>')
    check(page.locator('img').count() == 0, 'untrusted label never becomes DOM HTML')
    check(page.locator('.result-card').first.locator('strong').inner_text().endswith('<img src=x onerror=alert(1)>'), 'label text remains intact')
    with page.expect_download() as evt:
        page.locator('#csvBtn').click()
    dl=evt.value
    check(dl.suggested_filename == 'ryunyu-fuda-links.csv', 'CSV download filename')
    csv_bytes=Path(dl.path()).read_bytes()
    check(csv_bytes.startswith(b'\xef\xbb\xbf'), 'CSV UTF-8 BOM')
    check(b'utm_campaign' in csv_bytes, 'CSV contains tracking header')
    with page.expect_download() as evt2:
        page.locator('#jsonBtn').click()
    jdownload=evt2.value
    data=json.loads(Path(jdownload.path()).read_text(encoding='utf-8'))
    check(len(data['placements']) == 7, 'JSON export serializes edited placements')
    page.locator('#resetBtn').click()
    check(page.locator('.placement').count() == 5, 'reset restores five sample rows')
    page.locator('#jsonFile').set_input_files({'name':'restore.json','mimeType':'application/json','buffer':json.dumps(data).encode('utf-8')})
    check(page.locator('.placement').count() == 7, 'JSON import restores project')
    check(page.locator('#countTotal').inner_text() == '7', 'JSON import refreshes report')
    page.locator('#jsonFile').set_input_files({'name':'invalid.json','mimeType':'application/json','buffer':b'{bad'})
    check(page.locator('.placement').count() == 7, 'invalid JSON does not replace prior model')
    page.locator('#saveBtn').click()
    check(page.locator('#toast').inner_text() != '', 'storage action reports its actual status')
    page.locator('#clearBtn').click()
    check(page.locator('#toast').inner_text() != '', 'storage clearing reports its status')
    page.locator('.result-link button').first.click()
    check(page.locator('#toast').inner_text() != '', 'copy action provides feedback')
    page.locator('#resetBtn').click()
    page.screenshot(path=str(ROOT / 'desktop.png'), full_page=True)
    context_m=context.browser.new_context(viewport={'width':390,'height':844},accept_downloads=True)
    mobile=context_m.new_page()
    # Use the same style and scripts for consistent mobile comparison.
    mobile.set_content((ROOT / 'index.html').read_text('utf-8').replace('<link rel="stylesheet" href="style.css">','').replace('<script src="engine.js"></script><script src="app.js"></script>',''))
    mobile.add_style_tag(content=(ROOT/'style.css').read_text('utf-8'))
    mobile.add_script_tag(content=(ROOT/'engine.js').read_text('utf-8'))
    mobile.add_script_tag(content=(ROOT/'app.js').read_text('utf-8'))
    check(mobile.locator('.placement').count() == 5, 'mobile app loads')
    viewport = mobile.evaluate('({ viewport: window.innerWidth, scroll: document.documentElement.scrollWidth })')
    check(viewport['scroll'] <= viewport['viewport']+1, f'no mobile horizontal overflow: {viewport}')
    mobile.screenshot(path=str(ROOT / 'mobile.png'), full_page=True)
    check(not errors, f'no JS exceptions: {errors}')
    check(not outgoing, f'no outgoing HTTP requests: {outgoing}')
    print(f'RESULT {checks}/{checks} PASS')
    context_m.close()
    browser.close()
