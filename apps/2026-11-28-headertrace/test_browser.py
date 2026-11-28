from pathlib import Path
import json
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).parent
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1200, 'height': 1000}, accept_downloads=True)
    errors, requests = [], []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('request', lambda r: requests.append(r.url) if r.url.startswith(('http:', 'https:')) else None)
    page.set_content((ROOT/'index.html').read_text())
    assert page.locator('#stats b').all_text_contents() == ['4','4','1']
    page.locator('#rows button').filter(has_text='e1').click()
    assert page.locator('#viewA th.ref').all_text_contents() == ['2026年','上期','東']
    assert page.locator('#viewB th.ref').all_text_contents() == ['2026年','後半','東']
    page.select_option('#filter','issue')
    assert page.locator('#rows button').all_text_contents() == ['w1']
    with page.expect_download() as d:
        page.click('#export')
    rows=json.loads(d.value.path().read_text())['rows']
    assert len(rows)==4 and rows[2]['after']['issues']==['ID不在: missing']
    page.screenshot(path=str(ROOT/'desktop.png'),full_page=True)
    page.click('#reset')
    page.fill('#after', '<table><tr><td>no id</td></tr></table>')
    assert page.locator('#results').is_hidden() and page.locator('#export').is_disabled()
    page.click('#run'); assert '安定id' in page.locator('#status').inner_text()
    cases=page.evaluate('''()=>{
      const tab=(body)=>'<table><tr>'+body+'</tr></table>';
      const h='<th id="h">A</th>', d='<td id="d" headers="h">1</td>';
      const a=parse(tab(h+d));const checks=[];
      const test=(n,ok)=>checks.push([n,Boolean(ok)]);
      test('same',compare(a,a)[0].changes.length===0);
      test('changed text',compare(a,parse(tab(h.replace('A','B')+d)))[0].changes.includes('見出し文言変更: h'));
      test('duplicate id',parse(tab(h+h+d)).data.get('d').issues.includes('ID重複: h'));
      test('non-th',parse(tab('<td id="h">A</td>'+d)).data.get('d').issues.includes('同じ表のthではない: h'));
      test('missing',parse(tab(d)).data.get('d').issues.includes('ID不在: h'));
      test('empty',parse(tab(h+d.replace('headers="h"','headers=""'))).data.get('d').issues.includes('明示参照なし'));
      test('duplicate token',parse(tab(h+d.replace('headers="h"','headers="h h"'))).data.get('d').issues.includes('重複トークン: h'));
      test('deleted',compare(a,parse(tab(h)))[0].changes[0]==='削除');
      test('added',compare(parse(tab(h)),a)[0].changes[0]==='追加');
      test('order',compare(parse(tab(h+'<th id="j">J</th>'+d.replace('headers="h"','headers="h j"'))),parse(tab(h+'<th id="j">J</th>'+d.replace('headers="h"','headers="j h"'))))[0].changes.join()==='headers列変更');
      test('same table',parse('<div id="h">A</div>'+tab(d)).data.get('d').issues.includes('同じ表のthではない: h'));
      test('500 cells',parse('<table>'+Array.from({length:5},(_,r)=>'<tr>'+Array.from({length:100},(_,i)=>`<td id="d${r}-${i}">x</td>`).join('')+'</tr>').join('')+'</table>').data.size===500);
      return checks;
    }''')
    assert all(v for _,v in cases),cases
    page.fill('#after','<table><tr><th id="h"><img src="https://example.invalid/a" onerror="window.BAD=1">見出し</th><td id="d" headers="h"><script>window.BAD=1</script>値</td></tr></table>')
    page.click('#run'); assert page.evaluate('window.BAD===undefined')
    assert not requests and not errors,(requests,errors)
    page.click('#reset'); page.set_viewport_size({'width':390,'height':844})
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.screenshot(path=str(ROOT/'mobile.png'),full_page=True)
    browser.close()
print(f'PASS: {len(cases)} fixed checks; sample, highlight, filter, download, invalidation, invalid HTML, inert content, mobile; errors={len(errors)}, HTTP requests={len(requests)}')
