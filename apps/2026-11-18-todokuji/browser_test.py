"""Chromium smoke/interaction tests without network permissions.
Uses the exact local HTML/CSS/JS, inlined only because administrator blocks file:// navigation.
"""
from pathlib import Path
import json
import re
import tempfile
import xml.etree.ElementTree as ET
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).parent
source=(ROOT/'index.html').read_text()
css=(ROOT/'style.css').read_text()
engine=(ROOT/'engine.js').read_text()
app=(ROOT/'app.js').read_text()
html=source.replace('<link rel="stylesheet" href="style.css">','<style>'+css+'</style>')
html=html.replace('<script src="engine.js"></script>','<script>'+engine+'</script>').replace('<script src="app.js"></script>','<script>'+app+'</script>')
checks=[]
def check(name, condition):
    assert condition,name
    checks.append(name)
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'],headless=True)
    ctx=browser.new_context(accept_downloads=True,viewport={'width':1440,'height':1050},device_scale_factor=1)
    page=ctx.new_page()
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(html,wait_until='load')
    check('title exists','とどく字' in page.title())
    check('svg renders',page.locator('#paperPreview svg').count()==1)
    check('default title rendered','受付はこちら' in page.locator('#paperPreview svg').text_content())
    check('initial audit visible','m' in page.locator('#titleReach').inner_text())
    check('paper size label visible','210×297mm' in page.locator('#scaleIndicator').inner_text())
    check('distance set',page.locator('#distance').input_value()=='2.5')
    check('SVG no external image',page.locator('#paperPreview svg image').count()==0)
    check('screen label editable',page.locator('#title').input_value()=='受付はこちら')
    page.locator('#title').fill('見学の受付はこちら')
    check('title updates immediately','見学の受付はこちら' in page.locator('#paperPreview svg').text_content())
    page.locator('#body').fill('受付後は左側に移動してください')
    check('body updates immediately','受付後は左側に移動してください' in page.locator('#paperPreview svg').text_content())
    page.select_option('#paper','A3')
    check('switch paper dimensions','297×420mm' in page.locator('#scaleIndicator').inner_text())
    page.select_option('#orientation','landscape')
    check('landscape physical dimensions','420×297mm' in page.locator('#scaleIndicator').inner_text())
    page.select_option('#arrow','none')
    check('no arrow removes svg polygon',page.locator('#paperPreview svg polygon').count()==0)
    page.select_option('#arrow','left')
    check('left arrow shows polygon',page.locator('#paperPreview svg polygon').count()==1)
    page.locator('#distance').fill('10')
    check('distant viewer warns',page.locator('#issueList').inner_text().find('小さめ')!=-1)
    page.locator('#titleSize').fill('58')
    check('font slider updates',page.locator('#titleSizeVal').inner_text()=='58mm')
    check('large heading reach increases',float(page.locator('#titleReach').inner_text()[:-1])>4)
    page.locator('#textColor').fill('#eeeeee')
    page.locator('#background').fill('#ffffff')
    check('low contrast warning','コントラストが4.5' in page.locator('#issueList').inner_text())
    page.locator('#autoContrast').click()
    check('auto contrast picks black',page.locator('#textColor').input_value()=='#000000')
    check('contrast passes',float(page.locator('#contrastRatio').inner_text().split(':')[0])>20)
    page.locator('[data-mode="mono"]').click()
    check('monochrome mode enabled','monochrome' in page.locator('#paperPreview').get_attribute('class'))
    page.locator('[data-mode="color"]').click()
    check('color mode restored','monochrome' not in page.locator('#paperPreview').get_attribute('class'))
    page.locator('[data-preset="event"]').click()
    check('event preset changes heading','会場は2階です' in page.locator('#paperPreview svg').text_content())
    check('event preset is A3',page.locator('#paper').input_value()=='A3')
    page.locator('[data-preset="queue"]').click()
    check('queue preset changes heading','こちらでお待ちください' in page.locator('#paperPreview svg').text_content())
    with page.expect_download() as ev:page.locator('#downloadSvg').click()
    dl=ev.value
    fp=ROOT/'_test_export.svg';dl.save_as(fp)
    check('SVG file exported',fp.exists() and fp.stat().st_size>1000)
    svgfile=fp.read_text()
    root=ET.fromstring(svgfile)
    check('SVG valid XML',root.tag.endswith('svg'))
    check('SVG exact mm attributes',root.attrib['width']=='210mm' and root.attrib['height']=='297mm')
    check('SVG contains expected Japanese text','こちらでお待ちください' in svgfile)
    fp.unlink()
    with page.expect_download() as ev:page.locator('#downloadReport').click()
    dl=ev.value;fp=ROOT/'_test_export.txt';dl.save_as(fp)
    check('report saves actual text','コントラスト' in fp.read_text())
    fp.unlink()
    with page.expect_download() as ev:page.locator('#downloadJson').click()
    dl=ev.value;fp=ROOT/'_test_export.json';dl.save_as(fp)
    saved=json.loads(fp.read_text());check('JSON schema valid',saved.get('format')=='TODOKUJI/1' and saved['project']['title']=='こちらでお待ちください')
    # Custom project import
    saved['project']['title']='再読込テスト'
    fp.write_text(json.dumps(saved,ensure_ascii=False))
    page.locator('#importJson').set_input_files(str(fp))
    check('JSON project import working','再読込テスト' in page.locator('#paperPreview svg').text_content())
    fp.unlink()
    # Reject wrong format
    fp=ROOT/'_test_bad.json';fp.write_text(json.dumps({'hello':True}))
    page.locator('#importJson').set_input_files(str(fp))
    check('JSON wrong schema rejected','再読込テスト'==page.locator('#title').input_value())
    fp.unlink()
    page.locator('#resetBtn').click()
    # default confirm dismissed in headless; explicit accepted below
    check('reset dialog dismissed without change',page.locator('#title').input_value()=='再読込テスト')
    page.once('dialog',lambda d:d.accept());page.locator('#resetBtn').click()
    check('reset works',page.locator('#title').input_value()=='受付はこちら')
    page.wait_for_timeout(2600)  # Let transient toast disappear before capturing screenshots
    page.screenshot(path=str(ROOT/'desktop.png'),full_page=True)
    check('desktop screenshot saved',(ROOT/'desktop.png').exists())
    page.set_viewport_size({'width':390,'height':844})
    page.screenshot(path=str(ROOT/'mobile.png'),full_page=True)
    check('mobile screenshot saved',(ROOT/'mobile.png').exists())
    check('mobile no horizontal overflow',page.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'))
    check('no JS errors',not errors)
    print('PASS',len(checks),'browser assertions')
    for i,n in enumerate(checks,1): print(f'{i:02} {n}')
    ctx.close();browser.close()