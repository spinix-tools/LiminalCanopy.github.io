import importlib.util
spec=importlib.util.spec_from_file_location("jt","browser_test.py")
jt=importlib.util.module_from_spec(spec);spec.loader.exec_module(jt)
from playwright.sync_api import sync_playwright
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True,executable_path="/usr/bin/chromium",args=["--no-sandbox","--disable-dev-shm-usage"])
 p=b.new_page(accept_downloads=True)
 p.set_content(jt.inline_html(),wait_until="load")
 p.locator('#file').set_input_files({"name":"input.srt","mimeType":"text/plain","buffer":"1\n00:00:00,000 --> 00:00:03,000\nテストです".encode()})
 assert p.locator("#mCount").inner_text()=="1"
 print("file import",p.locator("#previewText").inner_text())
 with p.expect_download() as di: p.locator("#exportSrt").click()
 print("export srt",di.value.suggested_filename)
 with p.expect_download() as dj: p.locator("#saveProject").click()
 print("export json",dj.value.suggested_filename)
 p.locator("#projectFile").set_input_files({"name":"data.json","mimeType":"application/json","buffer":b'{"cues":[{"id":1,"start":0,"end":1200,"text":"Imported JSON"}]}'})
 assert p.locator("#previewText").inner_text()=="Imported JSON"
 print("json restore OK")
 b.close()
