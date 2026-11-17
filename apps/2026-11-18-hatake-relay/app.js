/* Browser UI for 畑リレー. All work stays local. */
(()=>{
'use strict';
const E=window.Hatake, $=id=>document.getElementById(id);
const STORAGE='hatake-relay-v1';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=prefix=>prefix+Math.random().toString(36).slice(2,10);
let state=E.demoState(), proposal=null, msgTimer=null;
try{const previous=localStorage.getItem(STORAGE);if(previous)state=E.normalizeState(JSON.parse(previous));}catch(err){console.warn('Stored state ignored',err)}
function toast(msg){const el=$('toast');el.textContent=msg;el.classList.add('show');if(msgTimer)clearTimeout(msgTimer);msgTimer=setTimeout(()=>el.classList.remove('show'),3600);}
function persist(){try{localStorage.setItem(STORAGE,JSON.stringify(state));}catch(e){toast('端末への自動保存に失敗しました。JSON保存をご利用ください。');}}
function modify(fn){const snapshot=JSON.parse(JSON.stringify(state));try{fn();state=E.normalizeState(state);proposal=null;persist();render();}catch(err){state=snapshot;toast(err.message);render();}}
function familySelect(selected){return `<option value="">記録なし</option>${Object.entries(E.FAMILIES).map(([id,name])=>`<option value="${id}" ${selected===id?'selected':''}>${esc(name)}</option>`).join('')}`;}
function renderBeds(){const target=$('beds');$('addBed').disabled=state.beds.length>=E.MAX;
if(!state.beds.length){target.innerHTML='<div class="empty">🌾 まだ区画がありません。<br>「＋ 区画」から登録してください。</div>';return;}
target.innerHTML=state.beds.map((b,i)=>`<div class="bedrow" data-bed="${b.id}"><div class="bedtop"><input class="bedname" data-role="bed-name" aria-label="区画${i+1}の名前" maxlength="28" value="${esc(b.name)}"><input class="area" data-role="bed-area" type="number" aria-label="区画${i+1}の面積㎡" min="0.1" max="1000" step="0.1" value="${b.area}"><button class="btn mini btn-danger" data-action="remove-bed" aria-label="${esc(b.name)}を削除">×</button></div><div class="tinylabel">過去3年に育てた科（左から新しい順）</div><div class="history">${b.history.map((f,j)=>`<label>${state.year-1-j}年<select data-role="history" data-index="${j}" aria-label="${esc(b.name)}の${state.year-1-j}年">${familySelect(f)}</select></label>`).join('')}</div></div>`).join('');
}
function renderWants(){const target=$('wants');$('addWant').disabled=state.wants.length>=E.MAX;
if(!state.wants.length){target.innerHTML='<div class="empty">🥕 育てたい野菜を追加してください。</div>';return;}
target.innerHTML=state.wants.map((w,i)=>{const c=E.crop(w.crop);return `<div class="wishrow" data-wish="${w.id}"><span class="wishnum">${String(i+1).padStart(2,'0')}</span><div class="wishcrop"><b>${esc(c.name)}</b> <span class="famtag">${esc(E.FAMILIES[c.family])}</span></div><button class="btn mini btn-danger" data-action="remove-wish" aria-label="${esc(c.name)}を削除">×</button></div>`}).join('');
}
function badgeFor(d){if(!d)return `<span class="status warn">未配置</span>`;if(d.repeat>=100||d.areaPenalty>=30)return `<span class="status bad">要再検討</span>`;if(d.repeat>0||!d.areaEnough)return `<span class="status warn">注意 ${d.score}点</span>`;return `<span class="status">適合 ${d.score}点</span>`;}
function renderMetrics(){const a=E.evaluate(state);$('metrics').innerHTML=`<div class="metric"><small>現在のリスク点</small><strong>${a.total}</strong><span>参考スコア</span></div><div class="metric"><small>同科の履歴</small><strong>${a.repeats}</strong><span>区画の重複</span></div><div class="metric"><small>割当済</small><strong>${a.placed}<small>/${state.wants.length}</small></strong><span>${a.unassigned?'未配置あり':'現在の登録作物'}</span></div>`;}
function renderPlan(){const data=E.evaluate(state),scores=Object.fromEntries(data.detail.map(d=>[d.wish,d]));
$('planRows').innerHTML=state.wants.map(w=>{const c=E.crop(w.crop),chosen=state.plan[w.id]||'';
const opts=`<option value="">未配置</option>${state.beds.map(b=>`<option value="${b.id}" ${chosen===b.id?'selected':''}>${esc(b.name)}</option>`).join('')}`;
return `<tr data-wish="${w.id}"><td><b>${esc(c.name)}</b><div class="muted">${esc(E.FAMILIES[c.family])}</div></td><td><select data-role="assign" aria-label="${esc(c.name)}の割当区画">${opts}</select></td><td><label class="check"><input type="checkbox" data-role="lock" ${state.locks[w.id]?'checked':''} ${!chosen?'disabled':''}>固定</label></td><td>${badgeFor(scores[w.id])}</td></tr>`;}).join('') || `<tr><td colspan="4" class="muted">登録した作物がここに表示されます。</td></tr>`;
}
function renderPlots(){const byBed={};const detail=E.evaluate(state).detail;for(const d of detail)byBed[d.bed]=d;
$('plots').innerHTML=state.beds.map((b,i)=>{const d=byBed[b.id],c=d?E.crop(d.crop):null;
const tag=d?(d.repeat>=100||d.areaPenalty>=30?'bad':d.repeat>0||d.areaPenalty>0?'warn':''):'warn';
return `<div class="plot"><div class="plot-title">${String(i+1).padStart(2,'0')} / ${esc(b.name)}</div><div class="plot-sub">${b.area}㎡ · 前年 ${esc(E.FAMILIES[b.history[0]]||'記録なし')}</div><div class="plot-crop">${c?'🌿 '+esc(c.name):'— 空き区画'}<span>${c?esc(E.FAMILIES[c.family]):'配置先を選ぶと表示します'}</span></div><div class="plot-flag"><span class="status ${tag}">${d?(d.repeat?`同じ科の履歴あり・${d.score}点`:d.areaPenalty?'面積に注意':'履歴上の重複なし'):'未配置'}</span></div></div>`;
}).join('')||'<div class="empty">区画を追加すると地図が表示されます。</div>';
}
function renderProposal(){if(!proposal){$('proposalArea').innerHTML='';return;}
const before=proposal.previous,after=proposal.metrics, saved=Math.max(0,Math.round((before.total-after.total)*10)/10);
$('proposalArea').innerHTML=`<div class="proposal"><h3>✨ 割当の候補ができました</h3><p>参考スコア <b>${before.total} → ${after.total}</b>（${saved}点改善）、同科の履歴 ${before.repeats} → ${after.repeats}件。${before.unassigned?'未配置を補って比較しています。':''} 点数は作物・病気の発生確率ではありません。</p><div class="proposal-actions"><button class="btn btn-ink" id="apply">提案を反映</button><button class="btn" id="dismiss">閉じる</button></div><div style="margin-top:10px" class="muted">${state.wants.map(w=>{const c=E.crop(w.crop),b=state.beds.find(x=>x.id===proposal.plan[w.id]);return `${esc(c.name)} → ${esc(b?.name||'未配置')}`;}).join('　/　')}</div></div>`;
}
function render(){ $('year').value=state.year;renderBeds();renderWants();renderMetrics();renderPlan();renderPlots();renderProposal(); }
function freeBedId(excludeWish){const used=new Set(Object.entries(state.plan).filter(([w])=>w!==excludeWish).map(([,b])=>b));return state.beds.find(b=>!used.has(b.id))?.id||'';}
$('addBed').addEventListener('click',()=>modify(()=>{if(state.beds.length>=E.MAX)throw Error('区画は最大10件です');state.beds.push({id:uid('b'),name:`区画 ${state.beds.length+1}`,area:1,history:['','','']});}));
$('beds').addEventListener('change',e=>{const row=e.target.closest('[data-bed]');if(!row)return;const b=state.beds.find(x=>x.id===row.dataset.bed);if(!b)return;
modify(()=>{switch(e.target.dataset.role){case 'bed-name':if(!e.target.value.trim())throw Error('区画名は空にできません');b.name=e.target.value.trim();break;case 'bed-area':b.area=Number(e.target.value);break;case 'history':b.history[Number(e.target.dataset.index)]=e.target.value;break;}});
});
$('beds').addEventListener('click',e=>{if(e.target.dataset.action!=='remove-bed')return;const id=e.target.closest('[data-bed]').dataset.bed;
modify(()=>{state.beds=state.beds.filter(b=>b.id!==id);for(const w of Object.keys(state.plan))if(state.plan[w]===id){delete state.plan[w];delete state.locks[w];}});
});
$('newCrop').innerHTML=E.CROPS.map(c=>`<option value="${c.id}">${esc(c.name)}（${esc(E.FAMILIES[c.family])}）</option>`).join('');
$('addWant').addEventListener('click',()=>modify(()=>{if(state.wants.length>=E.MAX)throw Error('作物は最大10件です');const id=uid('w');state.wants.push({id,crop:$('newCrop').value});const free=freeBedId(id);if(free)state.plan[id]=free;}));
$('wants').addEventListener('click',e=>{if(e.target.dataset.action!=='remove-wish')return;const id=e.target.closest('[data-wish]').dataset.wish;modify(()=>{state.wants=state.wants.filter(w=>w.id!==id);delete state.plan[id];delete state.locks[id];});});
$('planRows').addEventListener('change',e=>{const row=e.target.closest('[data-wish]');if(!row)return;const id=row.dataset.wish;
if(e.target.dataset.role==='lock'){modify(()=>{if(e.target.checked){if(!state.plan[id])throw Error('先に区画を選んでください');state.locks[id]=state.plan[id];}else delete state.locks[id];});return;}
if(e.target.dataset.role==='assign'){modify(()=>{const v=e.target.value;if(state.locks[id] && state.locks[id]!==v)throw Error('固定解除してから割当先を変更してください');
if(v && Object.entries(state.plan).some(([wid,b])=>wid!==id&&b===v))throw Error('その区画には既に作物を割り当てています');
if(v)state.plan[id]=v;else delete state.plan[id];});}
});
$('solve').addEventListener('click',()=>{try{proposal=E.optimize(state);renderProposal();toast('すべての候補割当を比較しました。');}catch(e){proposal=null;renderProposal();toast(e.message);}});
$('proposalArea').addEventListener('click',e=>{if(e.target.id==='dismiss'){proposal=null;renderProposal();return;}if(e.target.id==='apply'&&proposal){const plan=proposal.plan;modify(()=>{state.plan={...plan};});toast('提案を現在の計画に反映しました。');}});
$('year').addEventListener('change',e=>modify(()=>{state.year=Number(e.target.value);}));
$('demo').addEventListener('click',()=>{if(!confirm('現在の計画をサンプルに置き換えますか？'))return;state=E.demoState();proposal=null;persist();render();toast('サンプルを読み込みました。');});
function download(name,text,mime){const blob=new Blob([text],{type:mime}),link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=name;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(link.href),1000);}
$('save').addEventListener('click',()=>{download(`hatake-relay-${state.year}.json`,JSON.stringify(state,null,2),'application/json;charset=utf-8');toast('JSONを保存しました。');});
$('csv').addEventListener('click',()=>{download(`hatake-relay-${state.year}.csv`,E.exportCSV(state),'text/csv;charset=utf-8');toast('CSVを出力しました。');});
$('load').addEventListener('click',()=>$('file').click());
$('file').addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;try{if(f.size>1024*1024)throw Error('1MB以下のJSONを選んでください');const s=E.normalizeState(JSON.parse(await f.text()));state=s;proposal=null;persist();render();toast('JSONを読み込みました。');}catch(err){toast('読み込めません: '+err.message);}finally{e.target.value='';}});
$('print').addEventListener('click',()=>window.print());
$('clear').addEventListener('click',()=>{if(!confirm('端末内の計画をすべて削除しますか？'))return;state=E.emptyState();proposal=null;persist();render();toast('計画を初期化しました。');});
render();
})();
