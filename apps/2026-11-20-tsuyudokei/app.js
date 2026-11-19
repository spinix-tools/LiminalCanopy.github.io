/* TSUYUDOKEI offline UI — no analytics, accounts, external endpoints or dependencies */
(function () {
  'use strict';
  const E = window.Tsuyu;
  const KEY='tsuyudokei-v1';
  const $=id=>document.getElementById(id);
  let state=load();
  let report=null;
  function safeText(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function round(n,d=1){return Number(n).toFixed(d);}
  function load(){
    try {const s=localStorage.getItem(KEY);if(s)return E.normalize(JSON.parse(s));}catch(e){}
    return E.stateFor('cold');
  }
  function save(){
    try{localStorage.setItem(KEY,JSON.stringify(state));$('saved-label').textContent='● この端末に保存済み';}
    catch(e){$('saved-label').textContent='○ 端末内保存が利用できません（JSONで保存可能）';}
  }
  function flash(message){const el=$('toast');el.textContent=message;el.hidden=false;clearTimeout(flash.timer);flash.timer=setTimeout(()=>el.hidden=true,3300);}
  function error(message){const el=$('form-error');el.textContent=message;el.hidden=false;el.scrollIntoView({behavior:'smooth',block:'nearest'});}
  function clearError(){$('form-error').hidden=true;}
  function presetFor(u){return Object.values(E.PRESETS).some(x=>Math.abs(x-u)<0.0001)?String(u):'custom';}
  function putConfig(){
    $('report-title').value=state.title;
    for(const key of ['A','B']){
      const k=key.toLowerCase(),s=state[key];
      $(`${k}-u`).value=s.u;
      $(`${k}-delta`).value=s.delta;
      $(`${k}-rsi`).value=String(s.rsi);
      $(`${k}-preset`).value=presetFor(s.u);
    }
  }
  function readForm(){
    const next=structuredClone(state);next.title=$('report-title').value;
    for(const key of ['A','B']){
      const k=key.toLowerCase();
      next[key]={u:$(`${k}-u`).value,rsi:$(`${k}-rsi`).value,delta:$(`${k}-delta`).value};
    }
    for(let i=0;i<12;i++)for(const k of ['outside','inside','rh']){
      const el=$(`r${i}-${k}`);if(el)next.rows[i][k]=el.value;
    }
    return E.normalize(next);
  }
  function applyForm(){
    try{state=readForm();putConfig();refresh();save();clearError();return true;}
    catch(e){error(e.message);return false;}
  }
  function statusChip(r){const cls=r.condense?'danger':r.damp?'warn':'ok';return `<span class="risk-chip ${cls}" title="${round(r.ts)}°C / 露点${round(r.dew)}°C">${round(r.surfaceRH,0)}%</span>`;}
  function renderTable(){
    const tbody=$('hour-rows');
    if(tbody.children.length!==12)tbody.innerHTML=state.rows.map((r,i)=>`<tr>
     <td>${E.TIMES[i]}</td>
     <td><input id="r${i}-outside" data-row="${i}" aria-label="${E.TIMES[i]}の外気温" type="number" min="-30" max="45" step="0.5" value="${r.outside}"></td>
     <td><input id="r${i}-inside" data-row="${i}" aria-label="${E.TIMES[i]}の室温" type="number" min="-10" max="45" step="0.5" value="${r.inside}"></td>
     <td><input id="r${i}-rh" data-row="${i}" aria-label="${E.TIMES[i]}の室内湿度" type="number" min="1" max="100" step="1" value="${r.rh}"></td>
     <td>${statusChip(report.A.slots[i])}</td><td>${statusChip(report.B.slots[i])}</td></tr>`).join('');
    else state.rows.forEach((r,i)=>{
      for(const k of ['outside','inside','rh']){
        const el=$(`r${i}-${k}`);
        if(document.activeElement!==el)el.value=r[k];
      }
      const cells=tbody.children[i].cells;
      cells[4].innerHTML=statusChip(report.A.slots[i]);
      cells[5].innerHTML=statusChip(report.B.slots[i]);
    });
  }
  function card(label,value,unit,desc,style){return `<div class="metric-card ${style}"><div class="metric-label">${label}</div><div class="metric-value">${value}<span class="metric-unit">${unit}</span></div><div class="metric-sub">${desc}</div></div>`;}
  function renderSummary(){
    const a=report.A,b=report.B;
    $('summary-grid').innerHTML=[
      card('A / 現状・表面RH 80%以上',a.dampHours,'時間 / 日',`結露計算 ${a.condHours}時間`,'a'),
      card('B / 対策後・表面RH 80%以上',b.dampHours,'時間 / 日',`結露計算 ${b.condHours}時間`,'b'),
      card('比較 / 湿潤時間の差',`${report.savedDampHours>0?'-':report.savedDampHours<0?'+':''}${Math.abs(report.savedDampHours)}`,'時間',report.savedDampHours>=0?'Aより減少／同じ':'Aより増加（注意）','impact')
    ].join('');
    const worst=E.TIMES[b.worstIdx];
    const reduction=b.maxNeededReduction;
    const cap=report.B.slots[b.worstIdx].safeRH80;
    const desc = reduction > 0.01 ?
      `Bで最も表面湿度が高い時刻は <strong>${worst}</strong>（約${round(b.maxRH)}%）。この時刻の湿潤80%未満の条件は、<strong>補正後の室内湿度が約${round(cap)}%未満</strong>です。24時間全枠で80%未満を目指すには、Bの現設定から<strong>最大約${round(reduction)}%pt</strong>の追加低減が計算上必要です。` :
      `Bの試算では、全12枠で窓表面の相対湿度が<strong>80%未満</strong>です（最も高い時刻は${worst}、約${round(b.maxRH)}%）。`;
    $('key-insight').innerHTML=`<strong>対策の読み方：</strong> ${desc} 実際の窓枠・熱橋・結露継続は別途確認してください。`;
  }
  function renderChart(){
    const chart=$('risk-chart');const left=47,right=777,top=22,bottom=230;
    const maxReal=Math.max(110,...report.A.slots.map(x=>x.surfaceRH),...report.B.slots.map(x=>x.surfaceRH));
    const ymax=Math.min(600,Math.ceil(maxReal/25)*25);
    const X=i=>left+(right-left)*i/11, Y=v=>bottom-Math.min(ymax,Math.max(0,v))/ymax*(bottom-top);
    let g='';
    [0,40,80,100,ymax].filter((x,i,a)=>a.indexOf(x)===i&&x<=ymax).forEach(level=>{
      const y=Y(level);const lineColor=level===100?'#e9b3a7':level===80?'#dbc99a':'#e2eeeb';
      g+=`<line x1="${left}" x2="${right}" y1="${y}" y2="${y}" stroke="${lineColor}" stroke-width="${level===80||level===100?1.5:1}" ${level===80||level===100?'stroke-dasharray="5 5"':''}/><text x="${left-9}" y="${y+4}" text-anchor="end" fill="#7e9799" font-size="12">${level}%</text>`;
    });
    g+=`<rect x="${left}" y="${Y(100)}" width="${right-left}" height="${Y(80)-Y(100)}" fill="#fce5d0" opacity=".23"/>`;
    E.TIMES.forEach((t,i)=>{g+=`<text x="${X(i)}" y="${bottom+25}" fill="#789193" font-size="11" text-anchor="middle">${t.slice(0,2)}</text>`});
    [['A','#177f9b'],['B','#eb8258']].forEach(([key,color])=>{
      const values=report[key].slots.map(r=>r.surfaceRH);const pts=values.map((v,i)=>`${X(i)},${Y(v)}`).join(' ');
      g+=`<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
      values.forEach((v,i)=>g+=`<circle cx="${X(i)}" cy="${Y(v)}" r="3.7" fill="#fff" stroke="${color}" stroke-width="2"><title>${key} / ${E.TIMES[i]} / ${round(v)}%</title></circle>`);
    });
    g+=`<text x="${right}" y="${bottom+43}" text-anchor="end" font-size="10" fill="#95aba9">時刻（2時間刻み）</text>`;
    chart.innerHTML=g;
  }
  function refresh(){report=E.analyze(state);renderTable();renderSummary();renderChart();}
  function download(name,blob,type){
    const url=URL.createObjectURL(new Blob([blob],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function readFile(input,callback){
    const file=input.files?.[0];if(!file)return;
    if(file.size>1_000_000){error('1MB以下のファイルを選んでください');input.value='';return;}
    const reader=new FileReader();reader.onload=()=>{
      try{callback(String(reader.result));flash('ファイルを読み込みました');clearError();}
      catch(e){error(e.message)}finally{input.value='';}
    };reader.onerror=()=>{error('ファイルを読み込めませんでした');input.value='';};reader.readAsText(file);
  }
  function setState(next){state=E.normalize(next);putConfig();refresh();save();}
  function bind(){
    $('recalculate').addEventListener('click',applyForm);
    $('report-title').addEventListener('change',applyForm);
    $('conditions').addEventListener('change',e=>{
      const id=e.target?.id||'';
      if(/^[ab]-preset$/.test(id)){
        const k=id[0],v=e.target.value;
        if(v!=='custom')$(`${k}-u`).value=v;
      }
      if(/^[ab]-(u|rsi|delta|preset)$/.test(id))applyForm();
    });
    $('hour-rows').addEventListener('change',e=>{
      if(e.target && e.target.dataset.row!==undefined)applyForm();
    });
    for(const name of ['cold','mild']){
      $(`preset-${name}`).addEventListener('click',()=>{
        setState(E.stateFor(name));$('preset-cold').classList.toggle('selected',name==='cold');$('preset-mild').classList.toggle('selected',name==='mild');clearError();flash('サンプル条件に切り替えました');
      });
    }
    $('reset-all').addEventListener('click',()=>{setState(E.stateFor('cold'));flash('初期例に戻しました');clearError()});
    $('export-csv').addEventListener('click',()=>{if(applyForm())download('tsuyudokei-report.csv','\uFEFF'+E.reportCSV(report),'text/csv;charset=utf-8');});
    $('export-json').addEventListener('click',()=>{if(applyForm())download('tsuyudokei-settings.json',JSON.stringify({schema:1,...state},null,2),'application/json;charset=utf-8');});
    $('import-json').addEventListener('click',()=>$('file-json').click());
    $('import-csv').addEventListener('click',()=>$('file-csv').click());
    $('file-json').addEventListener('change',()=>readFile($('file-json'),t=>setState(JSON.parse(t))));
    $('file-csv').addEventListener('change',()=>readFile($('file-csv'),t=>setState({...state,rows:E.parseCsvRows(t)})));
    $('print-report').addEventListener('click',()=>{if(applyForm())window.print();});
  }
  putConfig();refresh();bind();save();
  window.TsuyuApp={getState:()=>structuredClone(state),getReport:()=>report,refresh:()=>refresh()};
})();
