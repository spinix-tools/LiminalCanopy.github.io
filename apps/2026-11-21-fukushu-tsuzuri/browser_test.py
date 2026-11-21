"""Chromium DOM interaction tests. Direct file:// is blocked by this managed environment;
inline source copies are used to exercise the identical JS/CSS in an about:blank page."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json
root = Path(__file__).parent
html = (root/'index.html').read_text()
css = (root/'style.css').read_text()
engine = (root/'engine.js').read_text()
app = (root/'app.js').read_text()
html=html.replace('<link rel="stylesheet" href="style.css">', '<style>'+css+'</style>')
html=html.replace('<script src="engine.js"></script>','<script>'+engine+'</script>').replace('<script src="app.js"></script>','<script>'+app+'</script>')
checks=[]
def ok(name, assertion):
    assert assertion, name
    checks.append(name)
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={"width":1366,"height":900},accept_downloads=True)
    errors=[];requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda q:requests.append(q.url))
    page.set_content(html,wait_until='load')
    ok('title',page.title().startswith('復習つづり'))
    ok('sample bank 10',page.locator('.bankitem').count()==10)
    ok('generated six',page.locator('.question').count()==6)
    ok('topics 3',page.locator('.topic-check').count()==3)
    ok('feedback six',page.locator('.feedback-row').count()==6)
    ok('no exceptions',not errors)
    ok('no external network',not requests)
    page.locator('#count').fill('4'); page.locator('#count').dispatch_event('change')
    ok('count edited',page.locator('.question').count()==4)
    page.locator('#minutes').fill('1');page.locator('#minutes').dispatch_event('change')
    ok('time cap',float(page.evaluate('window.fukushuDebug.getState().planIds.map(id=>window.fukushuDebug.getState().bank.find(x=>x.id===id).seconds).reduce((a,b)=>a+b,0)'))<=60)
    ok('warning when too short',page.locator('#warning').is_visible())
    page.locator('#minutes').fill('12');page.locator('#minutes').dispatch_event('change')
    ok('count restored',page.locator('.question').count()==4)
    # Empty topics stays empty.
    for x in page.locator('.topic-check').all():x.uncheck()
    ok('none selected means none',page.locator('.question').count()==0)
    page.locator('.topic-check').first.check()
    ok('one topic',page.locator('.question').count()>0)
    # CRUD: add question
    page.locator('#topic').fill('英語');page.locator('#prompt').fill('The past of go?');page.locator('#answer').fill('went');
    page.locator('#seconds').fill('55');page.locator('#save-question').click()
    ok('question added',len(page.evaluate('window.fukushuDebug.getState().bank'))==11)
    ok('new topic checked',page.locator('.topic-check').count()==4)
    page.locator('#search').fill('The past of go?')
    ok('search',page.locator('.bankitem').count()==1)
    page.locator('[data-edit]').last.click()
    ok('edit form populated',page.locator('#prompt').input_value()=='The past of go?')
    page.locator('#prompt').fill('The past form of go?');page.locator('#save-question').click()
    ok('edit persisted','The past form' in page.evaluate('window.fukushuDebug.getState().bank.at(-1).prompt'))
    page.locator('#search').fill('The past form')
    page.locator('[data-remove]').last.click()
    ok('delete works',len(page.evaluate('window.fukushuDebug.getState().bank'))==10)
    # Restore all filters, gather feedback
    page.locator('#search').fill('')
    for x in page.locator('.topic-check').all():
        if not x.is_checked(): x.check()
    page.locator('.attempt-count').first.fill('30')
    page.locator('.correct-count').first.fill('18')
    before=page.evaluate('window.fukushuDebug.getState()')
    tracked=before['planIds'][0];prior=next(x for x in before['bank'] if x['id']==tracked)
    page.locator('#save-feedback').click()
    after=page.evaluate('window.fukushuDebug.getState()')
    updated=next(x for x in after['bank'] if x['id']==tracked)
    ok('aggregate attempts',updated['attempts']==prior['attempts']+30)
    ok('aggregate correct',updated['correct']==prior['correct']+18)
    # Error handling: valid rows cannot be committed if one has invalid counts
    page.locator('.attempt-count').first.fill('3');page.locator('.correct-count').first.fill('10')
    before=page.evaluate('JSON.stringify(window.fukushuDebug.getState().bank)')
    page.locator('#save-feedback').click()
    ok('invalid feedback atomic',before==page.evaluate('JSON.stringify(window.fukushuDebug.getState().bank)'))
    # Exports
    for id in ['export-json','export-csv','plan-csv']:
        with page.expect_download() as e: page.locator('#'+id).click()
        ok('download '+id,e.value.suggested_filename.endswith('.json' if id=='export-json' else '.csv'))
    # Print test stub
    page.evaluate('window.print=()=>{ window.__printed=(window.__printed||0)+1 }')
    page.locator('#print-questions').click()
    ok('question print',page.evaluate('window.__printed')>=1 and 'なまえ' in page.locator('#print-area').inner_html())
    was=page.evaluate('window.__printed')
    page.locator('#print-answers').click()
    ok('answer print',page.evaluate('window.__printed')>was and '正答' in page.locator('#print-area').inner_html())
    # Import fixture via file chooser
    imported={'version':1,'bank':[{'id':'x','topic':'歴史','prompt':'鎌倉幕府は何時代？','answer':'鎌倉時代','seconds':80,'difficulty':1,'attempts':0,'correct':0,'lastUsed':''}],'chosenTopics':['歴史'],'planIds':['x'],'asOf':'2026-11-21','count':1,'minutes':3}
    page.locator('#import-json').set_input_files({'name':'import.json','mimeType':'application/json','buffer':json.dumps(imported,ensure_ascii=False).encode()})
    page.wait_for_function('window.fukushuDebug.getState().bank.length===1')
    ok('json import',page.locator('.bankitem').count()==1)
    ok('imported question displayed',page.locator('.question').count()==1)
    page.locator('#import-json').set_input_files({'name':'invalid.json','mimeType':'application/json','buffer':b'{oops'})
    ok('invalid json does not overwrite',page.locator('.bankitem').count()==1)
    page.on('dialog',lambda d:d.accept())
    page.locator('#reset-demo').click()
    ok('reset demo',page.locator('.bankitem').count()==10)
    ok('reset settings',page.locator('#count').input_value()=='6' and page.locator('#minutes').input_value()=='10')
    page.screenshot(path=str(root/'desktop.png'),full_page=True)
    page.set_viewport_size({'width':390,'height':844});page.screenshot(path=str(root/'mobile.png'),full_page=True)
    ok('mobile no horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
    ok('no JS exceptions at end',not errors)
    ok('no outbound calls at end',not requests)
    browser.close()
print('Chromium checks:',len(checks),'PASS')
for i,c in enumerate(checks,1):print(f'{i:02d}. {c}')
