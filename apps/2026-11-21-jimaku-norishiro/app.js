/* Browser UI: local-only. No telemetry, no network calls. */
(()=>{
'use strict';
const E=window.Norishiro;
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state={cues:[],original:[],settings:{...E.PRESETS.horizontal},format:'srt',selected:null,filter:'all',history:[],play:false,position:0,playAt:0,frame:0,warning:[]};
let toastTimer;
const secText=ms=>{let n=Math.max(0,Math.floor(ms/100));return `${String(Math.floor(n/600)).padStart(2,'0')}:${String(Math.floor(n/10)%60).padStart(2,'0')}.${n%10}`;};
const duration=()=>Math.max(1000,...state.cues.map(c=>c.end+500));
function notify(msg,bad=false){const t=$('toast');t.textContent=msg;t.style.background=bad?'#884734':'#253732';t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),3600);}
function settingsFromDOM(){const out={};for(const key of Object.keys(E.DEFAULTS)){out[key]=Number($(key).value);}return E.settingsOf(out);}
function applySettings(s){state.settings=E.settingsOf(s);for(const k of Object.keys(E.DEFAULTS))$(k).value=s[k];}
function storeUndo(){state.history.push(E.copy(state.cues));if(state.history.length>30)state.history.shift();}
function mutate(next,label){storeUndo();state.cues=next;render();notify(label);}
function selectCue(id){const cue=state.cues.find(c=>c.id===id);if(!cue)return;state.selected=id;state.position=cue.start;stop();render();}
function analysis(){return E.analyze(state.cues,state.settings);}
function load(input){const result=E.parse(input);if(!result.cues.length){notify(result.warnings.join('。')||'字幕を読み込めませんでした',true);return;}
state.cues=E.copy(result.cues);state.original=E.copy(result.cues);state.history=[];state.format=result.format;state.warning=result.warnings;state.selected=state.cues[0]?.id??null;state.position=0;stop();render();notify(`${state.cues.length} 件の字幕を読み込みました`);}
function safeNum(n,digits=1){return Number.isFinite(n)?Number(n).toFixed(digits):'—';}
function renderSummary(r){const s=r.summary,orig=E.analyze(state.original,state.settings).summary;
$('total').textContent=s.total;$('flagged').textContent=s.flagged;$('violations').textContent=s.violations;$('peak').textContent=safeNum(s.peakSpeed);$('docType').textContent=state.format.toUpperCase();
$('comparison').textContent=`読み込み時 ${orig.flagged} 件 → 現在 ${s.flagged} 件の要確認（${orig.flagged-s.flagged>=0?'−':'＋'}${Math.abs(orig.flagged-s.flagged)} 件）。修正前の内容は「戻す」で復元できます。`;
$('rowCount').textContent=`${r.rows.length}件`;const warnings=state.warning;$('importWarnings').textContent=warnings.length?`注意：${warnings.slice(0,4).join('\n')}${warnings.length>4?'\n他 '+(warnings.length-4)+' 件':''}`:'';
$('undo').disabled=state.history.length===0;}
function renderCues(r){$('filterAll').classList.toggle('active',state.filter==='all');$('filterProblems').classList.toggle('active',state.filter==='problems');
const rows=r.rows.filter(x=>state.filter==='all'||x.issues.length);
$('cueList').innerHTML=rows.length?rows.map(row=>{const c=row.cue,issue=row.issues.length,labels=issue?row.issues.map(code=>`<span class="pill">${esc(E.RULES[code])}</span>`).join(''):'<span class="pill ok">✓ 問題なし</span>';
return `<article class="cue-row ${state.selected===c.id?'selected':''}" data-cue="${c.id}" tabindex="0" role="button" aria-label="字幕 ${c.id} を編集"><div><div class="cue-id"># ${c.id}</div><div class="cue-time">${esc(E.timecode(c.start))}<br>${esc(E.timecode(c.end))}</div></div><div><div class="cue-body">${esc(c.text)}</div><div class="cue-metric">${safeNum(row.duration/1000)} 秒 · ${safeNum(row.speed)} 全角相当/秒 · 最大 ${safeNum(row.maxLine)} 文字幅</div><div class="cue-meta">${labels}</div></div><span class="cue-open">編集 ↗</span></article>`;}).join(''):'<div class="empty-list">該当する字幕はありません。すべての表示に切り替えてください。</div>';}
function renderEditor(){const cue=state.cues.find(c=>c.id===state.selected);$('editor').hidden=!cue;$('editorEmpty').hidden=!!cue;if(!cue)return;
$('selectedLabel').textContent=`字幕 # ${cue.id} を編集中`;$('editStart').value=E.timecode(cue.start,state.format);$('editEnd').value=E.timecode(cue.end,state.format);$('editText').value=cue.text;}
function renderTimeline(){const len=duration(),cue=state.cues.find(c=>c.id===state.selected);$('endTime').textContent=secText(len);
$('timeline').innerHTML=state.cues.map(c=>`<button type="button" class="block ${cue&&cue.id===c.id?'selected':''}" style="left:${Math.max(0,c.start/len*100)}%;width:${Math.max(0,(c.end-c.start)/len*100)}%" data-cue="${c.id}" title="字幕 ${c.id}"></button>`).join('')+'<div class="needle" id="needle"></div>';
updatePreview();}
function render(){const r=analysis();renderSummary(r);renderCues(r);renderEditor();renderTimeline();}
function updatePreview(){const len=duration();state.position=Math.min(Math.max(0,state.position),len);const shown=state.cues.filter(c=>c.start<=state.position&&state.position<c.end).sort((a,b)=>a.start-b.start);
$('caption').textContent=shown.length?shown.map(c=>E.visibleText(c.text)).join('\n'):'…';$('currentTime').textContent=secText(state.position);$('scrub').value=String(Math.round(state.position/len*1000));const needle=$('needle');if(needle)needle.style.left=(state.position/len*100)+'%';}
function stop(){state.play=false;cancelAnimationFrame(state.frame);$('play').textContent='▶';$('play').setAttribute('aria-label','再生する');}
function tick(now){if(!state.play)return;state.position=now-state.playAt;if(state.position>=duration()){state.position=duration();stop();updatePreview();return;}updatePreview();state.frame=requestAnimationFrame(tick);}
function play(){if(state.play){stop();return;}if(state.position>=duration())state.position=0;state.play=true;state.playAt=performance.now()-state.position;$('play').textContent='Ⅱ';$('play').setAttribute('aria-label','一時停止');state.frame=requestAnimationFrame(tick);}
function download(text,name,type){const blob=new Blob([text],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);notify(`${name} を生成しました`);}
function exportSub(format){try{download(E.serialize(state.cues,format),`jimaku-norishiro.${format}`,format==='srt'?'text/plain;charset=utf-8':'text/vtt;charset=utf-8');}catch(e){notify(e.message,true);}}
function safeAction(fn){try{fn();}catch(e){notify(e.message||String(e),true);}}
async function fileSelected(file){if(!file)return;if(file.size>2*1024*1024){notify('2 MB以下の字幕ファイルを指定してください',true);return;}
try{const bytes=await file.arrayBuffer();let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{text=new TextDecoder('shift_jis',{fatal:true}).decode(bytes);notify('Shift_JIS として読み込みました。保存は UTF-8 になります');}load(text);}
catch(e){notify('文字コードを解釈できません。UTF-8かShift_JISを指定してください',true);}}
$('demo').addEventListener('click',()=>load(E.DEMO));$('loadText').addEventListener('click',()=>load($('source').value));$('file').addEventListener('change',e=>fileSelected(e.target.files[0]));
$('preset').addEventListener('change',()=>safeAction(()=>{const k=$('preset').value;if(k!=='custom')applySettings(E.PRESETS[k]);render();}));
for(const key of Object.keys(E.DEFAULTS))$(key).addEventListener('change',()=>safeAction(()=>{const params=settingsFromDOM();state.settings=params;$('preset').value='custom';render();}));
$('filterAll').addEventListener('click',()=>{state.filter='all';renderCues(analysis());});$('filterProblems').addEventListener('click',()=>{state.filter='problems';renderCues(analysis());});
$('cueList').addEventListener('click',e=>{const card=e.target.closest('[data-cue]');if(card)selectCue(Number(card.dataset.cue));});$('cueList').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){const card=e.target.closest('[data-cue]');if(card){e.preventDefault();selectCue(Number(card.dataset.cue));}}});
$('timeline').addEventListener('click',e=>{const card=e.target.closest('[data-cue]');if(card)selectCue(Number(card.dataset.cue));});
$('play').addEventListener('click',play);$('scrub').addEventListener('input',()=>{stop();state.position=Number($('scrub').value)/1000*duration();updatePreview();});
$('saveCue').addEventListener('click',()=>safeAction(()=>{const cue=state.cues.find(c=>c.id===state.selected);if(!cue)return;const start=E.parseTime($('editStart').value),end=E.parseTime($('editEnd').value);if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)throw Error('終了時刻は開始時刻より後にしてください');const next=E.copy(state.cues),target=next.find(c=>c.id===cue.id);target.start=start;target.end=end;target.text=$('editText').value.replace(/\r\n?/g,'\n');mutate(next,`字幕 #${cue.id} を保存しました`);}));
$('wrapOne').addEventListener('click',()=>safeAction(()=>{const target=state.cues.find(c=>c.id===state.selected);if(!target)return;const suggestion=E.proposeWrap(target.text,state.settings);if(!suggestion.ok){notify(suggestion.reason,true);return;}if(suggestion.unchanged){notify('改行を変更する必要はありません');return;}const next=E.copy(state.cues);next.find(c=>c.id===target.id).text=suggestion.text;mutate(next,'禁則を避けた改行案を適用しました');}));
$('extendOne').addEventListener('click',()=>safeAction(()=>{const r=E.extendCue(state.cues,state.selected,state.settings);if(!r.changed){notify(r.reason,true);return;}mutate(r.cues,r.reason);}));
$('wrapAll').addEventListener('click',()=>safeAction(()=>{const r=E.wrapAll(state.cues,state.settings);if(!r.changed){notify('適用できる改行案はありません（手動で短縮できます）');return;}mutate(r.cues,`${r.changed} 件に改行案を適用しました。未対応 ${r.skipped} 件`);}));
$('extendAll').addEventListener('click',()=>safeAction(()=>{const r=E.extendAll(state.cues,state.settings);if(!r.changed){notify('安全に延長できる字幕はありません');return;}mutate(r.cues,`${r.changed} 件の表示時間を延長しました（部分改善 ${r.partial} 件）`);}));
$('shift').addEventListener('click',()=>safeAction(()=>{const delta=Number($('shiftMs').value);if(!Number.isFinite(delta)||!Number.isInteger(delta))throw Error('移動時間は整数で指定してください');if(delta===0)return;mutate(E.shift(state.cues,delta),`全字幕を ${delta}ms 移動しました`);}));
$('undo').addEventListener('click',()=>{if(!state.history.length)return;state.cues=state.history.pop();render();notify('ひとつ前の状態に戻しました');});
$('exportSrt').addEventListener('click',()=>safeAction(()=>exportSub('srt')));$('exportTop').addEventListener('click',()=>safeAction(()=>exportSub('srt')));$('exportVtt').addEventListener('click',()=>safeAction(()=>exportSub('vtt')));
$('exportCsv').addEventListener('click',()=>safeAction(()=>download(E.reportCSV(analysis()),'jimaku-norishiro-report.csv','text/csv;charset=utf-8')));
applySettings(E.PRESETS.horizontal);load(E.DEMO);
})();
