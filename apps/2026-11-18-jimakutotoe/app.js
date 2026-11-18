(function(){
'use strict';
const E=window.JimakuEngine;
const $=id=>document.getElementById(id);
const SAMPLE=`1
00:00:00,200 --> 00:00:02,200
みなさん、こんにちは。今日は字幕の見やすさについてお話しします。

2
00:00:02,100 --> 00:00:03,000
これだけの長い文章をたったの一秒間で読み終えるのは非常に大変ですね。

3
00:00:03,500 --> 00:00:07,300
字幕の区切り方を少し変えるだけで
伝わり方が変わります。

4
00:00:07,400 --> 00:00:09,200
あなたの作品を、
もっと多くの人へ。`;
let cues=[],format='srt',selectedId=null,filter='all',history=[],play=false,frame=0,currentMs=0,videoUrl=null,nextId=1,lastTick=0;
function safe(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function rules(){const keys={cps:['ruleCps',3,50],lineChars:['ruleLineChars',5,80],lines:['ruleLines',1,5],minDuration:['ruleMinDuration',100,5000],maxDuration:['ruleMaxDuration',1000,30000],minGap:['ruleMinGap',0,1000]};const r={};for(const [k,[id,min,max]]of Object.entries(keys)){let v=Number($(id).value);if(!Number.isFinite(v))v=E.DEFAULT_RULES[k];r[k]=Math.max(min,Math.min(max,v));}return r;}
function saveUndo(){history.push(JSON.stringify({cues,selectedId}));if(history.length>40)history.shift();$('undoBtn').disabled=false;}
function displayClock(ms){const s=Math.floor(ms/1000);return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}.${Math.floor(ms%1000/100)}`;}
function duration(){return Math.max(1,...cues.map(c=>c.end));}
function draw(){const result=E.analyze(cues,rules());$('totalStat').textContent=cues.length;$('errorsStat').textContent=result.errors;$('warningsStat').textContent=result.warnings;$('cleanStat').textContent=result.clean;$('allCount').textContent=cues.length;$('issueCount').textContent=result.rows.filter(r=>r.problems.length).length;
  const list=$('cueList');const visible=result.rows.filter(r=>filter==='all'||r.problems.length);
  if(!cues.length){list.innerHTML='<div class="empty"><div class="empty-icon">◌</div><strong>まだ字幕はありません</strong><span>サンプルを開くと診断結果が表示されます。</span></div>';}else if(!visible.length){list.innerHTML='<div class="empty"><strong>要確認の字幕はありません ✓</strong></div>';}else{
    list.innerHTML=visible.map(r=>{let c=r.cue;return `<article class="cue-row ${c.id===selectedId?'selected':''}" data-id="${safe(c.id)}"><div class="cue-n">${String(r.index+1).padStart(2,'0')}</div><div class="cue-content"><div class="cue-meta"><input aria-label="${r.index+1}番 開始時刻" data-key="start" value="${E.formatTime(c.start)}"><span class="arrow">→</span><input aria-label="${r.index+1}番 終了時刻" data-key="end" value="${E.formatTime(c.end)}"><span class="cue-speed">${Number.isFinite(r.speed)?r.speed.toFixed(1):'∞'} 字/秒</span></div><textarea aria-label="${r.index+1}番 字幕テキスト" class="cue-text" data-key="text">${safe(c.text)}</textarea><div class="cue-issues">${r.problems.length?r.problems.map(p=>`<span class="issue ${p.severity==='error'?'error':''}">${safe(p.label)}</span>`).join(''):'<span class="issue ok">✓ 問題なし</span>'}</div><div class="cue-actions"><button data-action="jump">▶ プレビュー</button><button data-action="delete">× 削除</button></div></div></article>`}).join('');
  }
  $('formatChip').textContent=format==='vtt'?'WebVTT':'SRT';
  ['exportSrt','exportVtt','exportCsv'].forEach(id=>$(id).disabled=cues.length===0);
  $('playBtn').disabled=cues.length===0;
  $('seekSlider').max=duration();$('seekSlider').value=Math.min(currentMs,duration());$('endTime').textContent=displayClock(duration());
  updatePreview();
}
function updatePreview(){const active=cues.filter(c=>currentMs>=c.start&&currentMs<c.end).slice(-1)[0];$('previewText').textContent=active?active.text:'（字幕のない時間）';$('currentTime').textContent=displayClock(currentMs);$('seekSlider').value=Math.min(currentMs,duration());}
function loadText(s){stop();$('sourceInput').value=s;const p=E.parseSubtitles(s);history=[];$('undoBtn').disabled=true;format=p.format;cues=p.cues.map(c=>({...c,id:`c-${nextId++}`}));selectedId=cues[0]?.id||null;currentMs=cues[0]?.start||0;draw();$('importFeedback').textContent=`${cues.length}件読み込み${p.errors.length?` ／ ${p.errors.length}ブロックを読み飛ばしました: ${p.errors[0]}`:''}`;$('fixFeedback').textContent='';}
function download(name,content,mime){const blob=new Blob(['\uFEFF',content],{type:mime+';charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);}
function stop(){play=false;cancelAnimationFrame(frame);$('playBtn').textContent='▶';$('playBtn').setAttribute('aria-label','再生');if(!$('videoPlayer').paused)$('videoPlayer').pause();}
function tick(t){if(!play)return;if(!lastTick)lastTick=t;const dt=Math.min(150,t-lastTick);lastTick=t;if(videoUrl && Number.isFinite($('videoPlayer').currentTime))currentMs=$('videoPlayer').currentTime*1000;else currentMs+=dt;
  if(currentMs>=duration()){currentMs=duration();stop();}updatePreview();if(play)frame=requestAnimationFrame(tick);
}
function start(){if(!cues.length)return;if(currentMs>=duration())currentMs=0;play=true;lastTick=0;$('playBtn').textContent='Ⅱ';$('playBtn').setAttribute('aria-label','一時停止');if(videoUrl)$('videoPlayer').play().catch(()=>{});frame=requestAnimationFrame(tick);}
$('sampleBtn').addEventListener('click',()=>{loadText(SAMPLE);$('workspace').scrollIntoView({behavior:'smooth',block:'start'});});
$('parseBtn').addEventListener('click',()=>loadText($('sourceInput').value));
$('fileInput').addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;if(f.size>2*1024*1024){$('importFeedback').textContent='ファイルは2MB以内で読み込んでください';return;}loadText(await f.text());e.target.value='';});
$('undoBtn').addEventListener('click',()=>{if(!history.length)return;const state=JSON.parse(history.pop());cues=state.cues;selectedId=state.selectedId;$('undoBtn').disabled=!history.length;$('fixFeedback').textContent='ひとつ前の編集に戻しました';draw();});
$('fixBtn').addEventListener('click',()=>{if(!cues.length){$('fixFeedback').textContent='先に字幕を読み込んでください';return;}const fixed=E.autoFix(cues,rules());if(fixed.lineCount+fixed.timingCount){saveUndo();cues=fixed.cues;}$('fixFeedback').textContent=`行分割 ${fixed.lineCount}件 / 重複解消 ${fixed.timingCount}件${fixed.skipped?` / 安全に短縮できず保留 ${fixed.skipped}件`:''}。音声を確認してください。`;draw();});
$('addCueBtn').addEventListener('click',()=>{stop();saveUndo();const start=cues.length?Math.max(...cues.map(c=>c.end))+250:0;const cue={id:`c-${nextId++}`,start,end:start+2000,text:'新しい字幕'};cues.push(cue);selectedId=cue.id;currentMs=cue.start;draw();});
$('cueList').addEventListener('click',e=>{const row=e.target.closest('.cue-row');if(!row)return;const id=row.dataset.id,idx=cues.findIndex(c=>c.id===id);if(idx<0)return;const action=e.target.closest('[data-action]')?.dataset.action;if(action==='delete'){stop();saveUndo();cues.splice(idx,1);if(selectedId===id)selectedId=cues[Math.min(idx,cues.length-1)]?.id||null;draw();return;}if(action==='jump'){stop();selectedId=id;currentMs=cues[idx].start;draw();return;}if(!e.target.matches('input,textarea')){selectedId=id;document.querySelectorAll('.cue-row').forEach(r=>r.classList.toggle('selected',r.dataset.id===id));currentMs=cues[idx].start;updatePreview();}});
$('cueList').addEventListener('change',e=>{const target=e.target;if(!target.dataset.key)return;const row=target.closest('.cue-row');const cue=cues.find(c=>c.id===row?.dataset.id);if(!cue)return;const key=target.dataset.key;let value=key==='text'?target.value:E.parseTime(target.value);if(value===null){target.setCustomValidity('時刻形式は 00:00:00,000');target.reportValidity();return;}target.setCustomValidity('');if(cue[key]!==value){saveUndo();cue[key]=value;selectedId=cue.id;draw();}});
for(const btn of document.querySelectorAll('.filter'))btn.addEventListener('click',()=>{filter=btn.dataset.filter;document.querySelectorAll('.filter').forEach(x=>x.classList.toggle('active',x===btn));draw();});
for(const id of ['ruleCps','ruleLineChars','ruleLines','ruleMinDuration','ruleMaxDuration','ruleMinGap'])$(id).addEventListener('change',draw);
$('exportSrt').addEventListener('click',()=>download('jimaku-totoe.srt',E.exportSubtitles(cues,'srt'),'text/plain'));
$('exportVtt').addEventListener('click',()=>download('jimaku-totoe.vtt',E.exportSubtitles(cues,'vtt'),'text/vtt'));
$('exportCsv').addEventListener('click',()=>download('jimaku-totoe-qa.csv',E.exportReport(cues,rules()),'text/csv'));
$('playBtn').addEventListener('click',()=>play?stop():start());
$('seekSlider').addEventListener('input',e=>{currentMs=Number(e.target.value);if(videoUrl)$('videoPlayer').currentTime=currentMs/1000;updatePreview();});
$('videoInput').addEventListener('change',e=>{const f=e.target.files?.[0];if(!f)return;stop();if(videoUrl)URL.revokeObjectURL(videoUrl);videoUrl=URL.createObjectURL(f);$('videoPlayer').hidden=false;$('videoPlayer').src=videoUrl;currentMs=0;updatePreview();});
window.addEventListener('beforeunload',()=>{if(videoUrl)URL.revokeObjectURL(videoUrl);});
draw();
})();
