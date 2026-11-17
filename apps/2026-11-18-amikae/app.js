(function () {
  'use strict';
  const E = window.AmiEngine;
  const $ = id => document.getElementById(id);
  const form = $('config');
  const storageKey = 'amikae:v1';
  let result = null, selection = 'A', row = 0;
  const escapeHTML = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = n => (Math.round(n * 10) / 10).toFixed(1);
  function fields() {
    const out = {};
    for (const el of form.querySelectorAll('[name]')) out[el.name] = el.value;
    return out;
  }
  function fill(data) {
    for (const el of form.querySelectorAll('[name]')) if (data[el.name] !== undefined) el.value = data[el.name];
  }
  function save() { try { localStorage.setItem(storageKey, JSON.stringify({ input: fields(), selection, row })); } catch (_) {} }
  function reset() { fill(E.defaults); selection = 'A'; row = 0; refresh(); }
  function renderScenario(s, rec) {
    const badge = s.label === rec ? '比較上の推奨' : '候補';
    const note = s.warnings.length ? s.warnings.length + '件の注意あり' : '大きな注意なし';
    const mult = s.peak > 1 ? ' / 複数目あり' : '';
    return `<article class="scenario ${s.label === rec ? 'winner' : ''}"><div class="scenariohead"><h3>試し編み ${s.label}</h3><span class="chip ${s.label === 'B' ? 'alt' : ''}">${badge}</span></div><div class="bigcount">${s.start}<span> → </span>${s.end}<small> 目</small></div><div class="summaryline">${s.targetRows} 段で移行 ／ 増減 ${s.events.length} 回${mult}</div><dl class="metric"><dt>開始幅</dt><dd>${fmt(s.actualStartCm)}cm</dd><dt>終了幅</dt><dd>${fmt(s.actualEndCm)}cm</dd><dt>最大幅誤差</dt><dd class="${s.widthError > .5 ? 'warn':''}">${fmt(s.widthError)}cm</dd><dt>長さ</dt><dd>${fmt(s.actualLengthCm)}cm</dd><dt>確認</dt><dd class="${s.warnings.length ? 'warn':''}">${note}</dd></dl></article>`;
  }
  function renderChart(s) {
    const total = s.timeline.length, cols = Math.min(48, Math.max(12, Math.ceil(Math.sqrt(total * 2))));
    const rows = Math.ceil(total / cols), boxW = 13, boxH = 12, gap = 3;
    const width = cols * (boxW + gap) + 2, height = rows * (boxH + gap) + 2;
    let rects = '';
    for (const t of s.timeline) {
      const i = t.row - 1, x = 1 + (i % cols) * (boxW + gap), y = 1 + Math.floor(i / cols) * (boxH + gap);
      const fill = t.row <= row ? '#e7a26c' : (t.change !== 0 ? '#7772d4' : '#d9dfe0');
      rects += `<rect x="${x}" y="${y}" width="${boxW}" height="${boxH}" rx="3" fill="${fill}"><title>${t.row}段目 / ${t.after}目${t.change ? ' / '+(t.change>0?'+':'')+t.change+'目':''}</title></rect>`;
    }
    $('map').innerHTML = `<svg class="chart-svg" viewBox="0 0 ${width} ${height}" aria-label="${total}段の増減目マップ">${rects}</svg>`;
    $('chartmeta').textContent = total + '段 / 紫 = 増減目';
  }
  function renderRows(s) {
    const next = s.events.find(e => e.row > row);
    const current = s.timeline[row - 1];
    const rowDisplay = row === 0 ? '開始前' : '現 ' + (current ? current.after : s.start) + '目';
    $('currentrow').textContent = row;
    $('totalrows').textContent = s.targetRows;
    $('progress').style.width = (100 * row / s.targetRows).toFixed(2) + '%';
    $('nextstep').textContent = row >= s.targetRows ? '計画の最後まで進みました。' : next ? `現在 ${rowDisplay} · 次は${next.row}段目に左右各${next.eachSide}目ずつ${next.change > 0 ? '増し目' : '減らし目'}` : `現在 ${rowDisplay} · 残りは増減目なし`;
    $('eventcount').textContent = s.events.length + '回の指定';
    $('events').innerHTML = s.events.length ? s.events.map((e,i)=>`<div class="event ${e.row <= row ? 'done' : (e === next ? 'next' : '')}"><strong>${e.row}段目</strong><span>${e.change > 0 ? '左右各 '+e.eachSide+'目 増やす' : '左右各 '+e.eachSide+'目 減らす'}</span><span class="stitches">→ ${e.after}目</span></div>`).join('') : '<div class="empty">増減目なし。まっすぐ編む計画です。</div>';
    $('planlabel').textContent = s.stitchGauge + '目 × ' + s.rowGauge + '段 / 10cm';
    $('useA').classList.toggle('active', selection === 'A');
    $('useB').classList.toggle('active', selection === 'B');
    renderChart(s);
  }
  function refresh() {
    try {
      result = E.calculate(fields());
      $('error').hidden = true; $('results').hidden = false;
      $('comparison').innerHTML = renderScenario(result.A, result.recommendation) + renderScenario(result.B, result.recommendation);
      const s = result[selection];
      if (row > s.targetRows) row = s.targetRows;
      $('explanation').innerHTML = `目標幅 <b>${fmt(s.targetStartCm)}cm → ${fmt(s.targetEndCm)}cm</b>、目標丈 <b>${fmt(s.targetLengthCm)}cm</b>。<br><b>注意：</b> ${escapeHTML(s.warnings.join(' ') || '大きな注意はありません。ただし模様・糸・編み方への適用確認が必要です。')}`;
      renderRows(s); save();
    } catch (err) {
      result = null; $('error').hidden = false; $('error').textContent = err.message;
      $('results').hidden = true; $('map').replaceChildren(); $('events').replaceChildren();
    }
  }
  function select(which) { selection = which; row = 0; if (result) renderRows(result[selection]); save(); }
  function advance(n) { if (!result) return; row = Math.max(0, Math.min(result[selection].targetRows, row + n)); renderRows(result[selection]); save(); }
  function download(name, data, type) {
    const blob = new Blob([data], {type}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function csv() {
    if (!result) return;
    const s = result[selection];
    const lines = ['row,stitches_after,change,each_side'];
    for (const t of s.timeline) lines.push([t.row,t.after,t.change,Math.abs(t.change)/2].join(','));
    download('amikae-'+selection+'-rows.csv', '\ufeff'+lines.join('\r\n'), 'text/csv;charset=utf-8');
  }
  function exportJSON() {
    if (!result) return;
    download('amikae-plan.json', JSON.stringify({app:'amikae',version:1,input:result.input,selection,row},null,2),'application/json');
  }
  async function importJSON(file) {
    if (!file) return;
    try {
      if (file.size > 150000) throw Error('150KBを超えるファイルは読み込めません');
      const parsed = JSON.parse(await file.text());
      if (parsed.app !== 'amikae' || parsed.version !== 1 || !parsed.input) throw Error('あみかえ形式のJSONではありません');
      E.calculate(parsed.input);
      fill(parsed.input); selection = parsed.selection === 'B' ? 'B' : 'A'; row = Number.isInteger(parsed.row) && parsed.row >= 0 ? parsed.row : 0; refresh();
    } catch (err) { $('error').hidden = false; $('error').textContent = '読込失敗: '+err.message; }
    finally { $('import').value = ''; }
  }
  form.addEventListener('input', refresh);
  form.addEventListener('change', refresh);
  $('reset').addEventListener('click', reset);
  $('export').addEventListener('click', exportJSON);
  $('csv').addEventListener('click', csv);
  $('import').addEventListener('change', e => importJSON(e.target.files[0]));
  $('print').addEventListener('click', () => window.print());
  $('useA').addEventListener('click', () => select('A'));
  $('useB').addEventListener('click', () => select('B'));
  $('minus').addEventListener('click', () => advance(-1));
  $('plus').addEventListener('click', () => advance(1));
  window.addEventListener('keydown', e => { if (['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName)) return; if (e.key === 'ArrowRight') advance(1); if (e.key === 'ArrowLeft') advance(-1); });
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved && saved.input) {
      E.calculate(saved.input); fill(saved.input); selection = saved.selection === 'B' ? 'B' : 'A'; row = Math.max(0, Math.floor(Number(saved.row) || 0));
    } else fill(E.defaults);
  } catch (_) { fill(E.defaults); }
  refresh();
})();
