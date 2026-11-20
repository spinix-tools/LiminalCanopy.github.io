/* 字幕ものさし - UI. All content stays in the local browser. */
(function () {
  'use strict';
  const E = window.JimakuEngine;
  const $ = id => document.getElementById(id);
  const state = { cues: [], format: 'srt', name: 'sample_japanese.srt', selection: 0, filter: 'all', history: [], log: [], report: null, preset: 'jp' };
  function rules() { return { ...E.presets[state.preset], line: +$('ruleLine').value, cps: +$('ruleCps').value, min: +$('ruleMin').value }; }
  function language() { return state.preset === 'en' ? 'en' : 'jp'; }
  function shortTime(ms) { return E.formatTime(ms, 'vtt').replace(/^00:/, ''); }
  function showStatus(msg, bad = false) {
    const el = $('status'); el.textContent = msg; el.className = 'status' + (bad ? ' bad' : '');
  }
  function addLog(msg) {
    state.log.unshift(msg); if (state.log.length > 75) state.log.length = 75;
  }
  function checkpoint() {
    if (state.history.length >= 25) state.history.shift();
    state.history.push({ cues: E.clone(state.cues), selection: state.selection, log: state.log.slice() });
  }
  function loadDocument(data, name) {
    state.cues = E.clone(data.cues); state.format = data.format; state.name = name;
    state.selection = 0; state.history = []; state.log = []; state.filter = 'all';
    $('tabAll').classList.add('active'); $('tabAll').setAttribute('aria-pressed', 'true');
    $('tabProblem').classList.remove('active'); $('tabProblem').setAttribute('aria-pressed', 'false');
    $('fileName').textContent = name; render(); showStatus(`${state.cues.length}件の字幕を読み込みました（${data.format.toUpperCase()}）。`);
  }
  function buildFlag(label, level) { const s = document.createElement('span'); s.className = 'flag' + (level ? ' ' + level : ''); s.textContent = label; return s; }
  const codeLabel = { time: '時刻不正', empty: '空字幕', short: '短時間', long: '長時間', lines: '行数', width: '行幅超過', speed: '高速', kinsoku: '禁則', order: '順序', overlap: '重複' };
  function render() {
    state.report = E.check(state.cues, rules(), language());
    const rpt = state.report;
    $('statTotal').textContent = String(state.cues.length);
    $('statErrors').textContent = String(rpt.errors);
    $('statWarnings').textContent = String(rpt.warnings);
    $('statClean').textContent = String(rpt.clean);
    $('allCount').textContent = state.cues.length;
    $('problemCount').textContent = rpt.risky;
    $('undoBtn').disabled = state.history.length === 0;
    renderTimeline(); renderList(); renderEditor(); renderLog();
  }
  function renderTimeline() {
    const container = $('timeline'); container.replaceChildren();
    const origin = Math.min(0, ...state.cues.map(x => x.start));
    const end = Math.max(1000, ...state.cues.map(x => x.end));
    const duration = Math.max(1000, end - origin);
    $('timelineLength').textContent = E.formatTime(end, 'vtt');
    state.cues.forEach((c, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'timeline-segment';
      const problems = state.report.perCue[i];
      if (problems.some(x => x.level === 'error')) b.classList.add('error');
      else if (problems.length) b.classList.add('warn');
      if (state.selection === i) b.classList.add('active');
      b.style.left = `${Math.max(0, c.start - origin) / duration * 100}%`;
      b.style.width = `${Math.max(0.35, Math.max(0, c.end - c.start) / duration * 100)}%`;
      b.title = `#${i+1} ${shortTime(c.start)} / ${problems.length}件の指摘`;
      b.setAttribute('aria-label', b.title);
      b.onclick = () => select(i);
      container.append(b);
    });
  }
  function renderList() {
    const container = $('cueList'); container.replaceChildren();
    let count = 0;
    state.cues.forEach((c, i) => {
      const issues = state.report.perCue[i];
      if (state.filter === 'problems' && !issues.length) return;
      count++;
      const row = document.createElement('div'); row.className = 'cue-item' + (state.selection === i ? ' selected' : '');
      row.tabIndex = 0; row.setAttribute('role', 'button'); row.setAttribute('aria-label', `字幕 ${i+1} を編集`);
      row.addEventListener('click', () => select(i)); row.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(i); } });
      const n = document.createElement('div'); n.className = 'cue-number'; n.textContent = String(i+1).padStart(2,'0');
      const body = document.createElement('div'); body.className = 'cue-body';
      const times = document.createElement('div'); times.className = 'cue-time'; times.textContent = `${shortTime(c.start)}   →   ${shortTime(c.end)}`;
      const text = document.createElement('div'); text.className = 'cue-text'; text.textContent = c.text;
      const flags = document.createElement('div'); flags.className = 'cue-flags';
      if (issues.length === 0) flags.append(buildFlag('✓ OK', 'good'));
      else issues.slice(0, 4).forEach(x => flags.append(buildFlag(codeLabel[x.code] || x.code, x.level === 'error' ? 'error' : '')));
      if (issues.length > 4) flags.append(buildFlag(`+${issues.length-4}`));
      body.append(times,text,flags);
      const speed = document.createElement('div'); speed.className = 'cue-speed';
      const secs = (c.end-c.start)/1000; const cps = secs>0 ? E.countUnits(c.text,language())/secs : Infinity;
      if (cps > rules().cps) speed.classList.add('hot');
      speed.textContent = '字幅/s'; const strong = document.createElement('strong'); strong.textContent = Number.isFinite(cps) ? cps.toFixed(1) : '—'; speed.append(strong);
      row.append(n,body,speed); container.append(row);
    });
    if (!count) { const div = document.createElement('div'); div.className='empty-list'; div.textContent='この条件に該当する字幕はありません。';container.append(div); }
  }
  function renderEditor() {
    const c = state.cues[state.selection]; if (!c) return;
    $('editIndex').textContent = `#${String(state.selection + 1).padStart(2,'0')}`;
    $('editStart').value = E.formatTime(c.start, 'vtt');
    $('editEnd').value = E.formatTime(c.end, 'vtt');
    $('editText').value = c.text;
    const issues = $('editIssues'); issues.replaceChildren();
    const flags = state.report.perCue[state.selection];
    if (!flags.length) issues.append(buildFlag('この字幕はチェック上問題なし', 'good'));
    else flags.forEach(x => {const span=buildFlag(x.message, x.level === 'error' ? 'error' : ''); issues.append(span);});
    previewEditor();
  }
  function previewEditor() {
    const text = $('editText').value;
    $('previewText').textContent = text || '字幕を入力してください';
    const l = language(); let dur = 0;
    try { dur = (E.parseTime($('editEnd').value) - E.parseTime($('editStart').value)) / 1000; } catch { /* unfinished editing */ }
    $('editWidth').textContent = `総字幅 ${E.countUnits(text,l).toFixed(1)}`;
    $('editCps').textContent = `読速 ${dur > 0 ? (E.countUnits(text,l) / dur).toFixed(1) : '—'} 字幅/秒`;
  }
  function renderLog() {
    $('logCount').textContent = `編集履歴 ${state.log.length}件`;
    const list = $('logList'); list.replaceChildren();
    if (!state.log.length) { const li = document.createElement('li'); li.textContent='まだ変更はありません。'; list.append(li); }
    else state.log.slice(0, 15).forEach(x => { const li = document.createElement('li'); li.textContent=x; list.append(li); });
  }
  function select(i) { state.selection = i; render(); }
  function filter(name) {state.filter=name; for (const id of ['All','Problem']) {const active=(id.toLowerCase() === (name === 'all' ? 'all' : 'problem')); const el=$('tab'+id);el.classList.toggle('active',active);el.setAttribute('aria-pressed',String(active));}renderList();}
  function applyBatch(result, heading) {
    if (!result.changes.length) { showStatus(`${heading}: 自動変更なし。未処理 ${result.skipped.length}件を手動で確認してください。`); return; }
    checkpoint(); state.cues = result.cues;
    result.changes.forEach(c => addLog(`#${c.index + 1} ${heading}：${c.reason}`));
    render(); showStatus(`${heading}: ${result.changes.length}件を変更、${result.skipped.length}件を保留。元に戻すことができます。`);
  }
  function escapeCsv(value) {
    let v = String(value == null ? '' : value).replace(/\r?\n/g, '\\n');
    if (/^\s*[=+\-@]/.test(v)) v = "'" + v; // block spreadsheet formula injection
    return '"' + v.replace(/"/g,'""') + '"';
  }
  function csvReport() {
    const r = state.report;
    return ['番号,開始,終了,本文,字幅,秒,指摘数,問題の種類',
      ...state.cues.map((c, i) => [i+1, E.formatTime(c.start,'vtt'),E.formatTime(c.end,'vtt'),c.text,
        E.countUnits(c.text,language()).toFixed(1),((c.end-c.start)/1000).toFixed(3),r.perCue[i].length,r.perCue[i].map(x=>codeLabel[x.code]).join(';')].map(escapeCsv).join(','))].join('\r\n');
  }
  function download(name, content, mime) {
    const blob = new Blob([content], {type: mime});
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href=url; a.download=name; document.body.append(a);a.click();a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }
  function filename(ext) { return (state.name.replace(/\.(srt|vtt)$/i,'').replace(/[^a-zA-Z0-9ぁ-んァ-ヶ一-龯_-]/g,'_') || 'captions') + '_checked.' + ext; }
  async function importFile(f) {
    if (!f) return;
    if (f.size > 3 * 1024 * 1024) { showStatus('3MB以下の字幕テキストを選択してください。', true);return; }
    try { const source=await f.text(); const data=E.parseSubtitles(source);loadDocument(data,f.name); }
    catch (error) { showStatus('読み込めませんでした：' + error.message, true); }
    finally { $('fileInput').value=''; }
  }
  $('fileInput').addEventListener('change',e => importFile(e.target.files[0]));
  $('pasteToggle').onclick=()=>{$('pastePanel').classList.toggle('hidden');$('pasteText').focus();};
  $('pasteCancel').onclick=()=> $('pastePanel').classList.add('hidden');
  $('pasteLoad').onclick=()=>{try {const data=E.parseSubtitles($('pasteText').value);loadDocument(data,'pasted_subtitles.'+data.format);$('pastePanel').classList.add('hidden');}catch(e){showStatus(e.message,true);}};
  $('demoBtn').onclick=()=>loadDocument(E.demo(),'sample_japanese.srt');
  $('preset').onchange=()=>{state.preset=$('preset').value;const p=E.presets[state.preset];$('ruleLine').value=p.line;$('ruleCps').value=p.cps;$('ruleMin').value=p.min;render();showStatus('チェック基準を変更しました。字幕データは変更していません。');};
  ['ruleLine','ruleCps','ruleMin'].forEach(id => $(id).addEventListener('change',()=>{const el=$(id);if(!Number.isFinite(+el.value)||+el.value<+el.min||+el.value>+el.max){el.value=E.presets[state.preset][id==='ruleLine'?'line':id==='ruleCps'?'cps':'min'];}render();}));
  $('tabAll').onclick=()=>filter('all');$('tabProblem').onclick=()=>filter('problems');
  $('wrapBtn').onclick=()=>applyBatch(E.batchWrap(state.cues,rules(),language()),'改行調整');
  $('overlapBtn').onclick=()=>applyBatch(E.trimOverlaps(state.cues,rules().gap,500),'重なり調整');
  $('undoBtn').onclick=()=>{if(!state.history.length)return;const s=state.history.pop();state.cues=s.cues;state.selection=s.selection;state.log=s.log;render();showStatus('直前の編集を元に戻しました。');};
  ['editStart','editEnd','editText'].forEach(id=>$(id).addEventListener('input',previewEditor));
  $('editorForm').addEventListener('submit', e=>{
    e.preventDefault(); const i=state.selection;let start,end;
    try{start=E.parseTime($('editStart').value);end=E.parseTime($('editEnd').value);}catch(err){showStatus(err.message,true);return;}
    if(end<=start){showStatus('終了時刻は開始時刻より後にしてください。',true);return;}
    const text=$('editText').value; if(!text.trim()){showStatus('字幕テキストを入力してください。',true);return;}
    if(start===state.cues[i].start && end===state.cues[i].end && text===state.cues[i].text){showStatus('変更はありません。');return;}
    checkpoint();state.cues[i]={...state.cues[i],start,end,text};addLog(`#${i+1} 手動編集：時刻またはテキストを更新`);render();showStatus(`#${i+1} を保存しました。`);
  });
  $('srtBtn').onclick=()=>{try{download(filename('srt'),E.exportSubtitles(state.cues,'srt'),'text/plain;charset=utf-8');showStatus('SRTを書き出しました。音声との同期を最終確認してください。');}catch(e){showStatus(e.message,true);}};
  $('vttBtn').onclick=()=>{try{download(filename('vtt'),E.exportSubtitles(state.cues,'vtt'),'text/vtt;charset=utf-8');showStatus('WebVTTを書き出しました。音声との同期を最終確認してください。');}catch(e){showStatus(e.message,true);}};
  $('csvBtn').onclick=()=>{download(filename('csv'),'\uFEFF'+csvReport(),'text/csv;charset=utf-8');showStatus('診断CSVを書き出しました。');};
  loadDocument(E.demo(), 'sample_japanese.srt');
})();
