/* JISA-TENBIN interactive UI: no network, no third-party dependencies. */
(() => {
  'use strict';
  const E=window.JisaEngine;
  const $=id=>document.getElementById(id);
  const STORAGE='jisatenbin.config.v1';
  const zones=E.ZONES;
  let config, computed, selectedPlan='rotate', selectedMinute=null, toastTimer;
  const escape=s=>String(s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const round=n=>Number(n).toFixed(1);
  const options=(value,extra=false)=>{
    const z=extra && !zones.includes(value)?[value,...zones]:zones;
    return z.map(v=>`<option value="${escape(v)}" ${v===value?'selected':''}>${escape(v.replaceAll('_',' '))}</option>`).join('');
  };
  const clockOptions=value=>{
    const minutes=[];for(let i=0;i<=48;i++)minutes.push(i*30);
    return minutes.map(n=>`<option value="${n}" ${n===value?'selected':''}>${E.timeLabel(n)}</option>`).join('');
  };
  function load() {
    try {
      const raw=JSON.parse(localStorage.getItem(STORAGE)||'null');
      if(raw && !E.validate(raw).length) return raw;
    } catch(e) { /* private mode / corrupt saved state */ }
    return E.defaultConfig();
  }
  function save(){try{localStorage.setItem(STORAGE,JSON.stringify(config));}catch(e){ /* not persistent if storage blocked */ }}
  function toast(s){const t=$('toast');t.textContent=s;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2800)}
  function syncSettings() {
    $('meeting-date').value=config.date;
    $('weeks').value=String(config.weeks);
    $('duration').value=String(config.duration);
    $('anchor').innerHTML=options(config.anchor,true);
    $('people-count').textContent=`${config.people.length} / 8 拠点`;
    $('add-person').disabled=config.people.length>=8;
  }
  function renderPeople(){
    $('people').innerHTML=config.people.map((p,i)=>`<article class="person" data-person="${i}">
      <div class="person-top"><strong><span class="person-number">${String(i+1).padStart(2,'0')}</span>${escape(p.name)}</strong><button type="button" class="remove" data-remove="${i}" aria-label="${escape(p.name)} を削除" ${config.people.length<=2?'disabled':''}>✕ 削除</button></div>
      <div class="person-grid"><label>拠点名<input data-i="${i}" data-field="name" type="text" maxlength="35" value="${escape(p.name)}"></label>
      <label>タイムゾーン<input data-i="${i}" data-field="zone" list="zones" type="text" spellcheck="false" value="${escape(p.zone)}"></label>
      <div class="work-hours wide"><label>現地の勤務開始<select data-i="${i}" data-field="start">${clockOptions(p.start)}</select></label><label>現地の勤務終了<select data-i="${i}" data-field="end">${clockOptions(p.end)}</select></label></div>
      <label class="wide">過去の累積負担点 <span class="history-hint">0〜100 · 自己申告値</span><input data-i="${i}" data-field="history" type="number" min="0" max="100" step="0.5" value="${escape(p.history)}"></label></div></article>`).join('');
    $('people-count').textContent=`${config.people.length} / 8 拠点`;
    $('add-person').disabled=config.people.length>=8;
  }
  function plan(){return computed?.results?.find(p=>p.id===selectedPlan)||computed?.results?.[0];}
  function renderStrategies(){
    $('strategy-cards').innerHTML=computed.results.map((p,i)=>`<button type="button" class="strategy ${p.id===selectedPlan?'active':''}" data-plan="${p.id}" aria-pressed="${p.id===selectedPlan}"><span class="rank">PLAN ${String(i+1).padStart(2,'0')}</span><strong>${p.name}</strong><span class="value">${round(p.metrics.max)}</span><small>最大累積負担点</small></button>`).join('');
  }
  function renderBurden(p){
    const max=Math.max(1,...p.metrics.totals);
    $('burden-bars').innerHTML=config.people.map((person,i)=>{
      const past=person.history, added=p.metrics.added[i],total=p.metrics.totals[i];
      return `<div class="burden-item"><div class="burden-label"><strong>${escape(person.name)}</strong><span>過去 ${round(past)} + 今回 ${round(added)} = <b>${round(total)}</b></span></div><div class="track" aria-label="${escape(person.name)} 負担点 ${round(total)}"><div class="past" style="width:${past/max*100}%"></div><div class="current" style="width:${added/max*100}%"></div></div></div>`;
    }).join('');
  }
  function renderWeeks(p){
    $('week-table').querySelector('thead').innerHTML=`<tr><th>週 / ${escape(config.anchor.split('/').pop().replaceAll('_',' '))}</th>${config.people.map(a=>`<th>${escape(a.name)}</th>`).join('')}</tr>`;
    $('week-table').querySelector('tbody').innerHTML=p.slots.map((s,w)=>`<tr><td>W${String(w+1).padStart(2,'0')}<div class="cell-bottom">${escape(E.localLabel(s.utcStart,config.anchor).replace(' ','　'))}</div></td>${s.detail.map((d,i)=>`<td><div class="time-line ${d.outsideMinutes>0?'cell-outside':'cell-ok'}">${d.outsideMinutes>0?'●':'✓'} ${escape(d.local.slice(11))}</div><div class="cell-bottom">${escape(d.local.slice(5,10))} · 負担 ${round(d.points)}</div>${p.transitions[w]?.includes(i)?'<span class="dst">夏時間の切替</span>':''}</td>`).join('')}</tr>`).join('');
  }
  function renderDetail(){
    const p=plan();if(!p)return;
    $('selected-title').textContent=p.name;
    $('selected-description').textContent=p.desc;
    const min=Math.min(...computed.results.map(x=>x.metrics.max));
    $('best-tag').hidden=p.metrics.max>min+1e-8;
    $('metrics').innerHTML=[['最も負担の重い拠点',p.metrics.max,'primary'],['今回のチーム総負担',p.metrics.totalAdded,''],['拠点間の累積格差',p.metrics.gap,'']]
      .map(([label,value,cls])=>`<div class="metric ${cls}"><strong>${round(value)}</strong><span>${label}</span></div>`).join('');
    renderBurden(p);renderWeeks(p);
  }
  function renderSlots(){
    const sorted=computed.candidates.slice().sort((a,b)=>a.minute-b.minute);
    const values=sorted.map(c=>c.sum);
    const min=Math.min(...values),max=Math.max(...values);
    $('slots').innerHTML=sorted.map(s=>{
      const ratio=(s.sum-min)/Math.max(.01,max-min);
      const cls=ratio<.35?'good':ratio<.7?'mid':'bad';
      return `<button type="button" class="slot ${cls} ${s.minute===selectedMinute?'active':''} ${s.minute===config.pinnedMinute?'pinned':''}" data-minute="${s.minute}" title="${E.timeLabel(s.minute)} / チーム合計負担 ${round(s.sum)}" aria-pressed="${s.minute===selectedMinute}">${E.timeLabel(s.minute)}</button>`;
    }).join('');
    const s=sorted.find(x=>x.minute===selectedMinute)||sorted[0];if(!s)return;
    $('slot-preview').innerHTML=`<strong>${E.timeLabel(s.minute)} 開始 · チーム負担 ${round(s.sum)} 点</strong><p>${s.detail.map((d,i)=>`${escape(config.people[i].name)} ${escape(d.local.slice(11))}（${round(d.points)}点）`).join(' / ')}</p>`;
    $('pin-slot').disabled=config.pinnedMinute===s.minute;
    $('clear-pin').disabled=config.pinnedMinute===null;
  }
  function recalc(){
    save();computed=E.build(config);
    $('errors').hidden=!computed.errors.length;
    if(computed.errors.length) {
      $('errors').textContent=computed.errors.join('。');
      $('strategy-cards').innerHTML=''; $('slots').innerHTML='';
      $('selected-title').textContent='条件を確認してください'; $('selected-description').textContent='設定を修正すると再計算します';
      $('metrics').innerHTML='';$('burden-bars').innerHTML='';
      $('week-table').querySelector('thead').innerHTML='';$('week-table').querySelector('tbody').innerHTML='';
      $('slot-preview').textContent='';return;
    }
    if(!computed.candidates.some(s=>s.minute===selectedMinute)) selectedMinute=computed.chosenMinute;
    renderStrategies();renderDetail();renderSlots();
  }
  function download(filename,body,mime) {
    const blob=new Blob([body],{type:mime});const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),4000);toast(`${filename} を出力しました`);
  }
  function summaryText(){
    const p=plan();const lines=[`時差てんびん｜${p.name}`,`最大累積負担 ${round(p.metrics.max)}点 / 今回の総負担 ${round(p.metrics.totalAdded)}点`,`※ 会議時刻はUTC基準で厳密に記載。カレンダー予定の重複や祝日は未確認。`];
    p.slots.forEach((s,w)=>lines.push(`${w+1}週目 ${new Date(s.utcStart).toISOString().replace('.000Z','Z')} ｜ ${config.people.map((person,i)=>`${person.name}: ${s.detail[i].local}`).join(' / ')}`));
    return lines.join('\n');
  }
  function initEvents(){
    for(const [id,key,parse] of [['meeting-date','date',String],['weeks','weeks',Number],['duration','duration',Number],['anchor','anchor',String]]){
      $(id).addEventListener('change',()=>{config[key]=parse($(id).value);recalc();});
    }
    $('people').addEventListener('change',e=>{
      const input=e.target;const i=Number(input.dataset.i),field=input.dataset.field;
      if(!field || !Number.isInteger(i) || !config.people[i])return;
      config.people[i][field]=['start','end','history'].includes(field)?Number(input.value):input.value.trim();
      if(field==='name')renderPeople();recalc();
    });
    $('people').addEventListener('click',e=>{
      const button=e.target.closest('[data-remove]');if(!button||config.people.length<=2)return;
      config.people.splice(Number(button.dataset.remove),1);renderPeople();recalc();
    });
    $('add-person').addEventListener('click',()=>{
      if(config.people.length>=8)return;
      config.people.push({name:`拠点${config.people.length+1}`,zone:'Asia/Singapore',start:540,end:1080,history:0});renderPeople();recalc();toast('拠点を追加しました');
    });
    $('reset').addEventListener('click',()=>{
      if(!window.confirm('入力内容を消してデモの条件に戻しますか？'))return;
      config=E.defaultConfig();selectedMinute=null;syncSettings();renderPeople();recalc();toast('デモの条件に戻しました');
    });
    $('strategy-cards').addEventListener('click',e=>{
      const btn=e.target.closest('[data-plan]');if(!btn)return;
      selectedPlan=btn.dataset.plan;renderStrategies();renderDetail();
    });
    $('slots').addEventListener('click',e=>{
      const btn=e.target.closest('[data-minute]');if(!btn)return;
      selectedMinute=Number(btn.dataset.minute);renderSlots();
    });
    $('pin-slot').addEventListener('click',()=>{config.pinnedMinute=selectedMinute;recalc();toast('固定開催時刻の基準に設定しました');});
    $('clear-pin').addEventListener('click',()=>{config.pinnedMinute=null;selectedMinute=null;recalc();toast('自動選定へ戻しました');});
    $('export-ics').addEventListener('click',()=>{if(plan())download('jisatenbin-meetings.ics',E.toICS(config,plan()),'text/calendar;charset=utf-8');});
    $('export-csv').addEventListener('click',()=>{if(plan())download('jisatenbin-plan.csv',E.toCSV(config,plan()),'text/csv;charset=utf-8');});
    $('copy-summary').addEventListener('click',async()=>{
      if(!plan())return;
      const s=summaryText();
      try{await navigator.clipboard.writeText(s);toast('予定の一覧をコピーしました');}
      catch(e){const area=document.createElement('textarea');area.value=s;document.body.appendChild(area);area.select();const ok=document.execCommand('copy');area.remove();toast(ok?'予定の一覧をコピーしました':'コピーできませんでした。CSV出力をご利用ください');}
    });
    $('export-json').addEventListener('click',()=>download('jisatenbin-config.json',JSON.stringify({schema:1,...config},null,2)+'\n','application/json;charset=utf-8'));
    $('import-json').addEventListener('click',()=>$('import-file').click());
    $('import-file').addEventListener('change',async e=>{
      const f=e.target.files?.[0];if(!f)return;
      try{
        if(f.size>100000)throw new Error('100KB以内のJSONにしてください');
        const raw=JSON.parse(await f.text());
        const candidate={date:raw.date,weeks:raw.weeks,duration:raw.duration,anchor:raw.anchor,pinnedMinute:raw.pinnedMinute??null,people:raw.people};
        const errors=E.validate(candidate);if(errors.length)throw new Error(errors.join('。'));
        config=candidate;selectedMinute=null;syncSettings();renderPeople();recalc();toast('設定を復元しました');
      }catch(err){toast(`復元できません: ${err.message}`);}finally{e.target.value='';}
    });
  }
  function init(){
    config=load();$('zones').innerHTML=zones.map(z=>`<option value="${escape(z)}"></option>`).join('');
    syncSettings();renderPeople();initEvents();recalc();
  }
  init();
})();