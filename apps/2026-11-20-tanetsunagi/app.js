/* Browser UI for TANE TSUNAGI. All data remains on this device. */
(() => {
  'use strict';
  const E=window.SeedEngine;
  const storageKey='tane-tsunagi-v1';
  const $=id=>document.getElementById(id);
  const safe=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  let config=E.clone(E.DEMO), result=null;
  try {const prev=localStorage.getItem(storageKey);if(prev) config=E.normalise(JSON.parse(prev));}catch(e){console.warn('保存情報の読込みはスキップ:',e.message);}
  const persist=()=>{try {localStorage.setItem(storageKey,JSON.stringify(config));}catch(e){console.warn('端末保存できません:',e.message);}};
  function warning(message){const b=$('errorBanner');b.textContent=message;b.hidden=!message;}
  function download(filename,body,type) {
    const url=URL.createObjectURL(new Blob([body],{type}));
    const a=document.createElement('a');a.href=url;a.download=filename;a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  const prettyDate=week=>{const d=E.dateFor(config.startDate,week);return `${Number(d.slice(5,7))}/${Number(d.slice(8,10))}`;};
  const option=(value,label,selected)=>`<option value="${safe(value)}" ${String(selected)===String(value)?'selected':''}>${safe(label)}</option>`;
  function paintSettings(){
    ['startDate','weeks','capacity','target'].forEach(k=>{$(k).value=config[k];});
    document.querySelectorAll('[data-mode]').forEach(b=>{const active=b.dataset.mode===config.mode;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
  }
  function cropInput(c,field,label,min,max) {
    return `<label>${label}<input class="crop-input" data-crop="${safe(c.id)}" data-field="${safe(field)}" type="number" min="${min}" max="${max}" value="${c[field]}" aria-label="${safe(c.name)} ${label}"></label>`;
  }
  function paintCrops(){
    $('cropList').innerHTML=config.crops.map(c=>`<div class="crop-card">
      <div class="crop-head"><span class="color-dot" style="background:${c.color}"></span><input type="text" maxlength="32" data-crop="${safe(c.id)}" data-field="name" aria-label="作物名" value="${safe(c.name)}"><button type="button" class="icon-btn" data-remove-crop="${safe(c.id)}" title="この作物を削除" aria-label="${safe(c.name)}を削除">×</button></div>
      <div class="crop-fields">${cropInput(c,'lead','育成 週',1,12)}${cropInput(c,'harvest','収穫 週',1,8)}${cropInput(c,'units','占有 枠',1,config.capacity)}${cropInput(c,'yield','週量',1,12)}${cropInput(c,'sowStart','開始週',0,config.weeks-1)}${cropInput(c,'sowEnd','終了週',0,config.weeks-1)}${cropInput(c,'maxBatches','播種上限',1,16)}</div></div>`).join('');
    $('cropCount').textContent=`${config.crops.length} / 8`;
    $('addCrop').disabled=config.crops.length>=8;
  }
  function paintPins(){
    const currentCrop=$('pinCrop').value,currentWeek=$('pinWeek').value;
    $('pinCrop').innerHTML=config.crops.map(c=>option(c.id,c.name,currentCrop||config.crops[0].id)).join('');
    $('pinWeek').innerHTML=Array.from({length:config.weeks},(_,w)=>option(w,`${w+1}週目 · ${prettyDate(w)}`,currentWeek||'0')).join('');
    $('pinnedList').innerHTML=config.pinned.length ? config.pinned.map((p,i)=>{
      const crop=config.crops.find(c=>c.id===p.cropId);
      return `<div class="pin-tag">● ${safe(crop?.name||p.cropId)} · ${prettyDate(p.week)}<button data-remove-pin="${i}" aria-label="固定を解除" title="固定を解除">×</button></div>`;
    }).join(''):'<p class="hint">固定した予定はありません。</p>';
  }
  function statCard(value,unit,label,note,accent){return `<div class="stat ${accent?'accent':''}"><div class="value">${value}<small>${unit}</small></div><div class="label">${label}</div><div class="note">${note}</div></div>`;}
  function paintStats(){const s=result.stats;
    $('stats').innerHTML=statCard(s.coverage,'%','収穫充足率','目標に対して満たした予定量',true)+
      statCard(s.met,` / ${config.weeks}週`,'目標に届く週','実測ではなく入力値からの試算',false)+
      statCard(result.selected.length,'回','計画した種まき','うち固定 '+config.pinned.length+' 回',false)+
      statCard(s.shortages,'単位','収穫の不足分','計画期間の合計',false);
    const gaps=s.supply.map((v,i)=>v<config.target?i:-1).filter(i=>i>=0);
    $('summary').textContent=gaps.length===0?'すべての週で目標を達成する計画です。現地条件による収量の変化には注意してください。':
      `${gaps.length}週は目標未達です（例：${gaps.slice(0,4).map(i=>prettyDate(i)).join('、')}${gaps.length>4?' ほか':''}）。枠数、作物の育成・収穫期間、種まき可能週を調整すると改善する可能性があります。`;
  }
  function paintChart(){
    const s=result.stats,H=config.weeks,plotW=Math.max(700,H*46),L=46,R=20,T=19,B=39;
    const height=245,chartH=height-T-B, width=plotW+L+R;
    const max=Math.max(config.target,...s.supply,1), top=Math.ceil(max*1.15),dy=chartH/top;
    let str=`<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="週別の推定収穫量。目標 ${config.target} 単位。充足率 ${s.coverage}%"><title>週別の収穫予定量</title>`;
    for(let v=0;v<=top;v+=Math.max(1,Math.ceil(top/4))){const y=T+chartH-v*dy;str+=`<line x1="${L}" x2="${width-R}" y1="${y}" y2="${y}" stroke="#e6eee3"/><text x="${L-11}" y="${y+4}" text-anchor="end" fill="#95a79b" font-size="11">${v}</text>`;}
    const goalY=T+chartH-config.target*dy;
    str+=`<line x1="${L}" x2="${width-R}" y1="${goalY}" y2="${goalY}" stroke="#d39d58" stroke-dasharray="6 5" stroke-width="2"/>`;
    for(let w=0;w<H;w++){
      const mid=L+(w+.5)*plotW/H,barWidth=Math.max(13,plotW/H*.53);
      let base=T+chartH;
      for(const crop of config.crops){const val=s.breakdown[w][crop.id]||0;if(!val)continue;
        const h=val*dy;base-=h;
        str+=`<rect x="${mid-barWidth/2}" y="${base}" width="${barWidth}" height="${h}" fill="${crop.color}" rx="2"><title>${safe(crop.name)}: ${val} 単位</title></rect>`;
      }
      str+=`<text x="${mid}" y="${height-15}" text-anchor="middle" fill="#879a88" font-size="10">${prettyDate(w)}</text>`;
    }
    str+='</svg>';
    $('harvestChart').innerHTML=str;
  }
  function paintTimeline(){
    const s=result.stats,H=config.weeks;
    const header=`<thead><tr><th>作物 / 週</th>${Array.from({length:H},(_,w)=>`<th title="第${w+1}週">${prettyDate(w)}</th>`).join('')}</tr></thead>`;
    const rows=config.crops.map(c=>{
      const picks=result.selected.filter(p=>p.cropId===c.id);
      const tds=Array.from({length:H},(_,w)=>{
        let growing=0,harvesting=0,sowing=false;
        for(const p of picks){const from=p.week+c.lead,to=from+c.harvest;
          if(w===p.week)sowing=true;
          if(w>=p.week&&w<from)growing++;
          if(w>=from&&w<to)harvesting++;
        }
        const cls=harvesting?'harvest':growing?'grow':'';
        const text=sowing?'<span class="seed-symbol">●</span>':harvesting?harvesting>1?`${harvesting}`:'✓':growing?'·':'';
        const title=`${c.name} ${prettyDate(w)}：${harvesting?'収穫期':growing?'育成中':'空き'}${sowing?' / 播種':''}`;
        return `<td class="${cls}" style="--fill:${c.color};--light:${c.color}47" title="${safe(title)}">${text}</td>`;
      }).join('');
      return `<tr><th class="crop-name"><span style="background:${c.color}"></span>${safe(c.name)}</th>${tds}</tr>`;
    }).join('');
    $('timeline').innerHTML=`<table class="timeline-table" aria-label="作物別占有・収穫カレンダー">${header}<tbody>${rows}</tbody></table>`;
    const maxUse=Math.max(...s.used);
    $('capacityChart').innerHTML=`<span class="capacity-note">枠の占有</span><div class="capacity-track">${s.used.map((v,w)=>`<span title="${prettyDate(w)}: ${v}/${config.capacity}枠"><b style="width:${100*v/config.capacity}%"></b></span>`).join('')}</div><span class="capacity-note">最大 ${maxUse}/${config.capacity} 枠</span>`;
  }
  function paintTasks(){
    $('taskList').innerHTML=result.selected.length ? result.selected.slice().sort((a,b)=>a.week-b.week).slice(0,8).map(p=>{
      const c=config.crops.find(c=>c.id===p.cropId);
      const pinned=config.pinned.some(x=>x.cropId===p.cropId&&x.week===p.week);
      return `<div class="task"><div class="task-date">${prettyDate(p.week)}</div><div><div class="task-name">${safe(c.name)}を播く ${pinned?'🔒':''}</div><div class="task-sub">${c.units}枠使用 · ${prettyDate(p.week+c.lead)}ごろから収穫</div></div></div>`;
    }).join(''):'<p class="hint">条件に合う種まき候補がありません。</p>';
  }
  function render(){
    paintSettings();paintCrops();paintPins();
    try {result=E.plan(config);warning('');paintStats();paintChart();paintTimeline();paintTasks();}
    catch(e){result=null;warning(e.message);['stats','harvestChart','timeline','capacityChart','taskList','summary'].forEach(k=>$(k).innerHTML='');}
    persist();
  }
  for(const field of ['startDate','weeks','capacity','target'])$(field).addEventListener('change',event=>{config[field]=event.target.value;config=E.normalise(config);render();});
  $('cropList').addEventListener('change',e=>{
    const id=e.target.dataset.crop,field=e.target.dataset.field;
    if(!id||!field)return;
    const crop=config.crops.find(c=>c.id===id);if(!crop)return;
    crop[field]=field==='name'?String(e.target.value).trim().slice(0,32)||'名称未設定':e.target.value;
    config=E.normalise(config);render();
  });
  $('cropList').addEventListener('click',e=>{
    const b=e.target.closest('[data-remove-crop]');if(!b)return;
    if(config.crops.length===1)return warning('作物は1件以上必要です。');
    const id=b.dataset.removeCrop;config.crops=config.crops.filter(c=>c.id!==id);config.pinned=config.pinned.filter(p=>p.cropId!==id);render();
  });
  $('addCrop').addEventListener('click',()=>{
    if(config.crops.length>=8)return;
    const id='user_'+Date.now().toString(36)+'_'+Math.floor(Math.random()*10000).toString(36);
    config.crops.push({id,name:'新しい作物',lead:3,harvest:2,units:1,yield:1,sowStart:0,sowEnd:Math.min(config.weeks-1,12),maxBatches:4});config=E.normalise(config);render();
  });
  $('addPin').addEventListener('click',()=>{
    try {config=E.addPin(config,{cropId:$('pinCrop').value,week:Number($('pinWeek').value)});render();}
    catch(e){warning(e.message);}
  });
  $('pinnedList').addEventListener('click',e=>{
    const b=e.target.closest('[data-remove-pin]');if(!b)return;
    config.pinned.splice(Number(b.dataset.removePin),1);render();
  });
  document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{config.mode=b.dataset.mode;render();}));
  $('downloadJson').addEventListener('click',()=>download('tane-tsunagi-plan.json',JSON.stringify(config,null,2),'application/json;charset=utf-8'));
  $('downloadCsv').addEventListener('click',()=>{if(result)download('tane-tsunagi-sowing.csv',E.exportCsv(result),'text/csv;charset=utf-8');else warning('まず計画の矛盾を解消してください。');});
  $('printPlan').addEventListener('click',()=>window.print());
  $('resetSample').addEventListener('click',()=>{config=E.clone(E.DEMO);render();});
  $('importJson').addEventListener('change',async e=>{
    const file=e.target.files?.[0];if(!file)return;
    try {if(file.size>250000)throw Error('250 KB以下のJSONを選んでください。');
      const loaded=E.normalise(JSON.parse(await file.text()));E.plan(loaded);config=loaded;render();}
    catch(err){warning('読込できません：'+err.message);}finally{e.target.value='';}
  });
  render();
})();
