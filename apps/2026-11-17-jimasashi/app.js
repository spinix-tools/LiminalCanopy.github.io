/* UI for JIMASASHI — all imported subtitle text stays in this browser. */
(() => {
  'use strict';
  const E = window.JimasashiCore;
  if (!E) throw Error('計算エンジンを読み込めません');
  const $ = id => document.getElementById(id);
  const STORE = 'jimasashi-v1';
  const getPreset = key => ({ ...(E.presets[key] || E.presets.web) });
  let state = { cues: E.demo(), selected: 'demo1', preset: 'web', cfg: getPreset('web'), name: 'sample.srt' };
  let report = null;
  let toastTimer = 0;
  function restore() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (saved && Array.isArray(saved.cues) && saved.cues.length <= 10000 && saved.cues.every(E.validateCue) && saved.cfg && Number.isFinite(saved.cfg.cps) && Number.isFinite(saved.cfg.maxWidth) && saved.cfg.cps > 0 && saved.cfg.maxWidth > 0) {
        state = { ...state, ...saved, cfg: { ...getPreset('web'), ...saved.cfg } };
        if (!state.cues.some(x => x.id === state.selected)) state.selected = state.cues[0]?.id || null;
      }
    } catch (err) { showNotice('保存データを読み込めませんでした。初期サンプルを表示しています。'); }
  }
  function persist() {
    try { localStorage.setItem(STORE, JSON.stringify(state)); }
    catch (_) { showNotice('ブラウザ保存を利用できません。SRTファイルをダウンロードして控えてください。'); }
  }
  function showNotice(message) { $('notice').textContent = message; $('notice').classList.add('show'); }
  function clearNotice() { $('notice').textContent = ''; $('notice').classList.remove('show'); }
  function toast(message) {
    const el = $('toast'); el.textContent = message; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }
  function selectedCue() { return state.cues.find(x => x.id === state.selected) || null; }
  function newId() { return 'c_' + Math.random().toString(36).slice(2) + Date.now().toString(36); }
  function text(tag, cls, content) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    el.textContent = content;
    return el;
  }
  function cleanConfig() {
    for (const [name, min, max] of [['maxWidth', 1, 100], ['cps', .5, 50], ['minDuration', .1, 10]]) {
      const val = Number($(name).value);
      if (!Number.isFinite(val) || val < min || val > max) throw Error(`設定値「${name}」は${min}～${max}の範囲にしてください`);
    }
  }
  function drawList() {
    const target = $('cueList'); target.replaceChildren();
    const filter = $('filter').value, term = $('search').value.toLocaleLowerCase();
    const visible = state.cues.filter(c => {
      const flagged = report.warnings.get(c.id).length > 0;
      return (filter === 'all' || (filter === 'flagged' ? flagged : !flagged)) && c.text.toLocaleLowerCase().includes(term);
    });
    $('countLabel').textContent = `${visible.length} 件表示`;
    if (!visible.length) { target.append(text('p', 'empty', '該当する字幕がありません。検索や表示条件を変えてください。')); return; }
    for (const cue of visible) {
      const issues = report.warnings.get(cue.id);
      const node = document.createElement('button'); node.type = 'button';
      node.className = 'cue-card' + (cue.id === state.selected ? ' active' : '');
      node.setAttribute('aria-pressed', String(cue.id === state.selected));
      node.dataset.id = cue.id;
      const top = text('div', 'cue-top', '');
      top.append(text('span', 'cue-num', '#' + (state.cues.indexOf(cue) + 1)));
      top.append(text('span', 'cue-time', `${E.formatTime(cue.start)} → ${E.formatTime(cue.end)}`));
      top.append(text('span', 'status' + (issues.length ? ' bad' : ''), issues.length ? `${issues.length}件の指摘` : 'OK'));
      node.append(top, text('div', 'cue-text', cue.text || '（空の字幕）'));
      if (issues.length) node.append(text('span', 'cue-issues', issues.slice(0, 2).join(' / ') + (issues.length > 2 ? ' …' : '')));
      node.addEventListener('click', () => { state.selected = cue.id; persist(); draw(); });
      target.append(node);
    }
  }
  function drawEditor() {
    const cue = selectedCue();
    for (const id of ['start','end','cueText','autoBreak','joinLines','removeCue','prevCue','nextCue']) $(id).disabled = !cue;
    if (!cue) {
      $('start').value = ''; $('end').value = ''; $('cueText').value = '';
      $('inspect').replaceChildren(); $('subtitlePreview').textContent = '字幕を追加してください';
      $('errorList').replaceChildren(); return;
    }
    $('start').value = E.formatTime(cue.start);
    $('end').value = E.formatTime(cue.end);
    $('cueText').value = cue.text;
    const lines = cue.text.split('\n');
    const width = Math.max(...lines.map(E.width), 0);
    const cps = lines.reduce((n, l) => n + E.width(l.replace(/\s/g, '')), 0) / ((cue.end - cue.start) / 1000);
    $('inspect').replaceChildren();
    for (const [value, label] of [[`${width}`, '最長行の文字相当数'], [`${cps.toFixed(1)} /秒`, '平均の表示速度（概算）']]) {
      const c = document.createElement('div'); c.append(text('b', '', value), text('span', '', label)); $('inspect').append(c);
    }
    const errors = report.warnings.get(cue.id);
    $('errorList').replaceChildren();
    const alert = text('div', 'error-list' + (errors.length ? '' : ' ok'), '');
    alert.append(text('strong', '', errors.length ? `${errors.length}件の確認ポイント` : 'この基準では指摘なし'));
    if (errors.length) {
      const ul = document.createElement('ul');
      for (const issue of errors) ul.append(text('li', '', issue));
      alert.append(ul);
    }
    $('errorList').append(alert);
    $('subtitlePreview').textContent = cue.text;
    const idx = state.cues.indexOf(cue);
    $('prevCue').disabled = idx <= 0;
    $('nextCue').disabled = idx >= state.cues.length - 1;
  }
  function draw(keepEditor = false) {
    report = E.audit(state.cues, state.cfg);
    $('metricTotal').textContent = report.total;
    $('metricFlagged').textContent = report.flagged;
    $('metricIssues').textContent = report.issues;
    $('preset').value = state.preset;
    for (const id of ['maxWidth','cps','minDuration']) $(id).value = state.cfg[id];
    drawList();
    if (!keepEditor) drawEditor();
    else {
      const cue = selectedCue();
      if (cue) {
        $('subtitlePreview').textContent = cue.text;
        const current = $('cueText'); if (document.activeElement !== current) current.value = cue.text;
        const lines = cue.text.split('\n');
        const longest = Math.max(...lines.map(E.width), 0);
        const cps = lines.reduce((n, line) => n + E.width(line.replace(/\s/g, '')), 0) / ((cue.end - cue.start) / 1000);
        const values = $('inspect').querySelectorAll('b');
        if (values[0]) values[0].textContent = String(longest);
        if (values[1]) values[1].textContent = cps.toFixed(1) + ' /秒';
      }
      // Diagnostics change while typing, without replacing the focused textarea/cursor.
      const idx = state.cues.indexOf(cue); if (idx >= 0) { const w = report.warnings.get(cue.id); const summary = $('errorList'); summary.replaceChildren(text('div', 'error-list' + (w.length ? '' : ' ok'), w.length ? w.join(' / ') : 'この基準では指摘なし')); }
    }
  }
  function editSelected(fn) {
    const cue = selectedCue(); if (!cue) return;
    try { clearNotice(); fn(cue); persist(); draw(); }
    catch (err) { showNotice(err.message); }
  }
  function download(content, fileName, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = fileName;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const stem = () => (state.name || 'subtitles').replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9\u3000-\u9fff\uff00-\uffef_-]/g, '_').slice(0, 70) || 'subtitles';
  $('fileInput').addEventListener('change', async ev => {
    const file = ev.target.files?.[0]; if (!file) return;
    try {
      if (file.size > 2 * 1024 * 1024) throw Error('最大2MBの字幕ファイルを指定してください');
      const parsed = E.parse(await file.text());
      state.cues = parsed.cues.map(c => ({ ...c, id: newId() }));
      state.selected = state.cues[0].id;
      state.name = file.name;
      $('search').value = ''; $('filter').value = 'all';
      clearNotice(); persist(); draw();
      toast(`${state.cues.length}件を読み込みました${parsed.skippedMeta ? `（メタ情報${parsed.skippedMeta}件は省略）` : ''}`);
    } catch (err) { showNotice('読込失敗：' + err.message + '。元の編集内容は保持しました。'); }
    finally { ev.target.value = ''; }
  });
  $('addCue').addEventListener('click', () => {
    const last = state.cues.length ? Math.max(...state.cues.map(c => c.end)) : 0;
    const cue = { id: newId(), start: last + 200, end: last + 2200, text: '新しい字幕' };
    state.cues.push(cue); state.selected = cue.id; $('search').value = ''; $('filter').value = 'all'; clearNotice(); persist(); draw(); toast('字幕を追加しました');
  });
  $('removeCue').addEventListener('click', () => {
    const i = state.cues.findIndex(c => c.id === state.selected); if (i < 0) return;
    state.cues.splice(i, 1); state.selected = state.cues[Math.min(i, state.cues.length - 1)]?.id || null;
    clearNotice(); persist(); draw(); toast('字幕を削除しました');
  });
  $('cueText').addEventListener('input', ev => {
    const cue = selectedCue(); if (!cue) return;
    cue.text = ev.target.value.replace(/\r/g,''); persist(); draw(true);
  });
  function commitTime(which) {
    const cue = selectedCue(); if (!cue) return;
    try {
      const parsed = E.parseTime($(which).value);
      if (which === 'start' && parsed >= cue.end) throw Error('開始時刻は終了時刻より前にしてください');
      if (which === 'end' && parsed <= cue.start) throw Error('終了時刻は開始時刻より後にしてください');
      cue[which] = parsed; clearNotice(); persist(); draw();
    } catch (err) { showNotice(err.message); $(which).setAttribute('aria-invalid', 'true'); }
  }
  for (const id of ['start','end']) {
    $(id).addEventListener('change', () => { $(id).removeAttribute('aria-invalid'); commitTime(id); });
  }
  $('autoBreak').addEventListener('click', () => editSelected(c => { c.text = E.autoBreak(c.text, state.cfg.maxWidth); toast('改行候補を適用しました。内容を確認してください'); }));
  $('joinLines').addEventListener('click', () => editSelected(c => { c.text = E.joinExistingLines(c.text); toast('改行を結合しました'); }));
  for (const [button, move] of [['prevCue', -1], ['nextCue', 1]]) $(button).addEventListener('click', () => {
    const next = state.cues[state.cues.findIndex(c => c.id === state.selected) + move];
    if (next) { state.selected = next.id; persist(); draw(); }
  });
  $('filter').addEventListener('change', drawList);
  $('search').addEventListener('input', drawList);
  $('preset').addEventListener('change', ev => {
    state.preset = ev.target.value;
    if (state.preset !== 'custom') state.cfg = getPreset(state.preset);
    clearNotice(); persist(); draw();
  });
  for (const name of ['maxWidth','cps','minDuration']) $(name).addEventListener('change', () => {
    try { cleanConfig(); state.cfg[name] = Number($(name).value); state.preset = 'custom'; clearNotice(); persist(); draw(); }
    catch (err) { showNotice(err.message); draw(); }
  });
  $('shiftBtn').addEventListener('click', () => {
    try {
      const amount = Number($('shiftAmount').value);
      if (!Number.isFinite(amount) || $('shiftAmount').value.trim() === '' || Math.abs(amount) > 3600) throw Error('移動量は-3600～3600秒で入力してください');
      state.cues = E.shift(state.cues, Math.round(amount * 1000));
      clearNotice(); persist(); draw(); toast(`全体を${amount}秒移動しました`);
    } catch (err) { showNotice(err.message); }
  });
  for (const [id, kind] of [['saveSrt','srt'], ['saveVtt','vtt']]) $(id).addEventListener('click', () => {
    try {
      if (!state.cues.length) throw Error('字幕がありません。先に字幕を追加してください');
      const out = E.serialize(state.cues, kind);
      download('\uFEFF' + out, `${stem()}-checked.${kind}`, kind === 'srt' ? 'application/x-subrip;charset=utf-8' : 'text/vtt;charset=utf-8');
      clearNotice(); toast(`${kind.toUpperCase()}を書き出しました`);
    } catch (err) { showNotice(err.message); }
  });
  $('qaExport').addEventListener('click', () => {
    if (!state.cues.length) return showNotice('点検対象の字幕がありません');
    download(E.report(state.cues, state.cfg), `${stem()}-qa.csv`, 'text/csv;charset=utf-8');
    toast('QA一覧CSVを書き出しました');
  });
  $('demoBtn').addEventListener('click', () => {
    state.cues = E.demo(); state.selected = 'demo1'; state.name = 'sample.srt';
    $('search').value = ''; $('filter').value = 'all'; clearNotice(); persist(); draw(); toast('サンプルを表示しました');
  });
  restore(); draw();
})();