/* 釣銭リハ — DOM application, browser-only, no dependencies. */
(() => {
  'use strict';
  const E = window.ChangeLab;
  const $ = id => document.getElementById(id);
  const yen = n => '¥' + Number(n || 0).toLocaleString('ja-JP');
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clone = x => JSON.parse(JSON.stringify(x));
  const STORE = 'tsurisen-rehearsal-v1';
  const defaults = () => ({counts: [...E.SAMPLE_FLOAT], rows: clone(E.SAMPLE_ROWS),
    settings:{menu:'350,450,800',customers:24,trials:80,weights:[30,45,15,10],seed:20261122}});
  let state = defaults();
  let stressResult = null;
  let lastSimulation = null;
  let noticeTimer = null;
  const pick = id => Number($(id).value);
  function msg(text) {
    $('message').textContent = text;
    if (noticeTimer) clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => $('message').textContent='',5500);
  }
  function sanitized(obj) {
    if (!obj || typeof obj !== 'object') throw new Error('保存データの形式が違います');
    const c = E.counts(obj.counts);
    if (!Array.isArray(obj.rows) || obj.rows.length>100) throw new Error('会計は100件以内です');
    const rows = obj.rows.map(E.checkRow);
    if (!obj.settings || typeof obj.settings!=='object') throw new Error('客列テストの設定がありません');
    const original = obj.settings;
    const menu = String(original.menu ?? '').slice(0,200);
    const parsedMenu = parseMenu(menu);
    const validated = E.validateStress({menu:parsedMenu,
      customers:original.customers,trials:original.trials,
      weights:original.weights,seed:original.seed});
    return {counts:c,rows,settings:{...validated,menu}};
  }
  function parseMenu(text) {
    const parts=String(text).split(/[、,，\s]+/).map(s=>s.trim()).filter(Boolean);
    if (!parts.length||parts.length>30) throw new Error('商品価格は1〜30個指定してください');
    return parts.map(x=>{if(!/^\d+$/.test(x)) throw new Error('価格には整数だけを入力してください');return E.asInt(Number(x),1,10000);});
  }
  function load() {
    try { const value=localStorage.getItem(STORE); if(value) state=sanitized(JSON.parse(value)); }
    catch(err) { console.warn('保存を読み込めませんでした:',err.message); state=defaults(); }
  }
  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(state)); return true; }
    catch (_) { return false; }
  }
  function renderFloat(){
    $('float-grid').innerHTML=E.DENOMS.map((denom,i)=>{
      const label=denom>=1000?'お札':'硬貨';
      return `<div class="float-cell"><label for="coin-${i}">${yen(denom)}<span>${label}</span></label>
        <div class="count-input"><input type="number" id="coin-${i}" data-coin="${i}" min="0" max="9999" step="1" value="${state.counts[i]}" aria-label="${yen(denom)}の枚数"><span class="piece">枚</span></div>
        <div class="subtotal">${yen(state.counts[i]*denom)}</div></div>`;
    }).join('');
    $('float-total').textContent=yen(E.money(state.counts));
  }
  function optionHTML(value, label, selected){return `<option value="${value}"${selected?' selected':''}>${label}</option>`;}
  function renderQueue(){
    const options=[['exact','ちょうど'],[500,'500円玉'],[1000,'1,000円札'],[5000,'5,000円札'],[10000,'10,000円札']];
    $('queue-body').innerHTML=state.rows.map((row,i)=>`
      <tr data-row="${i}"><td>${String(i+1).padStart(2,'0')}</td>
      <td><input aria-label="${i+1}行目の品名" data-field="name" data-idx="${i}" maxlength="40" value="${escapeHTML(row.name)}"></td>
      <td><input type="number" aria-label="${i+1}行目の会計金額" data-field="price" data-idx="${i}" min="1" max="10000" step="1" value="${row.price}"></td>
      <td><select aria-label="${i+1}行目の預かり方" data-field="tender" data-idx="${i}">${options.map(([v,label])=>optionHTML(v,label,String(row.tender)===String(v))).join('')}</select></td>
      <td><button type="button" class="remove-row" data-remove="${i}" aria-label="${i+1}行目を削除">×</button></td></tr>`).join('') || '<tr><td colspan="5">会計がありません。「会計を追加」から始めてください。</td></tr>';
  }
  function details(plan){if(!plan)return '—';return plan.map((v,i)=>v?`${yen(E.DENOMS[i])} × ${v}`:'').filter(Boolean).join(' / ')||'0円';}
  function renderResults(){
    const r=E.runQueue(state.counts,state.rows);lastSimulation=r;
    const failure=r.events.at(-1);
    const success=r.complete;
    $('overview').innerHTML=`<div class="result-kicker">REHEARSAL STATUS / ${success?'READY':'ATTENTION'}</div>
      <div class="result-title ${success?'':'bad'}">${success?'<strong>最後まで会計OK</strong>':'<strong>'+String(r.failAt+1)+'人目で停止</strong>'}</div>
      <div class="result-desc">${success?'現在の客列では、全員にお釣りを返せました。順番が変わる場合も下の客列テストで確認できます。':escapeHTML(failure?.reason==='invalid'?'入力内容を修正してください。':'必要なお釣りを、手持ちの紙幣・硬貨では作れません。停止した会計は成立していない扱いです。')}</div>
      <div class="result-stats"><div><label>処理完了</label><strong>${r.processed} / ${state.rows.length} 件</strong></div><div><label>成立した売上</label><strong>${yen(r.sales)}</strong></div><div><label>手元の現金</label><strong>${yen(r.closing)}</strong></div></div>`;
    let html = '<div class="playback-items">';
    for (const e of r.events) {
      html += `<div class="event ${e.ok?'':'fail'}"><div class="event-badge">${e.ok?'✓':'!'}</div><div>
        <div class="event-name">${escapeHTML(e.name)} <span style="font-weight:500;color:#829288">/ ${yen(e.price)}</span></div>
        <div class="event-detail">${e.ok?'預かり '+yen(e.paid)+' ／ '+(e.change?details(e.out):'お釣り不要'):escapeHTML(e.message)}</div></div>
        <div class="event-change">${e.ok?(e.change?'−'+yen(e.change):'±0'): '停止'}<small>${e.ok?`残高 ${yen(E.money(e.after))}`:`${e.change===undefined?'入力を確認':`お釣り ${yen(e.change)}`}`}</small></div></div>`;
    }
    html+='</div>';
    if (!r.events.length) html='<p class="muted-placeholder">会計を追加すると結果を表示します。</p>';
    if(!success && failure?.reason==='shortage'){
      const tip=E.rescue(failure);
      const combination=tip?tip.additions.map((n,i)=>n?`${yen(E.DENOMS[i])} × ${n}枚`:'').filter(Boolean).join(' ＋ '):'';
      html+=`<div class="rescue-card"><b>この会計の応急案</b><br>${tip?`停止時点に ${combination} を補充すれば、少なくともこの1件のお釣りを作れます。`:'補充案を見つけられませんでした。'}
      <br><small>開店時に同数を追加しても、前の会計で消費される可能性があり、結果の保証ではありません。</small>
      ${tip?`<div><button class="btn btn-outline" data-add-plan="${tip.additions.join(',')}">開店時の枚数に追加して再計算</button></div>`:''}</div>`;
    }
    $('playback').innerHTML=html;
    $('leftover').innerHTML=`<div class="inventory-grid">${E.DENOMS.map((denom,i)=>`<div class="inv-item ${r.final[i]<3?'inv-low':''}"><div class="inv-name">${yen(denom)}</div><strong>${r.final[i]} <span>枚</span></strong><span>開店時 ${state.counts[i]} 枚</span></div>`).join('')}</div>
     <div class="note">手元の現金は「初期準備金＋成立した現金売上」の合計と一致します。停止した取引は手元の現金に反映しません。</div>`;
  }
  function stressSettingsFromForm(){return {menu:$('menu').value,customers:pick('customers'),trials:pick('trials'),weights:[0,1,2,3].map(i=>pick('weight-'+i)),seed:pick('seed')};}
  function renderSettings(){
    const s=state.settings;
    $('menu').value=s.menu; $('customers').value=s.customers;$('trials').value=s.trials;$('seed').value=s.seed;
    s.weights.forEach((n,i)=>$('weight-'+i).value=n);
  }
  function renderStress(){
    if(!stressResult){$('stress-results').className='muted-placeholder';$('stress-results').textContent='「客列テストを実行」を押すと、ここに結果が表示されます。';return;}
    const s=stressResult;
    $('stress-results').className='';
    $('stress-results').innerHTML=`<div class="stress-hero"><div class="big-rate">${(s.passRate*100).toFixed(1)}<small>%</small></div><div><strong>最後まで止まらなかった試行の割合</strong><p>${s.trials}回中 ${s.successes}回。与えた仮定・シードでの結果です。</p></div></div>
      <div class="progressbar" role="img" aria-label="成功割合 ${(s.passRate*100).toFixed(1)}パーセント"><div style="width:${s.passRate*100}%"></div></div>
      <div class="stress-metrics"><div>1回あたりの平均完了件数<strong>${s.averageProcessed.toFixed(1)} 件</strong></div><div>停止した試行<strong>${s.failures} / ${s.trials} 回</strong></div></div>
      ${s.samples.length?`<div class="sample-note">最初の停止例: 第${s.samples[0].trial}試行・${s.samples[0].step}人目（${s.samples[0].reason==='shortage'?'金種不足':'入力エラー'}）。${s.hint?`不足時の単一金種補充ヒントには ${yen(s.hint.denom)} が ${s.hint.count} 回登場しました（停止例の先頭15回から集計）。`:''}</div>`:'<p class="sample-note">この設定では停止例がありません。ただし安全性を保証しません。</p>'}
      <p class="note">現金支払いの仮定に基づく疑似実験です。価格は一様抽選し、紙幣が価格より小さい場合は支払い可能な次の高額紙幣に繰り上げます。実績データではありません。</p>`;
  }
  function render(){renderFloat();renderQueue();renderResults();renderStress();}
  function invalidate(){stressResult=null;render();save();}
  function download(name,text,mime){
    const url=URL.createObjectURL(new Blob([text],{type:mime}));
    const a=document.createElement('a');a.href=url;a.download=name;a.click();
    setTimeout(()=>URL.revokeObjectURL(url),2000);
  }
  function exportCSV(){
    const r=lastSimulation || E.runQueue(state.counts,state.rows);
    const rows=[['番号','品名','金額(円)','支払金種','預かり(円)','お釣り(円)','状態','返却内訳','成立後の手持ち(円)']];
    r.events.forEach(e=>rows.push([e.index+1,e.name,e.price||'',e.tender==='exact'?'ちょうど':e.tender||'',e.paid??'',e.change??'',e.ok?'成立':'停止',e.ok?details(e.out):e.message,e.ok?E.money(e.after):'']));
    rows.push([],['開店時の金額',r.opening],['成立した売上',r.sales],['会計後の現金',r.closing]);
    download('tsurisen-rehearsal-result.csv',E.toCSV(rows),'text/csv;charset=utf-8');msg('会計票のCSVを保存しました。');
  }
  function loadJSON(file){
    if(file.size>200000) {msg('読み込めるJSONは200 KB以内です。');return;}
    const reader=new FileReader();
    reader.onload=()=>{
      try {state=sanitized(JSON.parse(reader.result));stressResult=null;renderSettings();render();save();msg('JSONを復元しました。');}
      catch(error){msg('復元できませんでした: '+error.message);}
    };
    reader.readAsText(file);
  }
  function init(){
    load();renderSettings();render();
    $('float-grid').addEventListener('change',e=>{
      const idx=e.target.dataset.coin;
      if(idx===undefined)return;
      try{state.counts[Number(idx)]=E.asInt(e.target.value,0,9999);invalidate();}
      catch(err){msg(err.message);renderFloat();}
    });
    $('queue-body').addEventListener('change',e=>{
      const f=e.target.dataset.field, i=Number(e.target.dataset.idx);
      if(!f||!state.rows[i])return;
      const row={...state.rows[i]};
      try {
        if(f==='name')row.name=String(e.target.value).trim().slice(0,40);
        if(f==='price')row.price=E.asInt(e.target.value,1,10000);
        if(f==='tender')row.tender=e.target.value==='exact'?'exact':Number(e.target.value);
        // A formerly valid tender may become too small when a price is increased;
        // it remains visible as a validation error in the result instead of being silently rewritten.
        state.rows[i]=row;invalidate();
      }catch(err){msg(err.message);renderQueue();}
    });
    $('queue-body').addEventListener('click',e=>{
      const btn=e.target.closest('[data-remove]');if(!btn)return;
      state.rows.splice(Number(btn.dataset.remove),1);invalidate();
    });
    $('add-row').onclick=()=>{
      if(state.rows.length>=100){msg('会計は100件までです。');return;}
      state.rows.push({name:'新しい会計',price:500,tender:1000});invalidate();
    };
    $('sample-reset').onclick=()=>{state.rows=clone(E.SAMPLE_ROWS);invalidate();msg('会計の列を初期サンプルに戻しました。');};
    $('playback').addEventListener('click',e=>{
      const b=e.target.closest('[data-add-plan]');if(!b)return;
      const plan=b.dataset.addPlan.split(',').map(Number);
      state.counts=state.counts.map((n,i)=>E.asInt(n+plan[i],0,9999));
      invalidate();msg('初期枚数を調整して再計算しました。');
    });
    $('run-stress').onclick=()=>{
      try {
        const raw=stressSettingsFromForm(),menu=parseMenu(raw.menu);
        const cfg=E.validateStress({...raw,menu});
        state.settings={...raw,menu:raw.menu};
        const button=$('run-stress');button.disabled=true;button.textContent='計算中…';
        requestAnimationFrame(()=>setTimeout(()=>{
          try{stressResult=E.stress(state.counts,cfg);renderStress();save();msg('客列テストが完了しました。');}
          catch(err){msg('計算できませんでした: '+err.message);}
          finally{button.disabled=false;button.innerHTML='客列テストを実行 <span aria-hidden="true">↗</span>';}
        },20));
      }catch(err){msg(err.message);}
    };
    $('export-csv').onclick=exportCSV;
    $('export-json').onclick=()=>{download('tsurisen-rehearsal-data.json',JSON.stringify({...state,version:1},null,2),'application/json;charset=utf-8');msg('JSONを保存しました。');};
    $('import-json').onclick=()=>$('file-input').click();
    $('file-input').onchange=e=>{const f=e.target.files[0];if(f)loadJSON(f);e.target.value='';};
    $('print-page').onclick=()=>window.print();
  }
  document.addEventListener('DOMContentLoaded',init);
})();
