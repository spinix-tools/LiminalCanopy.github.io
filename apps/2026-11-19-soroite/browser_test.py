"""Browser smoke/regression suite; uses same source inlined because admin blocks navigation. Storage mocked."""
from pathlib import Path
import tempfile, json
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
def html_with_inline_assets(seed=''):
    source = (ROOT / 'index.html').read_text(encoding='utf-8')
    css = (ROOT / 'style.css').read_text(encoding='utf-8')
    engine = (ROOT / 'engine.js').read_text(encoding='utf-8')
    app = (ROOT / 'app.js').read_text(encoding='utf-8')
    memory = json.dumps({'soroite-prototype-v1': seed} if seed else {}, ensure_ascii=False)
    stub = '<script>window.__testStore=' + memory + ';Object.defineProperty(window,"localStorage",{configurable:true,value:{getItem(k){return window.__testStore[k]??null},setItem(k,v){window.__testStore[k]=v},removeItem(k){delete window.__testStore[k]}}});</script>'
    source = source.replace('<link rel="stylesheet" href="./style.css">', '<style>' + css + '</style>' + stub)
    source = source.replace('<script src="./engine.js"></script>', '<script>' + engine + '</script>')
    return source.replace('<script src="./app.js"></script>', '<script>' + app + '</script>')

def run():
    checks = []
    def ok(condition, message):
        assert condition, message
        checks.append(message)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        page = browser.new_page(viewport={'width': 1440, 'height': 1050}, device_scale_factor=1, accept_downloads=True)
        errs=[]; page.on('pageerror', lambda e:errs.append(str(e)))
        page.set_content(html_with_inline_assets(),wait_until='load')
        ok('そろい手' in page.title(), 'title')
        ok(page.locator('#groups .group-row').count()==3, 'three editable groups')
        ok(page.locator('#opening-odds').inner_text().startswith('33.18'), 'exact default 33.18%')
        ok('6T' in page.locator('#chart').inner_text(), 'curve six turns')
        ok(page.locator('#curve-table tr').count()==7, 'curve table rows')
        ok(page.locator('#remainder-value').inner_text()=='30 枚', 'remainder computed')
        ok(page.locator('#suggestions .suggestion').count()==5, 'five candidates')
        ok(page.locator('#opening-caption').inner_text().startswith('3カテゴリ'), 'caption')
        ok(page.locator('#redraw-odds').inner_text()!='—', 'mulligan odds')
        ok(page.locator('#last-odds').inner_text()!='—', 'final odds')
        page.screenshot(path=str(ROOT/'desktop.png'),full_page=True)
        page.locator('#draw-button').click()
        ok(page.locator('#sample-status').inner_text().startswith(('✓','×')), 'sample draw status')
        ok(page.locator('#sample-cards .sample-card').count()==4, 'sample category breakdown')
        first=page.locator('#opening-odds').inner_text()
        page.locator('#groups input[data-field="count"]').first.fill('9')
        ok(page.locator('#opening-odds').inner_text()!=first, 'live recalculate')
        ok(page.locator('#remainder-value').inner_text()=='29 枚', 'live remainder')
        seed = page.evaluate('window.__testStore["soroite-prototype-v1"]')
        ok(bool(seed), 'storage stub received current config')
        page.set_content(html_with_inline_assets(seed), wait_until='load')
        ok(page.locator('#groups input[data-field="count"]').first.input_value()=='9', 'simulated storage rehydrated')
        page.locator('#reset').click()
        ok(page.locator('#groups input[data-field="count"]').first.input_value()=='8','demo reset')
        page.locator('#add-group').click()
        ok(page.locator('#groups .group-row').count()==4,'add category')
        ok(page.locator('#add-group').is_disabled(),'limit category count')
        page.locator('#groups .group-row').last.locator('button.remove-group').click()
        ok(page.locator('#groups .group-row').count()==3,'remove category')
        page.locator('#deck').fill('10')
        ok(bool(page.locator('#message').inner_text()), 'bad deck validation')
        ok(page.locator('#opening-odds').inner_text()=='—','invalid input cannot show stale result')
        page.locator('#deck').fill('60')
        ok(page.locator('#message').inner_text()=='','error clears after fix')
        page.locator('#groups .group-row').first.locator('input[data-field="min"]').fill('4')
        ok('不正' not in page.locator('#message').inner_text(),'bounds change accepted')
        page.locator('#groups .group-row').first.locator('input[data-field="min"]').fill('1')
        before=page.locator('#opening-odds').inner_text()
        page.locator('.suggestion button.sug-apply').first.click()
        ok(page.locator('#opening-odds').inner_text()!=before,'one-card recommendation applied')
        with page.expect_download() as d:
            page.locator('#save-json').click()
        file=d.value
        ok(file.suggested_filename=='soroite-deck.json','JSON downloadable')
        with tempfile.TemporaryDirectory() as tmp:
            out=Path(tmp)/'deck.json';file.save_as(str(out)); payload=json.loads(out.read_text())
            ok('groups' in payload['config'],'JSON contents parseable')
            page.locator('#reset').click()
            page.locator('#load-json').set_input_files(str(out))
            ok(page.locator('#groups input[data-field="count"]').first.input_value()==str(payload['config']['groups'][0]['count']),'JSON reimport')
        with page.expect_download() as d:
            page.locator('#export-csv').click()
        csv=d.value
        ok(csv.suggested_filename=='soroite-probability.csv','CSV downloadable')
        with tempfile.TemporaryDirectory() as tmp:
            out=Path(tmp)/'result.csv';csv.save_as(str(out))
            ok('probability_percent' in out.read_text(encoding='utf-8-sig'),'CSV has headers')
            ok(len(out.read_text(encoding='utf-8-sig').splitlines())==8,'CSV has curve data')
        ok(not errs,'no page errors')
        mobile=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1)
        mobile.set_content(html_with_inline_assets(),wait_until='load')
        ok(mobile.locator('#opening-odds').inner_text()!='—','mobile can compute')
        ok(mobile.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 2'),'mobile no horizontal overflow')
        mobile.screenshot(path=str(ROOT/'mobile.png'),full_page=True)
        mobile.locator('#draw-button').click()
        ok(mobile.locator('#sample-cards .sample-card').count()==4,'mobile draw works')
        browser.close()
    print(f'PASS {len(checks)}/{len(checks)} browser assertions | screenshots desktop.png/mobile.png')
if __name__=='__main__': run()
