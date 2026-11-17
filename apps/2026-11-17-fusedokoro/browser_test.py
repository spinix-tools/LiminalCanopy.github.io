"""FUSEDOKORO Playwright interaction test. Requires playwright and Chromium."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json, io
from PIL import Image

ROOT=Path(__file__).resolve().parent
checks=[]
def verify(label, ok):
    checks.append((label,bool(ok)))
    assert ok, label

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page(viewport={'width':1365,'height':1000}, accept_downloads=True)
    errors=[]
    page.on('pageerror', lambda err: errors.append(str(err)))
    mode='file'
    try:
        page.goto((ROOT/'index.html').as_uri(),timeout=5000)
        page.wait_for_function('!!window.__fusedokoroTest',timeout=2000)
    except Exception:
        mode='injected'
        page.close()
        page=browser.new_page(viewport={'width':1365,'height':1000},accept_downloads=True)
        page.on('pageerror', lambda err: errors.append(str(err)))
        import re
        html=(ROOT/'index.html').read_text()
        html=re.sub(r'<meta http-equiv="Content-Security-Policy"[^>]+>', '', html)
        html=html.replace('<script src="engine.js"></script><script src="app.js"></script>', '')
        page.set_content(html)
        page.add_script_tag(path=str(ROOT/'engine.js'))
        page.add_script_tag(path=str(ROOT/'app.js'))
    print('BROWSER MODE',mode)
    verify('page renders',page.locator('h1').inner_text()=='ふせどころ')
    verify('initial export disabled',page.locator('#export').is_disabled())
    verify('initial placeholder',page.locator('#placeholder').is_visible())
    page.locator('#demo').click()
    verify('demo image dimensions',page.evaluate('window.__fusedokoroTest.getState().width')==1160)
    verify('demo placeholder removed',page.locator('#canvas').is_visible())
    canvas=page.locator('#canvas')
    bb=canvas.bounding_box()
    def drag(x0,y0,x1,y1):
        bb=canvas.bounding_box()
        def at(x,y):return (bb['x']+x/bb['width']*bb['width'],bb['y']+y/720*bb['height'])
        # x coordinates refer directly to sample's 1160px width
        page.mouse.move(bb['x']+x0/1160*bb['width'],bb['y']+y0/720*bb['height'])
        page.mouse.down();page.mouse.move(bb['x']+x1/1160*bb['width'],bb['y']+y1/720*bb['height'],steps=6);page.mouse.up()
    drag(130,248,740,283)
    verify('first mask created',page.locator('#maskCount').inner_text()=='1')
    verify('selected geometry visible',page.locator('#geometry').is_visible())
    verify('mask list label', '氏名・ID' in page.locator('#masklist').inner_text())
    verify('export disabled until checked',page.locator('#export').is_disabled())
    page.locator('#kind').select_option('住所・位置')
    drag(130,397,740,431)
    verify('second mask',page.locator('#maskCount').inner_text()=='2')
    verify('second mask label', '住所・位置' in page.locator('#masklist').inner_text())
    area=page.evaluate('window.__fusedokoroTest.getState().masks')
    verify('padding stored',area[1]['w']>610)
    page.locator('#undo').click()
    verify('undo removes last mask',page.locator('#maskCount').inner_text()=='1')
    page.locator('#redo').click()
    verify('redo restores mask',page.locator('#maskCount').inner_text()=='2')
    page.locator('#masklist button').last.click()
    page.locator('#gx').fill('70')
    page.locator('#gw').fill('830')
    page.locator('#applyGeo').click()
    verify('coordinates editable',page.evaluate('window.__fusedokoroTest.getState().masks[1].x')==70)
    page.locator('#view').select_option('final')
    verify('final preview selectable',page.locator('#view').input_value()=='final')
    page.locator('#zoom').select_option('actual')
    verify('100 percent zoom class',page.locator('#canvas').evaluate('(e)=>e.classList.contains("actual-zoom")'))
    page.locator('#zoom').select_option('fit')
    verify('fit zoom resets class',not page.locator('#canvas').evaluate('(e)=>e.classList.contains("actual-zoom")'))
    page.locator('#review1').check();page.locator('#review2').check()
    verify('export becomes enabled',page.locator('#export').is_enabled())
    with page.expect_download() as info:page.locator('#export').click()
    download=info.value
    output=ROOT/'browser-export.png'; download.save_as(output)
    verify('export file PNG',output.read_bytes()[:8]==b'\x89PNG\r\n\x1a\n')
    verify('PNG download filename',download.suggested_filename.endswith('.png'))
    img=Image.open(output).convert('RGBA')
    verify('PNG dimensions intact',img.size==(1160,720))
    verify('PNG original masked pixels replaced',img.getpixel((250,263))==(20,30,42,255))
    verify('PNG corrected position masked',img.getpixel((90,410))==(20,30,42,255))
    verify('PNG outside region intact',img.getpixel((1000,650))!=(20,30,42,255))
    verify('export audit succeeded','検証OK' in page.locator('#audit').inner_text())
    verify('no detected metadata chunks','メタデータチャンク 0件' in page.locator('#audit').inner_text())
    verify('report enabled',page.locator('#auditDownload').is_enabled())
    with page.expect_download() as info:page.locator('#auditDownload').click()
    report=ROOT/'browser-audit.json';info.value.save_as(report)
    data=json.loads(report.read_text())
    verify('audit report masks recorded',data['masks']==2)
    verify('audit zero mismatches',data['mismatched_pixels']==0)
    verify('report excludes original image data',set(data).isdisjoint({'original','image_data','pixels'}))
    page.locator('#deleteMask').click()
    verify('delete selected mask',page.locator('#maskCount').inner_text()=='1')
    verify('change invalidates audit',page.locator('#auditDownload').is_disabled())
    verify('change clears review checks',not page.locator('#review1').is_checked())
    # Import actual binary image from disk to test file input, replacement of image.
    sample=Image.new('RGB',(200,100),(233,201,144));path=ROOT/'synthetic-input.jpg';sample.save(path,format='JPEG',exif=b'Exif\x00\x00')
    page.locator('#file').set_input_files(str(path))
    page.wait_for_function('window.__fusedokoroTest.getState().width===200', timeout=5000)
    verify('uploaded file changes dimensions',page.evaluate('window.__fusedokoroTest.getState().width')==200)
    verify('upload resets masks',page.locator('#maskCount').inner_text()=='0')
    verify('no uncaught page errors',not errors)
    page.screenshot(path=str(ROOT/'desktop.png'),full_page=True)
    # Get a meaningful screenshot with the demo and marks.
    page.locator('#demo').click()
    page.locator('#kind').select_option('メール・電話')
    drag(130,247,740,283);drag(130,394,730,433)
    page.screenshot(path=str(ROOT/'desktop.png'),full_page=True)
    mobile=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1)
    if mode=='file':
        mobile.goto((ROOT/'index.html').as_uri())
    else:
        mobile.set_content(html)
        mobile.add_script_tag(path=str(ROOT/'engine.js'))
        mobile.add_script_tag(path=str(ROOT/'app.js'))
    mobile.locator('#demo').click()
    verify('mobile page visible',mobile.locator('h1').is_visible())
    verify('mobile canvas visible',mobile.locator('#canvas').is_visible())
    mobile.screenshot(path=str(ROOT/'mobile.png'),full_page=True)
    browser.close()

for name,pass_ in checks: print(('PASS' if pass_ else 'FAIL')+' '+name)
print(f'CHROMIUM: {len(checks)} / {len(checks)} checks passed')
