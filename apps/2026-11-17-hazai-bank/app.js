/* 端材バンク UI — no network requests, all storage local */
(function(){
'use strict';
const K='hazai-bank-v1';
const E=window.HazaiEngine;
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sample=()=>({version:1,kerf:3,trim:5,minOffcut:250,
 stock:[{id:'s-a',label:'SPF 2×4 規格材',length:1820,qty:3,kind:'new'},{id:'s-b',label:'前回の余り',length:760,qty:1,kind:'offcut'}],
 cuts:[{id:'p-a',label:'棚の横桟',length:560,qty:3},{id:'p-b',label:'補強材',length:340,qty:3},{id:'p-c',label:'短い桟',length:280,qty:2}],undo:null,lastReceipt:null});
function restore(){try{const raw=localStorage.getItem(K);if(raw){const x=JSON.parse(raw);if(x.version===1&&Array.isArray(x.stock)&&Array.isArray(x.cuts))return x;}}catch(_){} return sample();}
let state=restore(), current=null, editing={stock:null,cut:null};
const uid=()=>`r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;
const count=a=>a.reduce((s,v)=>s+v.qty,0);
function notify(msg){$('toast').textContent=msg;$('toast').hidden=false;clearTimeout(notify.timer);notify.timer=setTimeout(()=>$('toast').hidden=true,3800);}
function save(){try{localStorage.setItem(K,JSON.stringify(state));}catch(_){notify('端末内保存が制限されています。JSONでバックアップしてください。');}}
function syncFields(){for(const key of ['kerf','trim'])$(key).value=state[key];$('min-offcut').value=state.minOffcut;}
function listRender(){
 const render=(kind,rows)=>{
  const target=$(kind+'-list'); if(!rows.length){target.innerHTML='<p class="empty">まだ登録がありません。</p>';return;}
  target.innerHTML=rows.map(x=>`<div class="list-row"><div><b>${esc(x.label)}</b><small>${x.length.toLocaleString('ja-JP')} mm × ${x.qty} ${kind==='stock'?(x.kind==='offcut'?'本 / 端材':'本 / 規格材'):'個'}</small></div><div class="row-actions"><button class="mini" data-action="edit" data-kind="${kind}" data-id="${esc(x.id)}">編集</button><button class="mini remove" data-action="remove" data-kind="${kind}" data-id="${esc(x.id)}">削除</button></div></div>`).join('');
 };
 render('stock',state.stock);render('cut',state.cuts);
}
function display(){
 listRender(); $('undo').disabled=!state.undo;
 const rec=state.lastReceipt; $('receipt').textContent=rec?`前回の確定: ${rec.parts}部材 / ${rec.consumed}本使用 / 新しい端材${rec.produced}本（実測値ではなく計画値）`:'';
 try{
  if(!state.stock.length||!state.cuts.length)throw new Error('在庫と部材を入力してください');
  current=E.plan(state);
  $('metric-pieces').innerHTML=`${current.bars.reduce((s,v)=>s+v.parts.length,0)} <span class="unit">個</span>`;
  $('metric-bars').innerHTML=`${current.bars.length} <span class="unit">本</span>`;
  $('metric-reuse').innerHTML=`${current.bars.filter(x=>x.reusable).length} <span class="unit">本</span>`;
  $('metric-yield').innerHTML=`${(current.yieldRatio*100).toFixed(1)} <span class="unit">%</span>`;
  $('status').textContent=current.complete?'全件割付':'未割付あり';$('status').className='status'+(current.complete?'':' alert');
  $('plan-note').textContent=`刃幅 ${current.kerf}mm / 端切り各${current.trim}mm / 在庫未使用 ${current.unusedCount}本。端材長は計算上の予測値です。`;
  $('plan-output').innerHTML=current.bars.length?current.bars.map((bar,i)=>{
    const segs=bar.parts.map(part=>`<span class="segment" title="${esc(part.label)} ${part.length}mm" style="flex:${part.length+current.kerf}">${esc(part.label)} ${part.length}</span>`).join('');
    const end=bar.leftover>0?`<span title="残り${bar.leftover}mm" class="segment end ${bar.reusable?'':'scrap'}" style="flex:${bar.leftover}">${bar.leftover>=95?bar.leftover+'mm':''}</span>`:'';
    return `<article class="plan-bar"><div class="plan-top"><b>${String(i+1).padStart(2,'0')} / ${esc(bar.label)}</b><small>${bar.kind==='offcut'?'端材から':'規格材から'} · ${bar.length}mm</small></div><div class="ruler" role="img" aria-label="${esc(bar.label)} の割付図">${segs}${end}</div><div class="tags">${bar.parts.map(p=>`<i>${esc(p.label)} ${p.length}mm</i>`).join('')} <span class="flag">余り ${bar.leftover}mm ${bar.reusable?'→ 再利用候補':'→ スクラップ扱い'}</span></div></article>`;
  }).join(''):'<div class="result-empty">割り付け可能な部材がありません。</div>';
  $('missing-output').innerHTML=current.missing.length?`<div class="missing"><strong>未割付 ${current.missing.length}個</strong>：${esc(current.missing.map(x=>x.label+' '+x.length+'mm').join(' / '))}。在庫の追加または寸法の見直しが必要です。</div>`:'';
  $('confirm-cut').disabled=!current.complete||current.bars.length===0;
  $('export-csv').disabled=current.bars.length===0;
 }catch(err){
  current=null; for(const id of ['metric-pieces','metric-bars','metric-reuse','metric-yield'])$(id).textContent='—';
  $('status').textContent='入力待ち';$('status').className='status alert';$('plan-output').innerHTML=`<div class="result-empty"><span>▤</span>${esc(err.message)}</div>`;$('missing-output').innerHTML='';$('confirm-cut').disabled=true;$('export-csv').disabled=true;
 }
}
function changed(){save();display();}
function setEdit(kind,id){
 const x=state[kind==='cut'?'cuts':'stock'].find(x=>x.id===id);if(!x)return;
 editing[kind]=id;$(kind+'-label').value=x.label;$(kind+'-length').value=x.length;$(kind+'-qty').value=x.qty;
 if(kind==='stock')$('stock-kind').value=x.kind;
 $(kind+'-submit').textContent='変更を保存';$(kind+'-cancel').hidden=false;$(kind+'-label').focus();
}
function cancelEdit(kind){editing[kind]=null;$(kind+'-label').value='';$(kind+'-submit').textContent='＋ '+(kind==='cut'?'部材':'材料')+'追加';$(kind+'-cancel').hidden=true;}
for(const kind of ['stock','cut']){
 $(kind+'-form').addEventListener('submit',event=>{
  event.preventDefault(); const obj={id:editing[kind]||uid(),label:$(kind+'-label').value.trim(),length:Number($(kind+'-length').value),qty:Number($(kind+'-qty').value)};
  if(kind==='stock')obj.kind=$('stock-kind').value;
  if(!obj.label){notify('名前を入力してください');return;}
  const arr=kind==='stock'?state.stock:state.cuts;
  const next=editing[kind]?arr.map(x=>x.id===editing[kind]?obj:x):[...arr,obj];
  const trial={...state,[kind==='stock'?'stock':'cuts']:next};
  try{E.normalized({...trial,stock:trial.stock.length?trial.stock:[{id:'temp',length:1,qty:1}],cuts:trial.cuts.length?trial.cuts:[{id:'temp2',length:1,qty:1}]});}
  catch(e){notify(e.message);return;}
  state=trial;cancelEdit(kind);changed();
 });
 $(kind+'-cancel').addEventListener('click',()=>cancelEdit(kind));
 $(kind+'-list').addEventListener('click',event=>{
  const button=event.target.closest('button[data-action]');if(!button)return;
  const id=button.dataset.id;
  if(button.dataset.action==='edit'){setEdit(kind,id);return;}
  const prop=kind==='stock'?'stock':'cuts';state[prop]=state[prop].filter(x=>x.id!==id);
  if(editing[kind]===id)cancelEdit(kind);changed();
 });
}
for(const id of ['kerf','trim','min-offcut'])$(id).addEventListener('change',()=>{
 const key=id==='min-offcut'?'minOffcut':id;
 const copy={...state,[key]:Number($(id).value)};
 try{E.normalized({...copy,stock:copy.stock.length?copy.stock:[{length:1000,qty:1}],cuts:copy.cuts.length?copy.cuts:[{length:100,qty:1}]});state=copy;changed();}
 catch(e){notify(e.message);syncFields();}
});
function download(name,data,type){const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);}
$('export-csv').addEventListener('click',()=>current&&download('hazai-cut-plan.csv',E.csv(current),'text/csv;charset=utf-8'));
$('download-json').addEventListener('click',()=>download('hazai-bank-backup.json',JSON.stringify({...state,undo:null},null,2),'application/json'));
$('upload-json').addEventListener('click',()=>$('json-file').click());
$('json-file').addEventListener('change',async event=>{
 const file=event.target.files[0];event.target.value='';if(!file)return;
 try{if(file.size>1000000)throw new Error('1MB以下のJSONを使用してください');const obj=JSON.parse(await file.text());
  if(obj.version!==1||!Array.isArray(obj.stock)||!Array.isArray(obj.cuts))throw new Error('端材バンク形式ではありません');
  const checked=E.normalized({...obj,stock:obj.stock.length?obj.stock:[{id:'temp',length:1,qty:1}],cuts:obj.cuts.length?obj.cuts:[{id:'temp2',length:1,qty:1}]});
  state={version:1,stock:obj.stock.length?checked.stock:[],cuts:obj.cuts.length?checked.cuts:[],kerf:checked.kerf,trim:checked.trim,minOffcut:checked.minOffcut,undo:null,lastReceipt:null};
  cancelEdit('stock');cancelEdit('cut');syncFields();changed();notify('バックアップを復元しました');
 }catch(e){notify('読込エラー: '+e.message);}
});
$('reset-demo').addEventListener('click',()=>{if(!window.confirm('現在の在庫と必要部材をサンプルで上書きしますか？'))return;state=sample();cancelEdit('stock');cancelEdit('cut');syncFields();changed();notify('サンプルに戻しました');});
$('confirm-cut').addEventListener('click',()=>{
 if(!current||!current.complete)return;
 if(!window.confirm('実際の切断を終え、端材を測定・確認しましたか？ 計画値で在庫を更新します（後から長さを編集可能）。'))return;
 try{state=E.settle(state,current);cancelEdit('stock');cancelEdit('cut');changed();notify('在庫を更新しました。必要部材一覧はクリアしました。');}
 catch(e){notify('確定できません: '+e.message);}
});
$('undo').addEventListener('click',()=>{if(!state.undo)return;if(!window.confirm('直前の在庫反映を取り消しますか？'))return;state={...state.undo,undo:null};syncFields();changed();notify('直前の確定を取り消しました');});
$('print').addEventListener('click',()=>window.print());
syncFields();display();
})();
