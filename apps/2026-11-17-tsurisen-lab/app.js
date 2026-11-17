/* つり銭ラボ — local-first browser UI. No external requests. */
(() => {
'use strict';
const E = window.TsuriEngine;
const $ = id => document.getElementById(id);
const KEY = 'tsurisen-lab-v1';
let state;
try {state = E.normalizeState(JSON.parse(localStorage.getItem(KEY)));} catch (_) {state = E.newState();}
const basket = new Map();
let simResult = null;
const fmt = n => Number(n).toLocaleString('ja-JP');
const yen = n => '¥' + fmt(n);
const esc = text => String(text).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
let toastTimer = null;
function toast(message, danger=false) {
  const el=$('toast'); el.textContent=message; el.style.background=danger?'#8d3d2f':'#1d4551'; el.style.display='block';
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.style.display='none',4300);
}
function persist() {
  try {localStorage.setItem(KEY, JSON.stringify(state));} catch(_) {toast('端末への保存が許可されていません。JSONバックアップを利用してください。',true);}
}
function setState(next){state=E.normalizeState(next);persist(); simResult=null; renderAll();}
function denomInputMarkup(prefix,counts,disabled=false){
  return E.DENOMS.map((d,i)=>`<div class="denom-cell"><label for="${prefix}-${d}">${fmt(d)}円</label><input id="${prefix}-${d}" data-index="${i}" type="number" min="0" max="999" step="1" value="${counts[i]}" ${disabled?'disabled':''} aria-label="${d}円の枚数"><small>枚</small></div>`).join('');
}
function readCounts(prefix){
  const v=E.DENOMS.map(d=>Number($(prefix+'-'+d).value)); E.validateCounts(v);
  return v;
}
function renderPrep(){
  const isLocked=state.sales.length>0;
  $('openingFields').innerHTML=denomInputMarkup('open',state.opening,isLocked);
  $('openingTotal').textContent=yen(E.totalCash(state.opening));
  $('saveOpening').disabled=isLocked; $('usePreset').disabled=isLocked;
  $('productRows').innerHTML=state.products.length?state.products.map(p=>`<tr><td>${esc(p.name)}</td><td class="money">${yen(p.price)}</td><td>${p.weight}</td><td><button type="button" class="btn small" data-edit="${p.id}">編集</button><button type="button" class="btn small danger" data-remove="${p.id}">削除</button></td></tr>`).join(''):'<tr><td colspan="4" class="empty">商品を追加してください。</td></tr>';
}
function renderHero(){const s=E.cashSummary(state);$('heroCash').textContent=fmt(E.totalCash(s.drawer));$('heroRevenue').textContent=fmt(s.revenue);$('heroSales').textContent=fmt(s.transactions);}
function totalBasket(){return [...basket].reduce((acc,[id,qty])=>{const p=state.products.find(x=>x.id===id);return acc+(p?p.price*qty:0);},0);}
function renderPOS(){
  $('saleProducts').innerHTML=state.products.length?state.products.map(p=>`<button class="product-button" type="button" data-add="${p.id}"><strong>${esc(p.name)}</strong><span>${yen(p.price)}</span></button>`).join(''):'<div class="empty">「準備する」で商品を登録してください。</div>';
  const lines=[...basket].map(([id,n])=>({p:state.products.find(p=>p.id===id),n})).filter(x=>x.p&&x.n>0);
  $('cartLines').innerHTML=lines.length?lines.map(({p,n})=>`<div class="cart-line"><div>${esc(p.name)}<div class="muted">${yen(p.price)} × ${n}</div></div><div class="qty"><button type="button" data-minus="${p.id}" aria-label="${esc(p.name)}を1点減らす">−</button><b>${n}</b><button type="button" data-add="${p.id}" aria-label="${esc(p.name)}を1点増やす">＋</button><strong class="money">${yen(p.price*n)}</strong></div></div>`).join(''):'<div class="empty">左の商品を選んでください。</div>';
  const sum=totalBasket(); $('cartTotal').textContent=yen(sum);
  const tender=$('tenderSelect'); const old=Number(tender.value);
  const choices=E.DENOMS.filter(d=>d>=sum && d<=10000 && (d===10000||d===5000||d===2000||d===1000||d===500||d===100||d===50||d===10||d===5||d===1));
  tender.innerHTML=choices.map(d=>`<option value="${d}">${fmt(d)}円</option>`).join('');
  if(choices.includes(old)) tender.value=String(old); else if(choices.length) tender.value=String(choices[0]);
  updateQuote();
  $('salesRows').innerHTML=state.sales.length?state.sales.slice(-8).reverse().map(s=>`<tr><td>${esc(s.at.slice(5,16).replace('T',' '))}</td><td>${esc(s.label)}</td><td class="money">${yen(s.amount)}</td><td>${yen(s.tender)}</td></tr>`).join(''):'<tr><td colspan="4" class="empty">会計記録はまだありません。</td></tr>';
  $('undoSale').disabled=!state.sales.length;
}
function updateQuote(){
  const amount=totalBasket(); const tender=Number($('tenderSelect').value);
  $('recordSale').disabled= !amount || amount>10000 || state.sales.length>=2000;
  if(amount>10000){$('quoteStatus').innerHTML='<div class="status bad">1会計10,000円まで対応です。注文を分けてください。</div>';return;}
  if(!amount || !E.DENOMS.includes(tender)){ $('quoteStatus').innerHTML='<div class="status neutral">商品を選ぶと釣銭を計算します。</div>';return; }
  let q; try{q=E.quote(E.getDrawer(state),amount,tender);} catch(err){$('quoteStatus').textContent=err.message;return;}
  const chips=q.change?E.DENOMS.map((d,i)=>({d,n:q.change[i]})).filter(x=>x.n).map(x=>`<div class="change-chip">${fmt(x.d)}円<b>× ${x.n}</b></div>`).join(''):'';
  $('recordSale').disabled=!q.possible;
  $('quoteStatus').innerHTML=q.possible?`<div class="status">お釣り <strong class="money">${yen(q.due)}</strong> — いまの金種で返せます。</div>${chips?`<div class="change-results">${chips}</div>`:''}`:`<div class="status bad">お釣り ${yen(q.due)} を現在の金種で組めません。確定できません。</div>`;
}
function renderClose(){
  const s=E.cashSummary(state);
  $('closeOpening').textContent=yen(s.opening);$('closeRevenue').textContent=yen(s.revenue);$('closeExpected').textContent=yen(s.expected);
  $('expectedFields').innerHTML=denomInputMarkup('expected',s.drawer,true);
  $('physicalFields').innerHTML=denomInputMarkup('physical',state.physical||s.drawer,false);
  renderCloseResult();
}
function renderCloseResult(){
  const el=$('closeResult');if(!state.physical){el.className='status neutral';el.textContent='実物の枚数を入力し、「差異を計算」を押してください。';return;}
  const s=E.cashSummary(state);
  el.className='status '+(s.difference===0?'':'bad');
  const per=E.DENOMS.map((d,i)=>({d,delta:state.physical[i]-s.drawer[i]})).filter(x=>x.delta);
  el.innerHTML=`<strong>${s.difference===0?'現金差異なし':`現金差異 ${s.difference>0?'+':''}${yen(s.difference)}`}</strong>　実物 ${yen(s.physical)} / 帳簿 ${yen(s.expected)}${per.length?`<div style="margin-top:7px;font-size:12px">枚数差：${per.map(x=>`${fmt(x.d)}円 ${x.delta>0?'+':''}${x.delta}枚`).join('・')}</div>`:''}`;
}
function renderSim(){
  if(!simResult){$('simBadge').textContent='未計算';$('simResults').innerHTML='<div class="empty">「不足リスクを計算」を押すと、釣銭が不足しない割合・不足しやすい金額が表示されます。</div>';return;}
  const r=simResult; const pct=Math.round(r.noShortageRate*1000)/10;
  $('simBadge').textContent=`${r.trials}回試行`;
  const max=Math.max(1,...r.riskyChanges.map(x=>x.count));
  const risks=r.riskyChanges.length?r.riskyChanges.map(x=>`<div class="risk-row"><span>${yen(x.amount)}</span><span class="bar"><i style="width:${(x.count/max)*100}%"></i></span><b>${x.count}</b></div>`).join(''):'<p class="mini">この条件では釣銭不足は発生しませんでした。</p>';
  $('simResults').innerHTML=`<div class="result-panel"><small>全取引で不足が起きなかった試行</small><b>${pct}%</b><div class="progress"><div style="width:${pct}%"></div></div><small>${r.noShortageRuns} / ${r.trials}試行（各${r.visits}件の会計）</small></div><div class="result-stat" style="margin-top:10px"><div class="result-panel"><small>1試行の平均不足回数</small><b>${r.avgShortages.toFixed(2)}</b></div><div class="result-panel"><small>不足が出るまでの平均件数 *</small><b>${r.avgFirstShortageSale==null?'—':r.avgFirstShortageSale.toFixed(1)}</b></div></div><h3 style="margin-top:21px">不足したお釣り金額 TOP 4</h3>${risks}<p class="mini">* 不足が発生した試行のみ。支払い金種・商品比重は仮定値。成功率は統計的な保証ではなくこのモデルでの試行割合です。</p>`;
}
function renderAll(){renderHero();renderPrep();renderPOS();renderClose();renderSim();}
function setTab(name){
  for(const btn of document.querySelectorAll('[data-tab]'))btn.setAttribute('aria-selected',String(btn.dataset.tab===name));
  for(const section of document.querySelectorAll('[id^="panel-"]'))section.hidden=section.id!=='panel-'+name;
}
function clearProductForm(){
  $('productForm').reset();$('editProductId').value='';$('productWeight').value='3';$('saveProduct').textContent='商品を追加';$('cancelProduct').hidden=true;
}
function saveFile(filename,contents,mime){
  const blob=new Blob([contents],{type:mime});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);
}
function safety(fn){return function(...args){try{fn(...args);}catch(e){toast(e.message||String(e),true);}};}

