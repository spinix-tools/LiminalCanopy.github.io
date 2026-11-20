"""Chromium E2E using inlined production assets (navigation blocked by environment)."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright

BASE = Path(__file__).resolve().parent
checks = []
# Chromium in this sandbox blocks file://, localhost and data: navigation.
# To exercise the exact HTML/CSS/JS while keeping the page offline, inline files
# and mock only unavailable storage in about:blank. This is NOT a direct-file test.
html = (BASE/'index.html').read_text()
css = (BASE/'style.css').read_text()
engine = (BASE/'engine.js').read_text()
app = (BASE/'app.js').read_text()
compiled = html.replace('<link rel="stylesheet" href="./style.css">',f'<style>{css}</style>').replace('<script defer src="./engine.js"></script><script defer src="./app.js"></script>','').replace('</body>', f'<script>{engine}</script><script>{app}</script></body>')
storage_mock = """Object.defineProperty(window, "localStorage", {configurable:true, value:{s:{}, getItem(k){return this.s[k] ?? null}, setItem(k,v){this.s[k]=String(v)},removeItem(k){delete this.s[k]}}})"""
def setup_page(page):
    page.evaluate(storage_mock)
    page.set_content(compiled, wait_until='load')
def check(name, condition):
    assert condition, name
    checks.append(name)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    ctx = browser.new_context(viewport={'width': 1440, 'height': 900}, accept_downloads=True, locale='ja-JP')
    page = ctx.new_page()
    page.on('dialog', lambda dialog: dialog.accept())
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    setup_page(page)
    page.wait_for_selector('.booking-card')
    check('initial HTML / JS visible',page.title().startswith('キット整列'))
    check('four sample bookings',page.locator('.booking-card').count()==4)
    check('live shortage badge',int(page.locator('#statBlocked').inner_text())>0)
    check('shortage list renders',page.locator('.shortage-table tbody tr').count()>0)
    check('no runtime error during load',not errors)
    page.screenshot(path=str(BASE/'desktop.png'),full_page=True)
    with page.expect_download() as download:
        page.get_by_role('button',name='不足表 CSV').click()
    result=download.value
    check('shortage CSV generated',result.suggested_filename.endswith('shortages.csv'))

    # Booking CRUD and overlap recalculation
    before=int(page.locator('#statBookings').inner_text())
    page.locator('#bookingTitle').fill('公民館テスト行事')
    page.locator('#bookingKit').select_option('lecture')
    page.locator('#bookingStart').fill('2026-12-11')
    page.locator('#bookingEnd').fill('2026-12-11')
    page.locator('#bookingCopies').fill('2')
    page.locator('#bookingSubmit').click()
    check('new booking added',int(page.locator('#statBookings').inner_text())==before+1)
    added=page.locator('.booking-card').filter(has_text='公民館テスト行事')
    check('new booking rendered',added.count()==1)
    check('new booking warned shortage',added.locator('.tag.warning').count()==1)
    added.get_by_role('button',name='編集').click()
    check('booking loaded for edit',page.locator('#bookingCopies').input_value()=='2')
    page.locator('#bookingCopies').fill('1')
    page.locator('#bookingSubmit').click()
    check('booking edited',page.locator('.booking-card').filter(has_text='公民館テスト行事').count()==1)
    added=page.locator('.booking-card').filter(has_text='公民館テスト行事')
    added.get_by_role('button',name='削除').click()
    check('booking removed',int(page.locator('#statBookings').inner_text())==before)

    page.get_by_role('tab',name='02 備品・キット').click()
    check('gear tab renders inventory',page.locator('.item-row').count()==6)
    page.locator('#itemName').fill('変換アダプター')
    page.locator('#itemStock').fill('4')
    page.locator('#itemUnit').fill('個')
    page.locator('#itemPlace').fill('テスト棚')
    page.locator('#itemForm button[type=submit]').click()
    check('item created',page.locator('.item-row').count()==7)
    page.locator('#kitName').fill('映写セット')
    page.locator('.kit-qty[data-id="hdmi"]').fill('2')
    page.locator('#kitForm button[type=submit]').click()
    check('kit created',page.locator('.kit-row').count()==3)
    page.locator('.kit-row').filter(has_text='映写セット').get_by_role('button',name='編集').click()
    check('kit edit quantity retains value',page.locator('.kit-qty[data-id="hdmi"]').input_value()=='2')
    page.locator('.kit-qty[data-id="hdmi"]').fill('3')
    page.locator('#kitForm button[type=submit]').click()
    check('kit edited count',page.locator('.kit-row').filter(has_text='映写セット').count()==1)
    page.locator('.kit-row').filter(has_text='映写セット').get_by_role('button',name='削除').click()
    check('kit removed',page.locator('.kit-row').count()==2)
    page.locator('.item-row').filter(has_text='変換アダプター').get_by_role('button',name='削除').click()
    check('item removed',page.locator('.item-row').count()==6)

    page.get_by_role('tab',name='03 出庫チェック').click()
    check('picklist shows items',page.locator('.pick-line').count()>0)
    initial=page.locator('#pickSidebar').inner_text()
    page.locator('.pick-line input').first.check()
    check('checked progress increments',page.locator('#pickSidebar').inner_text()!=initial)
    check('blocked booking not complete after check',page.locator('#pickSidebar .notice').inner_text().find('不足')>=0)
    with page.expect_download() as download:
        page.locator('#exportPick').click()
    check('picklist CSV works',download.value.suggested_filename=='kit-seiretsu-picklist.csv')

    page.get_by_role('tab',name='04 出力・保存').click()
    check('procurement table shown',page.locator('#purchasePanel table').count()==1)
    with page.expect_download() as download:
        page.locator('#exportPurchase').click()
    check('purchase CSV works',download.value.suggested_filename.endswith('additional-gear.csv'))
    with page.expect_download() as download:
        page.locator('#exportData2').click()
    tmp=BASE/'e2e_backup.json';download.value.save_as(tmp)
    saved=json.loads(tmp.read_text())
    check('backup valid project schema',saved['schemaVersion']==1 and len(saved['bookings'])==4)
    page.set_content(compiled, wait_until="load")  # rerun the same app against mocked persisted storage
    check('checked progress persists on reload',page.locator('#statBookings').inner_text()=='4' and page.evaluate('JSON.parse(localStorage.getItem("kit-seiretsu-project-v1")).bookings[0].checked.length')==1)

    # Import JSON after resetting browser data
    page.get_by_role('tab',name='04 出力・保存').click()
    page.locator('#resetData').click()
    page.locator('#importData').set_input_files(str(tmp))
    check('import restores data',page.evaluate('JSON.parse(localStorage.getItem("kit-seiretsu-project-v1")).bookings[0].checked.length')==1)

    # User-provided text must not become executable HTML.
    page.get_by_role('tab',name='01 予定と不足').click()
    page.locator('#bookingTitle').fill('<img src=x onerror="window.__xss=true">')
    page.locator('#bookingKit').select_option('lecture')
    page.locator('#bookingCopies').fill('1')
    page.locator('#bookingStart').fill('2026-12-21')
    page.locator('#bookingEnd').fill('2026-12-21')
    page.locator('#bookingSubmit').click()
    check('malicious markup escaped',page.evaluate('window.__xss') is None and page.locator('.booking-card img').count()==0)
    check('no JS errors',not errors)

    # Mobile viewport / interaction, direct file URL
    mobile = browser.new_context(viewport={'width':390,'height':844}, is_mobile=True,has_touch=True,accept_downloads=True)
    mp=mobile.new_page()
    setup_page(mp)
    mp.wait_for_selector('.booking-card')
    mp.screenshot(path=str(BASE/'mobile.png'),full_page=True)
    check('mobile page renders',mp.locator('.booking-card').count()==4)
    check('mobile page no horizontal overflow',mp.evaluate('document.documentElement.scrollWidth <= document.documentElement.clientWidth + 3'))
    mp.get_by_role('tab',name='03 出庫チェック').click()
    check('mobile pick tab interactive',mp.locator('.pick-line').count()>0)
    browser.close()
    tmp.unlink(missing_ok=True)

print(f'PASS {len(checks)}/{len(checks)} Chromium E2E checks, inlined production source + mocked storage; screenshots desktop.png mobile.png')
for i, name in enumerate(checks,1): print(f'{i:02d}. {name}')
