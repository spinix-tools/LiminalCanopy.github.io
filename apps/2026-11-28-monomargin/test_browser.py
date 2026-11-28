from pathlib import Path
from playwright.sync_api import sync_playwright
import io, wave, struct, tempfile
root=Path(__file__).parent
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=b.new_page(viewport={'width':1100,'height':900},accept_downloads=True)
    errors=[];requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:requests.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((root/'index.html').read_text());page.wait_for_function("document.querySelector('#status').textContent==='解析完了'")
    print('sample',page.locator('#mix').inner_text(),page.locator('#worst').inner_text())
    assert page.locator('#base').inner_text()=='-120.00 dB'
    page.screenshot(path=str(root/'desktop.png'),full_page=True)
    with page.expect_download() as d:page.click('#wav')
    with wave.open(str(d.value.path()),'rb') as w:assert (w.getnchannels(),w.getframerate(),w.getnframes())==(1,8000,32000)
    with page.expect_download() as d:page.click('#csv')
    assert len(Path(d.value.path()).read_text().splitlines())==5
    page.click('#listenMix');assert page.locator('#player').get_attribute('src').startswith('blob:')
    page.locator('#bias').fill('0');assert page.locator('#wav').is_disabled();page.click('#run');assert page.locator('#mix').inner_text()=='50:50'
    f=io.BytesIO()
    with wave.open(f,'wb') as w:w.setparams((2,2,8000,0,'NONE',''));w.writeframes(struct.pack('<hh',1000,1000)*8000)
    page.locator('#file').set_input_files({'name':'test.wav','mimeType':'audio/wav','buffer':f.getvalue()});page.wait_for_function("document.querySelector('#source').textContent.includes('ローカル音源')")
    assert page.locator('#base').inner_text()=='0.00 dB'
    page.locator('#file').set_input_files({'name':'bad.wav','mimeType':'audio/wav','buffer':b'bad'});page.wait_for_function("document.querySelector('#status').textContent.includes('RIFF')");assert page.locator('#wav').is_disabled()
    page.locator('#bias').fill('30');page.click('#demo');page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.screenshot(path=str(root/'mobile.png'),full_page=True)
    assert not errors and not requests,(errors,requests)
    b.close();print('browser PASS: WAV input/output, CSV, preview URL, invalid input, stale results, 390px, no HTTP or JS errors')
