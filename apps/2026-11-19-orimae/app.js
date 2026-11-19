/* ORIMAE browser controller. No network requests or third-party libraries. */
(() => {
  'use strict';
  const E = window.ORIMAE;
  const KEY = 'orimae-v1';
  const $ = id => document.getElementById(id);
  const form = $('settings');
  const fields = ['title','pages','copies','binding','paper','inkPerSide','paperPerSheet','testSheets','backRotate','backReverse'];
  let selected = 1;
  let checks = {};
  let plan;
  let toastTimer;
  const fmt = n => Number(n).toLocaleString('ja-JP');
  function read() {
    const o = {};
    for (const key of fields) o[key] = $(key).type === 'checkbox' ? $(key).checked : $(key).value;
    return E.validate(o);
  }
  function setFields(options) {
    const o = E.validate(options);
    for (const key of fields) {
      if ($(key).type === 'checkbox') $(key).checked = o[key];
      else $(key).value = o[key];
    }
  }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify({ options: read(), checks })); }
    catch (_) { /* private browsing/storage disabled: application still works */ }
  }
  function restore() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (raw && raw.options && typeof raw.options === 'object') {
        setFields(raw.options);
        checks = raw.checks && typeof raw.checks === 'object' ? raw.checks : {};
      }
    } catch (_) { /* ignore corrupt storage */ }
  }
  function pageMarkup(n) {
    const blank = n > plan.pages;
    return `<div class="page-tile ${blank ? 'blank' : ''}"><span class="tile-index">${blank ? 'EMPTY' : 'PAGE'}</span><strong>${blank ? '—' : n}</strong><em>${blank ? '空白ページ' : n === 1 ? '表紙' : 'P.' + n}</em></div>`;
  }
  function toast(message) {
    const el = $('toast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2700);
  }
  function checkSignature(p) { return [p.pages,p.binding,p.paper].join('|'); }
  function render(resetChecks = false) {
    const old = plan;
    plan = E.makePlan(read());
    if (resetChecks && old && checkSignature(old) !== checkSignature(plan)) checks = {};
    selected = Math.max(1, Math.min(selected, plan.sheetCount));
    const cost = E.estimate(plan);
    $('mPages').textContent = plan.padded;
    $('mBlank').textContent = plan.blanks ? '空白ページ ＋' + plan.blanks : '空白ページなし';
    $('mSheets').textContent = plan.sheetCount;
    $('mPaper').textContent = plan.paper + ' → ' + plan.finishedSize;
    $('mPhysical').textContent = fmt(cost.physicalSheets);
    $('mProof').textContent = '試し刷り ' + plan.testSheets + '枚込み';
    $('mCost').textContent = fmt(cost.totalCost);
    $('mEach').textContent = '1冊あたり 約¥' + fmt(Math.ceil(cost.perCopy));
    $('sheetTotal').textContent = '全' + plan.sheetCount + '枚';
    $('sheetList').innerHTML = plan.sheets.map(s => `<button type="button" class="sheet-item ${s.id === selected ? 'active' : ''}" data-sheet="${s.id}" aria-pressed="${s.id === selected}"><span><strong>シート ${String(s.id).padStart(2,'0')}</strong><small>${s.isOuter ? '外側・表紙の紙' : s.isCenter ? '中心の紙' : '中の紙'}</small></span><b>${checks[s.id] ? '✓' : '›'}</b></button>`).join('');
    $('sheetList').querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => {selected = Number(btn.dataset.sheet); render();}));
    const sheet = plan.sheets[selected - 1];
    $('detailTitle').innerHTML = String(selected).padStart(2,'0') + ' <small>/ 枚目</small>';
    $('detailPill').textContent = sheet.isOuter ? '外側の紙' : sheet.isCenter ? '中心の紙' : '中の紙';
    $('previewFront').innerHTML = sheet.front.map(pageMarkup).join('');
    $('previewBack').innerHTML = sheet.back.map(pageMarkup).join('');
    $('verified').checked = Boolean(checks[selected]);
    $('verifyCount').textContent = plan.sheets.filter(s => checks[s.id]).length + '/' + plan.sheetCount + ' チェック済';
    persist();
  }
  function download(text, filename, mimetype) {
    const blob = new Blob([text], {type: mimetype});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  function exportTest(mode) {
    download(E.printHTML(read(), mode), 'orimae-' + mode + '-' + plan.padded + 'p.html', 'text/html;charset=utf-8');
    toast(mode === 'all' ? '試験台紙を保存しました。ブラウザで開いて印刷してください。' : '片面用の台紙を保存しました。');
  }
  restore();
  form.addEventListener('input', () => render(true));
  form.addEventListener('change', () => render(true));
  $('verified').addEventListener('change', event => { checks[selected] = event.target.checked; render(); });
  $('downloadAll').addEventListener('click', () => exportTest('all'));
  $('downloadFront').addEventListener('click', () => exportTest('fronts'));
  $('downloadBack').addEventListener('click', () => exportTest('backs'));
  $('downloadCSV').addEventListener('click', () => {download(E.csv(read()), 'orimae-imposition-' + plan.padded + 'p.csv', 'text/csv;charset=utf-8');toast('面付け表CSVを保存しました。');});
  render();
})();