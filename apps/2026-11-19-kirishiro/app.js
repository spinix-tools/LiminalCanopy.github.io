/* KIRISHIRO browser application — no network requests or external dependencies. */
(()=>{'use strict';
const E=globalThis.KIRISHIRO,KEY='kirishiro.v1';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const yen=n=>new Intl.NumberFormat('ja-JP',{style:'currency',currency:'JPY',maximumFractionDigits:0}).format(n);
const num=n=>Number(n).toLocaleString('ja-JP');
let state=readState(),result=null,undoSnapshot=null,idCounter=0;
function readState(){try{const raw=localStorage.getItem(KEY);if(raw){const parsed=JSON.parse(raw);E.normalize(parsed);return parsed;}}catch(e){/* storage may be blocked */}return E.sample();}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(state));$('storageStatus').textContent='✓ この端末に保存しました · 外部送信なし';}catch(e){$('storageStatus').textContent='端末保存は利用できません。JSON保存を利用してください。';}}
function freshId(prefix){return prefix+Date.now().toString(36)+(++idCounter).toString(36);}
function partRow(p){return `<tr data-id="${esc(p.id)}"><td><input aria-label="部材名" data-entity="part" data-field="name" value="${esc(p.name)}" maxlength="60"></td><td><input aria-label="部材の長さ mm" data-entity="part" data-field="length" type="number" min="1" max="6000" value="${esc(p.length)}"></td><td><input aria-label="部材数" data-entity="part" data-field="qty" type="number" min="1" max="40" value="${esc(p.qty)}"></td><td><button type="button" class="remove-btn" data-remove="part" aria-label="部材を削除">×</button></td></tr>`;}
function stockRow(s){return `<tr data-id="${esc(s.id)}"><td><div class="stock-name"><select aria-label="材料種別" data-entity="stock" data-field="kind"><option value="new" ${s.kind==='new'?'selected':''}>買う材料</option><option value="offcut" ${s.kind==='offcut'?'selected':''}>手元の端材</option></select><input aria-label="材料名" data-entity="stock" data-field="name" value="${esc(s.name)}" maxlength="60"></div></td><td><input aria-label="材料の長さ mm" type="number" data-entity="stock" data-field="length" min="1" max="6000" value="${esc(s.length)}"></td><td><input aria-label="材料の利用可能本数" type="number" data-entity="stock" data-field="qty" min="0" max="40" value="${esc(s.qty)}"></td><td><input aria-label="材料の単価 円" type="number" data-entity="stock" data-field="price" min="0" max="100000" value="${s.kind==='offcut'?0:esc(s.price)}" ${s.kind==='offcut'?'disabled':''}></td><td><button type="button" class="remove-btn" data-remove="stock" aria-label="材料を削除">×</button></td></tr>`;}
function renderInputs(){
  document.querySelectorAll('[data-setting]').forEach(el=>el.value=state.settings[el.dataset.setting]??'');
  $('partsRows').innerHTML=state.parts.map(partRow).join('');
  $('stocksRows').innerHTML=state.stocks.map(stockRow).join('');
}
function metric(label,value,unit='',prominent=false){return `<div class="metric ${prominent?'primary':''}"><small>${label}</small><strong>${esc(value)} <span>${unit}</span></strong></div>`;}
function diagram(board){
  const usable=board.sourceLength-board.trimUsed;
  const pieces=board.parts.map((p,i)=>{
    const w=(p.length/usable*100).toFixed(5),kw=(p.kerf/usable*100).toFixed(5);
    return `<div class="segment" style="width:${w}%" title="${esc(p.name)} ${p.length}mm"><span>${esc(p.name)}<br>${num(p.length)}</span></div>${p.kerf>0?`<div class="kerf-piece" style="width:${kw}%" title="刃幅 ${p.kerf}mm"></div>`:''}`;
  }).join('');
  const remain=board.remainder?`<div class="remainder" style="width:${(board.remainder/usable*100).toFixed(5)}%" title="端材 ${board.remainder}mm">${board.remainder/usable>.1?num(board.remainder)+'mm':''}</div>`:'';
  const tags=board.parts.map(p=>`<span>${esc(p.name)} ${num(p.length)}mm</span>`).join('');
  const isNew=board.kind==='new';
  return `<article class="board-card"><div class="board-header"><div><span class="source-chip ${isNew?'new':''}">${isNew?'購入材':'手元の端材'}</span><strong>${esc(board.sourceName)}</strong> <small>${num(board.sourceLength)}mm</small></div><small>カット ${board.cuts}回 / ${isNew?yen(board.price):'0円'}</small></div><div class="cutbar" role="img" aria-label="${esc(board.sourceName)}から${board.parts.map(p=>esc(p.name)+p.length+'mm').join('、')}を切り出し、残り${board.remainder}mm">${pieces}${remain}</div><div class="board-meta"><span>仕上がり部材 ${board.parts.length}個</span><span>端部余裕 ${board.trimUsed}mm / 刃のロス ${board.kerfUsed}mm / 残り ${num(board.remainder)}mm</span></div><div class="board-tags">${tags}</div></article>`;
}
function renderResult(){
  if(!result)return;
  const {totals:t,boards,unplaced,purchase}=result;
  $('errorBox').hidden=true;
  $('resultStatus').textContent=unplaced.length?'未配置あり':'配置完了';$('resultStatus').className='status-pill'+(unplaced.length?' warn':'');
  $('heroTotal').textContent=yen(t.grandTotal);$('heroNote').textContent=`購入材 ${t.newCount}本 · 手元の端材 ${t.offcutCount}本を使用`;
  $('summary').innerHTML=metric('材料＋店舗加工費',num(t.grandTotal),'円',true)+metric('購入本数',num(t.newCount),'本')+metric('店舗カット代',num(t.feeCost),'円')+metric('残せる端材',num(t.kept),'mm')+metric('加工ロス＋廃材',num(t.waste),'mm')+metric('端材を使う本数',num(t.offcutCount),'本');
  const clone=JSON.parse(JSON.stringify(state));clone.stocks.forEach(s=>{if(s.kind==='offcut')s.qty=0;});
  try{const alt=E.plan(clone);const saving=alt.totals.grandTotal-t.grandTotal;
    $('comparison').innerHTML=`端材を使わない同条件の試算：<strong>${yen(alt.totals.grandTotal)}</strong>。今回との差：<strong>${saving>=0?'−'+yen(saving):'＋'+yen(-saving)}</strong>（近似計算による比較）${alt.unplaced.length?' ※比較側には未配置があります。':''}`;
  }catch(e){$('comparison').textContent='端材を使わない比較プランは計算できません。';}
  $('boards').innerHTML=boards.length?boards.map(diagram).join(''):'<p class="empty">割り付けできる材料がありません。</p>';
  $('purchase').innerHTML='<h3>買い物メモ</h3>'+(purchase.length?purchase.map(p=>`<div class="purchase-row"><span>${esc(p.name)}（${num(p.length)}mm）× ${p.qty}本</span><b>${yen(p.total)}</b></div>`).join(''):'<p class="empty">新たな購入は不要です。</p>')+`<div class="purchase-row"><span>材料費 ${yen(t.stockCost)} ＋ 店舗加工 ${t.storeCuts}回</span><b>合計 ${yen(t.grandTotal)}</b></div>`;
  $('warning').textContent=unplaced.length?`⚠ ${unplaced.length}個の部材を配置できませんでした：${unplaced.map(p=>`${p.name} ${p.length}mm`).join('、')}。材料・本数上限・運搬上限を確認してください。`:'';
  $('applyBtn').disabled=unplaced.length>0||boards.length===0;
}
function recalc(){
  try{result=E.plan(state);renderResult();}
  catch(e){result=null;$('errorBox').hidden=false;$('errorBox').textContent='入力を確認：'+e.message;$('resultStatus').textContent='要修正';$('resultStatus').className='status-pill warn';$('summary').innerHTML='';$('comparison').innerHTML='';$('boards').innerHTML='';$('purchase').innerHTML='';$('warning').textContent='';$('heroTotal').textContent='—';$('heroNote').textContent='入力を修正してください';$('applyBtn').disabled=true;}
}
function changed(){undoSnapshot=null;$('undoBtn').hidden=true;persist();recalc();}
function rebuild(){renderInputs();changed();}
function download(filename,content,type){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=filename;document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
function csvEscape(v){let s=String(v??'');if(/^[\s]*[=+\-@]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
function csv(){if(!result)return;const rows=[['種別','材料名','母材長(mm)','部材名','開始位置(mm)','仕上がり長(mm)','切りしろ(mm)','残材(mm)','材料費(円)']];
 for(const b of result.boards){for(const p of b.parts)rows.push([b.kind==='new'?'購入':'端材',b.sourceName,b.sourceLength,p.name,p.start,p.length,p.kerf,b.remainder,b.price]);}
 rows.push([]);rows.push(['購入名','長さ(mm)','本数','単価(円)','計(円)']);for(const p of result.purchase)rows.push([p.name,p.length,p.qty,p.unit,p.total]);rows.push(['材料費',result.totals.stockCost],['加工費',result.totals.feeCost],['合計',result.totals.grandTotal]);
 download('kirishiro-cutlist.csv','\uFEFF'+rows.map(r=>r.map(csvEscape).join(',')).join('\r\n'),'text/csv;charset=utf-8');}
function svg(){if(!result || !result.boards.length)return;const w=1240,left=190,barW=990,h=125+result.boards.length*83;let body=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="#ffffff"/><text x="35" y="43" font-family="sans-serif" fill="#15362f" font-size="27" font-weight="bold">きりしろ | CUT PLAN</text><text x="35" y="72" font-family="sans-serif" fill="#64826d" font-size="15">${esc('費用 '+yen(result.totals.grandTotal)+' / 本数 '+result.boards.length+' / 刃幅 '+result.settings.kerf+'mm')}</text>`;
 result.boards.forEach((b,i)=>{const y=108+i*83,usable=b.sourceLength-b.trimUsed;body+=`<text x="35" y="${y+20}" font-family="sans-serif" fill="#224533" font-size="15" font-weight="bold">${esc(b.sourceName)}</text><text x="35" y="${y+38}" font-family="sans-serif" fill="#748d78" font-size="12">${esc(String(b.sourceLength)+'mm / '+(b.kind==='new'?'購入':'端材'))}</text>`;let x=left;
  b.parts.forEach((p,j)=>{const pw=p.length/usable*barW;body+=`<rect x="${x}" y="${y}" width="${pw}" height="45" fill="${['#b7d9ba','#b8d8cb','#d9e7b0'][j%3]}" stroke="white"/><title>${esc(p.name)} ${p.length}mm</title>`;if(pw>60)body+=`<text x="${x+pw/2}" y="${y+26}" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#234c38">${esc(p.name+' '+p.length)}</text>`;x+=pw;if(p.kerf){const kw=p.kerf/usable*barW;body+=`<rect x="${x}" y="${y}" width="${kw}" height="45" fill="#bc735a"/>`;x+=kw;}});
  if(b.remainder)body+=`<rect x="${x}" y="${y}" width="${b.remainder/usable*barW}" height="45" fill="#edf0e7"/><text x="${x+5}" y="${y+62}" font-family="sans-serif" font-size="11" fill="#64796b">残 ${b.remainder}mm</text>`;
 });body+=`<text x="35" y="${h-17}" font-family="sans-serif" fill="#708579" font-size="11">1D approximation · verify dimensions before cutting · KIRISHIRO</text></svg>`;download('kirishiro-plan.svg',body,'image/svg+xml;charset=utf-8');}
document.addEventListener('change',async ev=>{
 const el=ev.target;
 if(el.dataset.setting){state.settings[el.dataset.setting]=el.value;changed();return;}
 if(el.dataset.entity){const id=el.closest('tr')?.dataset.id;const entry=(el.dataset.entity==='part'?state.parts:state.stocks).find(p=>String(p.id)===id);if(!entry)return;entry[el.dataset.field]=el.value;if(el.dataset.field==='kind' && entry.kind==='offcut')entry.price=0;if(el.dataset.field==='kind'){renderInputs();}changed();return;}
});
document.addEventListener('click',ev=>{
 const btn=ev.target.closest('[data-remove]');if(!btn)return;const id=btn.closest('tr')?.dataset.id;
 if(btn.dataset.remove==='part')state.parts=state.parts.filter(p=>String(p.id)!==id);else state.stocks=state.stocks.filter(s=>String(s.id)!==id);rebuild();
});
$('addPart').addEventListener('click',()=>{state.parts.push({id:freshId('p'),name:'新しい部材',length:450,qty:1});rebuild();});
$('addStock').addEventListener('click',()=>{state.stocks.push({id:freshId('s'),kind:'offcut',name:'手元の端材',length:700,qty:1,price:0});rebuild();});
$('calculateBtn').addEventListener('click',()=>{persist();recalc();$('resultTitle').scrollIntoView({behavior:'smooth',block:'center'});});
$('resetBtn').addEventListener('click',()=>{if(confirm('入力をサンプルに戻しますか？')){state=E.sample();rebuild();}});
$('exportJsonBtn').addEventListener('click',()=>download('kirishiro-project.json',JSON.stringify(state,null,2),'application/json;charset=utf-8'));
$('importBtn').addEventListener('click',()=>$('importFile').click());
$('importFile').addEventListener('change',async ev=>{const file=ev.target.files?.[0];ev.target.value='';if(!file)return;try{if(file.size>200000)throw Error('JSONファイルが大きすぎます（上限200KB）');const next=JSON.parse(await file.text());E.normalize(next);state=next;rebuild();}catch(e){$('errorBox').hidden=false;$('errorBox').textContent='読込に失敗：'+e.message;}});
$('csvBtn').addEventListener('click',csv);$('svgBtn').addEventListener('click',svg);$('printBtn').addEventListener('click',()=>window.print());
$('applyBtn').addEventListener('click',()=>{if(!result||result.unplaced.length)return;if(!confirm('表示中の計画どおりに全て切り終わりましたか？ 使用端材を減らし、残材を台帳へ追加します。'))return;try{const next=E.applyInventory(state,result);undoSnapshot=JSON.parse(JSON.stringify(state));state=next;renderInputs();persist();recalc();$('undoBtn').hidden=false;$('storageStatus').textContent='✓ 端材台帳を更新しました。実作業との一致を確認してください。';}catch(e){$('errorBox').hidden=false;$('errorBox').textContent=e.message;}});
$('undoBtn').addEventListener('click',()=>{if(!undoSnapshot)return;state=undoSnapshot;undoSnapshot=null;renderInputs();persist();recalc();$('undoBtn').hidden=true;});
renderInputs();recalc();
})();
