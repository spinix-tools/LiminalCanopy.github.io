(()=>{'use strict';
const E=window.Kirinaoshi, STORAGE='kirinaoshi_v1_20261121';
const $=id=>document.getElementById(id), escapeHTML=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state;try{state=E.importProject(localStorage.getItem(STORAGE)||'');}catch{state=E.demo()}
const notice=msg=>{$('notice').textContent=msg||'';};
function store(){try{localStorage.setItem(STORAGE,JSON.stringify({...state,history:[]}));}catch{notice('端末への自動保存に失敗しました。JSON保存をご利用ください。')}}
function number(v){return Number(v).toLocaleString('ja-JP')}
function draw(){
 const p=E.plan(state);$('title').value=state.title;$('kerf').value=state.kerf;$('reuseMin').value=state.reuseMin;$('undo').disabled=!state.history?.length;
 $('stats').innerHTML=[['完了',`${p.totalCompleted} / ${p.totalRequested}`,'切断済みの部材'],['割当済み',`${p.planned} 本`,'これから切る予定'],['材料使用',`${p.boards.length} 本`,'在庫のうち使用する本数'],['残材',`${number(p.stored)} mm`,'予定される再利用可能な残り']].map(([t,n,d],i)=>`<div class="stat ${i===1&&p.missing.length?'warn':''}"><span>${t}</span><b>${n}</b><span>${d}</span></div>`).join('');
 $('stockRows').innerHTML=state.stocks.map(s=>`<tr><td><input aria-label="${escapeHTML(s.label)} の名前" data-table="stocks" data-id="${escapeHTML(s.id)}" data-field="label" value="${escapeHTML(s.label)}" maxlength="80"></td><td><input aria-label="${escapeHTML(s.label)} の長さ" type="number" min="0" max="20000" step="1" data-table="stocks" data-id="${escapeHTML(s.id)}" data-field="length" value="${s.length}"></td><td><select aria-label="種別" data-table="stocks" data-id="${escapeHTML(s.id)}" data-field="kind"><option value="new" ${s.kind==='new'?'selected':''}>購入材</option><option value="offcut" ${s.kind==='offcut'?'selected':''}>端材</option></select></td><td><button class="delete" data-remove="stocks" data-id="${escapeHTML(s.id)}" aria-label="削除">×</button></td></tr>`).join('')||'<tr><td colspan="4">材料がありません</td></tr>';
 $('partRows').innerHTML=state.parts.map(s=>`<tr><td><input aria-label="${escapeHTML(s.label)} の名前" data-table="parts" data-id="${escapeHTML(s.id)}" data-field="label" value="${escapeHTML(s.label)}" maxlength="80"></td><td><input type="number" min="1" max="20000" step="1" data-table="parts" data-id="${escapeHTML(s.id)}" data-field="length" value="${s.length}" aria-label="${escapeHTML(s.label)} の長さ"></td><td><input type="number" min="${s.done||1}" max="100" step="1" data-table="parts" data-id="${escapeHTML(s.id)}" data-field="qty" value="${s.qty}" aria-label="必要本数"></td><td><span class="done-pill">${s.done}</span></td><td><button class="delete" data-remove="parts" data-id="${escapeHTML(s.id)}" aria-label="削除">×</button></td></tr>`).join('')||'<tr><td colspan="5">部材がありません</td></tr>';
 $('warnings').innerHTML=p.missing.length?`<div class="warnbox"><strong>⚠ 未割当 ${p.missing.length} 本</strong>：いまの在庫では全て切れません（計画は近似です）。不足：${escapeHTML(p.missing.map(x=>`${x.label} ${x.length}mm`).slice(0,8).join('、'))}${p.missing.length>8?' ほか':''}。材料を追加または実測値を更新してください。</div>`:'<div class="successbox">✓ 現在の未切断部材は、登録した手持ち材料で割り当て可能です（寸法・刃厚の概算）。</div>';
 $('plans').innerHTML=p.boards.map((b,bi)=>{
  const segments=[];b.cuts.forEach(c=>{segments.push(`<div class="segment ${b.kind}" style="flex:${c.length}" title="${escapeHTML(c.label)} ${c.length}mm">${escapeHTML(c.length>=140?c.label:'')}</div>`);if(state.kerf)segments.push(`<div class="segment kerf" style="flex:${state.kerf}" title="刃厚 ${state.kerf}mm"></div>`)});
  if(b.remaining)segments.push(`<div class="segment remainder" style="flex:${b.remaining}" title="残り ${b.remaining}mm">${b.remaining>100?`${b.remaining}mm`:''}</div>`);
  const first=b.cuts[0],expected=b.initial-first.length-state.kerf;
  return `<article class="board"><div class="board-title"><strong>${escapeHTML(b.label)}</strong><span class="type ${b.kind==='offcut'?'offcut':''}">${b.kind==='offcut'?'端材':'購入材'}</span></div><div class="board-meta"><span>開始 ${number(b.initial)} mm</span><span>予定残 ${number(b.remaining)} mm</span><span>切断 ${b.cuts.length} 回</span></div><div class="bar" role="img" aria-label="${escapeHTML(b.cuts.map(c=>c.label+' '+c.length+'mm').join('、'))}">${segments.join('')}</div><div class="chips">${b.cuts.map((c,i)=>`<span class="chip">${i+1}. ${escapeHTML(c.label)} ${number(c.length)}mm</span>`).join('')}</div><div class="measure"><label>1本目を切った後の実測残り（mm）<input type="number" min="0" max="${expected}" step="1" data-measure="${escapeHTML(b.id)}" value="${expected}"></label><button class="primary" data-cut="${escapeHTML(b.id)}" data-part="${escapeHTML(first.id)}">✓ ${escapeHTML(first.label)}を切断完了</button></div></article>`;
 }).join('')||'<div class="empty">未切断の割当はありません。全部完了した場合は、このままCSVで記録できます。</div>';
 $('history').innerHTML=(state.log||[]).slice(-5).reverse().map(x=>`<div class="historyline">${escapeHTML(x.part)} ${number(x.cutLength)} mm ／ ${escapeHTML(x.stock)} → 残り ${number(x.actual)} mm${x.loss?` （予定差 −${number(x.loss)} mm）`:''}</div>`).join('')||'<p class="hint">まだ切断記録はありません。右上の「1手戻す」は切断操作に対応します。</p>';
}
function mutate(fn){const old=E.copy(state);try{fn();E.validate(state);notice('');store();draw();}catch(e){state=old;draw();notice(e.message||'更新できませんでした');}}
function download(name,content,mime){const blob=new Blob([content],{type:mime}),href=URL.createObjectURL(blob),a=document.createElement('a');a.href=href;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(href),2000)}
const uid=prefix=>prefix+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
$('addStock').addEventListener('click',()=>mutate(()=>state.stocks.push({id:uid('s'),label:'新しい材料',length:1820,kind:'new'})));
$('addPart').addEventListener('click',()=>mutate(()=>state.parts.push({id:uid('p'),label:'新しい部材',length:300,qty:1,done:0})));
document.addEventListener('change',event=>{
 const t=event.target;if(t.matches('[data-table][data-field]')){const key=t.dataset.field;mutate(()=>{const row=state[t.dataset.table].find(x=>x.id===t.dataset.id);if(!row)throw Error('対象行が見つかりません');row[key]=['length','qty'].includes(key)?Number(t.value):t.value;});}
 else if(['title','kerf','reuseMin'].includes(t.id)){mutate(()=>{state[t.id]=t.id==='title'?t.value:Number(t.value);if(t.id==='title'&&state.title.length>80)throw Error('名前が長すぎます')})}
});
document.addEventListener('click',event=>{const t=event.target.closest('button');if(!t)return;
 if(t.dataset.remove){mutate(()=>{state[t.dataset.remove]=state[t.dataset.remove].filter(x=>x.id!==t.dataset.id)});return}
 if(t.dataset.cut){const measured=document.querySelector(`[data-measure="${CSS.escape(t.dataset.cut)}"]`);const original=state;try{state=E.cut(state,t.dataset.cut,t.dataset.part,measured.value);notice('切断を記録しました。残った材料から計画を更新しています。');store();draw();}catch(e){state=original;notice(e.message)}return}
});
$('undo').addEventListener('click',()=>{try{state=E.undo(state);store();draw();notice('最後の切断記録を1手戻しました。')}catch(e){notice(e.message)}});
$('save').addEventListener('click',()=>download('kirinaoshi-project.json',JSON.stringify({...state,history:[]},null,2),'application/json'));
$('csv').addEventListener('click',()=>download('kirinaoshi-cut-plan.csv',E.exportCSV(state),'text/csv;charset=utf-8'));
$('print').addEventListener('click',()=>window.print());
$('reset').addEventListener('click',()=>{if(window.confirm('現在の入力と切断履歴をサンプルに戻しますか？')){state=E.demo();store();draw();notice('サンプルに戻しました')}});
$('load').addEventListener('change',async event=>{const file=event.target.files?.[0];if(!file)return;try{if(file.size>1024*1024)throw Error('ファイルが大きすぎます（上限1MB）');state=E.importProject(await file.text());store();draw();notice('JSONを読み込みました');}catch(e){notice('読込できませんでした: '+e.message)}event.target.value='';});
try{draw()}catch(e){state=E.demo();draw();notice('保存データに不備があり、サンプルを読み込みました')}
})();