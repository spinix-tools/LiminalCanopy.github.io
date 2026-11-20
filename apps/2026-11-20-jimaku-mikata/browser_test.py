from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).parent
def inline_html():
    content=(ROOT/"index.html").read_text()
    content=content.replace('<link rel="stylesheet" href="style.css">',"<style>"+(ROOT/"style.css").read_text()+"</style>")
    content=content.replace('<script src="engine.js"></script>',"<script>"+(ROOT/"engine.js").read_text()+"</script>")
    content=content.replace('<script src="app.js"></script>',"<script>"+(ROOT/"app.js").read_text()+"</script>")
    return content
def test():
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,executable_path="/usr/bin/chromium",args=["--no-sandbox","--disable-dev-shm-usage"])
        page=browser.new_page(viewport={"width":1440,"height":980},device_scale_factor=1)
        errors=[]
        page.on("pageerror",lambda err:errors.append(str(err)))
        page.set_content(inline_html(),wait_until="load")
        page.locator("#mCount").wait_for()
        assert page.locator("#mCount").inner_text()=="5"
        assert page.locator("#mBad").inner_text()!="0"
        assert page.locator(".cue").count()==5
        page.locator("#draft").click()
        assert "修正" in page.locator("#status").inner_text()
        assert page.locator(".compare-tile").count()==2
        assert page.locator("#undo").is_enabled()
        page.locator("#undo").click()
        assert page.locator("#mCount").inner_text()=="5"
        page.locator("#preset").select_option("research")
        assert page.locator("#cps").input_value()=="6"
        page.locator("#aspect").select_option("vertical")
        assert "vertical" in page.locator("#preview").get_attribute("class")
        page.locator("#filter").select_option("bad")
        assert page.locator(".cue").count()>=1
        page.locator("#filter").select_option("all")
        page.locator(".cue").nth(1).click()
        page.locator("#editStart").fill("00:00:03,100")
        page.locator("#editText").fill("短く読みやすい字幕に直しました。")
        page.locator("#lock").check()
        page.locator("#apply").click()
        assert page.locator("#previewText").inner_text()=="短く読みやすい字幕に直しました。"
        assert "固定" in page.locator(".cue.active").inner_text()
        page.locator("#revert").click()
        assert "参加した方々" in page.locator(".cue").nth(1).inner_text()
        page.locator("#raw").fill("1\n00:00:00,000 --> 00:00:02,000\nテストの字幕です")
        page.locator("#load").click()
        assert page.locator("#mCount").inner_text()=="1"
        assert page.locator("#previewText").inner_text()=="テストの字幕です"
        page.locator("#sample").click()
        assert page.locator("#mCount").inner_text()=="5"
        page.screenshot(path=str(ROOT/"desktop.png"),full_page=True)
        mobile=browser.new_page(viewport={"width":390,"height":844},device_scale_factor=1)
        mobile.set_content(inline_html(),wait_until="load")
        mobile.locator("#mCount").wait_for()
        mobile.screenshot(path=str(ROOT/"mobile.png"),full_page=True)
        assert mobile.evaluate("document.documentElement.scrollWidth <= window.innerWidth+2"),"mobile overflow"
        assert errors==[],errors
        print("Browser pass: 19 key interactions + no JS errors + no mobile overflow")
        browser.close()
if __name__=="__main__":test()
