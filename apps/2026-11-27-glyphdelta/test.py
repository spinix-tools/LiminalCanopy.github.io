"""Node + FontTools cmap comparison and Chromium UI smoke test (local only)."""
import json, re, subprocess, tempfile
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools import subset
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent
html=(root/'index.html').read_text()
core=re.search(r'<script id="core">(.*?)</script>',html,re.S)[1]
fonts=[Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'),Path('/usr/share/fonts/truetype/lato/Lato-Regular.ttf'),Path('/usr/share/fonts/opentype/inter/Inter-Regular.otf')]
assert all(f.exists() for f in fonts), fonts
with tempfile.TemporaryDirectory() as td:
    tmp=Path(td)
    js=tmp/'check.js'
    js.write_text(core+'''\nconst fs=require('fs'),assert=require('assert/strict');
const source=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
for(const row of source){const b=fs.readFileSync(row.file),f=fontCoverage(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));const set=new Set(row.codes);for(let c=0;c<=0x10ffff;c++)assert.equal(f.has(c),set.has(c),row.file+':'+c);console.log('format',f.format,'codepoints',set.size,'matched');}
const f=s=>({has:c=>s.includes(String.fromCodePoint(c))});let r=audit('one\\tAA髙😀\\ntwo\\t髙B',f('A髙😀'),f('AB😀'));assert.equal(r.pages[0].lost,1);assert.equal(r.pages[1].gained,1);assert.equal(r.rows.find(x=>x.ch==='髙').count,2);assert.equal(r.rows.find(x=>x.ch==='😀').state,'kept');assert.throws(()=>audit('bad',f(''),f('')));assert.throws(()=>audit('a\\tA\\na\\tB',f(''),f('')));assert.throws(()=>fontCoverage(new ArrayBuffer(10)));assert.equal(audit('a\\tA\\uFE0F B',f('A'),f('B')).skipped,2);console.log('8 fixed assertions passed');''')
    src=[]
    for file in fonts:
        font=TTFont(file); src.append(dict(file=str(file),codes=[c for c,g in font.getBestCmap().items() if font.getGlyphID(g)!=0]));font.close()
    (tmp/'ref.json').write_text(json.dumps(src))
    subprocess.run(['node',str(js),str(tmp/'ref.json')],check=True)
    # Create a real smaller font for browser upload, not distributed.
    old=fonts[0]; new=tmp/'subset.ttf'; font=TTFont(old); sub=subset.Subsetter();sub.populate(text='AB');sub.subset(font);font.save(new);font.close()
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
        page=browser.new_page(viewport={'width':1160,'height':900},accept_downloads=True)
        errors=[]; requests=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:requests.append(r.url))
        page.set_content(html);assert '2' in page.locator('#stats .tile').first.inner_text();assert '2/3' in page.locator('#stats').inner_text();page.screenshot(path=str(root/'desktop.png'),full_page=True)
        page.locator('#old').set_input_files(str(old));page.locator('#new').set_input_files(str(new));page.wait_for_function("document.querySelector('#oldStatus').textContent.includes('cmap') && document.querySelector('#newStatus').textContent.includes('cmap')")
        page.locator('#corpus').fill('one\tABC😀\ntwo\tAC');page.locator('#run').click();assert '2/2' in page.locator('#stats').inner_text();assert '2' in page.locator('#stats .tile').first.inner_text();page.locator('#filter').select_option('lost');assert page.locator('#chars tr').count()==2
        with page.expect_download() as d:page.locator('#export').click()
        report=json.loads(Path(d.value.path()).read_text());assert report['pages'][0]['lost']==2;assert report['pages'][1]['lost']==1
        page.locator('#corpus').fill('bad');assert page.locator('#export').is_disabled();page.locator('#run').click();assert page.locator('#error').inner_text();assert page.locator('#result').is_hidden()
        page.locator('#sample').click();page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.screenshot(path=str(root/'mobile.png'),full_page=True)
        assert not errors,errors;assert not [x for x in requests if x.startswith(('http:','https:'))],requests;browser.close();print('Chromium: sample, real TTF upload, filtering, JSON, invalidation, mobile, no page errors or HTTP requests: PASS')
