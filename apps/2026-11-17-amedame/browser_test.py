#!/usr/bin/env python3
"""Chromium UI regression tests with direct HTML/JS load; storage shim required by network policy."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).parent
checks=0

def mount(page, saved=None):
    # Chromium navigation is blocked in this managed container.
    # Render the real HTML and execute the actual application scripts, without modifying them.
    page.set_content((ROOT/'index.html').read_text(encoding='utf-8'),wait_until='load')
    page.evaluate('''(saved) => {
        const memory = Object.assign({}, saved || {});
        Object.defineProperty(window, 'localStorage', {configurable:true, value:{
            getItem: k => Object.prototype.hasOwnProperty.call(memory,k) ? memory[k] : null,
            setItem: (k,v) => {memory[k] = String(v)},
            removeItem: k => {delete memory[k]},
            clear: () => {for (const k of Object.keys(memory)) delete memory[k]}
        }});
        window.__mockStorage = memory;
    }''',saved)
    page.add_script_tag(content=(ROOT/'engine.js').read_text(encoding='utf-8'))
    page.add_script_tag(content=(ROOT/'app.js').read_text(encoding='utf-8'))
    page.evaluate("document.dispatchEvent(new Event('DOMContentLoaded'))")


def check(ok,message):
    global checks
    assert ok,message
    checks+=1

def run():
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox','--disable-dev-shm-usage'])
        context=browser.new_context(viewport={'width':1440,'height':1040},device_scale_factor=1,accept_downloads=True)
        page=context.new_page()
        errors=[]
        page.on('pageerror',lambda e: errors.append(str(e)))
        mount(page)
        page.wait_for_selector('#compareBody tr')
        check(page.title().startswith('あめだめ'),'title')
        check(page.locator('h1').inner_text().find('AMEDAME')>=0,'branding')
        check(page.locator('#rainInputs input').count()==12,'12 rain months')
        check(page.locator('#compareBody tr').count()==4,'four capacities')
        check(page.locator('#coverage').inner_text().endswith('%'),'coverage calculated')
        check(page.locator('#shortageDays').inner_text().endswith('日'),'shortage days calculated')
        check(page.locator('#overflow').inner_text().endswith(' L'),'overflow calculated')
        check(page.locator('#tankChart path').count()==1,'chart SVG path')
        check(page.locator('#tankChart circle').count()>0,'shortage markers')
        check('月４回' in page.locator('#scenarioLabel').inner_text(),'default scenario label')
        page.screenshot(path=str(ROOT/'desktop.png'),full_page=True)
        old=page.locator('#coverage').inner_text()
        page.locator('#mode').select_option('burst')
        check('月２回' in page.locator('#scenarioLabel').inner_text(),'scenario switching')
        check(page.locator('#coverage').inner_text()!=old,'timing affects coverage')
        page.locator('#area').fill('45');page.locator('#runBtn').click()
        check('45'==page.locator('#area').input_value(),'input updated')
        check('試算を更新' in page.locator('#status').inner_text(),'recalculate status')
        page.locator('#compareBody tr').first.click()
        check(page.locator('#capacity').input_value()=='100','row selection updates capacity')
        page.locator('#area').fill('-5');page.locator('#runBtn').click()
        check('集水面積' in page.locator('#status').inner_text(),'validation error shown')
        check(page.locator('#status').get_attribute('role')=='alert','accessible validation alert')
        page.locator('#area').fill('32');page.locator('#runBtn').click()
        check(page.locator('#status').get_attribute('role')=='status','error clears after valid input')
        saved=page.evaluate('window.__mockStorage')
        mount(page,saved);page.wait_for_selector('#compareBody tr')
        check(page.locator('#capacity').input_value()=='100','mocked localStorage survives remount')
        check(page.locator('#mode').input_value()=='burst','scenario survives reload')
        with page.expect_download() as info:page.locator('#dailyBtn').click()
        daily_download=info.value
        check(daily_download.suggested_filename.endswith('.csv'),'daily CSV exported')
        daily_path=ROOT/'_test-daily.csv';daily_download.save_as(daily_path)
        daily_text=daily_path.read_text(encoding='utf-8-sig')
        check(daily_text.startswith('date,rain_mm,'),'CSV header present')
        check(daily_text.count('\n')==366,'CSV 365 dates')
        with page.expect_download() as info:page.locator('#saveBtn').click()
        backup=info.value
        backup_path=ROOT/'_test-settings.json';backup.save_as(backup_path)
        data=json.loads(backup_path.read_text(encoding='utf-8-sig'))
        check(data['config']['capacity']==100,'valid JSON backup')
        page.locator('#resetBtn').click()
        check(page.locator('#capacity').input_value()=='200','reset restores defaults')
        page.locator('#jsonFile').set_input_files(str(backup_path))
        page.wait_for_function("document.querySelector('#capacity').value==='100'")
        check(page.locator('#capacity').input_value()=='100','JSON backup imported')
        with page.expect_download() as info:page.locator('#templateBtn').click()
        template=info.value
        template_path=ROOT/'_test-template.csv';template.save_as(template_path)
        check(template_path.read_text(encoding='utf-8-sig').startswith('date,rain_mm'),'daily template download')
        page.locator('#csvFile').set_input_files(str(template_path))
        page.wait_for_function("document.querySelector('#mode').value==='observed'")
        check(page.locator('#mode').input_value()=='observed','observed CSV chosen')
        check(page.locator('#clearCsvBtn').is_visible(),'clear CSV button visible')
        check(page.locator('#compareBody tr').count()==4,'observed comparison rendered')
        check('実測CSV' in page.locator('#scenarioLabel').inner_text(),'observed scenario label')
        check(page.locator('#coverage').inner_text().endswith('%'),'observed KPI calculated')
        check(page.locator('#compareBody tr td').nth(2).inner_text()=='—','nonexistent modes excluded')
        page.locator('#clearCsvBtn').click()
        check(page.locator('#mode').input_value()!='observed','clear CSV restores scenarios')
        # import bad CSV and verify original scenario preserved
        page.locator('#csvFile').set_input_files({'name':'bad.csv','mimeType':'text/csv','buffer':b'date,rain_mm\n2026-01-01,5\n'})
        check('漏れなく' in page.locator('#status').inner_text(),'missing days rejected')
        page.locator('#sampleBtn').click()
        check(page.locator('#rain0').input_value()=='52','sample restored')
        check(not errors,'no uncaught JS errors: '+repr(errors))
        mobile=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1)
        mpage=mobile.new_page();mount(mpage);mpage.wait_for_selector('#compareBody tr')
        check(mpage.locator('#coverage').is_visible(),'mobile result visible')
        check(mpage.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'),'no mobile horizontal overflow')
        mpage.screenshot(path=str(ROOT/'mobile.png'),full_page=True)
        mobile.close();context.close();browser.close()
    for p in ROOT.glob('_test-*'):p.unlink()
    print(f'Chromium browser checks: {checks}/{checks} PASS')

if __name__=='__main__':run()
