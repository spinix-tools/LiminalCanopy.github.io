(() => {
  'use strict';
  const E = globalThis.KitEngine, STORAGE = 'kitmawashi-v1';
  const $ = id => document.getElementById(id);
  const escapeHTML = value => String(value).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let state, selectedKit, history=[], messageTimer;
  function id(prefix) { return prefix + Math.random().toString(36).slice(2,11); }
  function initial() { try { const raw=localStorage.getItem(STORAGE); if(raw) return E.validate(JSON.parse(raw)); } catch(e) { console.warn('Stored data ignored',e); } return E.demo(); }
  state=initial(); selectedKit=state.kits[0]?.id;
  function notify(text,bad=false) { const el=$('message'); el.textContent=text;el.className='message'+(bad?' bad':'');el.hidden=false;clearTimeout(messageTimer);messageTimer=setTimeout(()=>el.hidden=true,6000); }
  function persist(){try{localStorage.setItem(STORAGE,JSON.stringify(state));}catch(e){notify('端末への保存に失敗しました。JSON出力でバックアップしてください。',true);}}
  function apply(mutator, success) {
    try {
      const next=structuredClone(state); mutator(next); const validated=E.validate(next);
      history.push(JSON.stringify(state)); if(history.length>25)history.shift();state=validated;persist();render(); if(success)notify(success);
      return true;
    } catch(e) {notify(e.message||'更新できませんでした。',true);render();return false;}
  }
  function fmt(s){return s.replace(/^\d{4}-/,'').replace('-','/');}
  function labelKit(kid){return state.kits.find(k=>k.id===kid)?.name||'未登録';}
  function itemName(iid){return state.items.find(x=>x.id===iid)?.name||iid;}
  function render(){
    const analysis=E.analyse(state), allCount=state.bookings.length;
    $('metrics').innerHTML=[
      ['管理中の部品',state.items.length,'種類の在庫マスタ'],
      ['貸出キット',state.kits.length,'組合せテンプレート'],
      ['確定予約',state.bookings.filter(x=>x.status==='confirmed').length,'候補を除く'],
      ['不足の日×部品',analysis.allIssues.length,'全候補を採用した場合']
    ].map((m,i)=>`<div class="metric"><small>${escapeHTML(m[0])}</small><strong class="${i===3&&m[1]?'warn':''}">${m[1]}</strong><em>${escapeHTML(m[2])}</em></div>`).join('');
    $('bookingCount').textContent=`${allCount}件 / 候補 ${analysis.proposals.length}件`;
    $('bKit').innerHTML=state.kits.map(k=>`<option value="${k.id}">${escapeHTML(k.name)}</option>`).join('');
    $('bookingForm').querySelector('button[type=submit]').disabled=!state.kits.length;
    const proposals=Object.fromEntries(analysis.proposals.map(x=>[x.id,x]));
    $('bookingList').innerHTML=state.bookings.length ? [...state.bookings].sort((a,b)=>a.start.localeCompare(b.start)).map(b=>{
      const p=proposals[b.id], bad=p&&!p.ok;
      const contents=Object.entries(E.demand(state,b)).map(([part,n])=>`${escapeHTML(itemName(part))} ×${n}`).join(' / ');
      let notice='';
      if(p) notice=bad ? `<div class="booking-message">⚠ 確定予約との重複で${p.collisions.length}件の容量超過。${p.suggest?'代替案 '+fmt(p.suggest.start)+' 〜 '+fmt(p.suggest.end):'21日先まで空きなし'}</div>` : '<div class="booking-message ok">✓ 確定済み予約との比較では受入可能</div>';
      return `<article class="booking ${bad?'problem':''}" data-id="${b.id}"><div class="booking-header"><span class="booking-title">${escapeHTML(b.name)}</span><span class="status ${b.status==='proposal'?'proposal':''}">${b.status==='confirmed'?'確定':'候補'}</span></div><div class="booking-info">${escapeHTML(labelKit(b.kitId))} ×${b.qty}セット ｜ ${fmt(b.start)} — ${fmt(b.end)}<br>${contents}</div>${notice}<div class="booking-actions">${b.status==='proposal'?`<button data-action="confirm" class="btn secondary" ${!p.ok?'disabled':''}>✓ 確定</button>${p.suggest&&!p.ok?'<button data-action="move" class="btn secondary">代替日へ移動</button>':''}`:`<button data-action="unconfirm" class="btn ghost">候補に戻す</button>`}<button data-action="delete" class="btn ghost">削除</button></div></article>`;
    }).join('') : '<p class="empty">予約はありません。左上から候補を追加してください。</p>';
    if(analysis.confirmedIssues.length===0 && analysis.allIssues.length===0){$('alerts').innerHTML='<div class="alert-empty">✓ 確定済み・候補を同時採用しても、登録在庫内に収まっています。</div>'}
    else {
      let html=analysis.confirmedIssues.length ? `<p class="alert-sub">⚠ 確定予約だけで ${analysis.confirmedIssues.length} 件の容量超過があります。</p>` : '<p class="alert-sub">✓ 確定済みのみでは超過なし。候補を全部採用すると以下の日に不足します。</p>';
      html+='<div class="alert-list">'+analysis.allIssues.slice(0,7).map(x=>`<div class="alert"><span>${fmt(x.date)}　${escapeHTML(itemName(x.itemId))}</span><strong>${x.used} / ${x.stock}（−${x.short}）</strong></div>`).join('')+'</div>';
      if(analysis.allIssues.length>7)html+=`<p class="alert-sub" style="margin-top:12px">ほか ${analysis.allIssues.length-7} 件。時間表で確認してください。</p>`;
      $('alerts').innerHTML=html;
    }
    $('itemList').innerHTML=state.items.map(x=>`<div class="item-row" data-id="${x.id}"><input aria-label="部品名" data-item-key="name" maxlength="54" value="${escapeHTML(x.name)}"><input aria-label="在庫数" data-item-key="qty" type="number" min="0" max="999" value="${x.qty}"><button class="btn tiny ghost" data-action="delete-item" aria-label="${escapeHTML(x.name)}を削除">×</button></div>`).join('') || '<p class="empty">部品を追加してください。</p>';
    if(!state.kits.some(k=>k.id===selectedKit))selectedKit=state.kits[0]?.id;
    $('kitSelect').innerHTML=state.kits.map(k=>`<option value="${k.id}" ${k.id===selectedKit?'selected':''}>${escapeHTML(k.name)}</option>`).join('');
    $('deleteKit').disabled=!selectedKit;
    const kit=state.kits.find(k=>k.id===selectedKit);
    $('partList').innerHTML=kit?`<p class="parts-head">部品ごとの必要数（0＝含めない）</p>`+state.items.map(x=>`<div class="part-row"><span>${escapeHTML(x.name)}</span><input type="number" min="0" max="99" data-part="${x.id}" value="${kit.parts[x.id]||0}" aria-label="${escapeHTML(x.name)}のキット構成数"></div>`).join(''):'<p class="empty">部品を先に追加してからキットを作成します。</p>';
    $('kName').disabled=state.items.length===0;$('kitForm').querySelector('button').disabled=state.items.length===0;
    renderTimeline();
  }
  function renderTimeline(){
    const start=$('viewStart').value||E.plus(new Date().toLocaleDateString('sv-SE'),0);
    if (!Number.isFinite(E.day(start))) return;
    const use=$('viewMode').value==='confirmed'?state.bookings.filter(b=>b.status==='confirmed'):state.bookings;
    const days=Array.from({length:8},(_,i)=>E.plus(start,i));
    let html='<div class="time-head"><div>部品 / 日付</div>'+days.map(s=>`<div>${fmt(s)}</div>`).join('')+'</div>';
    for(const item of state.items){
      html+=`<div class="time-row"><span class="time-label" title="${escapeHTML(item.name)}">${escapeHTML(item.name)}</span>`;
      for(const d of days){ const n=E.loadAt(state,use,E.day(d))[item.id]||0; const css=n>item.qty?'over':n===item.qty&&n>0?'full':n>0?'busy':'';html+=`<div class="time-cell ${css}" title="${escapeHTML(item.name)} ${d}: ${n}/${item.qty}">${n}/${item.qty}</div>`; }
      html+='</div>';
    }
    $('timeline').innerHTML=html||'<p class="empty">部品を追加してください。</p>';
  }
  function download(filename,content,type){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([content],{type}));a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);}
  function csvField(v){const s=String(v??'');return /[",\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}
  function toCsv(){
    const lines=[['種別','ID','名前','開始日','終了日','数量','状態','部品ID','部品名','必要数'], ...state.items.map(i=>['部品',i.id,i.name,'','',i.qty,'','','','']),...state.kits.flatMap(k=>Object.entries(k.parts).map(([part,n])=>['キット構成',k.id,k.name,'','',1,'',part,itemName(part),n])),...state.bookings.map(b=>['予約',b.id,b.name,b.start,b.end,b.qty,b.status,b.kitId,labelKit(b.kitId),''])];
    return '\uFEFF'+lines.map(row=>row.map(csvField).join(',')).join('\r\n');
  }
  $('bookingForm').addEventListener('submit',e=>{e.preventDefault();const name=$('bName').value.trim(),start=$('bStart').value,end=$('bEnd').value,kitId=$('bKit').value,qty=Number($('bQty').value);if(!name||!kitId)return notify('入力を確認してください。',true);if(apply(data=>data.bookings.push({id:id('b'),name,kitId,start,end,qty,status:'proposal'}),'予約候補を追加しました。')) $('bName').value='';});
  $('bookingList').addEventListener('click',e=>{const btn=e.target.closest('[data-action]');if(!btn)return;const box=btn.closest('[data-id]'),bid=box?.dataset.id,b=state.bookings.find(x=>x.id===bid);if(!b)return;
    if(btn.dataset.action==='confirm'){if(!E.assess(state,b).ok)return notify('確定予約と容量が衝突しています。',true);apply(d=>d.bookings.find(x=>x.id===bid).status='confirmed','予約を確定しました。');}
    if(btn.dataset.action==='unconfirm')apply(d=>d.bookings.find(x=>x.id===bid).status='proposal','予約を候補に戻しました。');
    if(btn.dataset.action==='move'){const s=E.suggestion(state,b);if(!s)return notify('21日以内に代替日がありません。',true);apply(d=>Object.assign(d.bookings.find(x=>x.id===bid),{start:s.start,end:s.end}),'候補を代替日へ移動しました。');}
    if(btn.dataset.action==='delete' && confirm('この予約を削除しますか？'))apply(d=>d.bookings=d.bookings.filter(x=>x.id!==bid),'予約を削除しました。');
  });
  $('itemForm').addEventListener('submit',e=>{e.preventDefault();const name=$('iName').value.trim(),qty=Number($('iQty').value);if(apply(d=>d.items.push({id:id('i'),name,qty}),'部品を追加しました。')) $('iName').value='';});
  $('itemList').addEventListener('change',e=>{const key=e.target.dataset.itemKey;if(!key)return;const iid=e.target.closest('[data-id]').dataset.id;apply(d=>{const x=d.items.find(x=>x.id===iid);x[key]=key==='qty'?Number(e.target.value):e.target.value;},'部品を更新しました。');});
  $('itemList').addEventListener('click',e=>{const btn=e.target.closest('[data-action="delete-item"]');if(!btn)return;const iid=btn.closest('[data-id]').dataset.id,affected=state.kits.filter(k=>k.parts[iid]);if(affected.length && !confirm(`この部品は${affected.length}キットに含まれています。キット構成からも削除しますか？`))return;
    apply(d=>{d.items=d.items.filter(x=>x.id!==iid);for(const k of d.kits)delete k.parts[iid];const emptied=new Set(d.kits.filter(k=>Object.keys(k.parts).length===0).map(k=>k.id));d.kits=d.kits.filter(k=>!emptied.has(k.id));d.bookings=d.bookings.filter(b=>!emptied.has(b.kitId));},'部品を削除しました。');
  });
  $('kitSelect').addEventListener('change',e=>{selectedKit=e.target.value;render();});
  $('partList').addEventListener('change',e=>{const part=e.target.dataset.part;if(!part||!selectedKit)return;const qty=Number(e.target.value);apply(d=>{const kit=d.kits.find(x=>x.id===selectedKit);if(qty===0)delete kit.parts[part];else kit.parts[part]=qty;},'キット構成を更新しました。');});
  $('kitForm').addEventListener('submit',e=>{e.preventDefault();if(!state.items.length)return;const name=$('kName').value.trim(),newId=id('k');if(apply(d=>d.kits.push({id:newId,name,parts:{[d.items[0].id]:1}}),'キットを追加しました。')){selectedKit=newId;$('kName').value='';render();}});
  $('deleteKit').addEventListener('click',()=>{const k=state.kits.find(x=>x.id===selectedKit);if(!k)return;const n=state.bookings.filter(x=>x.kitId===k.id).length;if(!confirm(`「${k.name}」を削除しますか？関連予約${n}件も削除されます。`))return;apply(d=>{d.kits=d.kits.filter(x=>x.id!==selectedKit);d.bookings=d.bookings.filter(x=>x.kitId!==selectedKit);},'キットと関連予約を削除しました。');});
  $('viewStart').addEventListener('change',renderTimeline);$('viewMode').addEventListener('change',renderTimeline);
  $('undo').addEventListener('click',()=>{if(!history.length)return notify('戻せる操作がありません。',true);state=E.validate(JSON.parse(history.pop()));persist();render();notify('直前の変更を戻しました。');});
  $('saveJson').addEventListener('click',()=>download('kitmawashi-data.json',JSON.stringify(state,null,2),'application/json'));
  $('saveCsv').addEventListener('click',()=>download('kitmawashi-export.csv',toCsv(),'text/csv;charset=utf-8'));
  $('loadJson').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>1_000_000)throw new Error('JSONファイルは1MBまでです。');const data=E.validate(JSON.parse(await f.text()));history.push(JSON.stringify(state));state=data;persist();render();notify('JSONを読み込みました。');}catch(err){notify('読込失敗: '+err.message,true);}finally{e.target.value='';}});
  $('reset').addEventListener('click',()=>{if(confirm('現在の作業内容を破棄し、デモに戻しますか？'))apply(d=>{const demo=E.demo();d.items=demo.items;d.kits=demo.kits;d.bookings=demo.bookings;},'デモデータに戻しました。');});
  const localToday=new Date().toLocaleDateString('sv-SE');
  $('bStart').value=E.plus(localToday,1);$('bEnd').value=E.plus(localToday,2);$('viewStart').value=E.plus(localToday,1);
  render();
})();
