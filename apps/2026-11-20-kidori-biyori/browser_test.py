from pathlib import Path
import re
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).parent
assertions=[]
def check(condition,name):
    assert condition,name
    assertions.append(name)
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page(accept_downloads=True, viewport={'width':1440,'height':950})
    messages=[]
    page.on('pageerror',lambda e:messages.append(str(e)))
    html=(ROOT/'index.html').read_text()
    html=re.sub(r'<link rel="stylesheet"[^>]*>', '', html)
    html=re.sub(r'<script src="[^"]+"></script>', '', html)
    page.set_content(html)
    page.add_style_tag(content=(ROOT/'style.css').read_text())
    page.add_script_tag(content=(ROOT/'engine.js').read_text())
    page.add_script_tag(content=(ROOT/'app.js').read_text())
    page.screenshot(path=str(ROOT/'desktop.png'),full_page=True)
    check(page.locator('h1').inner_text().startswith('木取り日和'),'inline local-source boot')
    check(page.locator('.result-card').count()==2,'two results')
    check(page.locator('.sheet').count()>0,'maps drawn')
    check(page.locator('#costOffcut').inner_text().endswith('円'),'purchase estimate')
    before=page.locator('#stocks tr').count()
    page.click('#addStock')
    check(page.locator('#stocks tr').count()==before+1,'add stock')
    page.locator('#stocks tr').last.locator('[data-key="name"]').fill('テスト材')
    page.locator('#stocks tr').last.locator('[data-key="name"]').dispatch_event('change')
    check(page.locator('#stocks tr').last.locator('input').first.input_value()=='テスト材','edit stock name')
    page.locator('#stocks tr').last.locator('[data-remove]').click()
    check(page.locator('#stocks tr').count()==before,'remove stock')
    before=page.locator('#parts tr').count()
    page.click('#addPart')
    check(page.locator('#parts tr').count()==before+1,'add part')
    page.locator('#parts tr').last.locator('[data-key="grain"]').check()
    check(page.locator('#parts tr').last.locator('[data-key="grain"]').is_checked(),'grain checkbox')
    page.locator('#parts tr').last.locator('[data-remove]').click()
    check(page.locator('#parts tr').count()==before,'remove part')
    page.click('#cardYield')
    check(page.locator('#cardYield').get_attribute('aria-pressed')=='true','select yield plan')
    page.click('#cardOffcut')
    check(page.locator('#cardOffcut').get_attribute('aria-pressed')=='true','select offcut plan')
    page.locator('#kerf').fill('4')
    page.locator('#kerf').dispatch_event('change')
    check(page.locator('#kerf').input_value()=='4','edit kerf')
    for control,name in [('saveJson','project JSON'),('exportCsv','parts CSV'),('exportRemnants','remainders CSV'),('exportSvg','sheet SVG')]:
        with page.expect_download() as download:
            page.click('#'+control)
        item=download.value
        check(bool(item.suggested_filename),name+' export')
        if name=='parts CSV':
            tmp=ROOT/'test-output.csv'; item.save_as(str(tmp)); check('材料' in tmp.read_text(encoding='utf-8-sig'), 'CSV headers'); tmp.unlink()
    page.locator('#kerf').fill('-5')
    page.locator('#kerf').dispatch_event('change')
    check(page.locator('#error').is_visible(),'input validation')
    check(page.locator('#layouts .empty').count()==1,'hide invalid map')
    page.locator('#kerf').fill('3')
    page.locator('#kerf').dispatch_event('change')
    check(not page.locator('#error').is_visible(),'recover from validation error')
    check(not messages,'no uncaught errors: '+str(messages))
    page.set_viewport_size({'width':390,'height':844})
    page.screenshot(path=str(ROOT/'mobile.png'),full_page=True)
    check(page.locator('.sheet').first.is_visible(),'mobile layout visible')
    browser.close()
print('BROWSER PASS',len(assertions),'checks:',', '.join(assertions))