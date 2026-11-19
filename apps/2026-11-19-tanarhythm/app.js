(function(){
  'use strict';
  const E=window.ShelfEngine;
  const $=id=>document.getElementById(id);
  const colors=['#6B8F80','#D69D72','#C6AC70','#8A9BC2','#AE8E7E','#72A6A3','#C3869D','#8B9D5E'];
  const storage='tanarhythm.v1';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const yen=v=>Math.round(v).toLocaleString('ja-JP')+'円';
  const qty=v=>Number(v.toFixed(1)).toLocaleString('ja-JP');
  let state, suggestion=null, notice='';
  try {state=E.normalize(JSON.parse(localStorage.getItem(storage)))}catch(e){state=E.sample()}
  function save(){try{localStorage.setItem(storage,JSON.stringify(state))}catch(e){/* Safari private mode */}}
  function showNotice(s, error=false){notice=s;const a=$('alert');a.textContent=s;a.hidden=!s;a.style.background=error?'#fff1e9':'#edf8f0';a.style.color=error?'#95572d':'#246b55';}
  function reportError(err){showNotice(err.message||String(err),true)}
  function getSnapshot(){return E.normalize(state)}
  function redraw(){
    let result;
    try {state=getSnapshot();result=E.measure(state)}catch(e){reportError(e);return}
    $('shelf-width').value=state.shelf.width;
    $('shelf-height').value=state.shelf.height;
    $('shelf-depth').value=state.shelf.depth;
    $('shelf-days').value=state.shelf.days;
    $('kpiProfit').textContent=yen(result.profit);
    $('kpiUsage').textContent=result.utilization+'%';
    $('kpiFree').textContent='残り '+qty(Math.max(0,result.free))+' cm';
    $('kpiRisk').textContent=result.riskCount+' 商品';
    $('kpiLost').textContent=qty(result.lost)+' 個';
    $('shelfScale').textContent=qty(result.used)+' / '+qty(state.shelf.width)+' cm';
    $('rulerEnd').textContent=state.shelf.width+' cm';
    if(!result.withinWidth)showNotice('陳列幅が棚幅を超えています。フェイスを減らすか、最適化してください。',true);
    else if(!result.withinHeight)showNotice('棚の高さ／奥行に収まらない商品があります。寸法を変更してください。',true);
    else if(notice.startsWith('陳列幅')||notice.startsWith('棚の高さ'))showNotice('');
    const scene=$('shelfScene');
    scene.innerHTML=result.rows.filter(x=>x.faces>0).map(x=>{
      const pct=100*x.cm/state.shelf.width;
      return `<div class="shelfItem" style="width:${pct}%;flex-shrink:0;background:${x.color}" title="${esc(x.name)}: ${x.faces}列 / ${x.cm}cm"><strong>${esc(x.name)}</strong><small>${x.faces} 列</small></div>`;
    }).join('')+(result.free>0?'<div class="shelfEmpty"></div>':'');
    scene.setAttribute('aria-label',result.rows.filter(x=>x.faces).map(x=>`${x.name} ${x.faces}列`).join('、')||'空の棚');
    $('productRows').innerHTML=result.rows.map((p,i)=>{
      const status=p.faces===0?'非陳列':!p.fit?'寸法超過':p.shortage>1e-8?'補充前に欠品の可能性':'補充日までカバー';
      const warn=p.faces>0&&(!p.fit||p.shortage>1e-8);
      return `<tr data-i="${i}"><td><span class="labelDot" style="background:${p.color}"></span><input class="nameField" aria-label="商品名 ${i+1}" data-field="name" value="${esc(p.name)}"><div class="status ${warn?'warn':''}">${status}</div></td>
      ${[['width',p.width],['height',p.height],['depth',p.depth],['daily',p.daily],['margin',p.margin]].map(([field,v])=>`<td><input aria-label="${esc(p.name)} ${field}" data-field="${field}" type="number" min="0" step="0.1" value="${v}"></td>`).join('')}
      <td><div class="rangeFields"><input aria-label="最低フェイス ${esc(p.name)}" type="number" min="0" max="12" step="1" data-field="min" value="${p.min}"><span>〜</span><input aria-label="最大フェイス ${esc(p.name)}" type="number" min="0" max="12" step="1" data-field="max" value="${p.max}"></div></td>
      <td><div class="faceCounter"><button data-action="minus" aria-label="${esc(p.name)} を1列減らす">−</button><b>${p.faces}</b><button data-action="plus" aria-label="${esc(p.name)} を1列増やす">＋</button></div></td><td><button data-action="delete" class="deleteBtn" aria-label="${esc(p.name)} を削除" title="削除">×</button></td></tr>`;
    }).join('');
    $('riskRows').innerHTML=result.rows.map(x=>{
      const filled=x.demand>0?Math.min(100,x.stock/x.demand*100):100;
      const risky=x.shortage>1e-8;
      return `<div class="riskRow"><div class="riskName">${esc(x.name)}<small>店頭在庫 ${x.stock} 個 / ${x.faces} フェイス</small></div><div class="riskTrack" title="予測需要に対する在庫割合"><div class="riskFill" style="width:${filled}%;background:${risky?'#d5a274':'#4b9c7d'}"></div></div><div class="riskValue ${risky?'bad':''}">${risky?'不足 '+qty(x.shortage)+' 個':'不足なし'}<small>需要予測 ${qty(x.demand)} 個</small></div></div>`;
    }).join('')||'<p class="hint">商品を追加してください。</p>';
    suggestion=E.optimize(state);
    const card=$('compare');
    if(!suggestion.ok){card.hidden=false;$('compareText').textContent=suggestion.error;$('applyBtn').disabled=true;return}
    $('applyBtn').disabled=false;
    const diff=suggestion.evaluation.profit-result.profit;
    const changed=suggestion.facings.some((n,i)=>n!==state.products[i].faces);
    card.hidden=!changed;
    $('compareText').textContent=`今の配置 ${yen(result.profit)} → おすすめ ${yen(suggestion.evaluation.profit)}（${diff>=0?'+':''}${yen(diff)}）。必要なフェイス数と予測粗利を比較してください。`;
  }
  function commit(){notice='';redraw();save()}
  document.querySelectorAll('[data-shelf]').forEach(el=>el.addEventListener('change',()=>{
    const key=el.dataset.shelf;const prev=state.shelf[key];state.shelf[key]=Number(el.value);
    try{state=E.normalize(state);commit()}catch(e){state.shelf[key]=prev;reportError(e);redraw()}
  }));
  $('productRows').addEventListener('change',e=>{
    const el=e.target.closest('input[data-field]');if(!el)return;
    const tr=el.closest('tr'),i=Number(tr.dataset.i),key=el.dataset.field,old=state.products[i][key];
    state.products[i][key]=key==='name'?el.value:Number(el.value);
    try{state=E.normalize(state);commit()}catch(err){state.products[i][key]=old;reportError(err);redraw()}
  });
  $('productRows').addEventListener('click',e=>{
    const btn=e.target.closest('button[data-action]');if(!btn)return;
    const i=Number(btn.closest('tr').dataset.i),action=btn.dataset.action;
    if(action==='delete'){state.products.splice(i,1)}
    else {const p=state.products[i];p.faces=E.clamp(p.faces+(action==='plus'?1:-1),0,12)}
    commit();
  });
  $('addBtn').addEventListener('click',()=>{
    if(state.products.length>=24){showNotice('商品は24種類まで追加できます。',true);return}
    const i=state.products.length;
    state.products.push({id:'item'+Date.now()+i,name:'新しい商品',width:8,height:12,depth:6,daily:1,margin:100,min:0,max:6,faces:1,color:colors[i%colors.length]});commit();
  });
  $('optimizeBtn').addEventListener('click',()=>{
    const o=E.optimize(state);if(!o.ok){showNotice(o.error,true);return}
    state.products.forEach((p,i)=>p.faces=o.facings[i]);commit();showNotice('予測粗利が最大になる配置を反映しました。');
  });
  $('applyBtn').addEventListener('click',()=>{
    const o=E.optimize(state);if(!o.ok){showNotice(o.error,true);return}
    state.products.forEach((p,i)=>p.faces=o.facings[i]);commit();showNotice('おすすめのフェイス数に更新しました。');
  });
  $('resetBtn').addEventListener('click',()=>{state=E.sample();commit();showNotice('サンプルを読み込みました。')});
  const download=(filename,content,type)=>{
    const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
  };
  $('exportJson').addEventListener('click',()=>download('tanarhythm-plan.json',JSON.stringify(state,null,2),'application/json;charset=utf-8'));
  $('exportCsv').addEventListener('click',()=>download('tanarhythm-report.csv',E.csv(state),'text/csv;charset=utf-8'));
  $('importJson').addEventListener('change',async e=>{
    const file=e.target.files&&e.target.files[0];if(!file)return;
    try{if(file.size>1024*1024)throw Error('JSONファイルは1MB以下にしてください');const loaded=E.normalize(JSON.parse(await file.text()));state=loaded;commit();showNotice('JSONを読み込みました。')}catch(err){reportError(err)}
    e.target.value='';
  });
  $('printBtn').addEventListener('click',()=>window.print());
  redraw();
})();
