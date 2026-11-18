"""Optional browser smoke test for AMIDAN. Run: python browser_test.py (requires playwright + Chromium)."""
from pathlib import Path
from playwright.sync_api import sync_playwright

HTML = Path(__file__).with_name("index.html").read_text(encoding="utf-8")
checks = []

def check(name, value):
    checks.append(name)
    if not value:
        raise AssertionError(name)
    print("PASS", name)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path="/usr/bin/chromium",
                                args=["--no-sandbox", "--disable-dev-shm-usage"])
    page = browser.new_page(viewport={"width": 1366, "height": 900}, accept_downloads=True)
    errors = []
    page.on("pageerror", lambda err: errors.append(str(err)))
    page.evaluate("""Object.defineProperty(window,'localStorage',{configurable:true,
      value:{getItem(k){return this[k]||null},setItem(k,v){this[k]=v},
      removeItem(k){delete this[k]}}})""")
    page.set_content(HTML)
    check("no JS runtime errors", len(errors) == 0)
    check("default 44 stitches", page.locator("#stStart").inner_text() == "44目")
    check("default 74 stitches", page.locator("#stEnd").inner_text() == "74目")
    check("default 112 rows", page.locator("#totalRows").inner_text() == "112段")
    check("15 shaping events", page.locator("#events tr").count() == 15)
    check("chart rendered", page.locator("#chart svg").count() == 1)
    page.locator("#plus").click()
    check("increment row", page.locator("#currentNumber").inner_text().startswith("1 "))
    page.locator("#minus").click()
    check("decrement row", page.locator("#currentNumber").inner_text().startswith("0 "))
    page.locator("#events button").first.click()
    check("jump to completed event row", int(page.locator("#currentNumber").inner_text().split()[0]) > 0)
    page.locator("#reset").click()
    check("reset progress", page.locator("#currentNumber").inner_text().startswith("0 "))
    page.locator("#endCm").fill("20")
    page.locator("#endCm").press("Tab")
    check("equal start and end no shaping", page.locator("#eventLabel").inner_text() == "0回")
    page.locator("#endCm").fill("34")
    page.locator("#endCm").press("Tab")
    check("restored shaping", page.locator("#eventLabel").inner_text() == "15回")
    page.locator("#side").select_option("even")
    check("even shaping rows", all(int(t.split("段")[0]) % 2 == 0
          for t in page.locator("#events td:first-child").all_inner_texts()))
    page.locator("#side").select_option("odd")
    page.locator("#offset").fill("2")
    page.locator("#offset").press("Tab")
    check("invalid input shown", "余り目" in page.locator("#action").inner_text())
    page.locator("#offset").fill("0")
    page.locator("#offset").press("Tab")
    check("recovered from invalid input", page.locator("#stStart").inner_text() == "44目")
    with page.expect_download() as d1:
        page.locator("#downloadJson").click()
    check("JSON download name", d1.value.suggested_filename == "amidan-project.json")
    with page.expect_download() as d2:
        page.locator("#downloadCsv").click()
    check("CSV download name", d2.value.suggested_filename == "amidan-rows.csv")
    check("localStorage set", page.evaluate("!!localStorage.getItem('amidan-v1')"))
    page.locator("#plus").click()
    page.set_content(HTML)
    check("progress persistence", page.locator("#currentNumber").inner_text().startswith("1 "))
    mobile = browser.new_page(viewport={"width": 390, "height": 844})
    mobile.set_content(HTML)
    check("mobile no horizontal scrolling",
          mobile.evaluate("document.documentElement.scrollWidth <= innerWidth + 2"))
    check("mobile chart visible", mobile.locator("#chart svg").count() == 1)
    check("no JS errors", len(errors) == 0)
    browser.close()
print("TOTAL", len(checks), "PASS")
