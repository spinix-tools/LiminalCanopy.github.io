/* 字幕余白 — local-only browser UI. */
(() => {
  'use strict';
  const E = window.JimakuEngine;
  if (!E) throw new Error('engine.js が読み込まれていません');
  const $ = id => document.getElementById(id);
  const KEY = 'jimaku-yohaku-project-v1';
  const sample = [
    { start: 0, end: 1900, text: '新しい季節、あなたの物語をはじめよう。' },
    { start: 1800, end: 3350, text: '小さな挑戦が、きっと大きな発見になります。' },
    { start: 3550, end: 5450, text: '毎日のなかに、ちょっとした余白を。' },
    { start: 5550, end: 6300, text: 'ぜひ、試してみてください！' },
    { start: 6400, end: 9300, text: '字幕の長さと時間を整えると、言葉がもっと伝わる。' }
  ];
  let state = { cues: E.normalizeCues(sample), settings: { ...E.DEFAULT_SETTINGS }, selected: 1, current: 0, filter: 'all' };
  let videoURL = null, previewTimer = null, running = false, toastTimer = null;
  function safeStorageLoad() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      state.cues = E.normalizeCues(data.cues);
      state.settings = validateSettings(data.settings);
      state.selected = state.cues[0]?.id ?? 0;
    } catch (err) { console.warn('Local state not restored', err); }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ cues: state.cues, settings: state.settings })); } catch (err) { console.warn('Local save unavailable', err); } }
  function validateSettings(obj = {}) {
    const x = { ...E.DEFAULT_SETTINGS };
    for (const [name, lo, hi] of [['cps', 1, 60], ['maxChars', 4, 80], ['maxLines', 1, 4], ['minDuration', 100, 8000], ['position', 10, 88]]) {
      const val = Number(obj?.[name]); if (Number.isFinite(val)) x[name] = Math.max(lo, Math.min(hi, Math.round(val)));
    }
    if (E.PRESETS[obj?.platform]) x.platform = obj.platform;
    return x;
  }
  function escape(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function shortStamp(ms) { const m = Math.max(0, Math.round(ms)); return `${String(Math.floor(m / 60000)).padStart(2,'0')}:${String(Math.floor(m % 60000 / 1000)).padStart(2, '0')}.${Math.floor(m % 1000 / 100)}`; }
  function toast(text, isError = false) { const el = $('toast'); el.textContent = text; el.className = 'toast show' + (isError ? ' error' : ''); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.className = 'toast', 2800); }
  function report() { return E.assess(state.cues, state.settings); }
  function updateControls() {
    for (const k of ['cps', 'maxChars', 'maxLines', 'minDuration', 'platform', 'position']) $(k).value = state.settings[k];
    $('positionNumber').textContent = state.settings.position + '%';
  }
  function updateSummary(r = report()) {
    $('metricTotal').textContent = r.total;
    $('metricErrors').textContent = r.errors;
    $('metricWarnings').textContent = r.warnings;
    $('metricDuration').textContent = shortStamp(r.duration);
    $('issueCounter').textContent = `${r.flagged}件を確認`;
    $('endTime').textContent = shortStamp(r.duration);
    $('playhead').max = Math.max(100, r.duration);
    $('playhead').value = Math.min(state.current, r.duration);
  }
  function preview(r = report()) {
    const platform = E.PRESETS[state.settings.platform];
    const el = $('previewStage');
    el.classList.toggle('landscape', state.settings.platform === 'landscape');
    el.style.setProperty('--t', platform.top + '%');
    el.style.setProperty('--b', platform.bottom + '%');
    el.style.setProperty('--l', platform.left + '%');
    el.style.setProperty('--r', platform.right + '%');
    el.style.setProperty('--position', state.settings.position + '%');
    $('formatTag').textContent = state.settings.platform === 'landscape' ? '16:9' : '9:16';
    $('previewPlatform').textContent = platform.label;
    $('positionNumber').textContent = state.settings.position + '%';
    const risk = E.positionRisk(state.settings.platform, state.settings.position);
    const hint = $('positionWarning');
    hint.className = 'hint' + (risk ? ' risk' : '');
    hint.textContent = risk ? '注意：この位置の字幕は推定UI占有領域に重なります。上下に移動してください。' : '推定セーフエリア内です。ただし配信画面・機種での実確認が必要です。';
    const active = state.cues.find(c => c.start <= state.current && state.current < c.end);
    $('captionOverlay').textContent = active ? active.text : (state.cues.length ? '（この時刻に字幕はありません）' : '字幕を読み込んでください');
    $('currentTime').textContent = shortStamp(state.current);
  }
  function showCues(r = report()) {
    const list = $('cueList');
    const visible = state.filter === 'issues' ? r.rows.filter(row => row.issues.length) : r.rows;
    if (!visible.length) { list.innerHTML = '<div class="empty-state">表示する字幕がありません。条件を変えるか、字幕を追加してください。</div>'; return; }
    list.innerHTML = visible.map(row => {
      const c = row.cue;
      return `<article class="cue ${c.id === state.selected ? 'active' : ''}" data-id="${c.id}">
      <div class="cue-top"><button class="cue-index" data-action="select" data-id="${c.id}" title="再生位置をこの字幕に移動">CUE ${String(c.id).padStart(2, '0')} ↗</button><div class="cue-nav"><button data-action="wrap" data-id="${c.id}" title="この字幕を再分割">行分割</button><button data-action="remove" data-id="${c.id}" title="削除">削除 ×</button></div></div>
      <div class="cue-time"><input aria-label="字幕${c.id}の開始時刻" data-field="start" data-id="${c.id}" value="${escape(E.stamp(c.start))}"><span>→</span><input aria-label="字幕${c.id}の終了時刻" data-field="end" data-id="${c.id}" value="${escape(E.stamp(c.end))}"></div>
      <textarea aria-label="字幕${c.id}のテキスト" data-field="text" data-id="${c.id}" rows="2">${escape(c.text)}</textarea>
      <div class="cue-footer"><span class="cue-reading">${row.length}字 / ${Number.isFinite(row.cps) ? row.cps : '∞'} 字/秒 / ${row.maxLine}字×${row.lineCount}行</span><span class="cue-status ${row.issues.length ? 'bad' : ''}">${row.issues.length ? `● ${row.issues.length} 件の指摘` : '✓ OK'}</span></div>
      ${row.issues.length ? '<div class="issue-tags">' + row.issues.map(issue => `<span class="${issue.severity === 'warning' ? 'warn' : ''}">${escape(issue.message)}</span>`).join('') + '</div>' : ''}
      </article>`;
    }).join('');
  }
  function render(full = true) { const r = report(); updateSummary(r); preview(r); if (full) showCues(r); }
  function applyCues(cues, notice) { state.cues = E.normalizeCues(cues); state.selected = state.cues[0]?.id ?? 0; state.current = state.cues[0]?.start || 0; pause(); save(); render(); if (notice) toast(notice); }
  function selectCue(id) { const cue = state.cues[id - 1]; if (!cue) return; state.selected = id; state.current = cue.start; if (videoURL) $('video').currentTime = cue.start / 1000; render(); }
  function download(filename, content, type = 'text/plain;charset=utf-8') {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast(filename + ' を保存しました');
  }
  async function loadFile(file) {
    if (!file) return;
    try {
      if (file.size > 4_000_000) throw new Error('字幕ファイルは4MB以下で指定してください');
      const text = await file.text();
      if (/\.json$/i.test(file.name)) {
        const data = JSON.parse(text);
        const input = Array.isArray(data) ? data : data.cues;
        if (data.settings) { state.settings = validateSettings(data.settings); updateControls(); }
        applyCues(input, `${input.length}件のJSONデータを読み込みました`);
      } else {
        const result = E.parseSubtitles(text);
        applyCues(result.cues, `${result.cues.length}件の${result.format.toUpperCase()}を読み込みました${result.skipped ? `（${result.skipped}ブロック省略）` : ''}`);
      }
    } catch (err) { toast('読み込み失敗：' + err.message, true); }
  }
  function setCurrent(ms) { state.current = Math.max(0, Math.min(Number(ms) || 0, report().duration)); preview(); $('playhead').value = state.current; }
  function pause() { running = false; clearInterval(previewTimer); previewTimer = null; if (videoURL) $('video').pause(); $('playBtn').textContent = '▶'; $('playBtn').ariaLabel = 'プレビュー再生'; }
  function play() {
    if (running) { pause(); return; }
    const duration = report().duration;
    if (state.current >= duration) setCurrent(0);
    running = true; $('playBtn').textContent = 'Ⅱ'; $('playBtn').ariaLabel = 'プレビュー停止';
    if (videoURL) {
      $('video').currentTime = state.current / 1000;
      $('video').play().catch(() => { pause(); toast('映像再生にはブラウザの許可が必要です', true); });
    } else {
      let start = performance.now() - state.current;
      previewTimer = setInterval(() => { const next = Math.min(performance.now() - start, duration); setCurrent(next); if (next >= duration) pause(); }, 60);
    }
  }
  function wire() {
    $('subtitleFile').addEventListener('change', ev => { loadFile(ev.target.files?.[0]); ev.target.value = ''; });
    $('videoFile').addEventListener('change', ev => {
      const f = ev.target.files?.[0]; if (!f) return;
      if (!f.type.startsWith('video/')) { toast('映像ファイルを選んでください', true); return; }
      pause(); if (videoURL) URL.revokeObjectURL(videoURL);
      videoURL = URL.createObjectURL(f); $('video').src = videoURL; $('previewStage').classList.add('has-video');
      $('video').load(); $('video').currentTime = state.current / 1000; toast('映像を端末内で読み込みました（送信なし）');
      ev.target.value = '';
    });
    $('video').addEventListener('timeupdate', () => { if (videoURL) setCurrent($('video').currentTime * 1000); });
    $('video').addEventListener('ended', pause);
    $('pasteOpen').addEventListener('click', () => { $('pasteArea').value = ''; $('pasteDialog').showModal(); });
    $('pasteDialog').addEventListener('close', () => {
      if ($('pasteDialog').returnValue !== 'import') return;
      try { const parsed = E.parseSubtitles($('pasteArea').value); applyCues(parsed.cues, `${parsed.cues.length}件を読み込みました`); }
      catch (err) { toast(err.message, true); }
    });
    $('sampleBtn').addEventListener('click', () => { state.settings = { ...E.DEFAULT_SETTINGS }; updateControls(); applyCues(sample, 'サンプルを復元しました'); });
    $('exportSrt').addEventListener('click', () => download('jimaku-yohaku.srt', E.serializeSrt(state.cues)));
    $('exportVtt').addEventListener('click', () => download('jimaku-yohaku.vtt', E.serializeVtt(state.cues), 'text/vtt;charset=utf-8'));
    $('exportJson').addEventListener('click', () => download('jimaku-yohaku.json', JSON.stringify({ app: 'JIMAKU_YOHAKU', version: 1, cues: state.cues, settings: state.settings }, null, 2), 'application/json;charset=utf-8'));
    $('reportCsv').addEventListener('click', () => download('jimaku-yohaku-report.csv', E.toCsvReport(report()), 'text/csv;charset=utf-8'));
    for (const name of ['cps', 'maxChars', 'maxLines', 'minDuration', 'platform', 'position']) {
      $(name).addEventListener('input', () => { state.settings = validateSettings({ ...state.settings, [name]: $(name).value }); save(); render(name !== 'position'); });
    }
    $('filter').addEventListener('change', () => { state.filter = $('filter').value; render(); });
    $('reflowAll').addEventListener('click', () => { const before = state.cues.map(c => c.text); state.cues = E.reflowAll(state.cues, state.settings); const count = state.cues.filter((c,i) => c.text !== before[i]).length; save(); render(); toast(`${count}件の行分割を調整しました。原稿を確認してください。`); });
    $('trimAll').addEventListener('click', () => { const result = E.trimOverlaps(state.cues, 100); state.cues = result.cues; save(); render(); toast(`${result.fixed}件の終了時間を短縮しました。音声との同期を確認してください。`); });
    $('shiftBtn').addEventListener('click', () => { try { const result = E.shiftAll(state.cues, Number($('shiftAmount').value)); state.cues = result.cues; state.current = Math.max(0, state.current + result.applied); save(); render(); toast(`${result.applied}ms移動しました`); } catch (err) { toast(err.message, true); } });
    $('resetLocal').addEventListener('click', () => {
      if (!confirm('端末内の保存データを削除して、サンプルに戻しますか？')) return;
      try { localStorage.removeItem(KEY); } catch (_err) {}
      state.settings = { ...E.DEFAULT_SETTINGS }; updateControls(); applyCues(sample, '保存データを削除しました'); try { localStorage.removeItem(KEY); } catch (_err) {}
    });
    $('cueList').addEventListener('click', e => {
      const btn = e.target.closest('[data-action]'); if (!btn) return;
      const id = Number(btn.dataset.id), cue = state.cues[id - 1]; if (!cue) return;
      switch (btn.dataset.action) {
        case 'select': selectCue(id); break;
        case 'wrap': cue.text = E.reflow(cue.text, state.settings.maxChars, state.settings.maxLines); save(); render(); toast('この字幕を行分割しました'); break;
        case 'remove': state.cues.splice(id - 1, 1); state.cues = E.normalizeCues(state.cues); state.selected = state.cues[0]?.id || 0; save(); render(); toast('字幕を削除しました'); break;
      }
    });
    $('cueList').addEventListener('input', e => {
      if (e.target.dataset.field !== 'text') return;
      const cue = state.cues[Number(e.target.dataset.id) - 1]; if (!cue) return;
      cue.text = e.target.value.slice(0, 4000); save(); updateSummary(); preview();
    });
    $('cueList').addEventListener('change', e => {
      const el = e.target, id = Number(el.dataset.id), cue = state.cues[id - 1]; if (!cue) return;
      if (el.dataset.field === 'start' || el.dataset.field === 'end') {
        try { cue[el.dataset.field] = E.parseStamp(el.value); } catch (err) { toast(err.message, true); }
      }
      save(); render();
    });
    $('addCue').addEventListener('click', () => {
      if (state.cues.length >= 5000) { toast('字幕は5000件までです', true); return; }
      const last = state.cues[state.cues.length - 1]; const start = last ? last.end + 300 : 0;
      state.cues.push({ id: state.cues.length + 1, start, end: start + 2400, text: '新しい字幕を入力' });
      state.selected = state.cues.length; state.current = start; save(); render();
      const cards = $('cueList').querySelectorAll('.cue'); cards[cards.length-1]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      toast('字幕を追加しました');
    });
    $('playBtn').addEventListener('click', play);
    $('playhead').addEventListener('input', () => { const ms = Number($('playhead').value); setCurrent(ms); if (videoURL) $('video').currentTime = ms / 1000; });
    window.addEventListener('beforeunload', () => { pause(); if (videoURL) URL.revokeObjectURL(videoURL); });
  }
  safeStorageLoad(); updateControls(); wire(); render();
})();
