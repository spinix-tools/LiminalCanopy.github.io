/* Browser controller; exposure calculation and CSV logic live in engine.js. */
(function () {
  'use strict';
  const E = window.RokoEngine;
  if (!E) return;
  const $ = (id) => document.getElementById(id);
  const KEY = 'roko-dandori-v1';
  let state = E.example();
  let current = null;
  let selected = 0;
  let timer = { remaining: 0, full: 0, deadline: null, tick: null, running: false, done: false };
  const ND_NAMES = ['なし (×1)', 'ND2', 'ND4', 'ND8', 'ND16', 'ND32', 'ND64', 'ND400', 'ND1000'];
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  }
  function append(parent, ...children) { children.forEach(x => parent.appendChild(x)); return parent; }
  function button(text, handler, title = '') {
    const b = el('button', '', text); b.type = 'button'; b.title = title || text;
    b.addEventListener('click', handler); return b;
  }
  function field(parent, text, prop, value, type = 'text', attrs = {}) {
    const lab = el('label', prop === 'name' ? 'name-field' : prop === 'note' ? 'note-field' : prop === 'exponent' ? 'exp-field' : '');
    append(lab, el('span', '', text));
    const inp = el('input'); inp.type = type; inp.value = String(value);
    for (const [k, v] of Object.entries(attrs)) inp.setAttribute(k, String(v));
    inp.setAttribute('aria-label', text);
    inp.addEventListener('input', event => {
      state.shots[Number(parent.dataset.idx)][prop] = event.target.value;
      recalc();
    });
    append(lab, inp); append(parent, lab);
  }
  function selection(parent, text, prop, value) {
    const lab = el('label'); append(lab, el('span', '', text));
    const select = el('select'); select.setAttribute('aria-label', text);
    E.ND.forEach((factor, i) => {
      const opt = el('option', '', ND_NAMES[i]); opt.value = String(factor); opt.selected = factor === Number(value); append(select, opt);
    });
    select.addEventListener('change', () => { state.shots[Number(parent.dataset.idx)][prop] = Number(select.value); recalc(); });
    append(lab, select); append(parent, lab);
  }
  function renderShots() {
    const host = $('shotList'); host.replaceChildren();
    state.shots.forEach((shot, i) => {
      const card = el('article', 'shot-card');
      const head = el('div', 'shot-head');
      append(head, el('strong', '', `SCENE ${String(i + 1).padStart(2, '0')}`));
      const controls = el('div', 'shot-controls');
      const up = button('↑', () => move(i, -1), '上に移動'); up.disabled = i === 0;
      const down = button('↓', () => move(i, 1), '下に移動'); down.disabled = i === state.shots.length - 1;
      const duplicate = button('⧉', () => duplicateShot(i), '複製'); duplicate.disabled = state.shots.length >= E.MAX_SHOTS;
      const remove = button('×', () => { if (state.shots.length > 1) { state.shots.splice(i, 1); renderShots(); recalc(); } }, '削除'); remove.disabled = state.shots.length === 1;
      append(controls, up, down, duplicate, remove); append(head, controls);
      const editor = el('div', 'shot-editor'); editor.dataset.idx = String(i);
      field(editor, '撮影名', 'name', shot.name, 'text', { maxlength: 48 });
      field(editor, '測光時間（秒）', 'meter', shot.meter, 'text', { inputmode: 'decimal' });
      selection(editor, 'NDフィルター 1', 'nd1', shot.nd1);
      selection(editor, 'NDフィルター 2', 'nd2', shot.nd2);
      field(editor, '補正指数 p', 'exponent', shot.exponent, 'number', { min: 1, max: 1.8, step: 0.01 });
      const checkLabel = el('label', 'check-field');
      const checkbox = el('input'); checkbox.type = 'checkbox'; checkbox.checked = !!shot.bracket; checkbox.setAttribute('aria-label', '±1 EVのブラケット');
      checkbox.addEventListener('change', () => { state.shots[i].bracket = checkbox.checked; recalc(); });
      append(checkLabel, checkbox, el('span', '', '±1 EVで3コマ撮影')); append(editor, checkLabel);
      field(editor, '撮影メモ（任意）', 'note', shot.note, 'text', { maxlength: 120 });
      append(card, head, editor); append(host, card);
    });
    $('addShot').disabled = state.shots.length >= E.MAX_SHOTS;
  }
  function move(i, delta) {
    const j = i + delta; if (j < 0 || j >= state.shots.length) return;
    [state.shots[i], state.shots[j]] = [state.shots[j], state.shots[i]];
    renderShots(); recalc();
  }
  function duplicateShot(i) {
    if (state.shots.length >= E.MAX_SHOTS) return;
    state.shots.splice(i + 1, 0, { ...state.shots[i], name: `${state.shots[i].name} コピー`.slice(0, 48) });
    renderShots(); recalc();
  }
  function getPlan() {
    return E.validatePlan({ ...state, start: $('start').value, gap: $('gap').value, budget: $('budget').value });
  }
  function updateStateFromInputs() {
    state.start = $('start').value; state.gap = $('gap').value; state.budget = $('budget').value;
  }
  function showError(message) { $('error').hidden = !message; $('error').textContent = message || ''; }
  function setStatus(message) { $('status').textContent = message; }
  function recalc() {
    updateStateFromInputs();
    try {
      const computed = E.schedule(getPlan());
      current = computed;
      showError('');
      $('totalTime').textContent = E.formatSeconds(computed.total);
      $('totalDetail').textContent = `露光 ${E.formatSeconds(computed.exposureTotal)} / 準備 ${E.formatSeconds(computed.gapTotal)}`;
      $('frameCount').textContent = `${computed.frames.length} コマ`;
      $('shotDetail').textContent = `${computed.plan.shots.length} シーン`;
      $('endTime').textContent = computed.endClock;
      $('budgetDetail').textContent = computed.fits ? `残り ${E.formatSeconds(computed.remaining)}` : `超過 ${E.formatSeconds(-computed.remaining)}`;
      $('fitsTag').textContent = computed.fits ? '撮影枠に収まります' : '撮影枠を超えています';
      $('fitsTag').style.color = computed.fits ? '#8dd3b8' : '#ee9889';
      $('framesSummary').textContent = `露光 ${E.formatSeconds(computed.exposureTotal)}`;
      paintTimeline(computed); paintFrames(computed); refreshTimerList(computed);
    } catch (err) {
      showError(err.message); current = null;
      $('totalTime').textContent = '—'; $('frameCount').textContent = '—'; $('endTime').textContent = '—';
      $('fitsTag').textContent = '入力確認'; $('timeline').replaceChildren(); $('frames').replaceChildren(); $('timerFrame').replaceChildren();
      stopTimer();
    }
  }
  function paintTimeline(model) {
    const host = $('timeline'); host.replaceChildren();
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 620 120'); svg.setAttribute('width', '100%'); svg.setAttribute('height', '120'); svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', '計画コマの露光と準備時間');
    const base = elSvg('line', { x1: 10, y1: 79, x2: 610, y2: 79, stroke: '#47606b', 'stroke-width': 1 }); append(svg, base);
    let x = 10; const full = model.total || 1; const width = 600;
    model.frames.forEach((frame, idx) => {
      if (idx) {
        const gapW = model.plan.gap / full * width;
        append(svg, elSvg('rect', { x, y: 31, width: gapW, height: 38, fill: '#3b5560', opacity: .9 })); x += gapW;
      }
      const w = frame.corrected / full * width;
      const color = idx % 3 === 0 ? '#eabd79' : idx % 3 === 1 ? '#d7a95e' : '#f2d6a6';
      const rect = elSvg('rect', { x, y: 31, width: Math.max(0, w), height: 38, fill: color, rx: 1 });
      const tooltip = document.createElementNS(NS, 'title'); tooltip.textContent = `${frame.scene} / ${frame.ev > 0 ? '+' : ''}${frame.ev}EV / ${E.formatSeconds(frame.corrected)}`; rect.appendChild(tooltip); append(svg, rect);
      if (w > 26) append(svg, elSvg('text', { x: x + w / 2, y: 54, 'text-anchor': 'middle', fill: '#19272e', 'font-size': 11, 'font-weight': 700 }, String(idx + 1)));
      x += w;
    });
    [0, .25, .5, .75, 1].forEach(t => {
      const x = 10 + t * width;
      append(svg, elSvg('line', { x1: x, y1: 79, x2: x, y2: 85, stroke: '#68828a' }));
      append(svg, elSvg('text', { x, y: 101, 'font-size': 10, fill: '#9bb3b7', 'text-anchor': t === 0 ? 'start' : t === 1 ? 'end' : 'middle' }, E.formatSeconds(model.total * t)));
    });
    append(svg, elSvg('text', { x: 10, y: 16, fill: '#aebfc1', 'font-size': 11 }, 'START ' + model.plan.start));
    append(svg, elSvg('text', { x: 610, y: 16, fill: '#e8c58d', 'font-size': 11, 'text-anchor': 'end' }, 'END ' + model.endClock));
    append(host, svg);
  }
  function elSvg(tag, attrs, text) {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
    if (text !== undefined) node.textContent = String(text); return node;
  }
  function paintFrames(model) {
    const host = $('frames'); host.replaceChildren();
    model.frames.forEach(f => {
      const frame = el('article', 'frame');
      append(frame, el('span', 'frame-num', f.index + 1));
      const detail = el('div');
      append(detail, el('strong', '', `${f.scene}　${f.ev > 0 ? '+' : ''}${f.ev} EV`));
      append(detail, el('div', 'frame-sub', `${E.clockAt(model.plan.start, f.startSec)} → ${E.clockAt(model.plan.start, f.endSec)} / ND×${f.ndFactor}`));
      const time = el('div', 'frame-time'); append(time, el('strong', '', E.formatSeconds(f.corrected)), el('small', '', `補正 +${E.formatSeconds(f.added)}`));
      append(frame, detail, time); append(host, frame);
    });
  }
  function refreshTimerList(model) {
    const previous = selected;
    const select = $('timerFrame'); select.replaceChildren();
    model.frames.forEach((f, i) => {const opt = el('option', '', `${String(i + 1).padStart(2, '0')} · ${f.scene} / ${f.ev > 0 ? '+' : ''}${f.ev}EV`); opt.value = String(i); append(select, opt);});
    selected = Math.min(previous, model.frames.length - 1); select.value = String(selected);
    timerReset();
  }
  function stopTimer() {
    if (timer.tick !== null) window.clearInterval(timer.tick);
    timer.tick = null; timer.running = false; timer.deadline = null;
  }
  function timerReset() {
    stopTimer(); timer.done = false;
    timer.full = current?.frames[selected]?.corrected || 0; timer.remaining = timer.full;
    paintTimer();
  }
  function paintTimer() {
    const n = Math.max(0, timer.remaining);
    $('timerValue').textContent = E.formatSeconds(n);
    $('timerStatus').textContent = timer.done ? 'DONE · SHUTTER CHECK' : timer.running ? 'EXPOSING' : (timer.remaining < timer.full ? 'PAUSED' : 'READY');
    $('timerProgress').style.width = timer.full > 0 ? `${Math.min(100, Math.max(0, (timer.full - n) / timer.full * 100))}%` : '0%';
    $('timerStart').disabled = !current || timer.running || timer.done;
    $('timerPause').disabled = !timer.running;
  }
  function timerStart() {
    if (!current || timer.running || timer.done) return;
    if (timer.remaining <= 0) { timerReset(); }
    timer.deadline = Date.now() + timer.remaining * 1000;
    timer.running = true;
    timer.tick = window.setInterval(() => {
      timer.remaining = Math.max(0, (timer.deadline - Date.now()) / 1000);
      if (timer.remaining <= 0) {stopTimer(); timer.done = true; }
      paintTimer();
    }, 100);
    paintTimer();
  }
  function timerPause() {
    if (!timer.running) return;
    timer.remaining = Math.max(0, (timer.deadline - Date.now()) / 1000);
    stopTimer(); paintTimer();
  }
  function download(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const uri = URL.createObjectURL(blob);
    const a = el('a'); a.href = uri; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    window.setTimeout(() => URL.revokeObjectURL(uri), 1000);
  }
  function checked() { const plan = getPlan(); E.schedule(plan); return plan; }
  function withStatus(action, success) {
    try { action(); setStatus(success); showError(''); }
    catch (err) { showError(err.message); setStatus('処理できませんでした。入力とブラウザ設定を確認してください。'); }
  }
  function applyPlan(p) {
    state = E.validatePlan(p);
    $('start').value = state.start; $('gap').value = state.gap; $('budget').value = state.budget;
    selected = 0; renderShots(); recalc();
  }
  ['start', 'budget', 'gap'].forEach(id => $(id).addEventListener('input', recalc));
  $('addShot').addEventListener('click', () => {
    if (state.shots.length >= E.MAX_SHOTS) return;
    state.shots.push({ name: `新しいシーン ${state.shots.length + 1}`, meter: '1/125', nd1: 1, nd2: 1, exponent: 1, bracket: false, note: '' });
    renderShots(); recalc();
  });
  $('timerFrame').addEventListener('change', e => { selected = Number(e.target.value) || 0; timerReset(); });
  $('timerStart').addEventListener('click', timerStart);
  $('timerPause').addEventListener('click', timerPause);
  $('timerReset').addEventListener('click', timerReset);
  $('csvBtn').addEventListener('click', () => withStatus(() => download('roko-dandori-frames.csv', '\uFEFF' + E.csv(checked()), 'text/csv;charset=utf-8'), '撮影票CSVを保存しました。'));
  $('jsonBtn').addEventListener('click', () => withStatus(() => download('roko-dandori-plan.json', JSON.stringify(checked(), null, 2), 'application/json;charset=utf-8'), '計画JSONを保存しました。'));
  $('importBtn').addEventListener('click', () => $('jsonFile').click());
  $('jsonFile').addEventListener('change', async e => {
    const file = e.target.files[0]; if (!file) return;
    try {
      if (file.size > 100000) throw new Error('100KB以下のJSONを選んでください');
      const txt = await file.text(); const parsed = E.validatePlan(JSON.parse(txt)); E.schedule(parsed);
      applyPlan(parsed); setStatus('JSONから計画を復元しました。'); showError('');
    } catch (err) { showError(`JSON読込: ${err.message}`); }
    finally { e.target.value = ''; }
  });
  $('saveBtn').addEventListener('click', () => withStatus(() => localStorage.setItem(KEY, JSON.stringify(checked())), 'このブラウザの端末内に保存しました。'));
  $('loadBtn').addEventListener('click', () => withStatus(() => {
    const txt = localStorage.getItem(KEY); if (!txt) throw new Error('端末内に保存済みの計画がありません');
    const obj = E.validatePlan(JSON.parse(txt)); E.schedule(obj); applyPlan(obj);
  }, '端末内の計画を復元しました。'));
  $('printBtn').addEventListener('click', () => withStatus(() => { checked(); window.print(); }, '印刷画面を開きました。'));
  renderShots(); recalc();
})();
