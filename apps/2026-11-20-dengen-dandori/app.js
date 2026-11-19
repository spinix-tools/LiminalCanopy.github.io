/* Browser UI. All computation is local; no fetch, analytics, fonts or remote assets. */
(() => {
  'use strict';
  const E = window.Dengen;
  const KEY = 'dengen-dandori-v1';
  const $ = id => document.getElementById(id);
  const html = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (v, d = 0) => Number.isFinite(Number(v)) ? Number(v) : d;
  const fmt = v => Math.round(v).toLocaleString('ja-JP');
  let project;
  let undo = null;
  let notification = '開始時間を手動変更するか、「自動で段取りを改善」を押してください。';
  try {
    const saved = localStorage.getItem(KEY);
    project = saved ? E.normalizeProject(JSON.parse(saved)) : E.defaultProject();
  } catch (_) { project = E.defaultProject(); }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(project)); } catch (_) {} }
  function note(message) { notification = message; $('status').textContent = notification; }
  function field(label, key, value, unit, min = 0, max = 100000) {
    return `<div class="field"><label for="${key}">${html(label)}</label><input id="${key}" data-field="${key.split('_')[1]}" data-station="${key[0]}" type="number" min="${min}" max="${max}" value="${html(value)}" aria-label="${html(label)} ${key[0]}" title="${html(unit)}" /></div>`;
  }
  function stationHTML(id) {
    const s = project.stations[id];
    return `<div class="station-card ${id.toLowerCase()}">
      <div class="station-head"><span class="station-letter">${id}</span><input aria-label="電源${id}の名称" maxlength="48" data-station="${id}" data-field="name" value="${html(s.name)}" /></div>
      <div class="station-fields">
        ${field('容量 Wh', `${id}_capacity`, s.capacity, 'Wh', 10, 100000)}
        ${field('AC連続出力 W', `${id}_output`, s.output, 'W', 1, 100000)}
        ${field('AC変換効率 %', `${id}_efficiency`, s.efficiency, '%', 50, 100)}
        ${field('初期充電率 %', `${id}_startSOC`, s.startSOC, '%', 0, 100)}
        ${field('残しておく割合 %', `${id}_reserve`, s.reserve, '%', 0, 80)}
        ${field('AC待機損失 W', `${id}_idle`, s.idle, 'W', 0, 150)}
        <div class="station-divider"></div>
        ${field('ソーラー入力 W', `${id}_solar`, s.solar, 'W', 0, 10000)}
        <div class="field"><label for="${id}_solarStart">発電開始</label><input id="${id}_solarStart" type="time" data-station="${id}" data-field="solarStart" value="${E.hhmm(s.solarStart)}" aria-label="電源${id}発電開始" /></div>
        <div class="field"><label for="${id}_solarEnd">発電終了</label><input id="${id}_solarEnd" type="time" data-station="${id}" data-field="solarEnd" value="${E.hhmm(s.solarEnd === 1440 ? 1439 : s.solarEnd)}" aria-label="電源${id}発電終了" /></div>
      </div><p class="station-comment">※ ソーラー値は機器に入力される有効Wを一定と仮定（予報ではありません）</p>
    </div>`;
  }
  function loadHTML(l) {
    const id = html(l.id);
    const input = (key, type, value, widthClass, extra = '') => `<input class="${widthClass}" data-id="${id}" data-load-field="${key}" type="${type}" value="${html(value)}" aria-label="${html(l.name)} ${key}" ${extra}/>`;
    return `<tr data-load-row="${id}"><td>${input('name', 'text', l.name, 'device-name', 'maxlength="48"')}
        <div class="device-sub">台数 ${input('count','number',l.count,'','min="1" max="12"')}</div></td>
      <td><div class="power-group">${input('watts', 'number', l.watts, '', 'min="1" max="15000"')}<span>W</span>
        <select data-id="${id}" data-load-field="supply" aria-label="${html(l.name)} 電源方式"><option value="AC"${l.supply === 'AC' ? ' selected' : ''}>AC</option><option value="DC"${l.supply === 'DC' ? ' selected' : ''}>DC</option></select></div></td>
      <td>${input('start', 'time', E.hhmm(l.start), 'clock')}</td>
      <td>${input('duration','number',l.duration,'duration','min="15" max="1440" step="15"')}</td>
      <td><label class="flex-toggle"><input type="checkbox" data-id="${id}" data-load-field="flex" ${l.flex ? 'checked' : ''}/>移動を許可</label>
        <div class="range-group">${input('earliest','time',E.hhmm(l.earliest),'clock',l.flex?'':'disabled')}
        <span>〜</span>${input('latest','time',E.hhmm(l.latest),'clock',l.flex?'':'disabled')}</div></td>
      <td><button class="delete-row" data-remove="${id}" aria-label="${html(l.name)} を削除">×</button></td></tr>`;
  }
  function compareHTML(which, r) {
    const ok = r.feasible;
    return `<article class="summary-card ${which.toLowerCase()}" data-report="${which}">
      <div class="summary-card-header"><strong>${html(project.stations[which].name)}</strong><span class="state-pill ${ok ? '' : 'warn'}">${ok ? '計画上は充足' : '要見直し'}</span></div>
      <div class="summary-giant">${fmt(r.endSOC)}<small>% / 終了時</small></div>
      <div class="summary-sub">最低残量 ${fmt(r.minSOC)}%　·　予備 ${fmt(r.floorSOC)}%</div>
      <div class="progress-track"><div class="progress-fill" style="width:${Math.max(0,Math.min(100,r.endSOC))}%"></div></div>
      <div class="metrics">
        <div class="metric"><small>供給不足</small><b>${fmt(r.unmetWh)} Wh</b></div>
        <div class="metric"><small>出力超過</small><b>${fmt(r.overloadMinutes)} 分</b></div>
        <div class="metric"><small>AC最大負荷</small><b>${fmt(r.peakAC)} W</b></div>
      </div>
    </article>`;
  }
  function svgReport(a, b) {
    const w = 1100, h = 350, left = 60, right = 1040, top = 27, bottom = 295;
    const x = i => left + (right - left) * i / 96;
    const y = soc => bottom - soc / 100 * (bottom - top);
    const maxW = Math.max(1000, Math.ceil((a.peakAC + 100) / 500) * 500);
    const powerY = p => bottom - (p / maxW) * (bottom - top);
    let grid = '';
    for (let pct = 0; pct <= 100; pct += 25) grid += `<line x1="${left}" y1="${y(pct)}" x2="${right}" y2="${y(pct)}" stroke="#36505c" stroke-dasharray="4 6" /><text x="${left - 10}" y="${y(pct) + 4}" fill="#9ab0b6" font-size="12" text-anchor="end">${pct}%</text>`;
    for (let hour = 0; hour <= 24; hour += 4) grid += `<line x1="${x(hour * 4)}" y1="${top}" x2="${x(hour * 4)}" y2="${bottom}" stroke="#2c424d"/><text x="${x(hour * 4)}" y="${bottom + 24}" fill="#9ab0b6" text-anchor="middle" font-size="12">${String(hour).padStart(2, '0')}:00</text>`;
    const points = r => `${x(0)},${y(project.stations[r.which].startSOC)} ` + r.timeline.map((p, i) => `${x(i + 1)},${y(p.soc)}`).join(' ');
    let loadPath = `M ${x(0)} ${bottom} `;
    for (let i = 0; i < 96; i++) loadPath += `L ${x(i)} ${powerY(a.timeline[i].ac)} L ${x(i + 1)} ${powerY(a.timeline[i].ac)} `;
    loadPath += `L ${x(96)} ${bottom} Z`;
    const limit = project.stations[project.target].output;
    const limitLine = limit <= maxW ? `<line x1="${left}" y1="${powerY(limit)}" x2="${right}" y2="${powerY(limit)}" stroke="#f38e7c" stroke-dasharray="7 5" opacity="0.8"/><text x="${right - 5}" y="${powerY(limit) - 6}" fill="#f7aa9a" text-anchor="end" font-size="11">${project.target} 上限 ${limit}W</text>` : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="電池残量および同時AC負荷の24時間推移">
      <rect width="${w}" height="${h}" rx="10" fill="#14232e"/>
      ${grid}<text x="${right + 9}" y="${top + 7}" fill="#f6b885" font-size="12">${fmt(maxW)} W</text><text x="${right + 9}" y="${bottom}" fill="#f6b885" font-size="12">0</text>
      <path d="${loadPath}" fill="#f6b885" fill-opacity="0.18" stroke="#f6b885" stroke-width="1.5" stroke-opacity=".75"/>
      ${limitLine}
      <polyline fill="none" points="${points(a)}" stroke="#b1ec74" stroke-width="3.6" stroke-linejoin="round"/>
      <polyline fill="none" points="${points(b)}" stroke="#70d5e2" stroke-width="3.6" stroke-linejoin="round"/>
      <text x="${left}" y="${h - 8}" font-size="12" fill="#aac3c8">● A 残量</text><text x="${left + 102}" y="${h - 8}" font-size="12" fill="#70d5e2">● B 残量</text><text x="${left + 203}" y="${h - 8}" font-size="12" fill="#f6b885">■ AC負荷</text>
    </svg>`;
  }
  function risks(a, b) {
    const items = [['A', a], ['B', b]];
    return items.map(([w, r]) => {
      const issues = [];
      if (r.overloadMinutes) issues.push(`AC連続定格を超える時間が${fmt(r.overloadMinutes)}分（最大${fmt(r.maxOverload)}W超過）`);
      if (r.unmetWh > 0.01) issues.push(`予備残量を維持できない見込みが${fmt(r.unmetMinutes)}分、合計${fmt(r.unmetWh)}Wh`);
      if (project.stations[w].startSOC < project.stations[w].reserve) issues.push('初期充電率が予備残量を下回ります');
      return `<div class="risk-item ${issues.length ? '' : 'good'}"><strong>${w}: ${issues.length ? '要確認ポイント' : '設定した条件内では問題なし'}</strong><p>${html(issues.length ? issues.join('。') + '。' : '連続定格超過と予備残量割れは検出されませんでした。ただし突入電流などは判定対象外です。')}</p></div>`;
    }).join('');
  }
  function render() {
    project = E.normalizeProject(project);
    $('stations').innerHTML = stationHTML('A') + stationHTML('B');
    $('loads').innerHTML = project.loads.map(loadHTML).join('') || '<tr><td colspan="6">機器がありません。「機器を追加」から登録してください。</td></tr>';
    $('target').value = project.target;
    $('btnUndo').disabled = !undo;
    const a = E.simulate(project, 'A'), b = E.simulate(project, 'B');
    $('summary').innerHTML = compareHTML('A', a) + compareHTML('B', b);
    $('chart').innerHTML = svgReport(a, b);
    $('riskList').innerHTML = risks(a, b);
    $('status').textContent = notification;
    save();
  }
  function edit() { undo = null; note('変更内容で計算を更新しました。'); render(); }
  $('stations').addEventListener('change', e => {
    const el = e.target, id = el.dataset.station, field = el.dataset.field;
    if (!id || !field || !project.stations[id]) return;
    project.stations[id][field] = field === 'name' ? el.value : field === 'solarStart' || field === 'solarEnd' ? E.parseTime(el.value, project.stations[id][field]) : num(el.value, project.stations[id][field]);
    edit();
  });
  $('loads').addEventListener('change', e => {
    const el = e.target, id = el.dataset.id, field = el.dataset.loadField;
    if (!id || !field) return;
    const load = project.loads.find(l => l.id === id);
    if (!load) return;
    if (field === 'name' || field === 'supply') load[field] = el.value;
    else if (field === 'flex') load.flex = el.checked;
    else if (['start', 'earliest', 'latest'].includes(field)) load[field] = E.parseTime(el.value, load[field]);
    else load[field] = num(el.value, load[field]);
    edit();
  });
  $('loads').addEventListener('click', e => {
    const btn = e.target.closest('[data-remove]');
    if (!btn) return;
    project.loads = project.loads.filter(l => l.id !== btn.dataset.remove);
    edit();
  });
  $('btnAdd').addEventListener('click', () => {
    if (project.loads.length >= 30) return note('負荷は30件までです。');
    const id = `l${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
    project.loads.push({ id, name: '新しい機器', watts: 40, count: 1, supply: 'AC', start: 720, duration: 60, flex: true, earliest: 600, latest: 900 });
    edit();
  });
  $('target').addEventListener('change', e => { project.target = e.target.value === 'B' ? 'B' : 'A'; edit(); });
  $('btnOptimize').addEventListener('click', () => {
    const result = E.autoArrange(project, project.target);
    if (!result.moved.length) return note('指定された移動可能範囲では改善が見つかりませんでした。制約か電源条件を見直してください。');
    undo = JSON.stringify(project);
    project = result.project;
    render();
    note(`${result.moved.length}件の開始時刻を変更しました。${result.moved.map(x => `${x.name} ${E.hhmm(x.from)}→${E.hhmm(x.to)}`).join('／')}。近似探索のため最適性は保証しません。`);
    $('btnUndo').disabled = false;
  });
  $('btnUndo').addEventListener('click', () => {
    if (!undo) return;
    project = E.normalizeProject(JSON.parse(undo));
    undo = null;
    note('自動段取り実行前の開始時間に戻しました。');
    render();
  });
  $('btnReset').addEventListener('click', () => { project = E.defaultProject(); undo = null; note('サンプルを読み込みました。'); render(); });
  function download(name, content, mime) {
    const file = new Blob([content], { type: mime });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a'); link.href = url; link.download = name;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  $('btnJSON').addEventListener('click', () => download('dengen-dandori-plan.json', JSON.stringify(project, null, 2), 'application/json'));
  $('btnCSV').addEventListener('click', () => download('dengen-dandori-report.csv', E.toCSV(project, E.simulate(project, 'A'), E.simulate(project, 'B')), 'text/csv;charset=utf-8'));
  $('btnSVG').addEventListener('click', () => download('dengen-dandori-chart.svg', svgReport(E.simulate(project, 'A'), E.simulate(project, 'B')), 'image/svg+xml;charset=utf-8'));
  $('btnPrint').addEventListener('click', () => window.print());
  $('importFile').addEventListener('change', async e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      if (file.size > 1024 * 1024) throw new Error('1MBを超えるJSONは読み込めません');
      const data = JSON.parse(await file.text());
      if (!data || data.version !== 1 || !Array.isArray(data.loads) || !data.stations || !data.stations.A || !data.stations.B) throw new Error('電源段取り用のJSON形式ではありません');
      project = E.normalizeProject(data); undo = null;
      note(`${project.loads.length}件の機器予定を復元しました。`); render();
    } catch (err) { note(`読み込みに失敗しました：${err.message}`); }
    e.target.value = '';
  });
  render();
})();
