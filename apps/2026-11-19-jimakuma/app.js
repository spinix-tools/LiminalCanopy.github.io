/* 字幕の間 / JIMAKU-MA — no analytics, no API calls */
(() => {
'use strict';
const E = window.JimakuEngine;
const $ = id => document.getElementById(id);
const KEY = 'jimakuma:workspace:v1';
const DEMO = `1
00:00:00,000 --> 00:00:02,000
字幕は、ただ表示すればよいわけではありません。

2
00:00:01,800 --> 00:00:03,000
読めない速さで流れると、伝えたい言葉が追いつかなくなります。

3
00:00:03,400 --> 00:00:06,500
たった一秒の余白が、見る人の理解を助けます。

4
00:00:07,000 --> 00:00:08,700
まずは、字幕を見直してみましょう。`;
let cues = [], preset = 'casual', custom = { ...E.PRESETS.custom }, selectedId = null;
let nextId = 1, undo = [], playing = false, ticker = null, positionMs = 0;
const MAX_UNDO = 30;
function uid() { return 'cue-'+(nextId++); }
function opt() { return { cps: +$('cps').value, width: +$('width').value, lines: +$('lines').value, min: +$('min').value, max: 7000 }; }
function message(txt, error=false) { $('status').textContent = txt; $('status').classList.toggle('error', error); }
function snapshot() { undo.push(JSON.stringify({cues,selectedId,positionMs})); if (undo.length>MAX_UNDO) undo.shift(); $('undoBtn').disabled=false; }
function persist() { try { localStorage.setItem(KEY,JSON.stringify({version:1,cues,preset,custom,nextId})); } catch { message('端末内の保存容量に達しました。JSONバックアップをご利用ください。',true); } }
function normalize(arr) {
  if (!Array.isArray(arr) || arr.length>5000) throw new Error('字幕は最大5000件です');
  const cleaned = [];
  for (const c of arr) {
    const start = Number(c.start), end = Number(c.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start<0 || end<=start || end>360000000) throw new Error('字幕の時刻が不正です');
    if (typeof c.text!=='string' || c.text.length>20000) throw new Error('字幕テキストが不正です');
    cleaned.push({id:uid(), start:Math.round(start), end:Math.round(end), text:c.text.replace(/\r\n?/g,'\n')});
  }
  return cleaned;
}
function setCues(arr, desc) { snapshot(); cues=normalize(arr); selectedId=cues[0]?.id||null; positionMs=cues[0]?.start||0; stop(); persist(); render(); message(desc || `${cues.length}件を読み込みました。`); }
function getCue(id) { return cues.find(c=>c.id===id); }
function limitsValid(){ const o=opt(); return o.cps>=1&&o.cps<=50&&o.width>=4&&o.width<=60&&o.lines>=1&&o.lines<=3&&o.min>=100&&o.min<=5000; }
function settingChange(){ if (!limitsValid()) { message('検査値が範囲外です。数字を確認してください。',true); return; } if (preset==='custom') custom=opt(); persist(); render(); }
function applyPreset(key) { preset=key; const o=key==='custom'?custom:E.PRESETS[key]; ['cps','width','lines','min'].forEach(k=>$(k).value=o[k]); persist(); render(); }
function durationString(ms) { if (!Number.isFinite(ms)) return '—'; const s=Math.round(ms/1000); return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`; }
function make(tag, className, text) { const n=document.createElement(tag); if(className)n.className=className;if(text!=null)n.textContent=text;return n; }
function btn(label, action, id, extra=''){ const b=make('button','tiny '+extra,label); b.type='button'; b.dataset.action=action; b.dataset.id=id;return b; }
function buildCue(c, i, analysis) {
  const a=analysis.byId.get(c.id), row=make('article','cue'+(a.issues.length?' issue':'')+(c.id===selectedId?' selected':'')); row.dataset.id=c.id;
  const num=make('div','cue-index',String(i+1).padStart(2,'0')); row.append(num);
  const content=make('div','cue-fields'); const times=make('div','cue-times');
  for(const key of ['start','end']) {const field=make('input');field.type='text';field.value=E.timecode(c[key]);field.dataset.field=key;field.dataset.id=c.id;field.setAttribute('aria-label',(i+1)+'番の'+(key==='start'?'開始':'終了')+'時刻');times.append(field);if(key==='start')times.append(make('span',null,'→'));}
  content.append(times);
  const textarea=make('textarea','cue-text');textarea.value=c.text;textarea.rows=2;textarea.dataset.field='text';textarea.dataset.id=c.id;textarea.setAttribute('aria-label',`${i+1}番の字幕内容`);content.append(textarea);
  const foot=make('div','cue-foot'), chips=make('div','chips');
  if(a.issues.length){a.issues.forEach(iss=>chips.append(make('span','chip issue',iss)));} else chips.append(make('span','chip','✓ 問題なし'));
  chips.append(make('span','chip',`${a.cps} 字/秒`));
  const controls=make('div','cue-buttons');controls.append(btn('改行','wrap',c.id),btn('延長','extend',c.id),btn('分割','split',c.id),btn('削除','delete',c.id,'delete'));
  foot.append(chips,controls);content.append(foot);row.append(content);return row;
}
function updateStats(analysis) {
  $('statTotal').textContent=analysis.total;$('statProblems').textContent=analysis.problem;$('statClean').textContent=analysis.clean;
  $('statDuration').textContent=cues.length?durationString(Math.max(...cues.map(c=>c.end))):'—';
  $('cueCount').textContent=cues.length?`(${cues.length} 件)`:'(0 件)';
  $('empty').hidden=!!cues.length; $('undoBtn').disabled=undo.length===0;
}
function render() {
  const list=$('cues');list.replaceChildren();const a=E.analyze(cues,opt());
  a.order.forEach((c,i)=>list.append(buildCue(c,i,a)));updateStats(a); updatePreview();
}
function updatePreview() {
  const max=Math.max(5000,...cues.map(c=>c.end));
  positionMs=Math.min(positionMs,max); const hit=[...cues].reverse().find(c=>c.start<=positionMs&&positionMs<c.end);
  $('previewText').textContent=hit ? E.cleanText(hit.text) : '字幕がない区間';
  $('previewTime').textContent=E.timecode(positionMs);
  $('seek').value=String(Math.round(positionMs/max*1000));
}
function stop(){ playing=false; if(ticker!==null){clearInterval(ticker);ticker=null;}$('playBtn').textContent='▶ 再生'; }
function doAction(action,id) {
  const c=getCue(id);if(!c)return;
  try {
    if(action==='delete'){snapshot();cues=cues.filter(x=>x.id!==id);selectedId=cues[0]?.id||null;}
    else if(action==='wrap'){snapshot();c.text=E.wrapJapanese(c.text,opt().width);selectedId=id;}
    else if(action==='extend'){snapshot();cues=E.extendCue(cues,id,opt());selectedId=id;}
    else if(action==='split') {
      const pair=E.splitCue(c,opt());snapshot();const idx=cues.findIndex(x=>x.id===id);
      pair[1].id=uid();cues.splice(idx,1,...pair);selectedId=pair[0].id;
    }
    positionMs=getCue(selectedId)?.start||0;persist();render();message({delete:'字幕を削除しました',wrap:'指定行を折り返しました',extend:'次の字幕の手前まで表示を延長しました',split:'字幕を2つに分割しました'}[action]);
  } catch(e) {message(e.message,true);}
}
function download(filename,text,mime){const blob=new Blob(['\ufeff',text],{type:mime+';charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);}
async function importFile(file,json=false) {
  if (!file)return;
  if(file.size>2*1024*1024){message('ファイルは2MBまでです。',true);return;}
  try {
    const content=await file.text();
    if(json){const data=JSON.parse(content);if(!data||!Array.isArray(data.cues))throw new Error('字幕JSONではありません');setCues(data.cues,'JSONから復元しました');if(data.options) {preset='custom';$('preset').value='custom';const o=data.options;for(const k of ['cps','width','lines','min'])if(Number.isFinite(+o[k]))$(k).value=o[k];}}
    else {const result=E.parseSubtitles(content);setCues(result.cues,`${result.cues.length}件読み込み。${result.errors.length?result.errors.length+'ブロックは形式不正で除外しました。':''}`);}
    persist();render();
  }catch(e){message('読み込み失敗: '+e.message,true);}
}
function initEvents() {
  $('demoBtn').addEventListener('click',()=>{setCues(E.parseSubtitles(DEMO).cues,'サンプルを読み込みました。警告を押して確認できます。');document.querySelector('.work').scrollIntoView({behavior:'smooth'});});
  $('fileInput').addEventListener('change',e=>{importFile(e.target.files[0]);e.target.value='';});
  $('jsonInput').addEventListener('change',e=>{importFile(e.target.files[0],true);e.target.value='';});
  $('pasteBtn').addEventListener('click',()=>$('pasteDialog').showModal());
  $('importPasteBtn').addEventListener('click',()=>{try{setCues(E.parseSubtitles($('pasteText').value).cues,'テキストを読み込みました');$('pasteDialog').close();}catch(e){message('貼り付けの解析失敗: '+e.message,true);}});
  $('preset').addEventListener('change',e=>applyPreset(e.target.value));
  for(const k of ['cps','width','lines','min'])$(k).addEventListener('change',()=>{preset='custom';$('preset').value='custom';settingChange();});
  $('resetBtn').addEventListener('click',()=>{if(!confirm('現在の字幕をすべて初期化しますか？'))return;setCues([],'初期化しました');});
  $('cues').addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(b){doAction(b.dataset.action,b.dataset.id);return;}const row=e.target.closest('.cue');if(row){selectedId=row.dataset.id;positionMs=getCue(selectedId)?.start||0;document.querySelectorAll('.cue').forEach(n=>n.classList.toggle('selected',n.dataset.id===selectedId));updatePreview();}});
  $('cues').addEventListener('focusin',e=>{if(e.target.matches('[data-field]')){selectedId=e.target.dataset.id;document.querySelectorAll('.cue').forEach(n=>n.classList.toggle('selected',n.dataset.id===selectedId));}});
  $('cues').addEventListener('focusout',e=>{
    const el=e.target;if(!el.matches('[data-field]'))return; const c=getCue(el.dataset.id);if(!c)return;
    const key=el.dataset.field;
    if(key==='text') { if(c.text!==el.value){snapshot();c.text=el.value;persist();render();message('字幕を更新しました');}return; }
    const t=E.parseTime(el.value);if(t===null||(key==='start'&&t>=c.end)||(key==='end'&&t<=c.start)){el.value=E.timecode(c[key]);message('時刻はHH:MM:SS.mmm形式で、開始は終了より前にしてください。',true);return;}
    if(t!==c[key]){snapshot();c[key]=t;persist();render();message('時刻を更新しました');}
  });
  $('addBtn').addEventListener('click',()=>{if(cues.length>=5000)return message('最大5000件です',true);snapshot();const end=Math.max(0,...cues.map(c=>c.end));const c={id:uid(),start:end+200,end:end+2200,text:'新しい字幕'};cues.push(c);selectedId=c.id;positionMs=c.start;persist();render();$('cues').lastElementChild?.scrollIntoView({block:'nearest'});message('字幕を追加しました');});
  $('wrapAllBtn').addEventListener('click',()=>{if(!cues.length)return; snapshot();cues=cues.map(c=>({...c,text:E.wrapJapanese(c.text,opt().width)}));persist();render();message('全字幕の自動改行を実行しました。意味の切れ目を確認してください。');});
  $('undoBtn').addEventListener('click',()=>{if(!undo.length)return;const s=JSON.parse(undo.pop());cues=s.cues;selectedId=s.selectedId;positionMs=s.positionMs;persist();render();message('直前の編集を取り消しました');});
  $('shiftBtn').addEventListener('click',()=>{try{const ms=Number($('shiftMs').value);if(!Number.isFinite(ms)||!Number.isInteger(ms))throw new Error('整数ミリ秒を入力してください');snapshot();cues=E.shiftAll(cues,ms);positionMs=Math.max(0,positionMs+ms);persist();render();message(`全字幕を${ms}ミリ秒移動しました`);}catch(e){message(e.message,true);}});
  for(const [id,format] of [['saveSrtBtn','srt'],['saveVttBtn','vtt']])$(id).addEventListener('click',()=>{if(!cues.length)return message('字幕がありません',true);try{download('jimakuma-edited.'+format,E.formatSubtitles(cues,format),'text/plain');message(format.toUpperCase()+'を書き出しました');}catch(e){message(e.message,true);}});
  $('saveJsonBtn').addEventListener('click',()=>{download('jimakuma-backup.json',JSON.stringify({app:'JIMAKU-MA',version:1,options:opt(),cues},null,2),'application/json');message('JSONバックアップを出力しました');});
  $('seek').addEventListener('input',e=>{const end=Math.max(5000,...cues.map(c=>c.end));positionMs=+e.target.value/1000*end;updatePreview();});
  $('playBtn').addEventListener('click',()=>{if(playing)return stop();const max=Math.max(5000,...cues.map(c=>c.end));if(positionMs>=max)positionMs=0;playing=true;$('playBtn').textContent='Ⅱ 一時停止';let last=performance.now();ticker=setInterval(()=>{const now=performance.now();positionMs+=now-last;last=now;if(positionMs>=max){positionMs=max;stop();}updatePreview();},60);});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
}
function restore() {
  try {const raw=localStorage.getItem(KEY);if(!raw)return;const data=JSON.parse(raw);if(!data||data.version!==1||!Array.isArray(data.cues))return;
    const temp=normalize(data.cues);cues=temp;nextId=Math.max(nextId,(Number(data.nextId)||1)+cues.length);preset=E.PRESETS[data.preset]?data.preset:'casual';custom={...E.PRESETS.custom,...data.custom};
    $('preset').value=preset;const o=preset==='custom'?custom:E.PRESETS[preset];for(const k of ['cps','width','lines','min'])$(k).value=o[k];selectedId=cues[0]?.id||null;message('前回の作業を端末内から復元しました');
  } catch { message('保存データを読み取れませんでした。JSON復元をご利用ください。',true); }
}
initEvents();restore();render();
})();
