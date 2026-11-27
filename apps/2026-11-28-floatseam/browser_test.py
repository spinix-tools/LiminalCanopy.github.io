from playwright.sync_api import sync_playwright
from pathlib import Path
import json
root=Path(__file__).parent
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=b.new_page(viewport={'width':1200,'height':900},accept_downloads=True)
    errors=[]; network=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:network.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((root/'index.html').read_text())
    assert [page.locator('#'+x).inner_text() for x in ['finite','repeat','seams','infinite']]==['0','2','2','0']
    page.screenshot(path=str(root/'desktop.png'),full_page=True)
    with page.expect_download() as d: page.locator('#save').click()
    data=json.loads(Path(d.value.path()).read_text()); assert len(data['periodic'])==2 and all(x['len']==5 for x in data['periodic'])
    with page.expect_download() as d: page.locator('#csv').click()
    assert 'weft,front,1,6,5,true' in Path(d.value.path()).read_text(encoding='utf-8-sig')
    page.locator('#filter').select_option('seam')
    before=page.locator('#draft').input_value(); page.locator('#map').click(position={'x':12,'y':12}); assert page.locator('#draft').input_value()!=before
    page.locator('#draft').fill('01\n1'); assert page.locator('#save').is_disabled(); page.locator('#run').click(); assert page.locator('#error').inner_text()
    page.locator('#sample').click(); page.locator('#plain').click(); assert page.locator('#repeat').inner_text()=='0'
    page.locator('#draft').fill('00\n00'); page.locator('#run').click(); assert page.locator('#infinite').inner_text()=='4'
    page.locator('#sample').click(); page.set_viewport_size({'width':390,'height':844}); page.screenshot(path=str(root/'mobile.png'),full_page=True)
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'); assert not errors and not network
    b.close()
print('Chromium: sample, JSON/CSV downloads, filter, click edit, invalidation, invalid input, plain weave, infinite floats, 390px, no page errors or HTTP(S) requests — PASS')
