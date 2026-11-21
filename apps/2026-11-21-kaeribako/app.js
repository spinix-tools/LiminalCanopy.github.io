/* KAERIBAKO browser UI — no network, no dependencies */
(function () {
  'use strict';
  const E = window.KaeribakoEngine;
  const STORAGE = 'kaeribako:settings:v1';
  const WEEKDAYS = ['日','月','火','水','木','金','土'];
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => Number(n).toLocaleString('ja-JP');
  const esc = (value) => String(value).replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  let state;
  let nextId = 1000;
  function load() {
    try {const saved=localStorage.getItem(STORAGE); if(saved) return E.normalize(JSON.parse(saved));}catch(_err){}
    return E.example();
  }
  state = load();
  function save() {
    try{localStorage.setItem(STORAGE,JSON.stringify(state));}catch(_err){ notify('ブラウザへの保存は利用できません。JSONで保存してください。',true); }
  }
  function notify(message, error=false){const el=$('message');el.textContent=message;el.className='status visible'+(error?' error':'');}
  function getOrderValue(rawField, value){
    if(rawField==='name') return String(value).slice(0,36);
    if(rawField==='date') return value;
    return value;
  }
  function fillControls() {
    for(const id of ['startDate','days','initialStock']) $(id).value=state[id];
    for(const id of ['extraStock','returnDaysCut','washDaysCut']) $(id).value=state.whatIf[id];
  }
  function metric(label,number,unit,detail,kind=''){
    return `<article class="metric ${kind==='highlight'?'highlight':''}"><div class="metric-title">${label}</div><div class="metric-number ${kind==='negative'?'negative':kind==='positive'?'positive':''}">${fmt(number)}<small>${unit}</small></div><div class="metric-detail">${detail}</div></article>`;
  }
  function renderResults() {
    const c=E.compare(state), a=c.base,b=c.whatIf;
    $('metrics').innerHTML=[
      metric('現状の欠品見込み',a.totalShortage,'個',a.daysWithShortage+'日で欠品'+(a.firstShortage?' · 初回 '+a.firstShortage:''),a.totalShortage?'negative':'positive'),
      metric('改善案の欠品見込み',b.totalShortage,'個',`${b.daysWithShortage}日で欠品 · 改善案の手元 ${fmt(b.initial)}個`,b.totalShortage?'':'positive'),
      metric('現状で必要な初期在庫',a.requiredStock,'個',`現状の手元より ${fmt(a.additionalNeeded)} 個多く必要`),
      metric('改善案で必要な初期在庫',b.requiredStock,'個',`現在の設定から追加 ${fmt(b.additionalNeeded)} 個で欠品ゼロ`,'highlight')
    ].join('');
    const reduction=a.totalShortage-b.totalShortage;
    $('insight').innerHTML= reduction>=0
      ?`<strong>改善案では欠品 ${fmt(reduction)} 個減</strong>。予定総数 ${fmt(a.totalDemand)} 個に対し、現状の出荷達成率は ${Math.round(a.serviceRate*1000)/10}%、改善案は ${Math.round(b.serviceRate*1000)/10}% です。${b.additionalNeeded?`さらに初期箱数を <strong>${fmt(b.additionalNeeded)} 個</strong>増やすと、この期間の欠品をゼロにできます。`:'この計算期間では欠品ゼロを達成しています。'}`
      :`<strong>改善案のほうが欠品は ${fmt(-reduction)} 個多い</strong>状態です。配送先の優先順位や回収日数を確認してください。`;
    renderChart(a,b);
    $('dayRows').innerHTML=a.records.map((r,i)=>{
      const q=b.records[i];const days=String(r.date.slice(5)).replace('-','/');
      return `<tr><td>${days}（${WEEKDAYS[r.weekday]}）</td><td>${fmt(r.demand)}</td><td>${fmt(r.shipped)}</td><td class="${r.shortage?'short-cell':''}">${fmt(r.shortage)}</td><td>${fmt(r.available)}</td><td class="${q.shortage?'short-cell':''}">${fmt(q.shortage)}</td><td>${fmt(q.available)}</td></tr>`;
    }).join('');
    $('tableHint').textContent=`欠品時は配送先リストの上から出荷します。現状の累積回収見込み損失 ${fmt(a.expectedLoss)} 個／改善案 ${fmt(b.expectedLoss)} 個。回収未到着分は将来の日付に計上します。`;
    return c;
  }
  function renderChart(a,b){
    const width=900,height=280,padL=52,padR=18,padT=23,padB=39, plotH=height-padT-padB,plotW=width-padL-padR;
    const n=a.records.length;
    const maxY=Math.max(10,...a.records.map(x=>x.available),...b.records.map(x=>x.available));
    const maxShort=Math.max(1,...a.records.map(x=>x.shortage));
    const scale=(x)=>padT+plotH-(x/maxY)*(plotH-26);
    const xAt=(i)=>padL+(n===1?0:i/(n-1)*plotW);
    const points=(records)=>records.map((r,i)=>`${xAt(i).toFixed(2)},${scale(r.available).toFixed(2)}`).join(' ');
    let svg=`<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="fillB" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#9ccbed" stop-opacity=".27"/><stop offset="100%" stop-color="#9ccbed" stop-opacity="0"/></linearGradient></defs>`;
    for(let i=0;i<=4;i++) {
      const val=maxY*i/4,y=scale(val);
      svg+=`<line x1="${padL}" x2="${width-padR}" y1="${y}" y2="${y}" stroke="#e6eee6" stroke-width="1"/><text x="${padL-10}" y="${y+4}" text-anchor="end" fill="#82958b" font-size="11">${fmt(Math.round(val))}</text>`;
    }
    a.records.forEach((r,i)=>{
      if(i%7===0 || i===n-1){const x=xAt(i);svg+=`<line x1="${x}" x2="${x}" y1="${padT}" y2="${padT+plotH}" stroke="#e9eee8" stroke-dasharray="3 5"/><text x="${x}" y="${height-11}" text-anchor="middle" font-size="11" fill="#75897e">${r.date.slice(5).replace('-','/')}</text>`;}
      if(r.shortage){const barH=9+Math.round(r.shortage/maxShort*19);svg+=`<rect x="${xAt(i)-Math.min(7,plotW/n/2)}" y="${padT+plotH-barH}" width="${Math.min(14,plotW/n)}" height="${barH}" rx="2" fill="#da7d68" opacity=".88"><title>${r.date} 欠品 ${r.shortage}個</title></rect>`;}
    });
    const bx=b.records.map((r,i)=>`${xAt(i).toFixed(2)},${scale(r.available).toFixed(2)}`).join(' ');
    svg+=`<polygon points="${xAt(0)},${padT+plotH} ${bx} ${xAt(n-1)},${padT+plotH}" fill="url(#fillB)"/>`;
    svg+=`<polyline points="${points(a.records)}" fill="none" stroke="#23836e" stroke-width="3.1" stroke-linecap="round" stroke-linejoin="round"/><polyline points="${points(b.records)}" fill="none" stroke="#86afe0" stroke-width="3.1" stroke-linecap="round" stroke-linejoin="round"/>`;
    if(n>0){svg+=`<circle cx="${xAt(n-1)}" cy="${scale(a.records[n-1].available)}" r="5" fill="#23836e" stroke="white" stroke-width="2"/><circle cx="${xAt(n-1)}" cy="${scale(b.records[n-1].available)}" r="5" fill="#86afe0" stroke="white" stroke-width="2"/>`;}
    svg+='</svg>';
    $('chart').innerHTML=svg;
    $('chart').setAttribute('aria-label',`${n}日間の在庫推移。現状の欠品合計${a.totalShortage}個、改善案${b.totalShortage}個。`);
  }
  function renderRoutes() {
    const canAdd=state.routes.length<16;
    $('addRoute').disabled=!canAdd;
    if(!state.routes.length){$('routes').innerHTML='<p class="muted">配送先がありません。「追加」から登録してください。</p>';return;}
    $('routes').innerHTML=state.routes.map((r,i)=>`<article class="route-card" data-route="${esc(r.id)}">
      <div class="route-top"><span class="route-num">ROUTE ${String(i+1).padStart(2,'0')}</span><div class="mini-actions"><button type="button" class="icon-button" data-action="up" ${i===0?'disabled':''} title="優先度を上げる" aria-label="${esc(r.name)}を上に移動">↑</button><button type="button" class="icon-button" data-action="down" ${i===state.routes.length-1?'disabled':''} title="優先度を下げる" aria-label="${esc(r.name)}を下に移動">↓</button><button type="button" class="icon-button danger" data-action="delete" title="削除" aria-label="${esc(r.name)}を削除">×</button></div></div>
      <label class="route-name">配送先名<input type="text" maxlength="36" data-field="name" value="${esc(r.name)}" aria-label="配送先名"></label>
      <div class="route-inputs"><label>1回の箱数<input type="number" min="0" max="2000" data-field="qty" value="${r.qty}"></label><label>回収まで（日）<input type="number" min="1" max="60" data-field="returnDays" value="${r.returnDays}"></label><label>洗浄（日）<input type="number" min="0" max="30" data-field="washDays" value="${r.washDays}"></label><label>回収できない割合（%）<input type="number" min="0" max="100" data-field="lossPct" value="${r.lossPct}"></label></div>
      <div class="days-label">発送曜日</div><div class="weekday-row">${WEEKDAYS.map((name,day)=>`<label class="day-choice"><input type="checkbox" data-day="${day}" ${r.weekdays.includes(day)?'checked':''} aria-label="${esc(r.name)} ${name}曜日"><span>${name}</span></label>`).join('')}</div>
    </article>`).join('');
  }
  function renderExtras() {
    $('addExtra').disabled=state.extras.length>=120||!state.routes.length;
    if(!state.extras.length){$('extras').innerHTML='<p class="muted">追加便なし。週ごとの定期発送のみ計算します。</p>';return;}
    $('extras').innerHTML=state.extras.map((x,i)=>`<div class="extra-row" data-extra="${i}"><div class="extra-grid"><label>発送日<input type="date" data-field="date" value="${esc(x.date)}"></label><label>配送先<select data-field="routeId">${state.routes.map(r=>`<option value="${esc(r.id)}" ${r.id===x.routeId?'selected':''}>${esc(r.name)}</option>`).join('')}</select></label><label>箱数<input type="number" min="0" max="2000" data-field="qty" value="${x.qty}"></label><button class="icon-button danger" type="button" data-action="delete-extra" aria-label="臨時追加便を削除">×</button></div></div>`).join('');
  }
  function renderAll(){fillControls();renderRoutes();renderExtras();renderResults();}
  function refresh(){save();renderAll();}
  function patchField(path,value){
    if(path==='startDate') { if(!E.validDate(value)) {notify('有効な開始日を入力してください。',true);return false;}state.startDate=value;return true; }
    const range={days:[7,120],initialStock:[0,1000000],extraStock:[0,1000000],returnDaysCut:[0,30],washDaysCut:[0,30]};
    if(!Object.prototype.hasOwnProperty.call(range,path))return false;
    const [min,max]=range[path];
    const current=(path in state)?state[path]:state.whatIf[path];
    const normalized=E.integer(value,min,max,current);
    if(path in state)state[path]=normalized;else state.whatIf[path]=normalized;
    return true;
  }
  function editRouteField(id,field,value){
    const route=state.routes.find(r=>r.id===id);
    if(!route||!['name','qty','returnDays','washDays','lossPct'].includes(field))return;
    route[field]=getOrderValue(field,value);
    state=E.normalize(state);
    refresh();
  }
  function editExtra(index,field,value){
    const row=state.extras[index];if(!row||!['date','routeId','qty'].includes(field))return;
    const copy={...row,[field]:value};
    if(field==='date'&&!E.validDate(value)){notify('有効な臨時追加便の日付を指定してください。',true);return;}
    state.extras[index]=copy;state=E.normalize(state);refresh();
  }
  function saveFile(filename,content,type){
    const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=filename;
    document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
  }
  for(const id of ['startDate','days','initialStock','extraStock','returnDaysCut','washDaysCut']) {
    $(id).addEventListener('change',(event)=>{if(patchField(id,event.target.value))refresh();});
  }
  $('routes').addEventListener('change',(event)=>{
    const parent=event.target.closest('[data-route]');if(!parent)return;
    const route=state.routes.find(r=>r.id===parent.dataset.route);if(!route)return;
    const field=event.target.dataset.field;
    if(field)editRouteField(route.id,field,event.target.value);
    const day=event.target.dataset.day;
    if(day!==undefined){const num=Number(day);if(event.target.checked) route.weekdays.push(num);else route.weekdays=route.weekdays.filter(x=>x!==num);state=E.normalize(state);refresh();}
  });
  $('routes').addEventListener('click',(event)=>{
    const button=event.target.closest('[data-action]'), parent=event.target.closest('[data-route]');if(!button||!parent)return;
    const i=state.routes.findIndex(r=>r.id===parent.dataset.route);if(i<0)return;
    const action=button.dataset.action;
    if(action==='delete') {const id=state.routes[i].id;state.routes.splice(i,1);state.extras=state.extras.filter(x=>x.routeId!==id);}
    if(action==='up'&&i>0) [state.routes[i-1],state.routes[i]]=[state.routes[i],state.routes[i-1]];
    if(action==='down'&&i<state.routes.length-1) [state.routes[i+1],state.routes[i]]=[state.routes[i],state.routes[i+1]];
    refresh();
  });
  $('addRoute').addEventListener('click',()=>{if(state.routes.length>=16)return;
    state.routes.push({id:'custom-'+(++nextId),name:'新しい配送先',weekdays:[1,3,5],qty:12,returnDays:4,washDays:1,lossPct:0});refresh();notify('配送先を追加しました。曜日と数量を編集してください。');
  });
  $('extras').addEventListener('change',(event)=>{const parent=event.target.closest('[data-extra]');if(!parent)return;editExtra(Number(parent.dataset.extra),event.target.dataset.field,event.target.value);});
  $('extras').addEventListener('click',(event)=>{const btn=event.target.closest('[data-action="delete-extra"]');if(!btn)return;const row=btn.closest('[data-extra]');state.extras.splice(Number(row.dataset.extra),1);refresh();});
  $('addExtra').addEventListener('click',()=>{if(!state.routes.length||state.extras.length>=120)return;
    state.extras.push({id:'extra-'+(++nextId),date:E.dayISO(state.startDate,Math.min(6,state.days-1)),routeId:state.routes[0].id,qty:15});refresh();notify('臨時追加便を追加しました。日付・配送先・箱数を編集できます。');
  });
  function fitStock(){const need=E.requiredStock(state,'whatIf').required;state.whatIf.extraStock=Math.max(0,need-state.initialStock);refresh();notify('改善案に、期間内で欠品をゼロにできる最小の追加箱数を設定しました。');}
  $('fitStock').addEventListener('click',fitStock);$('fitStockSmall').addEventListener('click',fitStock);
  $('resetSample').addEventListener('click',()=>{state=E.example();refresh();notify('サンプルの条件を読み込みました。');});
  $('exportJSON').addEventListener('click',()=>{saveFile('kaeribako-plan.json',JSON.stringify(state,null,2)+'\n','application/json;charset=utf-8');notify('設定JSONのダウンロードを開始しました。');});
  $('exportCSV').addEventListener('click',()=>{const {base,whatIf}=E.compare(state);
    const head=['日付','曜日番号','予定','現状_返却','現状_出荷','現状_欠品','現状_手元','現状_戻り待ち','現状_洗浄待ち','改善_返却','改善_出荷','改善_欠品','改善_手元'];
    const rows=base.records.map((a,i)=>{const b=whatIf.records[i];return [a.date,a.weekday,a.demand,a.returned,a.shipped,a.shortage,a.available,a.inTransit,a.inWash,b.returned,b.shipped,b.shortage,b.available];});
    const csv='\ufeff'+[head,...rows].map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\r\n');
    saveFile('kaeribako-daily.csv',csv,'text/csv;charset=utf-8');notify('日別CSVのダウンロードを開始しました。');
  });
  $('importJSON').addEventListener('click',()=>{$('fileInput').value='';$('fileInput').click();});
  $('fileInput').addEventListener('change',async(event)=>{
    const file=event.target.files&&event.target.files[0];if(!file)return;
    if(file.size>1024*1024){notify('設定JSONは1MB以下にしてください。',true);return;}
    try{const raw=JSON.parse(await file.text());
      if(!raw||typeof raw!=='object'||!Array.isArray(raw.routes)||!E.validDate(raw.startDate)){throw new Error('設定の構造を確認してください');}
      state=E.normalize(raw);refresh();notify('設定を読み込みました。');
    }catch(err){notify('JSONを読み込めませんでした: '+err.message,true);}
  });
  $('printPage').addEventListener('click',()=>window.print());
  renderAll();
})();
