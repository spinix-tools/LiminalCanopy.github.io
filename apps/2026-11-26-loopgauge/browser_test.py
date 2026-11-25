from pathlib import Path
from playwright.sync_api import sync_playwright
import wave
root=Path(__file__).parent
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
    page=b.new_page(viewport={'width':1080,'height':1050},accept_downloads=True)
    errors=[]; requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:requests.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content((root/'index.html').read_text())
    assert page.locator('#result').is_visible()
    assert float(page.locator('#after').inner_text())<float(page.locator('#before').inner_text())
    page.screenshot(path=str(root/'desktop.png'),full_page=True)
    page.locator('#candidates button').nth(1).click()
    assert page.locator('#delta').inner_text()=='69 fr'
    page.locator('#playA').click();page.wait_for_function("!document.querySelector('audio').paused")
    page.locator('#playB').click();page.wait_for_function("!document.querySelector('audio').paused")
    with page.expect_download() as d:page.locator('#save').click()
    data=Path(d.value.path()).read_bytes()
    with wave.open(str(d.value.path()),'rb') as w:assert (w.getnchannels(),w.getframerate(),w.getnframes())==(2,16000,20800)
    page.locator('#file').set_input_files({'name':'test.wav','mimeType':'audio/wav','buffer':data})
    page.wait_for_function("document.querySelector('#info').textContent.includes('20800 frames')")
    page.locator('#len').fill('2');assert not page.locator('#result').is_visible();page.locator('#run').click();assert page.locator('#error').inner_text()
    page.locator('#file').set_input_files({'name':'bad.wav','mimeType':'audio/wav','buffer':b'bad'})
    page.wait_for_function("document.querySelector('#error').textContent.includes('RIFF')")
    page.locator('#demo').click();assert page.locator('#result').is_visible()
    page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.screenshot(path=str(root/'mobile.png'),full_page=True)
    assert not errors,errors;assert not requests,requests
    b.close()
print('Chromium: demo, candidate, playback state A/B, WAV download/reimport, invalid inputs, 390px, zero page errors/HTTP requests passed')
