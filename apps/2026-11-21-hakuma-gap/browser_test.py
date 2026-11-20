"""Smoke test the actual index.html in Chromium. Run: python browser_test.py"""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
checks = 0

def check(condition, message):
    global checks
    assert condition, message
    checks += 1

with sync_playwright() as p:
    chromium = p.chromium.launch(
        headless=True,
        executable_path="/usr/bin/chromium",
        args=["--no-sandbox", "--disable-dev-shm-usage", "--autoplay-policy=no-user-gesture-required"])
    page = chromium.new_page(viewport={"width": 1440, "height": 960}, accept_downloads=True)
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto((ROOT / "index.html").as_uri())
    check("拍間 GAP" in page.title(), "page title")
    check(page.locator("#start").is_enabled(), "start enabled")
    check(page.locator("#tap").is_disabled(), "tap disabled before session")
    check(page.locator("#rate").inner_text() == "—", "result starts blank")
    page.locator("#demo").click()
    check(page.locator("#rate").inner_text().endswith("%"), "demo scoring")
    check("無音" in page.locator("#groups").inner_text(), "phase breakdown")
    check(page.locator("#graph svg circle").count() > 2, "plotted results")
    check(page.locator("#exportCsv").is_enabled(), "CSV enabled")
    check(page.locator("#exportJson").is_enabled(), "JSON enabled")
    with page.expect_download() as download:
        page.locator("#exportCsv").click()
    check(download.value.suggested_filename.endswith(".csv"), "CSV downloaded")
    with page.expect_download() as download:
        page.locator("#exportJson").click()
    check(download.value.suggested_filename.endswith(".json"), "JSON downloaded")
    page.locator("#bpm").fill("110")
    page.locator("#bpm").dispatch_event("change")
    check(page.locator("#bpm").input_value() == "110", "BPM editing")
    page.reload()
    check(page.locator("#bpm").input_value() == "110", "settings persist")
    check(page.locator("#rate").inner_text().endswith("%"), "session persists")
    sample = json.dumps({"app": "hakuma-gap", "version": 1,
        "config": {"bpm": 120, "meter": 3, "hearBars": 1, "muteBars": 1, "rounds": 1, "latency": 0},
        "taps": [1500, 2000, 2500, 3000, 3500, 4000]})
    page.locator("#importJson").set_input_files({"name":"test.json","mimeType":"application/json","buffer":sample.encode()})
    check("成功" in page.locator("#status").inner_text(), "session import")
    page.locator("#start").click()
    page.wait_for_timeout(260)
    check(page.locator("#tap").is_enabled(), "live tap enabled")
    page.locator("#tap").click()
    page.locator("#stop").click()
    check("途中終了" in page.locator("#status").inner_text(), "safe early stop")
    page.locator("#clear").click()
    check(page.locator("#rate").inner_text() == "—", "clear report")
    check(not errors, "no uncaught JS errors: " + str(errors))
    page.locator("#demo").click()
    page.screenshot(path=str(ROOT/"desktop.png"), full_page=True)
    page.set_viewport_size({"width":390,"height":844})
    page.screenshot(path=str(ROOT/"mobile.png"), full_page=True)
    check(page.locator("#start").is_visible(), "responsive mobile")
    chromium.close()

print(f"Browser assertions: {checks}/{checks} passed")
