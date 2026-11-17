/* AMEDAME UI. No tracking, network calls, or dependencies. */
(function () {
  'use strict';
  const C = window.RainCore;
  const $ = id => document.getElementById(id);
  const numericFields = ['year','area','efficiency','capacity','startPercent','demand','summerFactor'];
  const storageKey = 'amedame-project-v1';
  let importedDays = null, lastConfig = null, lastComparison = null;
  const fmt = (v, digits = 0) => new Intl.NumberFormat('ja-JP', {maximumFractionDigits:digits}).format(v);
  const colors = {even:'#57e6bf',weekly:'#79bff7',burst:'#ffce7c',observed:'#57e6bf'};

  function setStatus(message, error = false) {
    const el = $('status'); el.textContent = message; el.setAttribute('role', error ? 'alert' : 'status');
  }
  function applyConfig(cfg) {
    numericFields.forEach(key => $(key).value = cfg[key]);
    $('candidates').value = cfg.candidates.join(', ');
    $('rainInputs').replaceChildren();
    cfg.rain.forEach((value, i) => {
      const holder = document.createElement('div'); holder.className = 'field';
      const label = document.createElement('label'); label.htmlFor = 'rain' + i; label.textContent = (i + 1) + '月 mm';
      const input = document.createElement('input'); input.type = 'number'; input.id = 'rain' + i;
      input.min = 0; input.max = 10000; input.step = '0.1'; input.value = value;
      holder.append(label, input); $('rainInputs').append(holder);
    });
    $('mode').value = cfg.mode;
  }
  function readConfig() {
    const cfg = {};
    numericFields.forEach(key => cfg[key] = $(key).value);
    cfg.rain = Array.from({length:12}, (_, i) => $('rain' + i).value);
    const values = $('candidates').value.split(/[,、\s]+/).filter(Boolean);
    if (!values.length) throw new Error('比較容量を入力してください。');
    cfg.candidates = values;
    cfg.mode = $('mode').value;
    return C.validateConfig(cfg);
  }
  function persist(cfg) {
    try { localStorage.setItem(storageKey, JSON.stringify(cfg)); }
    catch (_) { setStatus('この環境では自動保存できません。JSONへ保存してください。'); }
  }
  function resetImported() {
    importedDays = null;
    $('mode').replaceChildren(...C.MODES.map(m => new Option(m.label, m.id)));
    $('clearCsvBtn').hidden = true;
    $('fileNote').textContent = '月降水量を3通りの日別配分へ変換します。CSV読込時は実測1系列を計算します。';
    $('csvFile').value = '';
  }
  function useImported(days, name) {
    importedDays = days;
    $('mode').replaceChildren(new Option('実測CSV', 'observed'));
    $('clearCsvBtn').hidden = false;
    $('fileNote').textContent = '実測CSV: ' + name + '（' + days.length + '日分）／月別入力と仮想シナリオは一時停止中';
  }
  function buildLinePath(trace, capacity, w, h, inset) {
    const dx = (w - inset * 2) / Math.max(1, trace.length - 1);
    const dy = h - inset * 1.8;
    return trace.map((x, i) => (i ? 'L' : 'M') + (inset + i * dx).toFixed(2) + ',' +
      (inset + (1 - x.storage / capacity) * dy).toFixed(2)).join(' ');
  }
  function drawChart(data) {
    const svg = $('tankChart'); svg.replaceChildren();
    const ns = 'http://www.w3.org/2000/svg';
    const tag = (name, attrs, parent = svg) => {
      const el = document.createElementNS(ns, name);
      Object.entries(attrs).forEach(([k,v]) => el.setAttribute(k, String(v)));
      parent.append(el); return el;
    };
    const w=760, h=250, left=42, right=18, top=20, bottom=30;
    const plotWidth=w-left-right, plotHeight=h-top-bottom;
    for (let i=0;i<=4;i++) {
      const y=top+i*plotHeight/4;
      tag('line',{x1:left,y1:y,x2:w-right,y2:y,class:'gridline'});
      tag('text',{x:6,y:y+4}).textContent = fmt(data.capacity * (4-i)/4,0)+'L';
    }
    [0,2,4,6,8,10].forEach(m => {
      const idx = data.trace.findIndex(d => d.month === m+1);
      if (idx < 0) return;
      const x=left+idx*plotWidth/Math.max(1,data.trace.length-1);
      tag('text',{x,y:h-10}).textContent = (m+1)+'月';
    });
    const d = data.trace.map((x,i) => (i?'L':'M') +
      (left + i * plotWidth/Math.max(1,data.trace.length-1)).toFixed(2)+','+
      (top + (1-x.storage/data.capacity)*plotHeight).toFixed(2)).join(' ');
    tag('path',{d,fill:'none',stroke:colors[$('mode').value]||colors.even,'stroke-width':2.8,'stroke-linejoin':'round'});
    data.trace.forEach((p,i)=>{
      if(p.shortage < 1e-8) return;
      const x=left+i*plotWidth/Math.max(1,data.trace.length-1);
      tag('circle',{cx:x,cy:h-bottom+1,r:2.0,fill:'#ffce7c'});
    });
    tag('title',{}).textContent = fmt(data.days)+'日のタンク残量。最終貯水量 '+fmt(data.endStorage,1)+'L。';
  }
  function showResult() {
    if (!lastConfig || !lastComparison) return;
    const cfg=lastConfig, mode=$('mode').value;
    const days=importedDays || C.buildSyntheticDays(cfg.year,cfg.rain,mode);
    const result=C.simulate(days,cfg,cfg.capacity);
    $('coverage').textContent=fmt(result.coverage,1)+'%';
    $('shortageDays').textContent=fmt(result.shortageDays)+'日';
    $('overflow').textContent=fmt(result.overflow)+' L';
    $('longest').textContent=fmt(result.longestShort)+'日';
    $('scenarioLabel').textContent=fmt(cfg.capacity)+' L × '+(importedDays?'実測CSV':C.MODES.find(x=>x.id===mode).label);
    $('chartNote').textContent='日末残量。年間降水量 '+fmt(result.totalRain,1)+' mm、年間需要 '+fmt(result.need)+' L、雨水供給 '+fmt(result.served)+' L。各日は流入 → 溢水 → 使用の順。';
    drawChart(result);
    const tbody=$('compareBody');tbody.replaceChildren();
    const observed=!!importedDays;
    const headings=document.querySelectorAll('.table-wrap th');
    headings[1].textContent=observed?'実測CSV':'毎日分散';
    headings[2].textContent=observed?'—':'月４回';
    headings[3].textContent=observed?'—':'月２回';
    lastComparison.byCapacity.forEach(record=>{
      const tr=document.createElement('tr');
      if(record.capacity===cfg.capacity) tr.className='highlight';
      const cells=[fmt(record.capacity)+' L',
        observed?fmt(record.scenarios.observed.coverage,1)+'%':fmt(record.scenarios.even.coverage,1)+'%',
        observed?'—':fmt(record.scenarios.weekly.coverage,1)+'%',
        observed?'—':fmt(record.scenarios.burst.coverage,1)+'%',
        fmt(record.worst,1)+'%',fmt(record.maxShortageDays)+'日'];
      cells.forEach((value,i)=>{const td=document.createElement('td');td.textContent=value;tr.append(td);});
      tr.title='クリックすると '+fmt(record.capacity)+' Lを詳細表示';
      tr.style.cursor='pointer';
      tr.addEventListener('click',()=>{$('capacity').value=record.capacity;calculate(false);});
      tbody.append(tr);
    });
    const spread=Math.max(...lastComparison.byCapacity.map(x=>x.best-x.worst));
    $('comparisonNote').textContent=observed
      ? '実測日別CSVの1系列による比較です。降雨のタイミングはCSVに記録された値を使用します。'
      : '同じ月間降水量でも、比較候補の中でカバー率に最大 '+fmt(spread,1)+' ポイントの差があります。3種類の降り方は仮定です。';
  }
  function calculate(save=true) {
    try {
      const cfg=readConfig();
      if (importedDays && importedDays.length !== (C.isLeap(cfg.year)?366:365)) {
        throw new Error('CSV読込後に年が変更されました。CSVを解除して再入力してください。');
      }
      lastConfig=cfg;lastComparison=C.compare(cfg,importedDays);
      if(save) persist(cfg);
      showResult();setStatus('試算を更新しました。');
      return true;
    } catch(e) {setStatus(e.message,true);return false;}
  }
  function saveFile(name,content,type) {
    const blob=new Blob(['\uFEFF',content],{type});
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a'); link.href=url;link.download=name;
    document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),3000);
  }
  async function importCSV(file) {
    try {
      if(!file || file.size>100000) throw new Error('CSVは100KB以内にしてください。');
      const cfg=readConfig();const days=C.parseDailyCSV(await file.text(),cfg.year);
      useImported(days,file.name);
      calculate();setStatus(fmt(days.length)+'日分のCSVを読み込みました。');
    }catch(e){setStatus(e.message,true);$('csvFile').value='';}
  }
  async function importJSON(file) {
    try{
      if(!file || file.size>120000) throw new Error('JSONは120KB以内にしてください。');
      const data=JSON.parse(await file.text());
      if(!data || data.format!=='amedame-v1') throw new Error('あめだめの設定JSONではありません。');
      const cfg=C.validateConfig(data.config);
      let days=null;
      if(data.dailyRain != null){
        if(!Array.isArray(data.dailyRain)) throw new Error('日別データが不正です。');
        const csv='date,rain_mm\n'+data.dailyRain.map(d=>{
          if(!d || typeof d.date!=='string') throw new Error('日別データが不正です。');
          return d.date+','+d.rainMm;
        }).join('\n');
        days=C.parseDailyCSV(csv,cfg.year);
      }
      resetImported();applyConfig(cfg);
      if(days) useImported(days,'バックアップより復元');
      calculate();setStatus('設定JSONを復元しました。');
    }catch(e){setStatus(e.message,true);}
  }
  function init() {
    let start={...C.DEFAULTS,rain:[...C.DEFAULTS.rain],candidates:[...C.DEFAULTS.candidates]};
    try {const raw=localStorage.getItem(storageKey);if(raw) start=C.validateConfig(JSON.parse(raw));}
    catch(_){/* invalid storage ignored */}
    applyConfig(start);
    $('mode').addEventListener('change',()=>{if(importedDays)return;calculate();});
    $('runBtn').addEventListener('click',()=>calculate());
    $('sampleBtn').addEventListener('click',()=>{
      Array.from({length:12},(_,i)=>$('rain'+i).value=C.SAMPLE[i]);
      resetImported();calculate();setStatus('架空の例示降水量へ戻しました。');
    });
    $('clearCsvBtn').addEventListener('click',()=>{resetImported();calculate();});
    $('csvFile').addEventListener('change',e=>{if(e.target.files[0])importCSV(e.target.files[0]);});
    $('jsonFile').addEventListener('change',e=>{if(e.target.files[0])importJSON(e.target.files[0]);e.target.value='';});
    $('templateBtn').addEventListener('click',()=>{
      try{const cfg=readConfig();saveFile('amedame-'+cfg.year+'-daily-template.csv',C.templateCSV(cfg.year),'text/csv;charset=utf-8');setStatus('日別CSVひな型を出力しました。');}
      catch(e){setStatus(e.message,true);}
    });
    $('saveBtn').addEventListener('click',()=>{
      if(!calculate())return;
      const data={format:'amedame-v1',config:lastConfig};
      if(importedDays) data.dailyRain=importedDays.map(d=>({date:d.date,rainMm:d.rainMm}));
      saveFile('amedame-settings.json',JSON.stringify(data,null,2),'application/json;charset=utf-8');
      setStatus('設定JSONを保存しました。');
    });
    $('dailyBtn').addEventListener('click',()=>{
      if(!calculate())return;
      const days=importedDays||C.buildSyntheticDays(lastConfig.year,lastConfig.rain,$('mode').value);
      const result=C.simulate(days,lastConfig);
      saveFile('amedame-'+lastConfig.year+'-'+$('mode').value+'.csv',C.toCSV(result.trace),'text/csv;charset=utf-8');
      setStatus('日別結果CSVを保存しました。');
    });
    $('printBtn').addEventListener('click',()=>{if(calculate())window.print();});
    $('resetBtn').addEventListener('click',()=>{
      resetImported();applyConfig({...C.DEFAULTS,rain:[...C.DEFAULTS.rain],candidates:[...C.DEFAULTS.candidates]});
      calculate();setStatus('初期設定へ戻しました。');
    });
    numericFields.forEach(id=>$(id).addEventListener('change',()=>calculate()));
    $('candidates').addEventListener('change',()=>calculate());
    for(let i=0;i<12;i++)$('rain'+i).addEventListener('change',()=>{if(!importedDays)calculate();});
    calculate(false);
  }
  document.addEventListener('DOMContentLoaded',init);
})();
