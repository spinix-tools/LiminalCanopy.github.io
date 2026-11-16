"""End-to-end Chromium tests with direct HTML/JS injection; storage is mocked due blocked URL navigation."""
import re
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
def run():
    failures = []
    check_count = 0
    def check(ok, label):
        nonlocal check_count
        check_count += 1
        if not ok: failures.append(label)
        print(('PASS' if ok else 'FAIL') + ' ' + label)
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
        context = browser.new_context(accept_downloads=True, viewport={'width': 1420, 'height': 1000}, locale='ja-JP')
        page = context.new_page()
        js_errors = []
        page.on('pageerror', lambda e: js_errors.append(str(e)))
        html = re.sub(r'<script src="[^"]+"></script>', '', (ROOT/'index.html').read_text(encoding='utf-8'))
        page.set_content(html, wait_until='load')
        page.evaluate("""() => { window.__mockStorage = new Map(); Object.defineProperty(window, 'localStorage', {configurable:true, get(){ return {getItem(k){return window.__mockStorage.get(k) ?? null},setItem(k,v){window.__mockStorage.set(k,String(v))},removeItem(k){window.__mockStorage.delete(k)}}}}) }""")
        page.add_script_tag(content=(ROOT/'engine.js').read_text(encoding='utf-8'))
        page.add_script_tag(content=(ROOT/'app.js').read_text(encoding='utf-8'))
        check(page.title() == '字幕ものさし｜文字量と表示時間を整える', 'HTML loads')
        check(page.locator('#cueList .cue-card').count() == 4, 'four sample cues')
        check(int(page.locator('#metricFlagged').inner_text()) >= 1, 'QA detects sample issues')
        page.locator('#cueList .cue-card').nth(1).click()
        check('詰め込み' in page.locator('#cueText').input_value(), 'cue selection opens editor')
        original = page.locator('#cueText').input_value()
        page.locator('#autoBreak').click()
        altered = page.locator('#cueText').input_value()
        check('\n' in altered and altered.replace('\n','') == original, 'auto-break preserves text')
        page.locator('#joinLines').click()
        check('\n' not in page.locator('#cueText').input_value(), 'join-lines action works')
        page.locator('#cueText').fill('<script>alert("XSS")</script>')
        check(page.locator('.subtitle-preview script').count() == 0 and '<script>' in page.locator('#subtitlePreview').inner_text(), 'imported markup is text not executable')
        page.locator('#preset').select_option('film')
        check(page.locator('#maxWidth').input_value() == '13' and page.locator('#cps').input_value() == '4', 'film preset changes QA limits')
        page.locator('#filter').select_option('flagged')
        check(page.locator('#cueList .cue-card').count() > 0, 'flagged-only filter')
        page.locator('#filter').select_option('all')
        page.locator('#search').fill('存在しない単語')
        check(page.locator('#cueList .cue-card').count() == 0, 'search filters cues')
        page.locator('#search').fill('')
        page.locator('#start').fill('99:88:77,666')
        page.locator('#start').press('Tab')
        check(page.locator('#notice').evaluate('(el) => el.classList.contains("show")'), 'invalid timeline shows notice')
        page.locator('#start').fill('00:00:03,500')
        page.locator('#start').press('Tab')
        check(not page.locator('#notice').evaluate('(el) => el.classList.contains("show")'), 'valid timestamp accepted')
        with page.expect_download() as download_info:
            page.locator('#saveSrt').click()
        srt = download_info.value
        tmp_srt = ROOT / '.test-export.srt'
        srt.save_as(tmp_srt)
        check(' --> ' in tmp_srt.read_text(encoding='utf-8-sig') and srt.suggested_filename.endswith('.srt'), 'actual SRT download contains cues')
        tmp_srt.unlink()
        with page.expect_download() as download_info:
            page.locator('#saveVtt').click()
        vtt = ROOT / '.test-export.vtt'
        download_info.value.save_as(vtt)
        check(vtt.read_text(encoding='utf-8-sig').startswith('WEBVTT'), 'actual VTT download')
        vtt.unlink()
        with page.expect_download() as download_info:
            page.locator('#qaExport').click()
        csv = ROOT / '.test-export.csv'
        download_info.value.save_as(csv)
        check('指摘内容' in csv.read_text(encoding='utf-8-sig'), 'QA CSV downloads with diagnostics')
        csv.unlink()
        previous = page.locator('#cueText').input_value()
        page.set_content(html, wait_until='load')
        page.add_script_tag(content=(ROOT/'engine.js').read_text(encoding='utf-8'))
        page.add_script_tag(content=(ROOT/'app.js').read_text(encoding='utf-8'))
        check(page.locator('#cueText').input_value() == previous, 'mock storage restores on app reinitialization')
        page.locator('#shiftAmount').fill('-10')
        page.locator('#shiftBtn').click()
        check(page.locator('#notice').is_visible(), 'negative shift rejects below-zero timestamps')
        page.locator('#shiftAmount').fill('2')
        page.locator('#shiftBtn').click()
        check(not page.locator('#notice').is_visible(), 'positive shift succeeds')
        page.locator('#fileInput').set_input_files({'name':'incoming.srt','mimeType':'text/plain','buffer':b'1\n00:00:01,000 --> 00:00:03,000\nImported SRT\n\n2\n00:00:03,100 --> 00:00:04,900\nSecond line\n'})
        check(page.locator('#cueList .cue-card').count() == 2 and page.locator('#metricTotal').inner_text() == '2', 'real file chooser imports SRT')
        page.locator('#fileInput').set_input_files({'name':'incoming.vtt','mimeType':'text/plain','buffer':b'WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nVTT import\n'})
        check(page.locator('#metricTotal').inner_text() == '1', 'VTT import')
        page.locator('#addCue').click()
        check(page.locator('#metricTotal').inner_text() == '2', 'add cue')
        page.locator('#removeCue').click()
        check(page.locator('#metricTotal').inner_text() == '1', 'remove cue')
        page.locator('#demoBtn').click()
        check(page.locator('#metricTotal').inner_text() == '4', 'restore demo')
        page.set_viewport_size({'width': 375, 'height': 812})
        page.screenshot(path=str(ROOT / 'mobile.png'), full_page=True)
        check(page.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 2'), 'mobile has no horizontal overflow')
        page.set_viewport_size({'width': 1420, 'height': 1000})
        page.screenshot(path=str(ROOT / 'desktop.png'), full_page=True)
        check(len(js_errors) == 0, 'no uncaught page errors')
        context.close(); browser.close()
    print(f'BROWSER TESTS: {check_count - len(failures)}/{check_count} passed')
    if failures: raise AssertionError('Failed: ' + ', '.join(failures))

if __name__ == '__main__': run()