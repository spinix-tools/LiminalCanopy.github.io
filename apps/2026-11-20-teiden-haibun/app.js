/* UI: local-only battery allocation planning. No network calls. */
(() => {
  'use strict';
  const E = window.TeidenEngine;
  const STORAGE_KEY = 'teiden-haibun-v1';
  const $ = (q) => document.querySelector(q);
  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  let state = E.initialState();
  let analysis;
  let day = 1;
  const n = (v, digits = 0) => Number(v).toLocaleString('ja-JP', { maximumFractionDigits: digits });
  const pct = (v) => Math.max(0, Math.min(100, Number(v) || 0));
  const idForDownload = () => new Date().toISOString().slice(0, 10);

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) state = E.normalizeState(JSON.parse(stored));
  } catch (_) { /* localStorage blocked or malformed; default demo remains usable */ }
  function persist() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) { /* file remains exportable */ } }
  function status(message, isError = false) {
    const el = $('#status');
    el.textContent = message;
    el.style.color = isError ? '#b1483f' : '#25765b';
  }
  const hourOptions = (chosen, inclusive24 = false) => Array.from({ length: inclusive24 ? 25 : 24 }, (_, i) => `<option value="${i}" ${i === chosen ? 'selected' : ''}>${i}時</option>`).join('');
  function renderDevices() {
    $('#devices-body').innerHTML = state.devices.map((d) => `
      <tr data-row="${esc(d.id)}">
        <td><input class="name-input" aria-label="家電の名前" data-device="${esc(d.id)}" data-field="name" maxlength="48" value="${esc(d.name)}"></td>
        <td><input aria-label="${esc(d.name)}の消費電力W" data-device="${esc(d.id)}" data-field="watts" type="number" min="0" max="5000" step="1" value="${d.watts}"></td>
        <td><input aria-label="${esc(d.name)}の台数" data-device="${esc(d.id)}" data-field="count" type="number" min="1" max="20" step="1" value="${d.count}"></td>
        <td><input aria-label="${esc(d.name)}の平均稼働率" data-device="${esc(d.id)}" data-field="dutyPct" type="number" min="0" max="100" step="5" value="${d.dutyPct}"></td>
        <td><select aria-label="${esc(d.name)}の開始時刻" data-device="${esc(d.id)}" data-field="start">${hourOptions(d.start)}</select></td>
        <td><select aria-label="${esc(d.name)}の終了時刻" data-device="${esc(d.id)}" data-field="end">${hourOptions(d.end, true)}</select></td>
        <td><select aria-label="${esc(d.name)}の優先度" data-device="${esc(d.id)}" data-field="tier"><option value="must" ${d.tier==='must'?'selected':''}>必須</option><option value="flex" ${d.tier==='flex'?'selected':''}>任意</option></select></td>
        <td><button class="delete-btn" type="button" aria-label="${esc(d.name)}を削除" data-remove="${esc(d.id)}">×</button></td>
      </tr>`).join('');
    $('#add-device').disabled = state.devices.length >= 36;
  }
  function renderSettings() {
    Object.entries(state.settings).forEach(([key, val]) => {
      const element = document.querySelector(`[data-setting="${key}"]`);
      if (element) element.value = val;
    });
  }
  function renderCards() {
    const a = analysis.baseline, b = analysis.optimized;
    const cards = [
      { title: '通常案 A', badge: a.feasible ? '条件上の不足なし' : '不足・注意あり', good: a.feasible, x: a, description: '予定どおり全家電を使う', klass: 'a' },
      { title: '省エネ案 B', badge: b.feasible ? '条件上の不足なし' : '不足・注意あり', good: b.feasible, x: b, description: '必須家電を優先して見直す', klass: 'b' }
    ];
    $('#result-cards').innerHTML = cards.map(c => `<article class="result-card result-card--${c.klass}">
      <div class="result-card__head"><strong>${c.title}</strong><span class="tag ${c.good ? 'tag--good' : 'tag--bad'}">${c.badge}</span></div>
      <div class="result-card__body"><div class="kpi-title">${c.description} / 終了時の電池残量</div>
        <div class="kpi">${n(c.x.endSocPct, 1)}<small>%</small></div>
        <div class="meter"><div class="meter__fill" style="width:${pct(c.x.endSocPct)}%"></div></div>
        <div class="kpi-grid"><div><small>未供給の電力量</small><strong>${n(c.x.unmetWh, 1)} Wh</strong></div><div><small>初回の電力不足</small><strong>${c.x.firstShortfall === null ? 'なし' : `${c.x.firstShortfall}時間目`}</strong></div><div><small>出力超過の時間帯</small><strong>${n(c.x.peakViolations)} 時間</strong></div><div><small>見積需要</small><strong>${n(c.x.requestedWh, 0)} Wh</strong></div></div>
      </div></article>`).join('');
  }
  function svgChart() {
    const W=920, H=306, left=55, right=19, top=18, bottom=43;
    const plotW=W-left-right, plotH=H-top-bottom;
    const xs = h => left + h / state.settings.hours * plotW;
    const ys = v => top + (100 - v)/100 * plotH;
    const lines = [0,20,40,60,80,100].map(y => `<line class="grid-line" x1="${left}" y1="${ys(y)}" x2="${W-right}" y2="${ys(y)}"/><text x="${left-12}" y="${ys(y)+4}" text-anchor="end">${y}%</text>`).join('');
    const tick = Array.from({length: state.settings.hours/12 + 1}, (_, i) => i*12).map(h => `<text x="${xs(h)}" y="${H-13}" text-anchor="middle">${h}h</text><line class="grid-line" x1="${xs(h)}" y1="${top}" x2="${xs(h)}" y2="${H-bottom}"/>`).join('');
    const path = points => points.map((p, i) => `${i?'L':'M'}${xs(p.hour).toFixed(2)},${ys(p.socPct).toFixed(2)}`).join(' ');
    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="${left}" y="${ys(state.settings.reservePct)}" width="${plotW}" height="${H-bottom-ys(state.settings.reservePct)}" fill="#fbf3e5"/>
      ${lines}${tick}
      <line class="reserve-line" x1="${left}" y1="${ys(state.settings.reservePct)}" x2="${W-right}" y2="${ys(state.settings.reservePct)}"/>
      <path class="line-a" d="${path(analysis.baseline.points)}"/><path class="line-b" d="${path(analysis.optimized.points)}"/>
      <text x="${W-right}" y="${ys(state.settings.reservePct)-6}" text-anchor="end">予備 ${state.settings.reservePct}%</text>
      </svg>`;
  }
  function renderAdvice() {
    $('#advice-title').textContent = analysis.essentialFeasible ? `任意家電の使用率：${Math.round(analysis.optionalFactor*100)}%` : '必須家電の条件に不足があります';
    $('#advice-text').textContent = analysis.reason;
    const notes = [];
    if (analysis.baseline.peakViolations) notes.push(`通常案：${analysis.baseline.peakViolations}時間帯で、使用家電の定格W合計が連続出力の上限を超えます。`);
    if (analysis.optimized.peakViolations) notes.push(`省エネ案：${analysis.optimized.peakViolations}時間帯で定格W合計が上限を超えます。`);
    if (analysis.baseline.unmetWh > 0.001) notes.push(`通常案の電池不足：${n(analysis.baseline.unmetWh, 1)}Wh 分の予定が満たせません。`);
    if (analysis.optimized.unmetWh > 0.001) notes.push(`必須家電を含む省エネ案にも${n(analysis.optimized.unmetWh, 1)}Whの不足があります。`);
    if (state.settings.initialPct <= state.settings.reservePct) notes.push('現在の充電率が予備割合以下です。予備を残す条件では給電余力がありません。');
    notes.push('平均稼働率の計算と、同時定格出力の判定は別です。起動時の瞬間電力や実測値は反映されません。');
    $('#warnings').innerHTML = notes.map(x => `<li>${esc(x)}</li>`).join('');
  }
  function renderHours() {
    const days = state.settings.hours / 24;
    const select = $('#day-select');
    if (day > days) day = days;
    select.innerHTML = Array.from({length:days},(_,i)=>`<option value="${i+1}" ${day===i+1?'selected':''}>${i+1}日目</option>`).join('');
    const rows = E.hourlyTable(analysis).filter(r=>r.day===day);
    $('#hour-rows').innerHTML = rows.map(r=>{
      const unmet = r.a.unmetWh > .0001 || r.b.unmetWh > .0001;
      return `<tr><td>${r.clock}</td><td>${n(r.a.demandW,1)} W</td><td>${n(r.b.demandW,1)} W</td><td>${n(r.a.socPct,1)}%</td><td>${n(r.b.socPct,1)}%</td><td class="${unmet?'warn':''}">${n(r.a.unmetWh,1)} / ${n(r.b.unmetWh,1)} Wh</td></tr>`;
    }).join('');
  }
  function render() {
    try {
      state = E.normalizeState(state);
      analysis = E.analyze(state);
      renderSettings(); renderDevices(); renderCards();
      $('#chart').innerHTML = svgChart(); renderAdvice(); renderHours();
      persist();
    } catch(err) { status(`計算できません：${err.message}`, true); }
  }
  function download(name, content, type) {
    const blob = new Blob([content], {type});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download=name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  document.addEventListener('change', event => {
    const t = event.target;
    if (t.matches('[data-setting]')) {
      state.settings[t.dataset.setting] = t.value;
      render();
    } else if (t.matches('[data-device]')) {
      const d = state.devices.find(d=>d.id===t.dataset.device);
      if (d) { d[t.dataset.field] = t.value; render(); }
    }
  });
  document.addEventListener('click', event => {
    const remove = event.target.closest('[data-remove]');
    if (remove) { state.devices = state.devices.filter(d=>d.id!==remove.dataset.remove); render(); status('家電を削除しました。'); }
  });
  $('#add-device').addEventListener('click',()=>{
    if (state.devices.length >= 36) return status('家電は最大36件までです。',true);
    const id = `new${Date.now().toString(36)}${state.devices.length}`;
    state.devices.push({id,name:'新しい家電',watts:20,count:1,dutyPct:100,start:0,end:24,tier:'flex'});
    render(); status('新しい家電を追加しました。');
  });
  $('#day-select').addEventListener('change',e=>{day=Number(e.target.value);renderHours();});
  $('#export-json').addEventListener('click',()=>{
    download(`teiden-plan-${idForDownload()}.json`,JSON.stringify(state,null,2)+'\n','application/json;charset=utf-8');
    status('設定JSONを出力しました。');
  });
  $('#export-csv').addEventListener('click',()=>{
    download(`teiden-hourly-${idForDownload()}.csv`,E.rowsToCsv(analysis),'text/csv;charset=utf-8');
    status('時間別の試算CSVを出力しました。');
  });
  $('#import-json').addEventListener('click',()=>$('#import-file').click());
  $('#import-file').addEventListener('change',async e=>{
    const f=e.target.files?.[0]; if(!f)return;
    try {
      if(f.size>1024*1024)throw new Error('JSONファイルは1MB以下にしてください。');
      const imported=E.normalizeState(JSON.parse(await f.text()));
      state=imported;day=1;render();status('JSONを読み込みました。');
    }catch(err){status(`読み込み失敗：${err.message}`,true);}
    e.target.value='';
  });
  $('#reset').addEventListener('click',()=>{state=E.initialState();day=1;render();status('サンプル設定に戻しました。');});
  $('#print').addEventListener('click',()=>window.print());
  render();
})();
