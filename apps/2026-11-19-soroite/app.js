/* SOROITE UI — all data stays in this browser, no network calls. */
(function () {
  'use strict';
  const E = window.SoroiteEngine;
  const STORAGE = 'soroite-prototype-v1';
  const colors = ['#d97b5a', '#5d9887', '#748bb3', '#ac8b73'];
  const $ = (id) => document.getElementById(id);
  const fmt = (p) => `${(p * 100).toFixed(2)}%`;
  let latest = null;
  let sample = null;
  let persisted = false;

  function defaults() { return E.configureDefaults(); }
  function storedConfig() {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw) { const cfg = JSON.parse(raw); E.validate(cfg); return cfg; }
    } catch (_) { /* absent/denied storage: keep working */ }
    return defaults();
  }
  function showMessage(message = '') { $('message').textContent = message; }
  function input(id, value) { $(id).value = value; }
  function cleanName(s) { return String(s).trim().slice(0, 50); }
  function create(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }
  function renderGroups(groups) {
    const root = $('groups');
    root.replaceChildren();
    groups.forEach((g, idx) => {
      const row = create('div', 'group-row');
      row.dataset.index = idx;
      row.style.setProperty('--accent', colors[idx % colors.length]);
      for (const [key, type, label] of [['name','text','名前'],['count','number','デッキ内枚数'],['min','number','最低枚数'],['max','number','最高枚数']]) {
        const elm = create('input', key === 'name' ? 'name-input' : '');
        elm.type = type;
        elm.value = g[key];
        elm.dataset.field = key;
        elm.setAttribute('aria-label', `${idx + 1}番目のカテゴリ ${label}`);
        if (type === 'number') { elm.min = 0; elm.max = 200; elm.step = 1; }
        else elm.maxLength = 50;
        row.append(elm);
      }
      const del = create('button', 'remove-group', '×');
      del.type = 'button'; del.title = `${g.name}を削除`;
      del.disabled = groups.length <= 1;
      del.addEventListener('click', () => {
        const cfg = getConfig();
        cfg.groups.splice(idx, 1);
        renderGroups(cfg.groups);
        recompute();
      });
      row.append(del);
      root.append(row);
    });
    $('group-count').textContent = String(groups.length).padStart(2,'0');
    $('add-group').disabled = groups.length >= 4;
  }
  function applyConfig(cfg) {
    for (const id of ['deck', 'hand', 'turns', 'drawPerTurn']) input(id, cfg[id]);
    renderGroups(cfg.groups);
    sample = null;
    $('sample-cards').replaceChildren();
    $('sample-status').textContent = '引くと、各カテゴリの枚数が表示されます。';
    $('sample-status').className = 'sample-status';
    recompute();
  }
  function numberValue(s) { return s === '' ? NaN : Number(s); }
  function getConfig() {
    const groups = [...$('groups').children].map(row => {
      const fields = {};
      row.querySelectorAll('input').forEach(el => {
        fields[el.dataset.field] = el.dataset.field === 'name' ? cleanName(el.value) : numberValue(el.value);
      });
      return fields;
    });
    return {deck:numberValue($('deck').value), hand:numberValue($('hand').value), turns:numberValue($('turns').value), drawPerTurn:numberValue($('drawPerTurn').value), groups};
  }
  function persist(cfg) {
    try { localStorage.setItem(STORAGE, JSON.stringify(cfg)); persisted = true; }
    catch (_) { persisted = false; }
  }
  function clearOutputs() {
    for (const id of ['opening-odds','redraw-odds','last-odds']) $(id).textContent = '—';
    $('opening-caption').textContent = '入力条件を確認してください';
    $('chart').replaceChildren();
    $('curve-table').replaceChildren();
    $('suggestions').replaceChildren();
    $('remainder-value').textContent = '—';
    latest = null;
  }
  function recompute() {
    try {
      const cfg = getConfig();
      const remainder = E.validate(cfg);
      const points = E.curve(cfg);
      latest = {cfg, points};
      showMessage('');
      $('remainder-value').textContent = `${remainder} 枚`;
      $('hand-summary').textContent = cfg.hand;
      const open = points[0].probability;
      const end = points[points.length - 1];
      $('opening-odds').innerHTML = `${(open * 100).toFixed(2)}<span>%</span>`;
      $('opening-caption').textContent = `${cfg.groups.length}カテゴリの条件をすべて満たす確率`;
      $('redraw-odds').textContent = fmt(E.fullRedraw(open));
      $('last-odds').textContent = fmt(end.probability);
      $('last-info').textContent = `初手 + ${cfg.turns}ターンで計 ${end.seen} 枚を確認`;
      $('probability-ring').style.background = `conic-gradient(#e7a184 0% ${(100 * open).toFixed(3)}%, #416168 ${(100 * open).toFixed(3)}% 100%)`;
      renderCurve(points);
      renderSuggestions(E.suggestions(cfg));
      persist(cfg);
    } catch (err) {
      clearOutputs();
      showMessage(err.message || '入力を確認してください');
    }
  }
  function renderCurve(points) {
    const graph = $('chart'), table = $('curve-table');
    graph.replaceChildren(); table.replaceChildren();
    points.forEach((p, i) => {
      const col = create('div','curve-col');
      col.append(create('span','curve-perc', `${(100 * p.probability).toFixed(1)}%`));
      const bar = create('div', `curve-bar${i === 0 ? ' first' : ''}`);
      bar.style.height = `${Math.max(2, 125 * p.probability)}px`;
      bar.title = `${p.turn === 0 ? '初手' : p.turn+'ターン'}: ${fmt(p.probability)}`;
      col.append(bar);
      col.append(create('span','curve-turn', p.turn === 0 ? '初手' : `${p.turn}T`));
      graph.append(col);
      const tr = create('tr');
      for (const v of [p.turn === 0 ? '初手' : `${p.turn}T`,`${p.seen}枚`,fmt(p.probability)]) tr.append(create('td','',v));
      table.append(tr);
    });
    graph.setAttribute('aria-label', points.map(p => `${p.turn === 0 ? '初手' : p.turn+'ターン'} ${fmt(p.probability)}`).join('、'));
  }
  function renderSuggestions(items) {
    const root = $('suggestions'); root.replaceChildren();
    if (!items.length) { root.append(create('p','hint','条件外カードがなく、入れ替え候補がありません。')); return; }
    items.slice(0, 5).forEach(s => {
      const row = create('div','suggestion');
      const info = create('div');
      info.append(create('strong','',`${s.name}を ${s.step > 0 ? '+1枚' : '−1枚'}`));
      info.append(create('small','',`変更後 ${fmt(s.updated)}（元 ${fmt(s.baseline)}）`));
      row.append(info);
      row.append(create('span',`sug-delta${s.delta < 0 ? ' negative' : ''}`,`${s.delta >= 0 ? '+' : ''}${(s.delta * 100).toFixed(2)}pt`));
      const apply = create('button','sug-apply','反映 ↗');
      apply.type = 'button';
      apply.addEventListener('click', () => {
        const cfg = getConfig();
        cfg.groups[s.index].count += s.step;
        applyConfig(cfg);
        showMessage('1枚の変更を反映しました。');
      });
      row.append(apply); root.append(row);
    });
  }
  function download(filename, value, mime) {
    const file = new Blob([value], {type: mime});
    const url = URL.createObjectURL(file);
    const a = create('a'); a.href = url; a.download = filename;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2500);
  }
  function exportCsv() {
    if (!latest) { showMessage('条件を修正してから書き出してください'); return; }
    const {cfg, points} = latest;
    const rows = [['turn','cards_seen','probability','probability_percent'], ...points.map(p=>[p.turn,p.seen,p.probability.toFixed(12),(p.probability*100).toFixed(4)])];
    download('soroite-probability.csv','\uFEFF'+rows.map(r=>r.join(',')).join('\r\n')+'\r\n','text/csv;charset=utf-8');
  }
  function drawHand() {
    if (!latest) { showMessage('入力を正しく設定してください'); return; }
    const {cfg} = latest;
    sample = E.drawSample(cfg,cfg.hand);
    const root = $('sample-cards'); root.replaceChildren();
    cfg.groups.forEach((g, i) => {
      const card = create('div','sample-card',`${g.name} × ${sample.counts[i]}`);
      card.style.borderLeft = `4px solid ${colors[i]}`;
      root.append(card);
    });
    root.append(create('div','sample-card other',`その他 × ${sample.other}`));
    $('sample-status').textContent = sample.accepted ? '✓ この手札は全条件を満たしています' : '× この手札は条件を満たしていません';
    $('sample-status').className = `sample-status ${sample.accepted ? 'ok' : 'ng'}`;
  }
  async function importJson(file) {
    if (!file) return;
    try {
      if (file.size > 100_000) throw new Error('100KBを超えるファイルは読み込めません');
      const text = await file.text();
      const parsed = JSON.parse(text);
      const cfg = parsed && parsed.config ? parsed.config : parsed;
      E.validate(cfg);
      applyConfig(cfg);
      showMessage('JSONを読み込みました。');
    } catch (err) { showMessage(`JSONを読み込めません: ${err.message}`); }
    $('load-json').value = '';
  }
  $('groups').addEventListener('input', recompute);
  for (const id of ['deck','hand','turns','drawPerTurn']) $(id).addEventListener('input',recompute);
  $('add-group').addEventListener('click',() => {
    const cfg = getConfig();
    if (cfg.groups.length >= 4) return;
    cfg.groups.push({name:`カテゴリ${cfg.groups.length+1}`,count:0,min:0,max:200});
    renderGroups(cfg.groups); recompute();
  });
  $('reset').addEventListener('click',() => { applyConfig(defaults()); showMessage('デモの条件に戻しました。'); });
  $('save-json').addEventListener('click',() => {
    if (!latest) { showMessage('条件を修正してから保存してください'); return; }
    download('soroite-deck.json',JSON.stringify({version:1, config:latest.cfg}, null,2),'application/json;charset=utf-8');
  });
  $('load-json').addEventListener('change',(e)=>importJson(e.target.files[0]));
  $('draw-button').addEventListener('click',drawHand);
  $('export-csv').addEventListener('click',exportCsv);
  $('print').addEventListener('click',()=>window.print());
  applyConfig(storedConfig());
})();
