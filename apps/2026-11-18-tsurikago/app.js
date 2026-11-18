/* TSURIKAGO interface. Only localStorage is used; no network requests. */
(() => {
  'use strict';
  const E=globalThis.TsuriEngine, $=s=>document.querySelector(s);
  const labels={exact:'ちょうど',1000:'千円札',5000:'五千円札',10000:'一万円札'};
  const SAMPLE={items:[{name:'焼き菓子',price:350,weight:5},{name:'お茶',price:150,weight:3},{name:'ギフト袋',price:750,weight:2}],float:[0,0,8,14,25,10,20,10,10],payment:[25,70,5,0],transactions:25,repeats:80,seed:311};
  const KEY='tsurikago-config-v1';
  let items=[],last=null;
  const copy=x=>JSON.parse(JSON.stringify(x));
  function esc(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function notice(s){$('#message').textContent=s;}
  function loadSaved(){try{const s=localStorage.getItem(KEY);return s?JSON.parse(s):copy(SAMPLE);}catch{return copy(SAMPLE);}}
  function save(){try{localStorage.setItem(KEY,JSON.stringify(getConfig()));}catch{/* Storage may be disabled */}}
  function input(n,attr){return `<input type="number" min="0" step="1" data-field="${attr}" value="${esc(n)}" aria-label="${attr}">`;}
  function renderItems(){ $('#items-body').innerHTML=items.map((x,i)=>`<tr data-index="${i}"><td><input data-field="name" value="${esc(x.name)}" maxlength="30" aria-label="商品名 ${i+1}"></td><td>${input(x.price,'price')}</td><td>${input(x.weight,'weight')}</td><td><button type="button" class="remove" aria-label="商品${i+1}を削除" title="削除">×</button></td></tr>`).join(''); }
  function renderDenoms(values){$('#denom-grid').innerHTML=E.DENOMS.map((d,i)=>`<div class="denom"><label for="denom-${d}">${E.yen(d)}<small>${d>=1000?'紙幣':'硬貨'}</small></label><input id="denom-${d}" class="float-input" data-index="${i}" type="number" min="0" max="1000" step="1" value="${Number(values[i]||0)}" aria-label="${d}円の枚数"><span class="subtotal" id="sub-${d}">${E.yen(d*(values[i]||0))}</span></div>`).join('');updateFloat();}
  function renderPayment(values){$('#payment-grid').innerHTML=['exact','1000','5000','10000'].map((key,i)=>`<label>${labels[key]}<span><input data-payment="${i}" aria-label="${labels[key]}の比率" type="number" min="0" max="100" step="1" value="${Number(values[i]||0)}"> %</span></label>`).join('');}
  function updateFloat(){const counts=[...document.querySelectorAll('.float-input')].map(x=>Math.max(0,Number(x.value)||0));$('#float-total').textContent=E.yen(E.total(counts));$('#hero-total').textContent=E.yen(E.total(counts));$('#piece-total').textContent=counts.reduce((a,b)=>a+b,0)+'枚';E.DENOMS.forEach((d,i)=>$('#sub-'+d).textContent=E.yen(d*counts[i]));}
  function getConfig(){return {items:items.map(x=>({...x})),float:[...document.querySelectorAll('.float-input')].map(x=>Number(x.value)),payment:[...document.querySelectorAll('[data-payment]')].map(x=>Number(x.value)),transactions:Number($('#transactions').value),repeats:Number($('#repeats').value),seed:Number($('#seed').value)};}
  function restore(raw){const normalized=E.sanitize(raw);items=copy(normalized.items);renderItems();renderDenoms(normalized.float);renderPayment(normalized.payment.map(x=>x.weight));$('#transactions').value=normalized.transactions;$('#repeats').value=normalized.repeats;$('#seed').value=normalized.seed;last=null;$('#success-rate').textContent='—';$('#avg-completed').textContent='—';$('#min-completed').textContent='—';$('#success-meter').style.width='0%';$('#result-status').textContent='未計算';$('#result-note').textContent='設定を変更したらシミュレーションを実行してください。';$('#transaction-log').innerHTML='';$('#recommend-result').textContent='「補充案を比較」を押すと、選択した条件で比較します。';save();}
  function markDirty(){last=null;$('#result-status').textContent='再計算が必要';$('#result-note').textContent='条件が変更されました。「シミュレーションする」で更新できます。';$('#recommend-result').textContent='条件が変更されました。補充案を再計算してください。';save();}
  function renderSimulation(s){last=s;$('#success-rate').textContent=s.successRate.toFixed(1)+'%';$('#avg-completed').textContent=s.avgCompleted.toFixed(1)+' 件';$('#min-completed').textContent=s.minCompleted+' 件';$('#success-meter').style.width=s.successRate+'%';$('#result-status').textContent=s.successRate>=90?'比較的余裕あり':s.successRate>=50?'釣銭切れに注意':'釣銭切れリスク高';$('#result-note').textContent=`${s.runs}回 × 最大${s.config.transactions}件の仮想取引。${s.successes}回で最後まで釣銭が不足しませんでした。最初に不足した時点で各試算は終了します。`;
    const log=s.sample.log;$('#transaction-log').innerHTML=log.length?log.map(x=>`<div class="log-row"><span class="index">#${x.step}</span><div><strong>${esc(x.item)} / ${E.yen(x.price)}</strong><small>受取 ${E.yen(x.face)} → お釣り ${E.yen(x.change)}</small></div><b class="${x.ok?'good':'bad'}">${x.ok?'OK':'不足'}</b></div>`).join(''):'<p>取引なし</p>';notice('同じシードなら同じ結果を再現できます。');}
  function run(){try{const s=E.simulate(getConfig());renderSimulation(s);save();}catch(e){notice('入力エラー: '+e.message);}}
  function renderRecommendation(r){const target=$('#recommend-result');const b=r.best;
    if(!b){target.textContent='指定予算内で購入できる補充パックがありません。予算を増やしてください。';return;}
    if(b.deltaSuccess<=0 && b.deltaCompleted<=0){target.innerHTML=`この条件では試算35回以下の比較で改善する補充パックが見つかりませんでした。販売比率、支払方法、開始金種を見直してください。<small>補充候補の比較は追加パック1種類のみ。組合せ最適化ではありません。</small>`;return;}
    target.innerHTML=`<div class="pack"><div><small>比較用試算 ${r.base.runs}回 / 追加候補</small><strong>${E.yen(b.denom)} × ${b.qty}枚</strong><small>追加準備金額 ${E.yen(b.cost)}</small></div><div><small>完走率</small><strong>${r.base.successRate.toFixed(1)} → ${b.successRate.toFixed(1)}%</strong></div></div><button class="secondary" id="apply-pack" data-denom="${b.denom}" data-qty="${b.qty}">この枚数を準備リストへ追加</button><small>同じ乱数条件で比較。1種類のみ追加した参考試算であり、最適な両替構成を保証しません。</small>`;
  }
  function recommend(){try{const r=E.recommend(getConfig(),Number($('#budget').value));renderRecommendation(r);notice('補充案を比較しました。');}catch(e){notice('入力エラー: '+e.message);}}
  function download(name,text,type){const blob=new Blob([text],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);notice(name+' をダウンロードしました。');}
  function csv(){const c=E.sanitize(getConfig()),rows=[['金種(円)','枚数','金額(円)','チェック'],...E.DENOMS.map((d,i)=>[d,c.float[i],d*c.float[i],'']),['合計',c.float.reduce((a,b)=>a+b,0),E.total(c.float),'']];return '\ufeff'+rows.map(r=>r.join(',')).join('\r\n')+'\r\n';}
  $('#items-body').addEventListener('input',e=>{const tr=e.target.closest('tr');if(!tr)return;const i=Number(tr.dataset.index),f=e.target.dataset.field;if(f){items[i][f]=f==='name'?e.target.value:Number(e.target.value);markDirty();}});
  $('#items-body').addEventListener('click',e=>{if(e.target.closest('.remove')){const i=Number(e.target.closest('tr').dataset.index);items.splice(i,1);renderItems();markDirty();}});
  $('#add-item').addEventListener('click',()=>{if(items.length>=20){notice('商品は20種類までです');return;}items.push({name:'新しい商品',price:500,weight:1});renderItems();markDirty();});
  $('#denom-grid').addEventListener('input',()=>{updateFloat();markDirty();});
  $('#payment-grid').addEventListener('input',markDirty);
  for(const id of ['transactions','repeats','seed']) $('#'+id).addEventListener('input',markDirty);
  $('#run').addEventListener('click',run);
  $('#reset').addEventListener('click',()=>{restore(copy(SAMPLE));notice('サンプルに戻しました。');run();});
  $('#recommend').addEventListener('click',recommend);
  $('#recommend-result').addEventListener('click',e=>{const btn=e.target.closest('#apply-pack');if(!btn)return;const d=Number(btn.dataset.denom),i=E.DENOMS.indexOf(d),node=$('#denom-'+d);node.value=Number(node.value)+Number(btn.dataset.qty);updateFloat();markDirty();notice(`${E.yen(d)}を${btn.dataset.qty}枚追加しました。再計算してください。`);});
  $('#export-csv').addEventListener('click',()=>{try{download('tsurikago-checklist.csv',csv(),'text/csv;charset=utf-8');}catch(e){notice(e.message);}});
  $('#export-json').addEventListener('click',()=>download('tsurikago-settings.json',JSON.stringify(getConfig(),null,2),'application/json;charset=utf-8'));
  $('#import-json').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>1000000)throw Error('ファイルが大きすぎます');const input=JSON.parse(await file.text());restore(input);notice('設定を復元しました。');run();}catch(err){notice('読込エラー: '+err.message);}finally{e.target.value='';}});
  $('#print').addEventListener('click',()=>window.print());
  try{restore(loadSaved());}catch{restore(copy(SAMPLE));}
  run();
})();
