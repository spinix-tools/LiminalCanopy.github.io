from pathlib import Path
from playwright.sync_api import sync_playwright
import json
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=b.new_page(viewport={'width':1100,'height':1050},accept_downloads=True)
    errors=[]; requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:requests.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.set_content(Path(__file__).with_name('index.html').read_text())
    assert [page.locator('#'+x).inner_text() for x in ['refs','passed','count']]==['3','1','3']
    page.screenshot(path=str(Path(__file__).with_name('desktop.png')),full_page=True)
    with page.expect_download() as dl: page.locator('#download').click()
    data=json.loads(Path(dl.value.path()).read_text()); assert data['passed']==1 and {i['code'] for i in data['issues']}=={'MISSING_ID','NO_RETURN','ORPHAN_NOTE'}
    page.locator('#list').select_option('Notes/end.xhtml')
    s=page.locator('#source').input_value().replace('</p>','<a href="../Text/ch1.xhtml#r2">戻る2</a></p>')
    page.locator('#source').fill(s); assert page.locator('#download').is_disabled()
    page.locator('#run').click(); assert page.locator('#passed').inner_text()=='—'
    page.locator('#save').click(); page.locator('#run').click(); assert page.locator('#passed').inner_text()=='2'
    cases=page.evaluate('''() => {const h=s=>'<html xmlns="http://www.w3.org/1999/xhtml">'+s+'</html>';const a=(s)=>audit(new Map([['a.xhtml',h(s)]]));const ref='<a id="r" role="doc-noteref" href="#n">1</a>';const note='<aside id="n" role="doc-footnote"><a href="#r">back</a></aside>';const check=(r,c)=>r.issues.some(i=>i.code===c);return [a(ref+note).passed===1,a(ref+note).issues.length===0,check(a(ref+note+note),'DUPLICATE_ID'),check(a(ref+note+note),'AMBIGUOUS_ID'),check(a(ref+'<p id="n"/>'),'NOT_A_NOTE'),check(a(ref.replace('#n','b.xhtml#n')),'FILE_UNAVAILABLE'),check(a(ref.replace('#n','https://x.test/#n')),'UNSUPPORTED_LINK'),check(a(ref.replace('id="r"','')+note),'REF_ID_REQUIRED'),check(a(ref+note.replace('href="#r"','href="#n" role="doc-backlink"')),'WRONG_BACKLINK'),check(a('<p xml:base="x/"/>'),'UNSUPPORTED_BASE'),check(audit(new Map([['a.xhtml','<html>']])),'BAD_XML'),check(audit(new Map([['a.xhtml','<!DOCTYPE html><html/>']])),'UNSUPPORTED_XML'),target('Text/a.xhtml','../Notes/%E6%B3%A8.xhtml#%E7%94%B2').id==='甲',target('Text/a.xhtml','../Notes/%E6%B3%A8.xhtml#%E7%94%B2').path==='Notes/注.xhtml',target('a.xhtml','//evil.test/#x')===null,a(ref+'<aside role="doc-footnote"><p id="n"/><a href="#r">b</a></aside>').passed===1]}''')
    assert all(cases),cases
    page.locator('#sample').click(); page.locator('#run').click(); page.set_viewport_size({'width':390,'height':844}); page.screenshot(path=str(Path(__file__).with_name('mobile.png')),full_page=True)
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    assert not errors and not requests,(errors,requests)
    print(f'{len(cases)}/{len(cases)} core assertions; browser sample, edit, stale result, export, 390px, no JS errors or HTTP requests: PASS')
    b.close()
