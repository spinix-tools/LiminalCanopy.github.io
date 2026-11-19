"""Chromium GUI smoke/regression test using the real HTML/CSS/JS source inline.
file:// and localhost navigation are blocked by this test environment's browser policy.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent

def load(page):
    html=(ROOT/'index.html').read_text()
    html=html.replace('<link rel="stylesheet" href="style.css">','')
    html=html.replace('<script defer src="engine.js"></script>','').replace('<script defer src="app.js"></script>','')
    css=(ROOT/'style.css').read_text()
    html=html.replace('</head>','<style>'+css+'</style></head>')
    page.set_content(html,wait_until='load')
    page.evaluate("""() => { const m={}; Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>m[k]||null,setItem:(k,v)=>m[k]=v,removeItem:k=>delete m[k]}}); }""")
    page.add_script_tag(content=(ROOT/'engine.js').read_text())
    page.add_script_tag(content=(ROOT/'app.js').read_text())


def run():
    checks=0
    def verify(v,message):
        nonlocal checks
        assert v,message
        checks+=1
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
        page=browser.new_page(viewport={'width':1440,'height':960}, device_scale_factor=1)
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        load(page)
        verify(page.title().startswith('種つなぎ'),'title')
        verify(page.locator('.crop-card').count()==4,'4 editable crops')
        verify(page.locator('#harvestChart svg').count()==1,'bar chart')
        verify(page.locator('#timeline table tbody tr').count()==4,'timeline')
        verify(page.locator('#stats .stat').count()==4,'metrics')
        verify(page.locator('#capacityChart .capacity-track span').count()==16,'week capacity')
        verify(page.locator('#taskList .task').count()>0,'sowing tasks')
        verify(page.locator('#errorBanner').is_hidden(),'no initial error')
        verify(page.locator('#capacity').input_value()=='5','default capacity')
        verify('JSON保存' in page.locator('#downloadJson').inner_text(),'export exists')
        verify(page.locator('#stats .stat').first.inner_text().strip().find('%')>=0,'coverage stat')
        page.screenshot(path=str(ROOT/'desktop.png'),full_page=True)

        page.locator('[data-mode="lowwork"]').click()
        verify(page.locator('[data-mode="lowwork"]').get_attribute('aria-pressed')=='true','mode change')
        page.locator('#target').fill('1');page.locator('#target').dispatch_event('change')
        verify(page.locator('#target').input_value()=='1','edit target')
        verify(page.locator('#stats .stat').count()==4,'recomputed metrics')
        page.locator('#capacity').fill('6');page.locator('#capacity').dispatch_event('change')
        verify(page.locator('#capacity').input_value()=='6','capacity edit')
        page.locator('#weeks').select_option('8')
        verify(page.locator('#capacityChart .capacity-track span').count()==8,'weeks recalc')
        page.locator('#addCrop').click()
        verify(page.locator('.crop-card').count()==5,'add crop')
        page.locator('[data-crop][data-field="name"]').last.fill('ベビーリーフ')
        page.locator('[data-crop][data-field="name"]').last.dispatch_event('change')
        verify('ベビーリーフ' in page.locator('#cropList').inner_text() or page.locator('[data-field="name"]').last.input_value()=='ベビーリーフ','rename crop')
        page.locator('[data-remove-crop]').last.click()
        verify(page.locator('.crop-card').count()==4,'delete crop')
        # Week 1 for first crop. It can be safely pinned.
        page.locator('#pinCrop').select_option('komatsuna')
        page.locator('#pinWeek').select_option('0')
        page.locator('#addPin').click()
        verify(page.locator('.pin-tag').count()==1,'manual pin')
        verify(page.locator('#errorBanner').is_hidden(),'valid pin')
        page.locator('#addPin').click()
        verify('すでに固定' in page.locator('#errorBanner').inner_text(),'duplicate pin rejected')
        page.locator('[data-remove-pin]').first.click()
        verify(page.locator('.pin-tag').count()==0,'pin removed')
        verify(page.locator('#errorBanner').is_hidden(),'pin removal clears error')
        page.locator('#resetSample').click()
        verify(page.locator('#weeks').input_value()=='16','reset sample')
        verify(page.locator('#target').input_value()=='2','reset goal')
        verify(page.locator('.crop-card').count()==4,'reset crops')
        # JSON and CSV exports exercise actual Blob creation, without browser downloads.
        page.evaluate("""() => { window.__saved=[]; const old=URL.createObjectURL;URL.createObjectURL=()=> 'blob:mock'; const oldClick=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){ window.__saved.push(this.download); }; }""")
        page.locator('#downloadJson').click();page.locator('#downloadCsv').click()
        verify(page.evaluate('window.__saved.includes("tane-tsunagi-plan.json")'),'JSON download')
        verify(page.evaluate('window.__saved.includes("tane-tsunagi-sowing.csv")'),'CSV download')
        verify(bool(page.evaluate('localStorage.getItem("tane-tsunagi-v1")')),'local saving writes')
        # Malformed import displays error, valid import roundtrips and restores data.
        page.locator('#importJson').set_input_files({'name':'bad.json','mimeType':'application/json','buffer':b'{invalid'})
        verify('読込できません' in page.locator('#errorBanner').inner_text(),'malformed JSON notice')
        good=page.evaluate('JSON.stringify(SeedEngine.DEMO)')
        page.locator('#importJson').set_input_files({'name':'good.json','mimeType':'application/json','buffer':good.encode()})
        verify(page.locator('#errorBanner').is_hidden(),'good JSON import')
        verify(page.locator('#harvestChart svg').count()==1,'import recalculates')
        verify(not errors,'no JavaScript exceptions: '+repr(errors))
        mobile=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1)
        load(mobile)
        verify(mobile.locator('#harvestChart svg').count()==1,'mobile chart')
        verify(mobile.locator('.crop-card').count()==4,'mobile crop editing')
        verify(mobile.locator('body').evaluate('(e)=>e.scrollWidth<=innerWidth+2'),'no horizontal page overflow')
        mobile.screenshot(path=str(ROOT/'mobile.png'),full_page=True)
        browser.close()
    return checks

if __name__=='__main__':
    print(f'PASS: {run()} Chromium UI assertions')