document.querySelectorAll('[data-tab]').forEach(btn=>btn.addEventListener('click',()=>setTab(btn.dataset.tab)));
$('openingFields').addEventListener('input',()=>{try{$('openingTotal').textContent=yen(E.totalCash(readCounts('open')));}catch(_){$('openingTotal').textContent='入力を確認';}});
$('saveOpening').addEventListener('click',safety(()=>{
  if(state.sales.length) throw Error('会計履歴を先にリセットしてください。');
  setState({...state,opening:readCounts('open')});toast('開始金種を保存しました。');
}));
$('usePreset').addEventListener('click',safety(()=>{
  if(state.sales.length)throw Error('会計履歴を先にリセットしてください。');
  setState({...state,opening:[...E.START]});toast('金種をサンプル値に戻しました。');
}));
$('productForm').addEventListener('submit',e=>{e.preventDefault();safety(()=>{
  const id=$('editProductId').value||('p'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7));
  const p={id,name:$('productName').value.trim(),price:Number($('productPrice').value),weight:Number($('productWeight').value)};
  E.validateProduct(p);
  const exists=state.products.some(x=>x.id===id);
  if(!exists && state.products.length>=100)throw Error('商品は最大100件です。');
  const next=exists?state.products.map(x=>x.id===id?p:x):[...state.products,p];
  setState({...state,products:next});clearProductForm();toast(exists?'商品を更新しました。':'商品を追加しました。');
})();});
$('cancelProduct').addEventListener('click',clearProductForm);
$('productRows').addEventListener('click',safety(e=>{
  const edit=e.target.closest('[data-edit]'); const del=e.target.closest('[data-remove]');
  if(edit){const p=state.products.find(x=>x.id===edit.dataset.edit);if(!p)return;
    $('editProductId').value=p.id;$('productName').value=p.name;$('productPrice').value=p.price;$('productWeight').value=p.weight;$('saveProduct').textContent='変更を保存';$('cancelProduct').hidden=false;$('productName').focus();}
  if(del){const p=state.products.find(x=>x.id===del.dataset.remove);if(!p)return;
    if(!window.confirm('「'+p.name+'」を削除しますか？過去の売上記録は残ります。'))return;
    basket.delete(p.id);setState({...state,products:state.products.filter(x=>x.id!==p.id)});toast('商品を削除しました。');}
}));
$('saleProducts').addEventListener('click',e=>{const b=e.target.closest('[data-add]');if(b){basket.set(b.dataset.add,Math.min(100,(basket.get(b.dataset.add)||0)+1));renderPOS();}});
$('cartLines').addEventListener('click',e=>{const plus=e.target.closest('[data-add]');const minus=e.target.closest('[data-minus]');if(plus){basket.set(plus.dataset.add,Math.min(100,(basket.get(plus.dataset.add)||0)+1));renderPOS();}if(minus){const q=(basket.get(minus.dataset.minus)||0)-1;if(q<=0)basket.delete(minus.dataset.minus);else basket.set(minus.dataset.minus,q);renderPOS();}});
$('tenderSelect').addEventListener('change',updateQuote);
$('clearCart').addEventListener('click',()=>{basket.clear();renderPOS();});
$('recordSale').addEventListener('click',safety(()=>{
  const amount=totalBasket();if(amount<=0)throw Error('商品を選択してください。');
  const label=[...basket].map(([id,qty])=>{const p=state.products.find(x=>x.id===id);return p?`${p.name}×${qty}`:'';}).filter(Boolean).join(' / ');
  const tender=Number($('tenderSelect').value);
  const next=E.recordSale(state,label,amount,tender);
  setState(next);basket.clear();renderPOS();toast('売上を記録しました（'+yen(amount)+'）。');
}));
$('undoSale').addEventListener('click',safety(()=>{
  if(!state.sales.length)return;
  if(!window.confirm('最後の会計を取り消しますか？現金も実際に元の状態へ戻してください。'))return;
  setState(E.undoLast(state));toast('最後の会計を取り消しました。');
}));
$('runSimulation').addEventListener('click',safety(()=>{
  simResult=E.simulate(state.products,E.getDrawer(state),{trials:Number($('simTrials').value),visits:Number($('simVisits').value),seed:Number($('simSeed').value)});
  renderSim();toast('釣銭不足の試算が完了しました。');
}));
$('fillExpected').addEventListener('click',()=>{const a=E.getDrawer(state);E.DENOMS.forEach((d,i)=>$('physical-'+d).value=a[i]);toast('記録上の枚数を入力しました。実物と照合してください。');});
$('checkPhysical').addEventListener('click',safety(()=>{setState({...state,physical:readCounts('physical')});toast('現金差異を計算しました。');}));
$('exportJson').addEventListener('click',()=>saveFile('tsurisen-backup.json',JSON.stringify(state,null,2),'application/json'));
$('exportCsv').addEventListener('click',()=>saveFile('tsurisen-sales.csv',E.salesCSV(state),'text/csv;charset=utf-8'));
$('importJson').addEventListener('change',async e=>{
  const file=e.target.files&&e.target.files[0];if(!file)return;
  try{
    if(file.size>1500000)throw Error('ファイルが大きすぎます。');
    const raw=JSON.parse(await file.text());const next=E.normalizeState(raw);
    if(!window.confirm('現在のデータをバックアップ内容で置き換えますか？'))return;
    basket.clear();clearProductForm();setState(next);toast('JSONを復元しました。');
  }catch(err){toast('復元エラー: '+err.message,true);}finally{e.target.value='';}
});
$('resetHistory').addEventListener('click',()=>{if(window.confirm('すべての会計履歴を消去しますか？保存済みの商品の登録と開始金種は残します。')){basket.clear();setState({...state,sales:[],physical:null});toast('会計履歴を消去しました。');}});
$('resetAll').addEventListener('click',()=>{if(window.confirm('商品・履歴・金種をすべて初期化しますか？')){basket.clear();clearProductForm();setState(E.newState());toast('初期化しました。');}});

renderAll();setTab('prep');
})();
