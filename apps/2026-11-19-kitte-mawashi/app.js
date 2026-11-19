/* KITTE MAWASHI browser interaction. No remote calls, no external dependencies. */
(() => {
  'use strict';
  const Engine = window.KitteEngine;
  const KEY = 'kitte-mawashi-project-v1';
  const $ = id => document.getElementById(id);
  const clone = x => JSON.parse(JSON.stringify(x));
  const demo = () => ({
    stocks:[{value:100,count:1},{value:70,count:1},{value:30,count:1},{value:10,count:1}],
    mails:[{label:'発送A',target:100,maxStamps:2},{label:'発送B',target:110,maxStamps:2}],
    overLimit:0, objective:'excess'
  });
  function esc(s) {return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function stockValue(rows) {return rows.reduce((sum,r) => sum + Number(r.value || 0) * Number(r.count || 0), 0);}
  function yen(n) {return Number(n).toLocaleString('ja-JP') + '円';}
  let project = demo(), result = null, undo = null, committed = null;
  try {const saved = JSON.parse(localStorage.getItem(KEY));if(saved)project = Engine.normalize(saved);} catch (_) { /* storage can be disabled */ }
  function persist() {try{localStorage.setItem(KEY,JSON.stringify(project));}catch(_){ /* private mode */ }}
  let noticeTimer;
  function notify(s) {const el=$('toast');el.textContent=s;el.classList.add('show');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>el.classList.remove('show'),3600);}
  function inputs() {
    $('stocks').innerHTML = project.stocks.map((s,i)=>`<div class="data-row stock-row">
      <input aria-label="切手${i+1}の額面" data-kind="stock" data-index="${i}" data-field="value" type="number" min="1" max="2000" step="1" value="${esc(s.value)}">
      <input aria-label="切手${i+1}の枚数" data-kind="stock" data-index="${i}" data-field="count" type="number" min="0" max="30" step="1" value="${esc(s.count)}">
      <button class="remove" type="button" data-action="remove-stock" data-index="${i}" aria-label="切手${i+1}を削除">×</button></div>`).join('');
    $('mails').innerHTML = project.mails.map((m,i)=>`<div class="data-row mail-row">
      <input aria-label="郵便物${i+1}の管理名" data-kind="mail" data-index="${i}" data-field="label" maxlength="40" value="${esc(m.label)}">
      <input aria-label="郵便物${i+1}の必要額" data-kind="mail" data-index="${i}" data-field="target" type="number" min="1" max="2000" step="1" value="${esc(m.target)}">
      <input aria-label="郵便物${i+1}の貼付枚数上限" data-kind="mail" data-index="${i}" data-field="maxStamps" type="number" min="1" max="5" step="1" value="${esc(m.maxStamps)}">
      <button class="remove" type="button" data-action="remove-mail" data-index="${i}" aria-label="郵便物${i+1}を削除">×</button></div>`).join('');
    $('overLimit').value = project.overLimit;
    $('objective').value = project.objective;
    $('undo').disabled = !undo;
  }
  function chips(row) {return row.stamps.map(s=>`<div class="stamp-chip"><span>${s.value}</span><small>円 × ${s.count}</small></div>`).join('');}
  function renderResult() {
    $('count-badge').textContent = result?.ok ? 'OPTIMIZED' : committed ? 'CONFIRMED' : 'READY';
    if(committed && !result) {
      $('results').innerHTML = `<div class="result-box good"><p class="result-title">✓ 在庫への反映を確定しました</p><div class="result-main"><span class="big-number">${committed.totalPieces}<small>枚 使用</small></span></div><p class="summary-line">${committed.rows.length}通に切手を割り当て、在庫から差し引きました。誤って確定した場合は「確定を戻す」を利用してください。</p>${committed.rows.map(r=>`<div class="allocation"><div class="alloc-head"><b>${esc(r.label)}</b><span>${yen(r.paid)} / 必要 ${yen(r.target)}</span></div><div class="stamp-chips">${chips(r)}</div></div>`).join('')}</div>`;
      return;
    }
    if(!result) {$('results').innerHTML='<div class="placeholder"><div style="font-size:36px">✉</div><strong>準備ができました</strong><p>在庫と郵便物の料金を入力して、<br>「最適な振分けを計算」を押してください。</p></div>';return;}
    if(result.error || !result.ok) {
      $('results').innerHTML=`<div class="result-error"><b>計画を確定できません</b><p>${esc(result.error || result.reason)}</p>${result.explored ? `<small>探索済み ${result.explored.toLocaleString()} 状態</small>` : ''}</div>`;return;
    }
    const stockAfter = stockValue(project.stocks) - result.rows.reduce((sum,r)=>sum+r.paid,0);
    const compare = !result.greedy ? '<strong>1通ずつの順番計算では、途中で切手が足りず全件を満たせません。</strong>同時最適化では全件をカバーできます。' :
      `<strong>1通ずつの順番計算：</strong> 超過 ${yen(result.greedy.totalExcess)}・${result.greedy.totalPieces}枚。<br>同時最適化：超過 ${yen(result.totalExcess)}・${result.totalPieces}枚。`;
    $('results').innerHTML = `<div class="result-box good"><p class="result-title">✓ ${result.rows.length}通すべての割当が見つかりました</p>
      <div class="result-main"><span class="big-number">${yen(result.totalExcess).replace('円','')}<small>円 超過</small></span><span class="stat-chip">計算完了</span></div>
      <div class="stats-row"><div class="stat"><small>使用切手</small><b>${result.totalPieces}枚</b></div><div class="stat"><small>割当後の在庫額</small><b>${yen(stockAfter)}</b></div></div>
      <div class="summary-line">優先順位：${result.objective === 'excess' ? '超過額が少ない → 貼付枚数が少ない' : '貼付枚数が少ない → 超過額が少ない'}<br>全候補を比較済み（探索 ${result.explored.toLocaleString()} 状態）</div>
      ${result.rows.map((r,i)=>`<div class="allocation"><div class="alloc-head"><b><span style="color:#99b3a1;margin-right:7px">0${i+1}</span>${esc(r.label)}</b><span>必要 ${yen(r.target)}</span></div><div class="stamp-chips">${chips(r)}</div><div class="alloc-foot">合計 ${yen(r.paid)} · 超過 ${yen(r.excess)} · ${r.pieces}枚</div></div>`).join('')}
      <div class="compare">↔ ${compare}</div>
      <button type="button" class="confirm" id="commit">この割当で在庫を減らす <small>✓</small></button>
      </div>`;
    $('commit').addEventListener('click', commit);
  }
  function render() {inputs();renderResult();}
  function changed() {result=null;committed=null;undo=null;persist();render();}
  function calculate() {
    committed=null;
    try {result=Engine.plan(project); if(result.ok)notify('計算が完了しました。確定前に割当をご確認ください。');}
    catch(e) {result={ok:false,error:e.message};notify('入力内容または探索条件を確認してください');}
    renderResult();
    $('undo').disabled = !undo;
  }
  function commit() {
    try {
      const next = Engine.applyPlan(project, result);
      undo = clone(project);committed=clone(result);project=next;result=null;persist();render();notify('在庫に反映しました。「確定を戻す」で取り消せます。');
    } catch(e) {notify(e.message);}
  }
  document.addEventListener('change', ev=>{
    const el=ev.target;
    if(el.dataset.kind === 'stock' || el.dataset.kind === 'mail') {
      const arr=el.dataset.kind === 'stock' ? project.stocks : project.mails;
      const i=Number(el.dataset.index),field=el.dataset.field;
      if(!arr[i])return;
      arr[i][field]=field==='label' ? el.value : el.value;
      changed();
    } else if(el.id==='overLimit'||el.id==='objective') {project[el.id]=el.value;changed();}
  });
  document.addEventListener('click',ev=>{
    const button=ev.target.closest('button[data-action]');if(!button)return;
    const idx=Number(button.dataset.index);
    if(button.dataset.action==='remove-stock' && project.stocks.length>1){project.stocks.splice(idx,1);changed();}
    if(button.dataset.action==='remove-mail' && project.mails.length>1){project.mails.splice(idx,1);changed();}
  });
  $('add-stock').addEventListener('click',()=>{if(project.stocks.length>=8){notify('切手は最大8種類です');return;}project.stocks.push({value:5,count:1});changed();});
  $('add-mail').addEventListener('click',()=>{if(project.mails.length>=4){notify('郵便物は最大4件です');return;}project.mails.push({label:`発送${String.fromCharCode(65+project.mails.length)}`,target:110,maxStamps:3});changed();});
  $('calculate').addEventListener('click',calculate);
  $('demo').addEventListener('click',()=>{project=demo();result=null;undo=null;committed=null;persist();render();calculate();notify('デモ条件に戻しました');});
  $('undo').addEventListener('click',()=>{if(!undo)return;project=undo;undo=null;committed=null;result=null;persist();render();calculate();notify('確定前の在庫に戻しました');});
  function download(name,content,type) {
    const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
  }
  $('save-json').addEventListener('click',()=>{download('kitte-mawashi-project.json',JSON.stringify({format:'kitte-mawashi-v1',project},null,2),'application/json;charset=utf-8');notify('設定JSONを保存しました');});
  $('load-json').addEventListener('click',()=>$('json-file').click());
  $('json-file').addEventListener('change',async ev=>{
    const file=ev.target.files?.[0];if(!file)return;
    try {if(file.size>1000000)throw new Error('ファイルが大きすぎます');const data=JSON.parse(await file.text());if(data.format!=='kitte-mawashi-v1')throw new Error('対応していないJSON形式です');
      const restored=Engine.normalize(data.project);project=restored;undo=null;result=null;committed=null;persist();render();calculate();notify('設定JSONを読み込みました');
    } catch(e){notify('読み込み失敗：'+e.message);}finally{ev.target.value='';}
  });
  function safeCsv(s) {const t=String(s);return '"'+(/^[=+\-@\t\r]/.test(t)?"'":'')+t.replace(/"/g,'""')+'"';}
  $('export-csv').addEventListener('click',()=>{
    const r=result?.ok ? result : committed;
    if(!r){notify('先に計算してください');return;}
    const rows=[['管理名','必要額_円','貼付合計_円','超過_円','使用枚数','切手の内訳'],...r.rows.map(x=>[x.label,x.target,x.paid,x.excess,x.pieces,x.stamps.map(s=>`${s.value}円×${s.count}`).join(' / ')])];
    download('kitte-mawashi-plan.csv','\uFEFF'+rows.map(a=>a.map(safeCsv).join(',')).join('\r\n'),'text/csv;charset=utf-8');notify('配分CSVを保存しました');
  });
  $('print').addEventListener('click',()=>window.print());
  persist();render();calculate();
})();