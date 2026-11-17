/* 時差の借り — browser UI, no external requests. */
(() => {
  'use strict';
  const E = window.JisaEngine;
  const $ = id => document.getElementById(id);
  const STORAGE_KEY = 'jisa-no-kari-v1';
  const clone = x => JSON.parse(JSON.stringify(x));
  const todayTokyo = () => E.parts(Date.now(),'Asia/Tokyo').date;
  const initial = () => ({date:todayTokyo(),weeks:4,duration:60,baseId:'t',people:clone(E.DEFAULTS)});
  let config = initial();
  let result = null;
  let active = 'comfort';
  const escapeHtml = text => String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const opts = E.ZONES.map(z=>`<option value="${escapeHtml(z.zone)}">${escapeHtml(z.label)} · ${escapeHtml(z.zone)}</option>`).join('');
  function status(message,error=false) {const el=$('status');el.textContent=message;el.classList.toggle('error',error);}
  function selectBase() {
    const options=config.people.map(p=>`<option value="${escapeHtml(p.id)}">${escapeHtml(p.label)}</option>`).join('');
    $('base').innerHTML=options;
    $('base').value=config.baseId;
  }
  function renderInputs() {
    $('people').innerHTML=config.people.map(p=>`<div class="fieldrow" data-id="${escapeHtml(p.id)}">
      <input aria-label="拠点名" data-key="label" value="${escapeHtml(p.label)}" maxlength="40">
      <select aria-label="タイムゾーン" data-key="zone">${opts}</select>
      <input aria-label="勤務開始・24時間表記" data-key="start" type="text" inputmode="numeric" maxlength="5" placeholder="09:00" value="${escapeHtml(p.start)}">
      <input aria-label="勤務終了・24時間表記" data-key="end" type="text" inputmode="numeric" maxlength="5" placeholder="18:00" value="${escapeHtml(p.end)}">
      <button class="remove" data-remove="${escapeHtml(p.id)}" aria-label="${escapeHtml(p.label)}を削除" ${config.people.length<=2?'disabled':''}>×</button>
    </div>`).join('');
    $('people').querySelectorAll('[data-id]').forEach(row=>{
      const p=config.people.find(x=>x.id===row.dataset.id);
      row.querySelector('[data-key="zone"]').value=p.zone;
    });
    $('add').disabled=config.people.length>=6;
    selectBase();
  }
  function renderControls() {
    $('date').value=config.date;$('weeks').value=config.weeks;$('duration').value=config.duration;
    renderInputs();
  }
  function captureControls() {
    config.date=$('date').value;
    config.weeks=Number($('weeks').value);
    config.duration=Number($('duration').value);
    config.baseId=$('base').value;
    config.people.forEach(p=>{
      const row=[...$('people').querySelectorAll('[data-id]')].find(e=>e.dataset.id===p.id);
      if(row) ['label','zone','start','end'].forEach(key=>p[key]=row.querySelector(`[data-key="${key}"]`).value);
    });
  }
  function compute(){
    try {
      captureControls();
      result=E.build(config);
      renderResults();
      status(`${config.weeks}回分・${config.people.length}拠点の候補を計算しました。`);
      return true;
    } catch(err){result=null;clearResults();status(err.message,true);return false;}
  }
  function clearResults(){
    $('comfortTotal').textContent='—';$('fairMax').textContent='—';
    $('scheduleArea').innerHTML='<div class="empty">条件を確認して再計算してください。</div>';
    $('bars').innerHTML='<div class="empty">計算待ち</div>';
    ['exportIcs','exportCsv','copy'].forEach(x=>$(x).disabled=true);
  }
  function renderResults(){
    if (!result) return;
    $('comfortTotal').textContent=result.comfort.total.toFixed(1)+' 点';
    $('fairMax').textContent=result.fair.max.toFixed(1)+' 点';
    $('comfortSummary').textContent=`最大個人負担 ${result.comfort.max.toFixed(1)}点 · 偏り ${result.comfort.range.toFixed(1)}点`;
    $('fairSummary').textContent=`総負担 ${result.fair.total.toFixed(1)}点 · 偏り ${result.fair.range.toFixed(1)}点`;
    ['comfort','fair'].forEach(k=>{
      $('tab'+(k==='comfort'?'Comfort':'Fair')).classList.toggle('active',active===k);
      $('tab'+(k==='comfort'?'Comfort':'Fair')).setAttribute('aria-pressed',active===k?'true':'false');
      $(k+'Metric').classList.toggle('selected',active===k);
    });
    const plan=result[active];
    $('planLabel').textContent=active==='comfort'?'総負担を抑える案':'偏りを抑える案';
    const heading=config.people.map(p=>`<th>${escapeHtml(p.label)}</th>`).join('');
    const rows=plan.slots.map((slot,i)=>{
      const cells=config.people.map((p,k)=>{
        const s=E.parts(slot.utc,p.zone), e=E.parts(slot.utc+config.duration*60000,p.zone);
        const burden=slot.costs[k];
        let info='勤務内';
        if (burden.weekendMinutes) info='週末を含む';
        else if(burden.nightMinutes) info='深夜を含む';
        else if(burden.outMinutes) info='勤務外あり';
        return `<td><strong>${escapeHtml(s.time)}–${escapeHtml(e.time)}</strong><span class="timeinfo">${escapeHtml(s.date)} ${s.weekday}</span><span class="${burden.outMinutes||burden.weekendMinutes?'pain':'good'}">${info} · ${burden.cost.toFixed(1)}点</span></td>`;
      }).join('');
      return `<tr><td><b>${i+1}回目</b><span class="timeinfo">${escapeHtml(E.parts(slot.utc,config.people.find(p=>p.id===config.baseId).zone).date)}</span></td>${cells}</tr>`;
    }).join('');
    $('scheduleArea').innerHTML=`<table><thead><tr><th>週</th>${heading}</tr></thead><tbody>${rows}</tbody></table>`;
    const max=Math.max(1,...plan.totals.map(x=>x.cost));
    $('bars').innerHTML=plan.totals.map(x=>`<div class="burdenrow"><div class="bar-label"><b>${escapeHtml(x.label)}</b><span>${x.cost.toFixed(1)} 点</span></div><div class="bar"><span class="${x.cost>=max*.85?'high':''}" style="width:${Math.max(0,100*x.cost/max).toFixed(1)}%"></span></div><div class="hint">勤務外 ${x.outMinutes}分 · 深夜 ${x.nightMinutes}分 · 週末 ${x.weekendMinutes}分</div></div>`).join('');
    ['exportIcs','exportCsv','copy'].forEach(x=>$(x).disabled=false);
  }
  function download(name,content,type){
    const url=URL.createObjectURL(new Blob([content],{type}));
    const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
  }
  $('people').addEventListener('change',evt=>{
    const row=evt.target.closest('[data-id]');if(!row)return;
    captureControls();selectBase();
    status('条件を変更しました。「候補を計算する」で再計算してください。');
  });
  $('people').addEventListener('click',evt=>{
    const rm=evt.target.closest('[data-remove]');if(!rm)return;
    captureControls(); if(config.people.length<=2)return;
    config.people=config.people.filter(x=>x.id!==rm.dataset.remove);
    if(!config.people.some(p=>p.id===config.baseId)) config.baseId=config.people[0].id;
    renderInputs();compute();
  });
  $('add').addEventListener('click',()=>{
    captureControls();if(config.people.length>=6)return;
    const choices=E.ZONES.filter(z=>!config.people.some(p=>p.zone===z.zone));
    const z=choices[0]||E.ZONES[0];
    config.people.push({id:'p'+Date.now().toString(36)+Math.floor(Math.random()*1000),label:z.label,zone:z.zone,start:'09:00',end:'18:00'});
    renderInputs();compute();
  });
  $('calculate').addEventListener('click',compute);
  $('reset').addEventListener('click',()=>{
    config=initial();active='comfort';result=null;renderControls();compute();status('初期設定に戻しました（保存済みのデータは維持されます）。');
  });
  $('tabComfort').addEventListener('click',()=>{active='comfort';renderResults();});
  $('tabFair').addEventListener('click',()=>{active='fair';renderResults();});
  $('save').addEventListener('click',()=>{
    try{captureControls();E.validate(config);localStorage.setItem(STORAGE_KEY,JSON.stringify(config));
      download('jisa-no-kari-settings.json',JSON.stringify(config,null,2),'application/json;charset=utf-8');
      status('設定を端末に保存し、JSONをダウンロードしました。');
    }catch(err){status('設定を保存できません: '+err.message,true);}
  });
  $('import').addEventListener('click',()=>{$('importFile').click();});
  $('importFile').addEventListener('change',async evt=>{
    const file=evt.target.files?.[0];if(!file)return;
    try{
      if(file.size>100000) throw new Error('設定ファイルが大きすぎます。');
      const parsed=JSON.parse(await file.text());E.validate(parsed);
      config=clone(parsed);result=null;renderControls();compute();status('JSON設定を読み込みました。');
    }catch(err){status('読込失敗: '+err.message,true);}
    evt.target.value='';
  });
  $('exportIcs').addEventListener('click',()=>{
    if(!result)return;download('jisa-no-kari-'+active+'.ics',E.ics(result[active],config),'text/calendar;charset=utf-8');
    status('ICSを出力しました。カレンダーへの取り込みは各自で行ってください。');
  });
  $('exportCsv').addEventListener('click',()=>{
    if(!result)return;download('jisa-no-kari-'+active+'.csv',E.csv(result[active],config),'text/csv;charset=utf-8');
    status('CSVを出力しました。');
  });
  $('copy').addEventListener('click',async()=>{
    if(!result)return;
    const text=E.proposal(result[active],config);
    try{await navigator.clipboard.writeText(text);status('現地時間入りの案内文をコピーしました。');}
    catch(err){
      const area=document.createElement('textarea');area.value=text;area.style.position='fixed';area.style.top='0';
      document.body.appendChild(area);area.select();const ok=document.execCommand('copy');area.remove();
      status(ok?'案内文をコピーしました。':'コピーできませんでした。ブラウザの権限をご確認ください。',!ok);
    }
  });
  try {
    const saved=localStorage.getItem(STORAGE_KEY);
    if(saved){const obj=JSON.parse(saved);E.validate(obj);config=obj;}
  }catch(err){ /* corrupted local state must never block launch */ }
  renderControls();compute();
})();
