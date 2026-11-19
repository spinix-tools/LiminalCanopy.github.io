"""Chromium UI regression tests. Loads exact source inline because file:// navigation is blocked in this runner.
localStorage is mocked: persistence across actual browser restarts is NOT exercised."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json, re, sys

ROOT=Path(__file__).resolve().parent
COUNT=0

def check(cond, desc):
    global COUNT
    assert cond, desc
    COUNT += 1
    print(f'PASS {COUNT:02d}: {desc}')

def inline_html():
    html=(ROOT/'index.html').read_text()
    html=html.replace('<link rel="stylesheet" href="style.css">', '<style>'+(ROOT/'style.css').read_text()+'</style>')
    html=re.sub(r'<script defer src="(?:engine|app)\.js"></script>', '', html)
    storage_script='''<script>window._saved={};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem(k){return window._saved[k]??null},setItem(k,v){window._saved[k]=v},removeItem(k){delete window._saved[k]}}});</script>'''
    return html.replace('</body>',storage_script+'<script>'+(ROOT/'engine.js').read_text()+'</script><script>'+(ROOT/'app.js').read_text()+'</script></body>')

def main():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
        context=browser.new_context(viewport={'width':1440,'height':900},device_scale_factor=1,accept_downloads=True)
        page=context.new_page()
        errs=[]
        page.on('pageerror',lambda e:errs.append(str(e)))
        page.set_content(inline_html(),wait_until='load')
        check('換水しらべ' in page.title(),'document title')
        check(page.locator('#chart svg').count()==1,'forecast SVG appears')
        check(page.locator('#chart path').count()==2,'A/B paths exist')
        check(page.locator('#calendar .calendar-day').count()==14,'calendar 14 days')
        check(page.locator('#tickerHorizon').inner_text()=='42日','default horizon 42')
        check(page.locator('#tickerA').inner_text()=='113.4 L','default A water volume')
        check(page.locator('#tickerB').inner_text()=='136.1 L','default B water volume')
        check(page.locator('#rateHint').inner_text().find('1.00')>=0,'measurement rate estimation')
        check(page.locator('#needA').inner_text()=='37%','inverse recommendation A')
        check(page.locator('#dayA').inner_text().endswith('ppm'),'day-specific reading')
        check('数値上は' in page.locator('#verdictTitle').inner_text(),'comparison verdict')
        page.screenshot(path=str(ROOT/'desktop.png'),full_page=True)
        page.locator('[data-field="current"]').fill('45')
        page.locator('[data-field="current"]').blur()
        check(page.locator('[data-field="current"]').input_value()=='45','edit current nitrate')
        check(page.locator('#dayA').inner_text().endswith('ppm'),'graph recalculates after current change')
        page.locator('[data-plan="b"][data-key="percent"]').fill('28')
        page.locator('[data-plan="b"][data-key="percent"]').blur()
        check('211.7' in page.locator('#tickerB').inner_text(),'change B percent and water usage')
        page.locator('[data-field="horizon"]').select_option('14')
        check(page.locator('#tickerHorizon').inner_text()=='14日','change horizon')
        check(page.locator('#daySlider').get_attribute('max')=='14','day slider clamped to horizon')
        page.locator('#daySlider').fill('5')
        check(page.locator('#dayLabel').inner_text()=='Day 5','day slider interactive')
        page.locator('[data-measure="start"]').fill('4')
        page.locator('[data-measure="start"]').blur()
        page.locator('[data-measure="end"]').fill('25')
        page.locator('[data-measure="end"]').blur()
        check('3.00' in page.locator('#rateHint').inner_text(),'measured delta updates')
        page.locator('#applyRate').click()
        check(page.locator('[data-field="dailyRise"]').input_value()=='3','apply measured daily rise')
        page.locator('[data-plan="a"][data-key="percent"]').fill('90')
        page.locator('[data-plan="a"][data-key="percent"]').blur()
        check(page.locator('[data-plan="a"][data-key="percent"]').input_value()=='35','invalid >80% reverts')
        check('換水率' in page.locator('#toast').inner_text(),'invalid input gives message')
        page.locator('[data-field="name"]').fill('')
        page.locator('[data-field="name"]').blur()
        check(page.locator('[data-field="name"]').input_value()=='リビングの淡水水槽','blank name rejected')
        page.locator('[data-field="name"]').fill('<img src=x onerror=alert(1)>')
        page.locator('[data-field="name"]').blur()
        check(page.locator('#tickerTank').inner_text()=='<img src=x onerror=alert(1)>','name is treated as text')
        check(page.locator('img').count()==0,'XSS-like text does not create image')
        page.locator('#saveBtn').click()
        check(bool(page.evaluate('Object.keys(window._saved).length')),'localStorage mock receives save')
        page.locator('#clearBtn').click()
        check(not page.evaluate('Object.keys(window._saved).length'),'saved data cleared')
        page.locator('#resetBtn').click()
        check(page.locator('[data-field="name"]').input_value()=='リビングの淡水水槽','reset restores demo')
        page.locator('#useNeedA').click()
        check(page.locator('[data-plan="a"][data-key="percent"]').input_value()=='37','recommended percentage applied')
        with page.expect_download() as info: page.locator('#csvBtn').click()
        csv=info.value
        check(csv.suggested_filename=='kansui-shirabe.csv','CSV download initiated')
        csv_path=ROOT/'test-export.csv';csv.save_as(str(csv_path))
        check(csv_path.read_text(encoding='utf-8-sig').count('\n')==44,'CSV contains 42 day rows and header')
        with page.expect_download() as info: page.locator('#jsonBtn').click()
        downloaded=info.value
        check(downloaded.suggested_filename=='kansui-shirabe.json','JSON download initiated')
        json_path=ROOT/'test-export.json';downloaded.save_as(str(json_path))
        check(json.loads(json_path.read_text())['plans'][0]['percent']==37,'JSON contains edited plan')
        with page.expect_download() as info: page.locator('#svgBtn').click()
        svg=info.value
        check(svg.suggested_filename=='kansui-shirabe.svg','SVG download initiated')
        svg_path=ROOT/'test-export.svg';svg.save_as(str(svg_path))
        check('<svg' in svg_path.read_text() and '<path ' in svg_path.read_text(),'SVG contents valid-looking')
        config=json.loads(json_path.read_text());config['name']='読み込み水槽';config['horizon']=28;config['selectedDay']=12
        page.locator('#importFile').set_input_files({'name':'input.json','mimeType':'application/json','buffer':json.dumps(config).encode()})
        check(page.locator('#tickerTank').inner_text()=='読み込み水槽','JSON import name restored')
        check(page.locator('#tickerHorizon').inner_text()=='28日','JSON import horizon restored')
        page.locator('#importFile').set_input_files({'name':'bad.json','mimeType':'application/json','buffer':b'{ invalid'})
        check('読み込み失敗' in page.locator('#toast').inner_text(),'invalid JSON handled')
        check(page.locator('#tickerTank').inner_text()=='読み込み水槽','invalid import preserves state')
        check(not errs,'no JavaScript runtime errors')
        mobile=context.new_page(viewport={'width':390,'height':844}) if False else browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1)
        mobile_errors=[]; mobile.on('pageerror',lambda e:mobile_errors.append(str(e)))
        mobile.set_content(inline_html(),wait_until='load')
        check(mobile.locator('#chart svg').count()==1,'mobile chart renders')
        check(mobile.evaluate('document.documentElement.scrollWidth <= window.innerWidth+1'),'mobile has no horizontal overflow')
        mobile.locator('#daySlider').fill('20')
        check(mobile.locator('#dayLabel').inner_text()=='Day 20','mobile slider works')
        check(not mobile_errors,'mobile no JavaScript errors')
        mobile.screenshot(path=str(ROOT/'mobile.png'),full_page=True)
        for file in ['test-export.csv','test-export.json','test-export.svg']:(ROOT/file).unlink(missing_ok=True)
        browser.close()
        print(f'BROWSER TESTS PASSED: {COUNT}/{COUNT}')

if __name__=='__main__':
    main()
