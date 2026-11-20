/* Local-only UI for SURIWAKE GRAPH. No remote services. */
(() => {
  'use strict';
  const E = window.Suriwake, STORAGE='suriwake-graph-project-v1';
  const $ = id => document.getElementById(id);
  const esc = E.escapeXml;
  const fallback = E.sample();
  let model;
  try { model = E.safeImport(localStorage.getItem(STORAGE) || JSON.stringify(fallback)); }
  catch { model = fallback; }
  function status(s) { $('saveStatus').textContent = s; }
  function save() {
    if(E.validate(model).errors.length) {status('入力を修正すると保存します');return;}
    try {localStorage.setItem(STORAGE, JSON.stringify(model));status('✓ 端末に自動保存しました');}
    catch {status('保存できません（保存領域に制限があります）');}
  }
  function download(filename,content,mime) {
    const b=new Blob([content],{type:mime}); const url=URL.createObjectURL(b);
    const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function renderTable() {
    $('editTable').querySelector('thead').innerHTML='<tr><th>項目名</th>'+model.series.map((s,i)=>`<th><input aria-label="系列${i+1}の名前" data-role="series" data-index="${i}" maxlength="60" value="${esc(s)}"></th>`).join('')+'<th>削除</th></tr>';
    $('editTable').querySelector('tbody').innerHTML=model.categories.map((c,i)=>'<tr>'+`<td><input aria-label="項目${i+1}の名前" data-role="category" data-row="${i}" maxlength="60" value="${esc(c.label)}"></td>`+c.values.map((v,j)=>`<td><input inputmode="decimal" aria-label="項目${i+1} 系列${j+1}の値" data-role="value" data-row="${i}" data-col="${j}" value="${Number.isFinite(v)?esc(v):''}"></td>`).join('')+`<td><button type="button" class="remove-row" aria-label="項目${i+1}を削除" data-remove="${i}" ${model.categories.length<=1?'disabled':''}>×</button></td>`+'</tr>').join('');
    $('addCategory').disabled=model.categories.length>=E.MAX_CATEGORIES;
    $('addSeries').disabled=model.series.length>=E.MAX_SERIES;
    $('removeSeries').disabled=model.series.length<=1;
  }
  function renderPreview() {
    const check=E.validate(model);
    $('statCategories').textContent=model.categories.length;
    $('statSeries').textContent=model.series.length;
    $('alerts').innerHTML=check.errors.map(s=>`<div class="alert error">× ${esc(s)}</div>`).join('')+
      check.warnings.map(s=>`<div class="alert warning">! ${esc(s)}</div>`).join('')+
      (check.errors.length||check.warnings.length?'':'<div class="alert ok">✓ 表示可能です。最終印刷前に原寸確認してください。</div>');
    ['exportSvg','exportCsv','exportJson','print'].forEach(id=>{$(id).disabled=check.errors.length>0;});
    if (check.errors.length) {$('chartHost').textContent='データを修正するとプレビューを再生成します。';$('readTable').innerHTML='';return;}
    $('chartHost').innerHTML=E.renderSvg(model);
    $('readTable').innerHTML='<thead><tr><th scope="col">項目</th>'+model.series.map(s=>`<th scope="col">${esc(s)}</th>`).join('')+(model.mode==='stacked'?'<th scope="col">合計</th>':'')+'</tr></thead><tbody>'+model.categories.map(c=>'<tr><td>'+esc(c.label)+'</td>'+c.values.map(v=>`<td>${v.toLocaleString('ja-JP',{maximumFractionDigits:4})}</td>`).join('')+(model.mode==='stacked'?`<td>${c.values.reduce((a,b)=>a+b,0).toLocaleString('ja-JP',{maximumFractionDigits:4})}</td>`:'')+'</tr>').join('')+'</tbody>';
  }
  function renderAll() {
    $('title').value=model.title; $('note').value=model.note;
    document.querySelectorAll('[data-mode]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.mode===model.mode)));
    document.querySelectorAll('[data-mono]').forEach(el=>el.setAttribute('aria-pressed',String((el.dataset.mono==='true')===model.monochrome)));
    renderTable();renderPreview();save();
  }
  ['title','note'].forEach(id=>$(id).addEventListener('input',()=>{model[id]=$(id).value;renderPreview();save();}));
  document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{model.mode=b.dataset.mode;renderAll();}));
  document.querySelectorAll('[data-mono]').forEach(b=>b.addEventListener('click',()=>{model.monochrome=b.dataset.mono==='true';renderAll();}));
  $('editTable').addEventListener('input',ev=>{
    const t=ev.target;if(!(t instanceof HTMLInputElement))return;
    if(t.dataset.role==='series')model.series[Number(t.dataset.index)]=t.value;
    if(t.dataset.role==='category')model.categories[Number(t.dataset.row)].label=t.value;
    if(t.dataset.role==='value'){
      const raw=t.value.trim();const valid=/^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/.test(raw);
      model.categories[Number(t.dataset.row)].values[Number(t.dataset.col)]=valid?Number(raw):NaN;
    }
    renderPreview();save();
  });
  $('editTable').addEventListener('click',ev=>{
    const btn=ev.target.closest('[data-remove]');if(!btn||model.categories.length<=1)return;
    model.categories.splice(Number(btn.dataset.remove),1);renderAll();
  });
  $('addCategory').addEventListener('click',()=>{if(model.categories.length>=E.MAX_CATEGORIES)return;model.categories.push({label:`項目${model.categories.length+1}`,values:model.series.map(()=>0)});renderAll();});
  $('addSeries').addEventListener('click',()=>{if(model.series.length>=E.MAX_SERIES)return;model.series.push(`系列${model.series.length+1}`);model.categories.forEach(c=>c.values.push(0));renderAll();});
  $('removeSeries').addEventListener('click',()=>{if(model.series.length<=1)return;model.series.pop();model.categories.forEach(c=>c.values.pop());renderAll();});
  $('reset').addEventListener('click',()=>{if(window.confirm('入力中のデータをサンプルに戻しますか？')){model=E.sample();renderAll();}});
  $('exportSvg').addEventListener('click',()=>{download('suriwake-graph.svg','<?xml version="1.0" encoding="UTF-8"?>\n'+E.renderSvg(model),'image/svg+xml;charset=utf-8');});
  $('exportCsv').addEventListener('click',()=>{download('suriwake-data.csv','\ufeff'+E.toCSV(model),'text/csv;charset=utf-8');});
  $('exportJson').addEventListener('click',()=>{download('suriwake-project.json',JSON.stringify(model,null,2)+'\n','application/json;charset=utf-8');});
  $('print').addEventListener('click',()=>window.print());
  async function readAndLoad(file,kind) {
    if(!file)return;
    try {
      if(file.size>(kind==='csv'?150000:50000))throw new Error('ファイルサイズ制限を超えました');
      const txt=await file.text();
      model=kind==='csv'?E.toModelFromCSV(txt,model):E.safeImport(txt);
      renderAll();status('✓ インポートしました（端末内保存済み）');
    }catch(e){status('読み込みエラー');window.alert('読み込みに失敗: '+e.message);}
  }
  $('importCsv').addEventListener('change',async ev=>{await readAndLoad(ev.target.files?.[0],'csv');ev.target.value='';});
  $('importJson').addEventListener('change',async ev=>{await readAndLoad(ev.target.files?.[0],'json');ev.target.value='';});
  renderAll();
})();
