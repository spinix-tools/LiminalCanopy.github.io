(function(){
'use strict';
const E=window.CueMori, $=id=>document.getElementById(id), LS='cuemori-v1';
let data=E.sample(),delayId='e',delay=5,storageError=false,seq=0;
try{const saved=localStorage.getItem(LS);if(saved)data=E.normalize(JSON.parse(saved));}catch(e){storageError=true;}
const txt=x=>String(x??'');
const esc=x=>txt(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function save(){try{localStorage.setItem(LS,JSON.stringify(data));$('storageStatus').textContent='この端末に保存済み · 外部送信なし';}catch(e){storageError=true;$('storageStatus').textContent='端末保存できません。JSONでバックアップしてください';}}
function issueId(){let id;do{id='c'+Date.now().toString(36)+(++seq).toString(36);}while(data.cues.some(x=>x.id===id));return id;}
function options(current,own){return ['<option value="">依存なし</option>',...data.cues.filter(x=>x.id!==own).map(x=>`<option value="${esc(x.id)}" ${current===x.id?'selected':''}>${esc(x.name)} (${esc(x.lane)})</option>`)].join('');}
function cueRow(c,i){return `<article class="cue" data-id="${esc(c.id)}"><div class="num">${String(i+1).padStart(2,'0')}</div><div class="namefield"><label>キュー名</label><input aria-label="${i+1}番目のキュー名" data-key="name" maxlength="90" value="${esc(c.name)}"></div><div class="lanefield"><label>レーン</label><select aria-label="${i+1}番目のレーン" data-key="lane">${['舞台','音響','映像','受付'].map(x=>`<option ${c.lane===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="ownerfield"><label>担当（重複回避）</label><input aria-label="${i+1}番目の担当" data-key="owner" maxlength="60" value="${esc(c.owner)}"></div><div class="minutesfield"><label>分数</label><input aria-label="${i+1}番目の分数" data-key="minutes" type="number" min="0.5" step="0.5" max="240" value="${esc(c.minutes)}"></div><div class="earliestfield"><label>最早開始（分後）</label><input aria-label="${i+1}番目の最早開始" data-key="earliest" type="number" min="0" step="0.5" max="1440" value="${esc(c.earliest)}"></div><div class="afterfield"><label>先行キュー</label><select aria-label="${i+1}番目の先行キュー" data-key="after">${options(c.after,c.id)}</select></div><button type="button" class="trash" data-action="remove" title="このキューを削除" aria-label="${i+1}番目を削除">×</button><div class="row-meta"><span data-meta="${esc(c.id)}"></span><button type="button" class="mini" data-action="up" aria-label="上に移動">↑ 上へ</button><button type="button" class="mini" data-action="down" aria-label="下に移動">↓ 下へ</button></div></article>`;}
function drawRows(){$('cueList').innerHTML=data.cues.map(cueRow).join('')||'<p class="helper">キューがありません。「キュー追加」から作成できます。</p>';drawOptions();}
function drawOptions(){const el=$('delayCue');if(!data.cues.some(x=>x.id===delayId)) delayId=data.cues[0]?.id||'';el.innerHTML=data.cues.map(c=>`<option value="${esc(c.id)}" ${c.id===delayId?'selected':''}>${esc(c.name)}</option>`).join('');}
const fmt=(result,min)=>E.hhmm((result.startsAt??780)+min);
function render(){const out=E.compare(data,delayId,delay),{base,scenario,affected}=out;
$('baseEnd').textContent=fmt(base,base.end);$('shiftEnd').textContent=fmt(scenario,scenario.end);
$('endDelta').textContent=out.endDelta?`通常より +${out.endDelta}分`:'通常と同時刻';
$('buffer').textContent=scenario.overflow?`超過 ${scenario.overflow}分`:`${scenario.idle}分`;
$('bufferNote').textContent=scenario.overflow?'終了期限を超過':'終了期限までの余裕';$('affected').textContent=affected.length+' 件';
const warnings=[...new Set([...scenario.warning,...base.warning])];
$('diagnosis').className='sos'+(scenario.overflow||warnings.length?' danger':'');
$('diagnosis').textContent=warnings.length?warnings.join(' / '):scenario.overflow?`⚠ 終演期限を ${scenario.overflow} 分超過する見込みです。`:`✓ 終演期限内の試算です（余裕 ${scenario.idle} 分）。`;
$('impactList').innerHTML=affected.length?affected.map(x=>`<p><strong>${esc(x.name)}</strong>　開始 ${x.startShift?'+':''}${x.startShift}分 / 終了 +${x.endShift}分</p>`).join(''):'<p>現在、影響を受けるキューはありません。</p>';
for(const c of data.cues){const target=document.querySelector('[data-meta="'+c.id+'"]');if(!target)continue;const slot=scenario.slots.find(x=>x.id===c.id);target.textContent=slot?`予定 ${fmt(scenario,slot.start)}–${fmt(scenario,slot.end)} · ${slot.duration}分`:'⚠ 依存関係を確認してください';}
const lanes=['舞台','音響','映像','受付'];const horizon=Math.max(scenario.end,base.end,scenario.hardOut,60);const clampPct=v=>Math.min(100,Math.max(0,v/horizon*100));
$('timeline').innerHTML=`<div class="timeline-info"><span>開始 ${esc(data.start)}</span><span>終演期限 ${fmt(base,base.hardOut)}</span><span>表示幅 ${horizon}分</span></div>`+lanes.map(l=>{const segment=(schedule,shift)=>schedule.slots.filter(s=>s.lane===l).map(s=>{const left=clampPct(s.start),width=Math.max(.5,clampPct(s.duration));return `<div class="tl-block ${shift?'shift':''}" title="${esc(s.name)} ${fmt(schedule,s.start)}–${fmt(schedule,s.end)}" style="left:${left}%;width:${Math.min(width,100-left)}%">${esc(s.name)}</div>`;}).join('');return `<div class="tl-row"><div class="tl-label">${l}</div><div class="tl-track">${segment(base,false)}${segment(scenario,true)}</div></div>`;}).join('');
save();}
function redraw(){drawRows();render();}
function setPreset(name){if(name==='sample')data=E.sample();else if(name==='festival')data=E.normalize({title:'学園祭 · ステージ進行',start:'10:00',hardOut:100,cues:[{id:'a',name:'会場準備',lane:'舞台',owner:'舞台班',minutes:20},{id:'b',name:'音出し',lane:'音響',owner:'音響班',minutes:15},{id:'c',name:'開会',lane:'舞台',owner:'司会',minutes:10,earliest:20},{id:'d',name:'バンド演奏',lane:'舞台',owner:'出演者',minutes:25,after:'c'},{id:'e',name:'映像上映',lane:'映像',owner:'音響班',minutes:15,after:'d'},{id:'f',name:'抽選会',lane:'舞台',owner:'司会',minutes:20,after:'e'},{id:'g',name:'片付け',lane:'舞台',owner:'舞台班',minutes:15,after:'f'}]});else if(name==='empty')data=E.normalize({title:'新しい進行表',start:'13:00',hardOut:120,cues:[]});
$('title').value=data.title;$('start').value=data.start;$('hardOut').value=data.hardOut;delayId=data.cues[0]?.id||'';delay=5;$('delay').value=delay;$('delayLabel').textContent=delay;redraw();}
$('cueList').addEventListener('change',e=>{const key=e.target.dataset?.key;const id=e.target.closest('[data-id]')?.dataset.id;const item=data.cues.find(x=>x.id===id);if(!item||!key)return;item[key]=['minutes','earliest'].includes(key)?Number(e.target.value):e.target.value;data=E.normalize(data);redraw();});
$('cueList').addEventListener('click',e=>{const button=e.target.closest('button[data-action]');if(!button)return;const id=button.closest('[data-id]')?.dataset.id,idx=data.cues.findIndex(c=>c.id===id);if(idx<0)return;const action=button.dataset.action;if(action==='remove'){data.cues.splice(idx,1);data.cues.forEach(c=>{if(c.after===id)c.after='';});}else if(action==='up'&&idx>0){[data.cues[idx-1],data.cues[idx]]=[data.cues[idx],data.cues[idx-1]];}else if(action==='down'&&idx<data.cues.length-1){[data.cues[idx+1],data.cues[idx]]=[data.cues[idx],data.cues[idx+1]];}redraw();});
$('addCue').addEventListener('click',()=>{if(data.cues.length>=E.MAX_CUES){alert('上限120件です');return;}data.cues.push({id:issueId(),name:'新しいキュー',lane:'舞台',owner:'',minutes:5,earliest:0,after:'',memo:''});redraw();});
for(const key of ['title','start','hardOut'])$(key).addEventListener('change',e=>{data[key]=key==='hardOut'?Number(e.target.value):e.target.value;data=E.normalize(data);$(key).value=data[key];render();});
$('preset').addEventListener('change',e=>{if(e.target.value==='current')return;if(!confirm('現在の進行表をプリセットで置き換えますか？（先にJSON保存できます）')){e.target.value='current';return;}setPreset(e.target.value);e.target.value='current';});
$('delayCue').addEventListener('change',e=>{delayId=e.target.value;render();});
$('delay').addEventListener('input',e=>{delay=Number(e.target.value);$('delayLabel').textContent=delay;render();});
$('resetDelay').addEventListener('click',()=>{delay=0;$('delay').value=0;$('delayLabel').textContent=0;render();});
function download(filename,body,type){const blob=new Blob([body],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
$('saveJson').addEventListener('click',()=>download('cuemori-plan.json',JSON.stringify(data,null,2),'application/json;charset=utf-8'));
$('saveCsv').addEventListener('click',()=>download('cuemori-delayed.csv',E.csv(E.schedule(data,{delayId,delay})),'text/csv;charset=utf-8'));
$('loadJson').addEventListener('click',()=>$('file').click());
$('file').addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;try{if(f.size>512000)throw Error('ファイルは500KB以下にしてください');const obj=JSON.parse(await f.text());if(!obj||!Array.isArray(obj.cues))throw Error('正しい進行表ではありません');data=E.normalize(obj);setPreset('current');}catch(error){alert('読み込みに失敗しました: '+error.message);}finally{e.target.value='';}});
$('print').addEventListener('click',()=>window.print());
$('title').value=data.title;$('start').value=data.start;$('hardOut').value=data.hardOut;delayId=data.cues.find(c=>c.id===delayId)?.id||data.cues[0]?.id||'';redraw();
})();