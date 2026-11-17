/* 字幕しあげ - browser-only controller */
(()=>{'use strict';
const E=window.JimakuEngine, $=id=>document.getElementById(id);
const state={cues:[],selected:-1,format:'srt',filename:'untitled',videoURL:null,hasVideo:false};
const fields=['maxCps','maxLine','maxLines','minMs','maxMs','gapMs'];
function setStatus(message,failed=false){$('status').textContent=message;$('status').style.color=failed?'#ac3647':'#276787';}
function settings(){return Object.fromEntries(fields.map(key=>[key,Number($(key).value)]));}
function normalizeSettings(){let s=settings();if(fields.some(key=>!Number.isFinite(s[key])||s[key]<0)||s.maxCps<1||s.maxLine<1||s.maxLines<1||s.maxMs<100||s.maxMs<=s.minMs){setStatus('チェック基準に不正な数値があります。',true);return false;}return true;}
function preset(name){const p=E.PRESETS[name]||E.PRESETS.vertical;for(const key of fields)$(key).value=p[key];$('videoWrap').classList.toggle('wide',name==='horizontal');render();}
function resetInputs(){state.cues=[];state.selected=-1;state.filename='untitled';state.format='srt';$('source').value='';$('fileInfo').textContent='未読み込み';$('parseError').hidden=true;setStatus('');render();}
function loadText(text,name){
  if(text.length>2_000_000){showError('最大2MBまでの字幕に対応しています。');return false;}
  const data=E.parse(text);
  if(data.errors.length){showError('読み込みを中止しました。非対応・不正なブロックを確認してください。\n'+data.errors.slice(0,8).join('\n')+(data.errors.length>8?'\n…':''));return false;}
  state.cues=data.cues.map((c,i)=>({...c,id:i+1}));state.selected=state.cues.length?0:-1;
  state.format=data.format;state.filename=(name||'untitled').replace(/\.(srt|vtt)$/i,'').slice(0,100);
  $('source').value=text;$('parseError').hidden=true;$('fileInfo').textContent=`${data.format.toUpperCase()} · ${state.cues.length}件`;
  setStatus(`${state.cues.length}件読み込みました。字幕一覧から修正できます。`);render();return true;
}
function showError(message){$('parseError').className='error';$('parseError').textContent=message;$('parseError').hidden=false;setStatus(message.split('\n')[0],true);}
function render(){
  if(!normalizeSettings())return;
  const a=E.analyze(state.cues,settings());
  $('totalCount').textContent=state.cues.length;$('flaggedCount').textContent=a.flagged;$('issueCount').textContent=a.issueCount;
  const box=$('cueList');box.replaceChildren();let shown=0;
  state.cues.forEach((cue,index)=>{
    const d=a.diagnostics[index];if($('filter').value==='flagged'&&!d.problems.length)return;
    shown++;const b=document.createElement('button');b.type='button';b.className='cue'+(index===state.selected?' selected':'');b.dataset.index=String(index);
    b.setAttribute('aria-label',`字幕${index+1} ${d.problems.length?'要確認':'問題なし'}`);
    const top=document.createElement('div');top.className='cue-top';
    const n=document.createElement('span');n.textContent='#'+(index+1)+' · '+E.msToTime(cue.start)+' → '+E.msToTime(cue.end);
    const sp=document.createElement('span');sp.textContent=d.cps.toFixed(1)+' 字/秒';top.append(n,sp);
    const body=document.createElement('div');body.className='cue-body';body.textContent=cue.text;
    const bottom=document.createElement('div');bottom.className='cue-bottom';
    for(const issue of d.problems.length?d.problems:['目安内']){const tag=document.createElement('span');tag.className='tag '+(d.problems.length?'warn':'good');tag.textContent=issue;bottom.appendChild(tag);}
    b.append(top,body,bottom);b.addEventListener('click',()=>{state.selected=index;render();seekTo(cue.start);});box.appendChild(b);
  });
  if(!shown){const e=document.createElement('div');e.className='empty';e.textContent=state.cues.length?'該当する字幕はありません。':'字幕を解析すると診断結果が並びます。';box.appendChild(e);}
  $('rowHint').textContent=`${shown}件を表示 · 行を選択して修正`;
  renderEditor();updatePreview();
}
function renderEditor(){
  const c=state.cues[state.selected], d=c?E.analyze(state.cues,settings()).diagnostics[state.selected]:null;
  $('selectedName').textContent=c?'#'+(state.selected+1)+' を編集中':'未選択';
  $('startTime').value=c?E.msToTime(c.start):'';
  $('endTime').value=c?E.msToTime(c.end):'';
  $('editText').value=c?c.text:'';
  $('editStats').textContent=c?`表示 ${d.duration.toFixed(2)}秒　/　${d.chars}文字　/　${d.cps.toFixed(1)}文字/秒　｜　${d.problems.length?d.problems.join('・'):'目安内'}`:'字幕を選択してください。';
  for(const id of ['saveCueBtn','breakBtn','extendBtn','overlapBtn','deleteCueBtn'])$(id).disabled=!c;
}
function replaceSelected(cue,message){state.cues[state.selected]=cue;setStatus(message);render();}
function updatePreview(){
  const video=$('video'),secs=state.hasVideo?video.currentTime:Number($('seek').value)/1000;
  if(state.hasVideo){$('seek').value=Math.round(secs*1000);$('seek').max=Math.max(1000,Math.round((video.duration||10)*1000));}
  $('timeDisplay').textContent=E.msToTime(Math.max(0,Math.round(secs*1000)),'vtt');
  const matches=state.cues.filter(c=>c.start<=secs*1000&&c.end>secs*1000).sort((a,b)=>a.start-b.start);
  $('captionOverlay').textContent=matches.length?E.visibleText(matches[matches.length-1].text):'';
}
function seekTo(ms){const time=Math.max(0,ms)/1000;if(state.hasVideo){try{$('video').currentTime=Math.min(time,Number.isFinite($('video').duration)?$('video').duration:time);}catch(_){}}else{$('seek').max=Math.max(Number($('seek').max),ms+1000);$('seek').value=ms;}updatePreview();}
function exportFile(filename,mime,content){const blob=new Blob([content],{type:mime}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);setStatus(`${filename} を出力しました。`);}
function exportCaptions(type){try{const data=type==='srt'?E.exportSrt(state.cues):type==='vtt'?E.exportVtt(state.cues):E.csvReport(state.cues,settings());exportFile(`${state.filename||'captions'}-checked.${type}`,type==='csv'?'text/csv;charset=utf-8':'text/plain;charset=utf-8',data);}catch(e){setStatus(e.message,true);}}
function project(){return{version:1,format:state.format,filename:state.filename,profile:$('preset').value,settings:settings(),cues:state.cues.map(c=>({start:c.start,end:c.end,text:c.text}))};}
function restoreObject(o){
  if(!o||o.version!==1||!Array.isArray(o.cues)||o.cues.length>10000)throw Error('JSON形式が無効、または件数が多すぎます。');
  const cs=o.cues.map((c,i)=>({id:i+1,start:c.start,end:c.end,text:c.text}));
  E.exportSrt(cs);if(cs.some(c=>c.text.length>20000))throw Error('字幕本文が長すぎます。');
  state.cues=cs;state.selected=cs.length?0:-1;state.filename=String(o.filename||'restored').slice(0,100);state.format=o.format==='vtt'?'vtt':'srt';
  $('preset').value=o.profile==='horizontal'?'horizontal':'vertical';preset($('preset').value);
  if(o.settings&&typeof o.settings==='object'){for(const field of fields){const v=Number(o.settings[field]);if(Number.isFinite(v))$(field).value=v;}}
  $('source').value=state.format==='vtt'?E.exportVtt(state.cues):E.exportSrt(state.cues);
  $('fileInfo').textContent='復元 · '+cs.length+'件';$('parseError').hidden=true;render();setStatus('編集プロジェクトを復元しました。');
}
$('parseBtn').addEventListener('click',()=>loadText($('source').value,'pasted.srt'));
$('sampleBtn').addEventListener('click',()=>loadText(E.SAMPLE,'sample.srt'));
$('clearBtn').addEventListener('click',resetInputs);
$('subtitleFile').addEventListener('change',async ev=>{const file=ev.target.files?.[0];if(!file)return;if(file.size>2_000_000){showError('ファイルは2MB以下にしてください。');return;}try{loadText(await file.text(),file.name);}catch(e){showError('ファイルを読み込めませんでした: '+e.message);}ev.target.value='';});
$('preset').addEventListener('change',()=>preset($('preset').value));
for(const field of fields)$(field).addEventListener('change',render);
$('filter').addEventListener('change',render);
$('saveCueBtn').addEventListener('click',()=>{
  const c=state.cues[state.selected],start=E.timeToMs($('startTime').value),end=E.timeToMs($('endTime').value),body=$('editText').value.trim();
  if(!c)return;if(start===null||end===null||start>=end||!body){setStatus('開始・終了時刻と本文を確認してください。',true);return;}
  replaceSelected({...c,start,end,text:body},'字幕を更新しました。');
});
$('breakBtn').addEventListener('click',()=>{const c=state.cues[state.selected];if(!c)return;const x=E.suggestedBreak($('editText').value,settings().maxLine);if(!x.ok){setStatus(x.reason,true);return;}$('editText').value=x.text;setStatus('改行候補を編集欄へ適用しました。保存ボタンで確定します。');});
$('extendBtn').addEventListener('click',()=>{const x=E.extendSafely(state.cues,state.selected,settings());if(!x.ok){setStatus(x.reason,true);return;}replaceSelected(x.cue,'他の字幕を動かさず、表示時間を延長しました。');});
$('overlapBtn').addEventListener('click',()=>{const x=E.shortenOverlap(state.cues,state.selected,settings());if(!x.ok){setStatus(x.reason,true);return;}replaceSelected(x.cue,'次字幕の直前まで短縮しました。読みやすさを再確認してください。');});
$('deleteCueBtn').addEventListener('click',()=>{if(state.selected<0)return;state.cues.splice(state.selected,1);state.selected=Math.min(state.selected,state.cues.length-1);render();setStatus('字幕を削除しました。');});
$('addCueBtn').addEventListener('click',()=>{const last=state.cues[state.cues.length-1],start=last?last.end+400:0;state.cues.push({id:Date.now(),start,end:start+2000,text:'新しい字幕'});state.selected=state.cues.length-1;render();seekTo(start);setStatus('字幕を追加しました。テキストと時刻を編集してください。');});
for(const type of ['srt','vtt','csv'])$(type+'Btn').addEventListener('click',()=>exportCaptions(type));
$('jsonBtn').addEventListener('click',()=>{if(!state.cues.length){setStatus('保存対象がありません。',true);return;}exportFile(`${state.filename}-project.json`,'application/json;charset=utf-8',JSON.stringify(project(),null,2));});
$('saveLocalBtn').addEventListener('click',()=>{if(!state.cues.length){setStatus('保存対象がありません。',true);return;}try{localStorage.setItem('jimaku-shiage-v1',JSON.stringify(project()));setStatus('このブラウザの端末内ストレージに保存しました。');}catch(e){setStatus('端末内保存に失敗しました: '+e.message,true);}});
$('loadLocalBtn').addEventListener('click',()=>{try{const data=localStorage.getItem('jimaku-shiage-v1');if(!data){setStatus('端末内保存はありません。',true);return;}restoreObject(JSON.parse(data));}catch(e){setStatus('復元失敗: '+e.message,true);}});
$('jsonInput').addEventListener('change',async ev=>{const f=ev.target.files?.[0];if(!f)return;try{if(f.size>2_000_000)throw Error('JSONは2MB以下にしてください。');restoreObject(JSON.parse(await f.text()));}catch(e){setStatus('JSON読込失敗: '+e.message,true);}ev.target.value='';});
$('videoInput').addEventListener('change',ev=>{const f=ev.target.files?.[0];if(!f)return;if(state.videoURL)URL.revokeObjectURL(state.videoURL);state.videoURL=URL.createObjectURL(f);state.hasVideo=true;$('video').src=state.videoURL;$('placeholder').hidden=true;$('video').load();updatePreview();setStatus('動画は端末内でのみ表示します。');});
$('video').addEventListener('timeupdate',updatePreview);$('video').addEventListener('loadedmetadata',updatePreview);
$('seek').addEventListener('input',()=>{if(state.hasVideo)$('video').currentTime=Number($('seek').value)/1000;updatePreview();});
window.addEventListener('pagehide',()=>{if(state.videoURL)URL.revokeObjectURL(state.videoURL);});
preset('vertical');
})();
