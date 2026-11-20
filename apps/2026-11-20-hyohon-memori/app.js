(function () {
  'use strict';
  const E = window.Hyohon;
  const $ = id => document.getElementById(id);
  const KEY = 'hyohon-memori-v1';
  let state=E.demo(), latest=null;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pct = x => Number.isFinite(x)?x.toFixed(1)+'%':'—';
  const fmt = x => Number.isFinite(x)?Number(x).toLocaleString('ja-JP',{maximumFractionDigits:1}):'—';
  function persist() {try{localStorage.setItem(KEY,JSON.stringify(state))}catch{ /* storage may be restricted */ }}
  function restore() { try { const s=localStorage.getItem(KEY); if(s) state=E.parseJSON(s); } catch {state=E.demo();} }
  function download(name,content,type){
    const blob=new Blob([content],{type});const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);
  }
  function normalizeTarget(items) {
    const total=items.reduce((s,c)=>s+Number(c.target),0);
    if(total<=0){items.forEach(c=>c.target=100/items.length);return;}
    items.forEach(c=>c.target=Math.round(Number(c.target)/total*100000)/1000);
    items[items.length-1].target=Number((100-items.slice(0,-1).reduce((s,c)=>s+c.target,0)).toFixed(3));
  }
  function targetAxis(titleKey,kind,axis) {
    return `<div class="axis-title"><label for="${kind}-title">${kind==='row'?'区分A':'区分B'}の名称</label><input id="${kind}-title" data-kind="meta" data-key="${titleKey}" maxlength="100" value="${esc(state[titleKey])}" aria-label="${kind==='row'?'区分A':'区分B'}の名称"><button type="button" data-remove="${kind}" ${axis.length<=2?'disabled':''}>末尾を削除</button></div>${axis.map((item,i)=>`<div class="target"><input aria-label="${kind} ${i+1}の名前" data-kind="name" data-axis="${kind}" data-i="${i}" maxlength="40" value="${esc(item.name)}"><input class="percent-input" aria-label="${kind} ${i+1}の目標割合パーセント" data-kind="target" data-axis="${kind}" data-i="${i}" type="number" min="0" max="100" step="any" value="${esc(item.target)}"></div>`).join('')}<small class="subtle">目標値の合計：${fmt(axis.reduce((a,b)=>a+Number(b.target),0))}%</small>`;
  }
  function renderForm() {
    $('title').value=state.title;$('question').value=state.question;
    $('targets').innerHTML=targetAxis('rowTitle','row',state.rows)+targetAxis('colTitle','col',state.cols);
    $('matrix').innerHTML=`<table><thead><tr><th>${esc(state.rowTitle)} ／ ${esc(state.colTitle)}</th>${state.cols.map(c=>`<th>${esc(c.name)}</th>`).join('')}</tr></thead><tbody>${state.rows.map((r,i)=>`<tr><th>${esc(r.name)}</th>${state.cols.map((c,j)=>`<td><div class="cell-inputs"><label>人数<input class="num-input" type="number" min="0" max="1000000" step="1" data-kind="cell" data-key="n" data-i="${i}" data-j="${j}" aria-label="${esc(r.name)} ${esc(c.name)} 回答人数" value="${esc(state.cells[i][j].n)}"></label><label>はい<input class="num-input" type="number" min="0" max="1000000" step="1" data-kind="cell" data-key="yes" data-i="${i}" data-j="${j}" aria-label="${esc(r.name)} ${esc(c.name)} はい人数" value="${esc(state.cells[i][j].yes)}"></label></div></td>`).join('')}</tr>`).join('')}</tbody></table>`;
    $('add-row').disabled=state.rows.length>=5;$('add-col').disabled=state.cols.length>=5;
  }
  function bars(axisLabel,series) {
    return `<div class="axis-block"><div class="axis-label">${esc(axisLabel)}</div>${series.map(x=>`<div class="bar-row"><span class="name">${esc(x.name)}</span><div><div class="bar-track"><div class="bar-fill" style="width:${x.before}%;background:#b1c0cb"></div></div><div class="bar-track" style="margin-top:3px"><div class="bar-fill" style="width:${x.after}%;background:#079e8b"></div></div><div class="bar-track" style="margin-top:3px"><div class="bar-fill" style="width:${x.target}%;background:#edb752"></div></div></div><output>${x.after.toFixed(1)}%</output></div>`).join('')}</div>`;
  }
  function resultView() {
    try {
      const r=E.compare(state); latest=r;
      $('error').hidden=true;$('status').textContent=`${fmt(r.both.N)} 回答を分析`; $('status').classList.remove('bad');
      $('raw-value').textContent=pct(r.rawShare);$('row-value').textContent=pct(r.row.weightedShare);$('both-value').textContent=pct(r.both.weightedShare);
      const shift=r.both.weightedShare-r.rawShare;
      $('shift').textContent=`補正前比 ${shift>=0?'+':''}${shift.toFixed(1)} pt`;
      $('ess-value').textContent=fmt(r.both.ess);$('ess-note').textContent=`元の${fmt(r.both.N)}回答の ${(r.both.ess/r.both.N*100).toFixed(1)}%`;
      $('max-weight').textContent=r.both.maxWeight.toFixed(2)+'×';$('residual').textContent=r.both.residual.toFixed(5)+' pt';$('iterations').textContent=fmt(r.both.iterations)+'回';
      $('chart').innerHTML=`<div class="key"><span><i style="background:#b1c0cb"></i> 回収構成</span><span><i style="background:#079e8b"></i> 補正後</span><span><i style="background:#edb752"></i> 目標</span></div>${bars(state.rowTitle,r.both.rows)}${bars(state.colTitle,r.both.cols)}`;
      $('warnings').innerHTML=r.warnings.map(w=>`<li>${esc(w)}</li>`).join('');
      $('csv').disabled=false;
    } catch(e) {
      latest=null;$('status').textContent='入力を確認してください';$('status').classList.add('bad');$('error').textContent=e.message;$('error').hidden=false;
      ['raw-value','row-value','both-value','ess-value','max-weight','residual','iterations'].forEach(id=>$(id).textContent='—');
      $('shift').textContent='再計算待ち';$('ess-note').textContent='—';$('chart').innerHTML='<div class="intro">目標や人数を修正するとここに比較結果が表示されます。</div>';$('warnings').innerHTML='';$('csv').disabled=true;
    }
  }
  function applyChange(el) {
    const d=el.dataset;
    if(!d.kind)return;
    let v=el.type==='number'?(el.value===''?NaN:Number(el.value)):el.value;
    if(d.kind==='meta')state[d.key]=v;
    else if(d.kind==='name')state[d.axis==='row'?'rows':'cols'][Number(d.i)].name=v;
    else if(d.kind==='target')state[d.axis==='row'?'rows':'cols'][Number(d.i)].target=v;
    else if(d.kind==='cell')state.cells[Number(d.i)][Number(d.j)][d.key]=v;
  }
  function added(which) {
    if(which==='row'&&state.rows.length<5){
      const k=state.rows.length+1;state.rows.push({name:`区分A-${k}`,target:10});normalizeTarget(state.rows);state.cells.push(state.cols.map(()=>({n:0,yes:0})));
    }
    if(which==='col'&&state.cols.length<5){
      const k=state.cols.length+1;state.cols.push({name:`区分B-${k}`,target:10});normalizeTarget(state.cols);state.cells.forEach(row=>row.push({n:0,yes:0}));
    }
    persist();renderForm();resultView();
  }
  function removed(which) {
    if(which==='row'&&state.rows.length>2){state.rows.pop();state.cells.pop();normalizeTarget(state.rows);}
    if(which==='col'&&state.cols.length>2){state.cols.pop();state.cells.forEach(row=>row.pop());normalizeTarget(state.cols);}
    persist();renderForm();resultView();
  }
  document.addEventListener('input',e=>{
    if(e.target.matches('#title,#question')){state[e.target.id]=e.target.value;persist();return;}
    if(e.target.dataset.kind){applyChange(e.target);persist();resultView();}
  });
  document.addEventListener('change',e=>{
    if(e.target.dataset.kind){applyChange(e.target);persist();renderForm();resultView();}
  });
  document.addEventListener('click',e=>{
    const remove=e.target.closest('[data-remove]');if(remove){removed(remove.dataset.remove);return;}
  });
  $('add-row').addEventListener('click',()=>added('row'));
  $('add-col').addEventListener('click',()=>added('col'));
  $('demo').addEventListener('click',()=>{state=E.demo();persist();renderForm();resultView();});
  $('csv').addEventListener('click',()=>{if(latest)download('hyohon-memori-weights.csv',E.exportCSV(state,latest.both),'text/csv;charset=utf-8')});
  $('json').addEventListener('click',()=>download('hyohon-memori-settings.json',JSON.stringify(state,null,2),'application/json;charset=utf-8'));
  $('import').addEventListener('change',async e=>{
    const file=e.target.files[0];e.target.value='';if(!file)return;
    try {if(file.size>200000)throw new Error('JSONは200KBまでです');state=E.parseJSON(await file.text());persist();renderForm();resultView();}
    catch(err){$('error').hidden=false;$('error').textContent='読み込み失敗：'+err.message;}
  });
  $('print').addEventListener('click',()=>window.print());
  restore();renderForm();resultView();
})();