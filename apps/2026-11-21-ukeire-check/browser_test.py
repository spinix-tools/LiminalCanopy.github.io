"""Playwright E2E of exact local HTML/CSS/JS via inline fallback (file:// blocked by administrator)."""
import tempfile, pathlib, json
from playwright.sync_api import sync_playwright
BASE=pathlib.Path(__file__).resolve().parent

def html_inline():
    html=(BASE/'index.html').read_text('utf8')
    html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+(BASE/'style.css').read_text('utf8')+'</style>')
    for name in ('engine.js','app.js'):
        html=html.replace('<script src="'+name+'"></script>','<script>'+(BASE/name).read_text('utf8').replace('</script','<\\/script')+'</script>')
    return html

def main():
    count=0
    def check(cond,msg):
        nonlocal count
        assert cond,msg
        count+=1
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
        page=browser.new_page(viewport={'width':1440,'height':930},accept_downloads=True,locale='ja-JP')
        errs=[]
        page.on('pageerror',lambda err:errs.append(str(err)))
        page.goto('about:blank')
        page.set_content(html_inline(),wait_until='load')
        page.wait_for_selector('#statTotal:not(:empty)')
        check(page.title().startswith('受入前チェック'),'title')
        check(page.locator('#statTotal').inner_text()=='6','sample has six data rows')
        check(int(page.locator('#statRejected').inner_text())>=4,'sample issues rejected')
        check(page.locator('#issueRows tr').count()>=4,'issues displayed')
        check(page.locator('#preview td').count()>0,'table preview')
        page.screenshot(path=str(BASE/'desktop.png'),full_page=True)
        page.locator('[data-filter=warning]').click()
        check(page.locator('[data-filter=warning]').get_attribute('class').find('active')>=0,'warning filter selected')
        check(page.locator('#issueRows').inner_text().find('注意')>=0,'warning filter content')
        page.locator('[data-filter=error]').click()
        check('エラー' in page.locator('#issueRows').inner_text(),'error filter')
        page.locator('[data-filter=all]').click()
        with page.expect_download() as info:
            page.locator('#downloadValid').click()
        down=info.value
        check(down.suggested_filename=='ukeire-approved.csv','CSV filename')
        data=pathlib.Path(down.path()).read_bytes()
        check(data.startswith(b'\xef\xbb\xbf'),'BOM default')
        check(b'00123' in data,'leading zeros preserved')
        check('四百'.encode('utf-8') not in data,'invalid data removed')
        with page.expect_download() as info2:
            page.locator('#downloadIssues').click()
        check(info2.value.suggested_filename=='ukeire-findings.csv','report download')
        with page.expect_download() as info3:
            page.locator('#exportRules').click()
        rule=json.loads(pathlib.Path(info3.value.path()).read_text('utf8'))
        check(len(rule['rules'])==6,'rules json')
        page.locator('#addRule').click()
        check(page.locator('#ruleRows tr').count()==7,'add rule')
        page.locator('#ruleRows tr').last.locator('button').click()
        check(page.locator('#ruleRows tr').count()==6,'delete rule')
        # Import external CP932 fixture through real browser FileReader / TextDecoder.
        with tempfile.TemporaryDirectory() as temp:
            original='商品コード,商品名,単価,在庫,発売日,区分\n00105,はさみ,500,1,2026-11-13,文具'
            fixture=pathlib.Path(temp)/'cp932.csv'
            fixture.write_bytes(original.encode('cp932'))
            page.locator('#encoding').select_option('auto')
            page.locator('#file').set_input_files(str(fixture))
            page.wait_for_function("document.querySelector('#csvInput').value.includes('はさみ')")
            check('はさみ' in page.locator('#csvInput').input_value(),'CP932 detected and decoded')
            check('shift_jis' in page.locator('#decodeStatus').inner_text(),'CP932 encoding status')
            page.locator('#check').click()
            check(page.locator('#statAccepted').inner_text()=='1','CP932 row accepted')
            check(page.locator('#statRejected').inner_text()=='0','CP932 no error')
            with page.expect_download() as dl:
                page.locator('#downloadValid').click()
            check('はさみ'.encode('utf8') in pathlib.Path(dl.value.path()).read_bytes(),'CP932 converted to UTF8')
            # Wrong forced decoding should warn rather than silently discard.
            page.locator('#encoding').select_option('utf-8')
            page.wait_for_function("document.querySelector('#decodeStatus').textContent.includes('置換')")
            check('置換' in page.locator('#decodeStatus').inner_text(),'wrong forced encoding warns')
        # Restore sample and modify one source value, check stale export controls
        page.locator('#sample').click()
        page.locator('#csvInput').fill('商品コード,商品名,単価,在庫,発売日,区分\n00123,ノート,300,5,2026-11-11,文具')
        check(page.locator('#downloadValid').is_disabled(),'stale result blocks export')
        page.locator('#check').click()
        check(page.locator('#statAccepted').inner_text()=='1','revalidation works')
        # No network, XSS as literal text only
        page.locator('#csvInput').fill('商品コード,商品名,単価,在庫,発売日,区分\n00123,"<img src=x onerror=alert(1)>",300,5,2026-11-11,文具')
        page.locator('#check').click()
        check(page.locator('#preview img').count()==0,'XSS not injected')
        check('<img' in page.locator('#preview').inner_text(),'html shown as text')
        check(not errs,'no page JS exceptions '+str(errs))
        mobile=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1,accept_downloads=True)
        mobile.goto('about:blank')
        mobile.set_content(html_inline(),wait_until='load')
        mobile.screenshot(path=str(BASE/'mobile.png'),full_page=True)
        check(mobile.locator('#statTotal').inner_text()=='6','mobile loads')
        check(mobile.evaluate('document.documentElement.scrollWidth <= innerWidth+2'),'no body overflow on mobile')
        browser.close()
    print(f'Browser UI checks passed: {count}/{count}')
if __name__=='__main__':main()