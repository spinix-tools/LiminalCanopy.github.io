"""Chromium Playwright interactions. Sandbox blocks HTTP/file navigation, so inject actual HTML/JS and mock localStorage."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json
ROOT=Path(__file__).parent
HTML=(ROOT/'index.html').read_text().replace('<script src="engine.js"></script><script src="app.js"></script>','')

def load(page):
    page.set_content(HTML)
    page.evaluate("""() => {const d=new Map();Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>d.get(k)||null,setItem:(k,v)=>d.set(k,String(v)),removeItem:k=>d.delete(k)}})}""")
    page.add_script_tag(path=str(ROOT/'engine.js'))
    page.add_script_tag(path=str(ROOT/'app.js'))

def main():
    n=0
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
        page=browser.new_page(viewport={'width':1366,'height':960},accept_downloads=True)
        errors=[]
        page.on('pageerror',lambda exc:errors.append(str(exc)))
        load(page);n+=1
        assert page.title().startswith('ずれなおし');n+=1
        assert page.locator('#svgHolder svg').count()==1;n+=1
        assert page.locator('#cellCount').inner_text()=='24';n+=1
        assert page.locator('#filledCount').inner_text()=='24';n+=1
        page.locator('[data-k="marginX"]').fill('10');n+=1
        assert '横幅が用紙を超えています' in page.locator('#message').inner_text();n+=1
        page.locator('[data-k="marginX"]').fill('8.5');n+=1
        assert '準備OK' in page.locator('#message').inner_text();n+=1
        page.locator('#labels').fill('A & <B>|第二行\n次の文字');n+=1
        html=page.locator('#svgHolder').inner_html()
        assert '&lt;B&gt;' in html and '<script>' not in html;n+=1
        assert page.locator('#filledCount').inner_text()=='2';n+=1
        page.locator('[data-k="from"]').fill('3');n+=1
        assert page.locator('#filledCount').inner_text()=='2';n+=1
        page.locator('#enableCorrection').check();n+=1
        assert page.locator('#calBadge').inner_text()=='補正ON';n+=1
        page.locator('[data-c="aX"]').fill('14');page.locator('[data-c="bX"]').fill('200');n+=1
        assert '逆補正' in page.locator('#calibrationText').inner_text();n+=1
        page.locator('#resetCorrection').click();n+=1
        assert page.locator('#calBadge').inner_text()=='補正OFF';n+=1
        with page.expect_download() as d: page.locator('#downloadSvg').click()
        svg=d.value.path().read_text();assert 'svg' in svg and 'A &amp; &lt;B&gt;' in svg;n+=1
        with page.expect_download() as d: page.locator('#exportCsv').click()
        assert '次の文字' in d.value.path().read_text('utf-8-sig');n+=1
        with page.expect_download() as d: page.locator('#exportJson').click()
        backup=json.loads(d.value.path().read_text());assert backup['data']['from']==3;n+=1
        project_file=ROOT/'test-project.json';project_file.write_text(json.dumps(backup,ensure_ascii=False),encoding='utf-8')
        assert json.loads(page.evaluate("localStorage.getItem('zuren-2026-v1')"))['from']==3;n+=1
        assert page.locator('[data-k="from"]').input_value()=='3';n+=1
        page.locator('#preset').select_option('a4-2x5');n+=1
        assert page.locator('#cellCount').inner_text()=='10';n+=1
        page.locator('#clear').click();n+=1
        assert page.locator('#filledCount').inner_text()=='0';n+=1
        page.locator('#demo').click();n+=1
        assert page.locator('#filledCount').inner_text()=='10';n+=1
        page.locator('#csvFile').set_input_files({'name':'two.csv','mimeType':'text/csv','buffer':b'alpha,beta\ngamma,delta'}) ;n+=1
        assert 'alpha | beta' in page.locator('#labels').input_value();n+=1
        assert page.locator('#filledCount').inner_text()=='2';n+=1
        page.locator('#jsonFile').set_input_files(str(project_file));n+=1
        assert page.locator('#cellCount').inner_text()=='24';n+=1
        assert page.locator('[data-k="from"]').input_value()=='3';n+=1
        page.locator('#enableCorrection').check();n+=1
        page.locator('[data-c="bX"]').fill('220');n+=1
        assert '補正値エラー' in page.locator('#message').inner_text();n+=1
        page.locator('#resetCorrection').click();n+=1
        assert page.locator('#calBadge').inner_text()=='補正OFF';n+=1
        page.locator('#demo').click();n+=1
        page.locator('#guides').select_option('true');n+=1
        assert page.evaluate('window.ZureEngine.defaultState() !== null');n+=1
        page.evaluate('window.__printN=0;window.print=()=>{window.__printN++}')
        page.locator('#proof').click();n+=1
        assert page.evaluate('window.__printN')>=1 and 'A (12' in page.locator('#printRoot').inner_html();n+=1
        prior=page.evaluate('window.__printN')
        page.locator('#printFinal').click();n+=1
        assert page.evaluate('window.__printN')>prior and '深煎り' in page.locator('#printRoot').inner_html();n+=1
        assert not errors,errors;n+=1
        page.screenshot(path=str(ROOT/'desktop.png'),full_page=True)
        mobile=browser.new_page(viewport={'width':390,'height':844})
        load(mobile);n+=1
        assert mobile.locator('#svgHolder svg').count()==1;n+=1
        assert mobile.evaluate('document.documentElement.scrollWidth <= innerWidth+2');n+=1
        mobile.screenshot(path=str(ROOT/'mobile.png'),full_page=True)
        browser.close()
    (ROOT/'test-project.json').unlink(missing_ok=True)
    print(f'Chromium UI tests PASS: {n}/{n} checks, injected HTML + JS; mocked localStorage; screenshots desktop.png/mobile.png')
if __name__=='__main__':main()