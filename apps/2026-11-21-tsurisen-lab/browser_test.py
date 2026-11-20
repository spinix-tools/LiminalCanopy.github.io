"""Run: python browser_test.py (requires playwright and Chromium). Managed Chromium blocks URL navigation: test concatenates the exact shipped CSS/JS into the page. Persistence is not tested."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json

ROOT=Path(__file__).resolve().parent
def local_html():
 html=(ROOT/'index.html').read_text('utf-8')
 html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+ (ROOT/'style.css').read_text('utf-8') + '</style>')
 html=html.replace('<script src="engine.js"></script>','<script>'+ (ROOT/'engine.js').read_text('utf-8') + '</script>')
 html=html.replace('<script src="app.js"></script>','<script>'+ (ROOT/'app.js').read_text('utf-8') + '</script>')
 return html

check=0

def ok(cond,msg):
 global check
 assert cond,msg
 check+=1

def run():
 global check
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  ctx=browser.new_context(viewport={'width':1360,'height':900},accept_downloads=True)
  page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content(local_html(),wait_until='load')
  ok(page.title()=='釣銭設計室｜TSURISEN LAB','title')
  ok(page.locator('.item').count()==3,'default products')
  ok(page.locator('#money-rows tr').count()==10,'ten denominations')
  ok(page.locator('#initial-total').inner_text()!='0円','cash total')
  ok(page.locator('#weight-sum').inner_text()=='合計 100%','weight sum')
  page.locator('#run').click();ok(page.locator('.stat').count()==2,'comparison cards')
  ok('200回' in page.locator('#status').inner_text(),'number of trials')
  ok(page.locator('.trace-item').count()==20,'trace first 20')
  page.screenshot(path=str(ROOT/'desktop.png'),full_page=True)
  page.locator('#add-item').click();ok(page.locator('.item').count()==4,'add product')
  page.locator('.item').last.locator('.item-name').fill('手編み\"バッグ')
  page.locator('.item').last.locator('.item-price').fill('450')
  page.locator('.item').last.locator('.item-qty').fill('9')
  ok(page.locator('.item').last.locator('.item-name').input_value()=='手編み\"バッグ','edit and XSS escape')
  page.locator('.item').last.locator('.item-remove').click();ok(page.locator('.item').count()==3,'remove product')
  page.locator('#weights [data-weight=exact]').fill('10');ok('75%' in page.locator('#weight-sum').inner_text(),'invalid weight total visible')
  page.locator('#run').click();ok('100%' in page.locator('#status').inner_text(),'error notice')
  page.locator('#weights [data-weight=exact]').fill('35')
  page.locator('#budget').fill('3000');page.locator('#suggest').click();ok('比較案に' in page.locator('#status').inner_text(),'suggestion displayed')
  page.locator('#trials').select_option('40');page.locator('#run').click()
  ok('40回' in page.locator('#status').inner_text(),'trial switching')
  with page.expect_download() as d:page.locator('#export-json').click()
  f=d.value;ok(f.suggested_filename=='tsurisen-plan.json','json filename')
  tmp=ROOT/'test-export.json';f.save_as(str(tmp));doc=json.loads(tmp.read_text('utf-8'))
  ok(len(doc['items'])==3,'json content')
  with page.expect_download() as d:page.locator('#export-csv').click()
  ok(d.value.suggested_filename=='tsurisen-preparation.csv','csv filename')
  # About:blank has no persistent localStorage in managed Chromium; do not claim persistence was verified.
  page.set_content(local_html(),wait_until='load');ok(page.locator('#trials').input_value()=='200','fresh load defaults')
  page.locator('#reset').click();ok(page.locator('#trials').input_value()=='200','reset')
  page.locator('#file-input').set_input_files(str(tmp));ok('読み込みました' in page.locator('#status').inner_text(),'json import')
  ok(page.locator('#trials').input_value()=='40','imported data restored')
  ok(not errors,'js exceptions '+str(errors))
  mobile=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1,accept_downloads=True)
  mp=mobile.new_page();mp.set_content(local_html(),wait_until='load');mp.locator('#trials').select_option('40');mp.locator('#run').click()
  ok(mp.locator('.stat').count()==2,'mobile result')
  ok(mp.evaluate('document.documentElement.scrollWidth <= window.innerWidth+1'),'no horizontal page overflow')
  mp.screenshot(path=str(ROOT/'mobile.png'),full_page=True)
  print(f'BROWSER_CHECKS: {check} passed')
  browser.close()

if __name__=='__main__':run()