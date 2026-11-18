/* ずらし畑 browser UI — MIT, no remote calls */
(() => {
  'use strict';
  const E = window.ZurashiEngine;
  const STORAGE = 'zurashibata-project-v1';
  const $ = id => document.getElementById(id);
  const escapeHTML = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num = x => Number(x).toLocaleString('ja-JP',{maximumFractionDigits:1});
  const dayLabel = date => date.slice(5).replace('-', '/');
  let toastTimer;
  function toast(message, error=false) {
    const node=$('toast'); node.textContent=message; node.classList.toggle('error',error);
    node.classList.add('visible'); clearTimeout(toastTimer);
    toastTimer = setTimeout(()=>node.classList.remove('visible'),3200);
  }
  function dateNextSpring() {
    const now = new Date();
    const year = now.getFullYear() + ((now.getMonth()+1>3 || ((now.getMonth()+1)===3 && now.getDate()>18)) ? 1 : 0);
    return year+'-03-18';
  }
  function sample() {
    const first=dateNextSpring();
    const beds=['北畝','中央畝','南畝'];
    return E.normalizeProject({version:1,title:'春の葉物菜園',beds,target:5,horizon:16,
      batches:E.series({crop:'コマツナ',first,count:5,spacing:14,maturity:30,window:8,yield:7,reset:3,bedOffset:0},beds,'sample')});
  }
  function load() {
    try {const saved=localStorage.getItem(STORAGE);return saved ? E.normalizeProject(JSON.parse(saved)) : sample();}
    catch (err) {return sample();}
  }
  let project=load();
  let comparison=null;
  function persist() {
    try {localStorage.setItem(STORAGE,JSON.stringify(project));return true;}
    catch (err) {toast('端末への自動保存ができません。JSONで保存してください。',true);return false;}
  }
  function commit(candidate,message) {
    try {project=E.normalizeProject(candidate);persist();comparison=null;render();toast(message || '変更を反映しました');return true;}
    catch (err) {toast(err.message,true);return false;}
  }
  function fillSelect(id, value) {
    const s=$(id); s.innerHTML=project.beds.map((b,i)=>`<option value="${i}">${escapeHTML(b)}</option>`).join('');
    const index=project.beds.indexOf(value);s.value=String(index<0?0:index);
  }
  function syncSettings() {
    $('p-title').value=project.title;
    $('p-beds').value=project.beds.join('、');
    $('p-target').value=project.target;
    $('p-horizon').value=project.horizon;
    const gValue=project.beds[Number($('g-bed').value)] || project.beds[0];
    const bValue=project.beds[Number($('b-bed').value)] || project.beds[0];
    fillSelect('g-bed',gValue);
    fillSelect('b-bed',bValue);
  }
  function initForms() {
    $('g-first').value=project.batches.length ? E.addDays(project.batches.map(E.occupiedEnd).sort().at(-1),3) : dateNextSpring();
    $('b-sow').value=dateNextSpring();
    syncSettings();
  }
  function seriesInput(spacingOverride) {
    const prefix='batch'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
    return {crop:$('g-crop').value,first:$('g-first').value,
      count:Number($('g-count').value),spacing:Number(spacingOverride??$('g-spacing').value),
      maturity:Number($('g-maturity').value),window:Number($('g-window').value),
      yield:Number($('g-yield').value),reset:Number($('g-reset').value),
      bedOffset:Number($('g-bed').value),prefix};
  }
  function batchInput() {
    const id=$('b-id').value||'one'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
    return {id,crop:$('b-crop').value,bed:project.beds[Number($('b-bed').value)],sow:$('b-sow').value,
      maturity:Number($('b-maturity').value),window:Number($('b-window').value),
      yield:Number($('b-yield').value),reset:Number($('b-reset').value)};
  }
  function addSeries(spacing) {
    try {
      const c=seriesInput(spacing);
      const bs=E.series(c,project.beds,c.prefix);
      if (project.batches.length+bs.length>300) throw new Error('作付けの上限は300件です');
      const merged={...project,batches:[...project.batches,...bs]};
      const problems=E.detectCollisions(merged.batches);
      if (commit(merged,`${bs.length}件を追加しました${problems.length?'（区画重複に注意）':''}`)) {
        $('compare-section').scrollIntoView({behavior:'smooth',block:'nearest'});
      }
    } catch(err) {toast(err.message,true);}
  }
  function drawStats(result) {
    const cards=[
      {label:'作付け',value:project.batches.length+'件',note:'登録されている計画'},
      {label:'週間収穫の最大',value:num(result.peak)+'食分',note:'表示期間中のピーク',alert:result.peak>project.target},
      {label:'目標を超えた分',value:num(result.overload)+'食分',note:'週ごとの超過分の合計',alert:result.overload>0,good:result.overload===0},
      {label:'区画の重複',value:result.collisions.length+'件',note:'占有期間が重なる組合せ',alert:result.collisions.length>0,good:result.collisions.length===0}
    ];
    $('stats').innerHTML=cards.map(c=>`<div class="stat-card ${c.alert?'alert':c.good?'good':''}"><div class="stat-label">${c.label}</div><div class="stat-value">${c.value}</div><div class="stat-note">${c.note}</div></div>`).join('');
  }
  function drawChart(result) {
    const max=Math.max(project.target,result.peak,1)*1.12;
    const bars=result.weeks.map(w=>{
      const h=Math.max(0,Math.min(100,w.amount/max*100));
      const over=w.amount>project.target+1e-9;
      return `<div class="bar-slot" title="${w.from}〜${w.to}: ${num(w.amount)}食分"><div class="bar ${over?'over':''}" style="height:${h.toFixed(3)}%">${w.amount>0.01?`<span class="bar-value">${num(w.amount)}</span>`:''}</div><span class="week-label">${dayLabel(w.from)}</span></div>`;
    }).join('');
    const line=(project.target/max*100).toFixed(3);
    $('chart').innerHTML=`<div class="target-line" style="bottom:${line}%"><span class="target-label">目標 ${num(project.target)}</span></div>`+bars;
    $('chart').setAttribute('aria-label',`収穫見込み：${result.weeks.map(w=>w.from+' '+num(w.amount)+'食分').join('、')}`);
    $('graph-range').textContent=`${result.from} から ${project.horizon}週`;
    const notes=[];
    if(result.collisions.length) notes.push(`⚠️ ${result.collisions.length}組の区画重複を検知。作付け一覧のオレンジ行を確認してください。`);
    if(result.outside>0.01) notes.push(`表示範囲外にも約${num(result.outside)}食分の収穫予定があります。週数を増やして確認してください。`);
    if(!notes.length)notes.push('✓ 区画重複はありません。収穫量の見込みは入力値に基づく参考計算です。');
    $('warning-box').classList.toggle('has-warning',result.collisions.length>0||result.outside>0.01);
    $('warning-box').textContent=notes.join('　');
  }
  function drawComparisons() {
    if (!comparison) {
      $('compare-results').innerHTML='<div class="empty-state"><span>↗</span><p>左の「5通りの間隔を比較」を押すと、候補と衝突を表示します。</p></div>';
      return;
    }
    $('compare-results').innerHTML=comparison.map((c,i)=>`<div class="comparison ${i===0?'best':''} ${c.collisions.length?'has-clash':''}"><div><div class="comp-title">${c.spacing}日 間隔</div><div class="comp-sub">${i===0?'★ この条件での最上位候補':'比較候補'} · ${c.generated.length}回追加</div></div><div class="comp-stats"><div>週間ピーク：<b>${num(c.peak)}食分</b></div><div>超過累計：<b>${num(c.overload)}食分</b></div><div>区画重複：<b>${c.collisions.length}件</b></div><div>表示外：<b>${num(c.outside)}食分</b></div></div><button type="button" class="button ${i===0?'primary':'subtle'}" data-action="apply" data-spacing="${c.spacing}">この案を追加</button></div>`).join('');
  }
  function drawRows(result) {
    $('batch-count').textContent=project.batches.length+'件';
    const badIds=new Set(result.collisions.flatMap(c=>[c.a,c.b]));
    const sorted=project.batches.slice().sort((a,b)=>a.sow.localeCompare(b.sow)||a.crop.localeCompare(b.crop));
    $('batch-rows').innerHTML=sorted.length?sorted.map(b=>`<tr class="${badIds.has(b.id)?'bad-row':''}"><td><strong>${escapeHTML(b.crop)}</strong><small>${escapeHTML(b.bed)} ${badIds.has(b.id)?'<span class="pill warn">区画重複</span>':''}</small></td><td>${b.sow}</td><td>${E.harvestStart(b)}<small>〜 ${E.harvestEnd(b)}</small></td><td><span class="pill">${b.yield} 食分</span></td><td><button type="button" class="table-action" data-action="edit" data-id="${escapeHTML(b.id)}">編集</button><button type="button" class="table-action delete" data-action="remove" data-id="${escapeHTML(b.id)}">削除</button></td></tr>`).join(''):'<tr><td colspan="5" style="text-align:center;color:#889b8c;padding:30px">まだ作付けがありません。左のフォームから追加できます。</td></tr>';
  }
  function render() {
    const result=E.analyze(project);
    syncSettings();drawStats(result);drawChart(result);drawComparisons();drawRows(result);
    document.title='ずらし畑 | '+project.title;
  }
  function resetBatch() {
    $('b-id').value='';$('b-crop').value='';$('b-sow').value=dateNextSpring();
    $('b-maturity').value='30';$('b-window').value='7';$('b-yield').value='6';$('b-reset').value='2';
    $('b-bed').value='0';$('batch-submit').textContent='1件を追加';
  }
  function editBatch(id) {
    const b=project.batches.find(x=>x.id===id);
    if(!b)return;
    $('b-id').value=b.id;$('b-crop').value=b.crop;$('b-bed').value=String(project.beds.indexOf(b.bed));
    $('b-sow').value=b.sow;$('b-maturity').value=b.maturity;
    $('b-window').value=b.window;$('b-yield').value=b.yield;$('b-reset').value=b.reset;
    $('batch-submit').textContent='編集を保存';
    $('batch-form').scrollIntoView({behavior:'smooth',block:'center'});
    $('b-crop').focus();
  }
  function download(filename, content, mime) {
    const blob = new Blob([content],{type:mime});const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
  }
  function chartSVG(result) {
    const width=1100,height=420, left=72,right=23,top=75,bottom=70;
    const plotW=width-left-right,plotH=height-top-bottom;
    const max=Math.max(result.peak,project.target,1)*1.12;
    const count=result.weeks.length;const slot=plotW/count;
    const esc=escapeHTML;
    const bars=result.weeks.map((w,i)=>{
      const h=Math.max(0,w.amount/max*plotH), x=left+i*slot+slot*.16,y=top+plotH-h;
      const barW=slot*.68;
      return `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${barW.toFixed(2)}" height="${h.toFixed(2)}" rx="3" fill="${w.amount>project.target?'#db9864':'#78aa78'}"/><text x="${(x+barW/2).toFixed(2)}" y="${height-39}" font-size="${count>20?11:13}" text-anchor="middle" fill="#526d59">${dayLabel(w.from)}</text>`;
    }).join('');
    const ty=top+plotH-project.target/max*plotH;
    return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#fffefa"/><text x="${left}" y="40" font-size="25" font-weight="bold" fill="#234532">${esc(project.title)} — 週別収穫見込み</text><text x="${left}" y="60" font-size="13" fill="#688276">単位：食分 / ${esc(result.from)}〜</text><line x1="${left}" x2="${width-right}" y1="${ty}" y2="${ty}" stroke="#305a46" stroke-width="2" stroke-dasharray="7 5"/><text x="${width-right}" y="${ty-7}" font-size="13" text-anchor="end" fill="#305a46">目標 ${project.target}</text><line x1="${left}" x2="${width-right}" y1="${top+plotH}" y2="${top+plotH}" stroke="#b7c9ba"/>${bars}<text x="${left}" y="${height-12}" font-size="11" fill="#8b9b8c">※入力された収穫見込みを期間内で均等配分した試算。天候・品種による変動は未考慮。</text></svg>`;
  }
  function setupEvents() {
    $('settings-form').addEventListener('submit',ev=>{
      ev.preventDefault();
      const beds=$('p-beds').value.split(/[,、，]/).map(s=>s.trim()).filter(Boolean);
      commit({...project,title:$('p-title').value,beds,target:Number($('p-target').value),horizon:Number($('p-horizon').value)},'菜園条件を更新しました');
    });
    $('compare-btn').addEventListener('click',()=>{
      try {
        const c=seriesInput();const options=[7,10,14,21,28,c.spacing];
        comparison=E.compare(project,c,options);
        drawComparisons();
        $('compare-section').scrollIntoView({behavior:'smooth',block:'start'});
        toast(`${comparison.length}通りを比較しました`);
      } catch(err) {toast(err.message,true);}
    });
    $('append-btn').addEventListener('click',()=>addSeries());
    $('series-form').addEventListener('input',()=>{if(comparison){comparison=null;drawComparisons();}});
    $('compare-results').addEventListener('click',ev=>{
      const btn=ev.target.closest('button[data-action="apply"]');
      if(btn)addSeries(Number(btn.dataset.spacing));
    });
    $('batch-form').addEventListener('submit',ev=>{
      ev.preventDefault();
      try {
        const b=batchInput();const exists=project.batches.some(x=>x.id===b.id);
        const batches=exists?project.batches.map(x=>x.id===b.id?b:x):[...project.batches,b];
        if(commit({...project,batches},exists?'作付けを更新しました':'作付けを1件追加しました'))resetBatch();
      }catch(err){toast(err.message,true);}
    });
    $('cancel-edit').addEventListener('click',resetBatch);
    $('batch-rows').addEventListener('click',ev=>{
      const btn=ev.target.closest('button[data-action]');if(!btn)return;
      const id=btn.dataset.id;
      if(btn.dataset.action==='edit')editBatch(id);
      if(btn.dataset.action==='remove') {
        if(commit({...project,batches:project.batches.filter(x=>x.id!==id)},'作付けを削除しました'))resetBatch();
      }
    });
    $('json-btn').addEventListener('click',()=>download('zurashibata-project.json',JSON.stringify(project,null,2),'application/json;charset=utf-8'));
    $('csv-btn').addEventListener('click',()=>download('zurashibata-batches.csv',E.batchesCsv(project),'text/csv;charset=utf-8'));
    $('weekly-btn').addEventListener('click',()=>download('zurashibata-weeks.csv',E.weeksCsv(project),'text/csv;charset=utf-8'));
    $('svg-btn').addEventListener('click',()=>download('zurashibata-chart.svg',chartSVG(E.analyze(project)),'image/svg+xml;charset=utf-8'));
    $('print-btn').addEventListener('click',()=>window.print());
    $('sample-btn').addEventListener('click',()=>{if(window.confirm('現在の計画をサンプルで置き換えますか？')){commit(sample(),'サンプルを読み込みました');resetBatch();}});
    $('clear-btn').addEventListener('click',()=>{if(window.confirm('全ての作付けを消去しますか？')){commit({...project,batches:[]},'作付けを消去しました');resetBatch();}});
    $('json-import').addEventListener('change',async ev=>{
      const f=ev.target.files?.[0];if(!f)return;
      try {
        if(f.size>1024*1024)throw new Error('1MB以下のJSONファイルを選択してください');
        const data=JSON.parse(await f.text());
        if(commit(E.normalizeProject(data),'JSONを復元しました'))resetBatch();
      } catch(err){toast('読み込み失敗：'+err.message,true);}
      finally{ev.target.value='';}
    });
  }
  initForms();setupEvents();render();
})();
