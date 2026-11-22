"""End-to-end browser tests for exact split source served from local HTTP server."""
import asyncio, json
from pathlib import Path
from playwright.async_api import async_playwright

ROOT=Path(__file__).parent
def inline_source():
 html=(ROOT/'index.html').read_text('utf-8')
 css=(ROOT/'style.css').read_text('utf-8')
 engine=(ROOT/'engine.js').read_text('utf-8')
 app=(ROOT/'app.js').read_text('utf-8')
 return (html.replace('<link rel="stylesheet" href="style.css">',f'<style>{css}</style>')
             .replace('<script src="engine.js"></script>',f'<script>{engine}</script>')
             .replace('<script src="app.js" defer></script>',f'<script>{app}</script>'))
async def run():
 source=inline_source()
 count=0; console_errors=[]; external=[]
 async def ck(pred,msg):
  nonlocal count
  assert pred,msg
  count+=1
  print(f'PASS {count}: {msg}')
 try:
  async with async_playwright() as p:
   browser=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
   context=await browser.new_context(accept_downloads=True,viewport={'width':1440,'height':980},device_scale_factor=1)
   page=await context.new_page()
   page.on('pageerror',lambda x:console_errors.append(str(x)))
   page.on('request',lambda req:external.append(req.url))
   await page.goto('about:blank')
   await page.evaluate('''() => {const data={};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>data[k]??null,setItem:(k,v)=>data[k]=String(v),removeItem:k=>delete data[k]}})}''')
   await page.set_content(source,wait_until='load')
   await ck(await page.title()=='棚じまい — 委託精算の前に、数を合わせる。','page loads title')
   await ck(await page.locator('#itemsBody tr').count()==6,'6 sample items')
   await ck(await page.locator('#mProblems').inner_text()=='1','sample discrepancy detected')
   await ck(await page.locator('#consignors .vendor-card').count()==3,'3 consignor cards')
   await ck(await page.locator('#consignors .status-pill.hold').count()==1,'only affected consignor held')
   await ck(await page.locator('#mSales').inner_text()=='¥28,550','sample gross amount matches expected')
   await ck(await page.locator('#mPayout').inner_text()=='¥22,905','sample settlement matches expected')
   await page.screenshot(path=str(ROOT/'desktop.png'),full_page=True)
   # Fix first discrepancy via direct edit.
   await page.locator('input[data-index="1"][data-field="onHand"]').fill('1')
   await page.locator('input[data-index="1"][data-field="onHand"]').press('Tab')
   await ck(await page.locator('#mProblems').inner_text()=='0','editing inventory reconciles shortage')
   await ck(await page.locator('#consignors .status-pill.hold').count()==0,'all consignors ready when rows match')
   # Modify sold, infer from remaining and confirm.
   await page.locator('input[data-index="0"][data-field="sold"]').fill('4')
   await page.locator('input[data-index="0"][data-field="sold"]').press('Tab')
   await ck(await page.locator('#mProblems').inner_text()=='1','new mismatch flagged')
   page.once('dialog',lambda d:asyncio.create_task(d.accept()))
   await page.locator('button[data-index="0"][data-action="suggest"]').click()
   await ck(await page.locator('input[data-index="0"][data-field="sold"]').input_value()=='9','explicit sold inference can apply')
   await ck(await page.locator('#mProblems').inner_text()=='0','infer resolves mismatch')
   # Add delete row
   await page.locator('#addBtn').click()
   await ck(await page.locator('#itemsBody tr').count()==7,'add row')
   await ck(await page.locator('#consignors .vendor-card').count()==4,'new consignor card')
   page.once('dialog',lambda d:asyncio.create_task(d.accept()))
   await page.locator('button[data-index="6"][data-action="remove"]').click()
   await ck(await page.locator('#itemsBody tr').count()==6,'delete row')
   # CSV downloads and escaping
   async with page.expect_download() as d:
    await page.locator('#csvBtn').click()
   dl=await d.value; csv=(await dl.path()).read_text(encoding='utf-8-sig')
   await ck('灯台文庫' in csv and '栞セット' in csv,'CSV contains details')
   await ck(csv.startswith('委託元,商品,SKU'),'CSV has stable header')
   async with page.expect_download() as d: await page.locator('#statementBtn').click()
   dl=await d.value; payout_csv=(await dl.path()).read_text(encoding='utf-8-sig')
   await ck('照合済（支払候補）' in payout_csv,'settlement CSV has status')
   async with page.expect_download() as d: await page.locator('#jsonBtn').click()
   dl=await d.value; backup=json.loads((await dl.path()).read_text('utf-8'))
   await ck(len(backup['items'])==6 and backup['format']=='tanajimai-v1','JSON export preserves state')
   # storage + reload
   await page.set_content(source,wait_until='load')
   await ck(await page.locator('#mProblems').inner_text()=='0','browser storage persists edits')
   # empty, restore
   page.once('dialog',lambda d:asyncio.create_task(d.accept()))
   await page.locator('#newBtn').click()
   await ck(await page.locator('#itemsBody tr').count()==0,'clear board creates empty view')
   await ck(await page.locator('#empty').is_visible(),'empty state visible')
   importfile=ROOT/'fixture-import.json';importfile.write_text(json.dumps(backup,ensure_ascii=False),encoding='utf-8')
   page.once('dialog',lambda d:asyncio.create_task(d.accept()))
   await page.locator('#importInput').set_input_files(str(importfile))
   await ck(await page.locator('#itemsBody tr').count()==6,'import restores items')
   await ck(await page.locator('#mProblems').inner_text()=='0','import restores prior reconciliation')
   # XSS: direct user text stays plain DOM text
   await page.locator('input[data-index="0"][data-field="consignor"]').fill('<img src=x onerror=alert(1)>')
   await page.locator('input[data-index="0"][data-field="consignor"]').press('Tab')
   await ck(await page.locator('#consignors img').count()==0,'input cannot inject HTML')
   await ck(len(console_errors)==0,'no uncaught JS exceptions')
   await ck(len(external)==0,'no external network requests')
   await context.close()
   mobile=await browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True)
   mpage=await mobile.new_page();await mpage.set_content(source,wait_until='load')
   await ck(await mpage.locator('#addBtn').is_visible(),'mobile controls visible')
   await ck(await mpage.locator('#mItems').inner_text()=='6','mobile data loads')
   await mpage.screenshot(path=str(ROOT/'mobile.png'),full_page=True)
   await browser.close()
  print(f'BROWSER SUCCESS: {count}/{count} checks')
 finally:
  pass

if __name__=='__main__': asyncio.run(run())
