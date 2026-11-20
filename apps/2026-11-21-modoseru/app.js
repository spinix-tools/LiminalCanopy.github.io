/* MODOSERU UI — all input and calculation stay in the browser. */
(function () {
  'use strict';
  const E = window.ModoseruEngine;
  const key = 'modoseru_v1_local';
  const $ = id => document.getElementById(id);
  const escape = text => String(text ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num = x => Number(x).toLocaleString('ja-JP',{maximumFractionDigits:2});
  const labels = { ready: '復元候補あり', stale: '期限超過', untested: '復元未検証', lost: '全コピー喪失' };
  const shortLabels = { ready: 'OK', stale: '古い', untested: '未検証', lost: '喪失' };
  let seq = 0;
  let toastTimer;
  let state;
  function notify(message, error) {
    const node=$('toast');node.textContent=message;node.className='toast show'+(error?' error':'');
    clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.className='toast',3600);
  }
  function load() {
    try { const saved=localStorage.getItem(key);return saved?E.normalize(JSON.parse(saved)):E.example(); }
    catch(err) { setTimeout(()=>notify('前回の保存データを読めず、サンプルを開きました',true),100);return E.example(); }
  }
  state=load();
  function persist() { try{localStorage.setItem(key, JSON.stringify(state));}catch(e){notify('端末保存できません。JSONで保存してください',true);} }
  function newId(prefix) {return prefix+'-'+Date.now().toString(36)+'-'+(++seq).toString(36);}
  function chooseScenario() {
    const list=E.scenarios(state);
    if (!list.some(x=>E.scenarioKey(x)===state.selectedScenario))state.selectedScenario=E.scenarioKey(list[0]);
    return list;
  }
  function field(title,kind,id,name,value,type='text',extras='') {
    const safe=escape(value);
    return `<label class="field"><span>${title}</span><input data-kind="${kind}" data-id="${escape(id)}" data-field="${name}" type="${type}" value="${safe}" ${extras}></label>`;
  }
  function dropdown(title,kind,id,name,options,current) {
    return `<label class="field"><span>${title}</span><select data-kind="${kind}" data-id="${escape(id)}" data-field="${name}">${options.map(o=>`<option value="${escape(o[0])}" ${String(o[0])===String(current)?'selected':''}>${escape(o[1])}</option>`).join('')}</select></label>`;
  }
  function yn(title,id,name,value,yes,no) {return dropdown(title,'copy',id,name,[['true',yes],['false',no]],String(value));}
  function renderEditors() {
    $('datasets').innerHTML=state.datasets.map(d=>`<div class="data-item" data-dataset="${escape(d.id)}">${field('データ名','dataset',d.id,'name',d.name)}${field('容量 / GB','dataset',d.id,'sizeGB',d.sizeGB,'number','min="0.01" max="10000000" step="0.01"')}${field('RPO / 時間','dataset',d.id,'rpoHours',d.rpoHours,'number','min="0" max="87600" step="0.5"')}<button class="remove" data-remove="dataset" data-id="${escape(d.id)}" ${state.datasets.length===1?'disabled':''} aria-label="${escape(d.name)}を削除">削除</button></div>`).join('');
    $('copies').innerHTML=state.copies.map((c,i)=>`<div class="copy-card" data-copy="${escape(c.id)}"><div class="copy-head"><div class="copy-title"><span class="copy-index">${String(i+1).padStart(2,'0')}</span><strong>${escape(c.name)}</strong></div><button class="remove" type="button" data-remove="copy" data-id="${escape(c.id)}">削除</button></div><div class="copy-fields">${field('コピーの名称','copy',c.id,'name',c.name)}${dropdown('対象データ','copy',c.id,'datasetId',state.datasets.map(d=>[d.id,d.name]),c.datasetId)}${field('保管場所（同じなら同名）','copy',c.id,'site',c.site)}${field('機器・媒体（同じなら同名）','copy',c.id,'device',c.device)}${field('認証群（同じなら同名）','copy',c.id,'account',c.account)}${field('コピー経過 / 時間','copy',c.id,'ageHours',c.ageHours,'number','min="0" max="87600" step="0.5"')}${yn('ネット接続',''+c.id,'online',c.online,'オンライン','切離し')}${yn('改変防止',''+c.id,'locked',c.locked,'保護済み','書込可能')}${yn('実機で復元済み',''+c.id,'verified',c.verified,'検証済み','未検証')}${field('復元速度 / MB毎秒','copy',c.id,'speed',c.speed,'number','min="0.1" max="100000" step="0.1"')}</div></div>`).join('') || '<p class="hint">コピーを追加して、事故後に残る経路を比較できます。</p>';
    $('add-dataset').disabled=state.datasets.length>=E.LIMITS.datasets;
    $('add-copy').disabled=state.copies.length>=E.LIMITS.copies;
  }
  function renderStats(m) {
    const failures=m.totalCells-m.readyCells;
    const percent=m.totalCells?Math.round(m.readyCells/m.totalCells*100):0;
    const uniqueSites=new Set(state.copies.map(c=>c.site)).size;
    $('stats').innerHTML=[
      ['想定する事故',num(m.scenarios)+' 通り','機器・拠点・認証・一斉改変'],
      ['診断クリア',num(m.readyCells)+' / '+num(m.totalCells),'コピーが生き、期限内・復元検証済'],
      ['要点検の結果',num(failures)+' 件','期限超過・未検証・喪失を含む',true],
      ['登録した保管拠点',num(uniqueSites)+' 拠点','クリア率 '+percent+'%（モデル内）']
    ].map(v=>`<div class="stat"><small>${v[0]}</small><b class="${v[3]?'warn':''}">${v[1]}</b><span>${v[2]}</span></div>`).join('');
  }
  function renderMatrix(m) {
    $('matrix').innerHTML=`<table class="matrix-table"><thead><tr><th>事故シナリオ</th>${m.cols.map(c=>`<th>${escape(c.name)}</th>`).join('')}</tr></thead><tbody>${m.rows.map(r=>`<tr data-select-scenario="${escape(E.scenarioKey(r.incident))}" class="${E.scenarioKey(r.incident)===state.selectedScenario?'selected':''}" tabindex="0" title="選択して事故の詳細を見る"><td>${escape(r.incident.label)}</td>${r.datasets.map(d=>`<td><span class="status-pill ${d.status}" title="${labels[d.status]}">${shortLabels[d.status]}</span></td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }
  function renderDetail() {
    const list=chooseScenario(), active=E.evaluate(state,state.selectedScenario);
    $('scenario').innerHTML=list.map(v=>`<option value="${escape(E.scenarioKey(v))}" ${E.scenarioKey(v)===state.selectedScenario?'selected':''}>${escape(v.label)}</option>`).join('');
    $('details').innerHTML=`<div class="incident-summary">${active.ready} / ${active.total} データに「期限内・復元テスト済」の経路が残ります。<br><small>※ 仮定上の判定であり、実際の復旧保証ではありません。</small></div>${active.datasets.map(d=>`<article class="detail-item"><div class="detail-row"><strong>${escape(d.name)}</strong><span class="status-pill ${d.status}">${labels[d.status]}</span></div><p>失われるコピー：${d.lost.length ? escape(d.lost.map(c=>c.name).join('、')) : 'なし'}　/　残るコピー：${d.survivors.length} 件</p>${d.selected ? `<p class="${d.status==='ready'?'safe-route':'bad-route'}">候補：${escape(d.selected.name)} · ${num(d.ageHours)}時間前 · 復元見積 ${num(d.estimatedHours)}時間</p><div class="meta-line">許容：${num(d.rpoHours)}時間前まで / 復元速度：${num(d.selected.speed)}MB/s${!d.selected.verified?' / ※実機検証なし':''}</div>` : '<p class="bad-route">事故後に残存するコピーがありません。</p>'}</article>`).join('')}`;
  }
  function renderAdvice(m) {
    $('advice').innerHTML=E.advice(state,m).map(x=>`<div class="advice-item"><div class="advice-header"><strong>${escape(x.name)}</strong><span>クリア ${x.passed}/${x.total}</span></div><ol>${x.ideas.map(t=>`<li>${escape(t)}</li>`).join('')}</ol></div>`).join('');
  }
  function render(edit=true) {
    try {
      state=E.normalize(state);const m=E.matrix(state);chooseScenario();renderStats(m);renderMatrix(m);renderDetail();renderAdvice(m);
      if (edit)renderEditors();persist();
    } catch(err) {notify(err.message,true);throw err;}
  }
  function updateField(target) {
    const {kind,id,field:prop}=target.dataset;
    if (!kind) return;
    const next=structuredClone(state);
    const targetRow=(kind==='copy'?next.copies:next.datasets).find(x=>x.id===id);
    if (!targetRow)return;
    const old=targetRow[prop];
    let value=target.value;
    if (typeof old==='boolean')value=value==='true';
    else if (typeof old==='number')value=Number(value);
    targetRow[prop]=value;
    try {state=E.normalize(next);render(true);}catch(e){render(true);notify(e.message,true);}
  }
  function download(filename,body,type) {
    const blob=new Blob([body],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;
    document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
  }
  document.addEventListener('change',event=>{
    const t=event.target;
    if(t.dataset.kind){updateField(t);return;}
    if(t.id==='scenario'){state.selectedScenario=t.value;render(false);return;}
    if(t.id==='import-json' && t.files?.[0]){
      (async()=>{try{if(t.files[0].size>1024*1024)throw Error('1MB以下の設定ファイルを選んでください');const raw=await t.files[0].text();state=E.normalize(JSON.parse(raw));render();notify('設定を読み込みました');}catch(err){notify('読込失敗：'+err.message,true);}finally{t.value='';}})();
    }
  });
  document.addEventListener('click',event=>{
    const btn=event.target.closest('[data-remove], [data-select-scenario]');if(!btn)return;
    if(btn.dataset.selectScenario){state.selectedScenario=btn.dataset.selectScenario;render(false);return;}
    if(btn.dataset.remove){const next=structuredClone(state),id=btn.dataset.id;
      if(btn.dataset.remove==='dataset'){
        if(next.datasets.length===1){notify('少なくともデータ1件が必要です',true);return;}
        next.datasets=next.datasets.filter(d=>d.id!==id);next.copies=next.copies.filter(c=>c.datasetId!==id);
      }else{next.copies=next.copies.filter(c=>c.id!==id);}
      state=next;render();notify('削除しました');
    }
  });
  $('matrix').addEventListener('keydown',event=>{if((event.key==='Enter'||event.key===' ')&&event.target.dataset.selectScenario){event.preventDefault();event.target.click();}});
  $('add-dataset').addEventListener('click',()=>{if(state.datasets.length>=E.LIMITS.datasets)return;
    state.datasets.push({id:newId('d'),name:'新しいデータ',sizeGB:10,rpoHours:24});render();notify('データを追加しました');});
  $('add-copy').addEventListener('click',()=>{if(state.copies.length>=E.LIMITS.copies)return;
    state.copies.push({id:newId('c'),datasetId:state.datasets[0].id,name:'新しいコピー',site:'別の場所',device:'別の機器',account:'独立アカウント',ageHours:1,online:false,locked:false,verified:false,speed:50});render();notify('コピーを追加しました');});
  $('reset').addEventListener('click',()=>{if(!confirm('入力した設定をサンプルで上書きしますか？'))return;state=E.example();render();notify('サンプルに戻しました');});
  $('export-json').addEventListener('click',()=>{download('modoseru-config.json',JSON.stringify(state,null,2),'application/json;charset=utf-8');notify('設定を保存しました');});
  $('csv').addEventListener('click',()=>{download('modoseru-report.csv',E.csvReport(state),'text/csv;charset=utf-8');notify('診断表をCSV出力しました');});
  $('print').addEventListener('click',()=>window.print());
  render();
})();
