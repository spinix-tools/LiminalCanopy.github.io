(function(){
'use strict';
const E=window.DengenEngine,STEP=E.STEP,KEY='dengen-kasane-v1';
const $=id=>document.getElementById(id);
const yen=x=>Math.round(x).toLocaleString('ja-JP');
const safe=E.esc;
let state=E.sample(),last=null,proposal=null,toastTimer;
try{const item=localStorage.getItem(KEY);if(item) state=E.normalize(JSON.parse(item));}catch(err){console.warn('Saved plan unavailable',err);state=E.sample();}
function alertToast(message,bad=false){ const e=$('toast');e.textContent=message;e.className='toast show'+(bad?' error':'');clearTimeout(toastTimer);toastTimer=setTimeout(()=>{e.className='toast';},3400); }
function persist(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch(err){alertToast('端末への自動保存ができません。JSON出力を使ってください。',true);} }
function optionTimes(selected){let out='';for(let m=0;m<=1440;m+=15){const formatted=E.tstr(m);out+=`<option value="${m}" ${selected===m?'selected':''}>${formatted}</option>`;}return out;}
function drawSetup(){
  $('eventTitle').value=state.title;$('eventFrom').value=E.tstr(state.from);$('eventTo').value=E.tstr(state.to);
  $('venueLimit').value=state.limitW;$('reservePct').value=state.reservePct;
  $('circuitList').innerHTML=state.circuits.map((c,i)=>`<div class="circuit-row" data-circuit-index="${i}"><span class="swatch" style="background:${['#258b79','#578cb5','#db9a61','#a483b5','#8f9f49','#b86875','#4d9b97','#b49a66'][i]}"></span><input aria-label="系統名 ${i+1}" data-cfield="name" value="${safe(c.name)}" maxlength="45"><input aria-label="系統上限W ${i+1}" data-cfield="capW" type="number" min="100" max="30000" step="50" value="${c.capW}"><button aria-label="系統を削除 ${i+1}" data-cdel="${i}" title="この系統を削除" ${state.circuits.length===1?'disabled':''}>×</button></div>`).join('');
  $('addCircuit').disabled=state.circuits.length>=8;
}
function deviceCard(d,i){return `<div class="device-card" data-device-index="${i}"><div class="device-top"><span class="number">${String(i+1).padStart(2,'0')}</span><input aria-label="機器名 ${i+1}" data-dfield="name" maxlength="70" value="${safe(d.name)}"><button class="device-delete" title="機器を削除" aria-label="${i+1}番目の機器を削除" data-ddel="${i}">×</button></div>
 <div class="device-fields"><label class="device-field">系統<select data-dfield="circuit">${state.circuits.map(c=>`<option value="${safe(c.id)}" ${c.id===d.circuit?'selected':''}>${safe(c.name)}</option>`).join('')}</select></label><label class="device-field">台数<input type="number" min="1" max="20" step="1" data-dfield="qty" value="${d.qty}"></label><label class="device-field">通常 W / 台<input type="number" min="0" max="15000" step="10" data-dfield="watts" value="${d.watts}"></label><label class="device-field">起動時 W / 台<input type="number" min="0" max="30000" step="10" data-dfield="peakWatts" value="${d.peakWatts}"></label><label class="device-field">稼働時間 <span title="分単位の計画">15分刻み</span></label></div>
 <div class="schedule-fields"><label class="device-field">開始<select data-dfield="start">${optionTimes(d.start)}</select></label><label class="device-field">終了<select data-dfield="end">${optionTimes(d.end)}</select></label><label class="flex-field"><input type="checkbox" data-dfield="flexible" ${d.flexible?'checked':''}> 時刻移動可</label><label class="device-field">前後 ± 分<select data-dfield="slack" ${d.flexible?'':'disabled'}>${[0,15,30,45,60,90,120,180,240].map(n=>`<option value="${n}" ${d.slack===n?'selected':''}>${n}分</option>`).join('')}</select></label></div></div>`;}
function drawDevices(){ $('deviceCount').textContent=`${state.devices.length}件`;$('deviceList').innerHTML=state.devices.map(deviceCard).join('');$('addDevice').disabled=state.devices.length>=80; }
function chart(report){
  const {slots,p,allowed}=report,w=660,h=238,ml=48,mr=15,mt=22,mb=38,pw=w-ml-mr,ph=h-mt-mb;
  const ymax=Math.max(500,Math.ceil(Math.max(report.maxTotal,allowed)*1.15/500)*500);
  const x=i=>ml+(i/Math.max(1,slots.length-1))*pw,y=v=>mt+ph-(v/ymax)*ph;
  let svg=`<svg viewBox="0 0 ${w} ${h}" aria-label="${safe(p.title)}の15分間隔負荷グラフ"><title>時間帯別消費電力。最大${report.maxTotal}W、上限目安${allowed}W</title>`;
  for(let i=0;i<=4;i++){const v=ymax*i/4;svg+=`<line x1="${ml}" y1="${y(v)}" x2="${w-mr}" y2="${y(v)}" stroke="#e2eae5"/><text x="${ml-9}" y="${y(v)+3}" font-size="10" fill="#90a19b" text-anchor="end">${Math.round(v)}</text>`;}
  const tx=[0,.25,.5,.75,1];for(const f of tx){const m=p.from+Math.round((p.to-p.from)*f/STEP)*STEP;svg+=`<text x="${ml+f*pw}" y="${h-13}" text-anchor="middle" font-size="10" fill="#8a9996">${E.tstr(Math.min(m,p.to))}</text>`;}
  // Each time bucket is a vertical bar, highlighting overload independently.
  const bw=Math.max(1,pw/slots.length-1);
  slots.forEach((s,i)=>{const bx=ml+(i/slots.length)*pw,high=ph-(y(s.total)-mt),over=s.total>allowed||p.circuits.some(c=>s.byCircuit[c.id]>c.capW);
    svg+=`<rect x="${bx.toFixed(2)}" y="${y(s.total).toFixed(2)}" width="${bw.toFixed(2)}" height="${Math.max(0,high).toFixed(2)}" fill="${over?'#ee8c58':'#8bc4ab'}" rx="1"><title>${E.tstr(s.time)} ${s.total}W${over?' / 要確認':''}</title></rect>`;});
  svg+=`<line x1="${ml}" y1="${y(allowed)}" x2="${w-mr}" y2="${y(allowed)}" stroke="#267f7c" stroke-width="2" stroke-dasharray="7 5"/><text x="${w-mr-2}" y="${Math.max(13,y(allowed)-7)}" text-anchor="end" font-size="10" fill="#267f7c" font-weight="bold">${allowed.toLocaleString()}W / 許容目安</text></svg>`;
  $('chartArea').innerHTML=svg;
  $('legend').innerHTML='<span><b style="background:#8bc4ab"></b>超過なし</span><span><b style="background:#ee8c58"></b>要確認</span><span><b style="background:#267f7c"></b>会場全体の予備率込み上限</span>';
  $('chartRange').textContent=E.tstr(p.from)+' — '+E.tstr(p.to);
}
function risks(report){
  const issues=report.slots.filter(s=>s.total>report.allowed||report.p.circuits.some(c=>s.byCircuit[c.id]>c.capW));
  $('riskSummary').textContent=issues.length?`${issues.length}枠を確認`:'超過なし';
  if(!issues.length){$('riskList').innerHTML='<div class="empty-risk">✓ 入力された前提では容量超過なし</div>';return;}
  const shown=issues.slice(0,10);
  $('riskList').innerHTML=shown.map(s=>{
    let reasons=[];
    if(s.total>report.allowed)reasons.push(`会場 +${yen(s.total-report.allowed)}W`);
    for(const c of report.p.circuits){if(s.byCircuit[c.id]>c.capW)reasons.push(`${safe(c.name)} +${yen(s.byCircuit[c.id]-c.capW)}W`);}
    return `<div class="risk-row"><span class="risk-time">${E.tstr(s.time)}–${E.tstr(s.time+15)}</span><span class="risk-desc">${reasons.join(' / ')}</span><span class="risk-amount">${yen(s.total)} W</span></div>`;
  }).join('')+(issues.length>shown.length?`<p class="micro">ほか ${issues.length-shown.length} 枠。グラフの橙色部分も確認してください。</p>`:'');
}
function redraw(){
  drawSetup();drawDevices();
  try{
    last=E.analyze(state);
    $('maxTotal').textContent=yen(last.maxTotal);$('overCount').textContent=yen(last.overloadSlots);$('energy').textContent=(last.energyWh/1000).toFixed(2);
    $('stateBadge').textContent=last.overloadSlots?'● 調整が必要':'✓ 入力上は超過なし';$('stateBadge').className='state-badge'+(last.overloadSlots?' warning':'');
    chart(last);risks(last);persist();
  }catch(err){alertToast(err.message,true);}
}
function updateField(obj,field,value){if(field==='name'||field==='circuit'){obj[field]=String(value);return;}if(field==='flexible'){obj.flexible=!!value;return;}obj[field]=Number(value);}
function mutate(callback){const before=E.structuredCopy(state); try{callback();state=E.normalize(state);proposal=null;$('optimizerResult').textContent='入力条件が更新されました。新しい調整案を計算できます。';redraw();}catch(err){state=before;redraw();alertToast(err.message,true);} }
['eventTitle','eventFrom','eventTo','venueLimit','reservePct'].forEach((id)=>{$(id).addEventListener('change',e=>mutate(()=>{const v=e.target.value;const key={eventTitle:'title',eventFrom:'from',eventTo:'to',venueLimit:'limitW',reservePct:'reservePct'}[id];state[key]=id==='eventFrom'||id==='eventTo'?E.mins(v):id==='eventTitle'?v:Number(v);}));});
$('circuitList').addEventListener('change',e=>{const row=e.target.closest('[data-circuit-index]');if(!row||!e.target.dataset.cfield)return;mutate(()=>updateField(state.circuits[+row.dataset.circuitIndex],e.target.dataset.cfield,e.target.value));});
$('circuitList').addEventListener('click',e=>{const b=e.target.closest('[data-cdel]');if(!b)return;mutate(()=>{const i=+b.dataset.cdel;if(state.circuits.length<2)return;const removed=state.circuits[i].id;state.circuits.splice(i,1);state.devices.forEach(d=>{if(d.circuit===removed)d.circuit=state.circuits[0].id;});});});
$('addCircuit').addEventListener('click',()=>mutate(()=>{if(state.circuits.length>=8)return;const k='C'+Date.now().toString(36);state.circuits.push({id:k,name:`系統 ${state.circuits.length+1}`,capW:1500});}));
$('deviceList').addEventListener('change',e=>{const card=e.target.closest('[data-device-index]');if(!card||!e.target.dataset.dfield)return;mutate(()=>{const d=state.devices[+card.dataset.deviceIndex],field=e.target.dataset.dfield;updateField(d,field,field==='flexible'?e.target.checked:e.target.value);});});
$('deviceList').addEventListener('click',e=>{const b=e.target.closest('[data-ddel]');if(!b)return;mutate(()=>state.devices.splice(+b.dataset.ddel,1));});
$('addDevice').addEventListener('click',()=>mutate(()=>{if(state.devices.length>=80)return;const end=Math.min(state.to,state.from+60);state.devices.push({id:'d'+Date.now().toString(36),name:'新しい機器',circuit:state.circuits[0].id,qty:1,watts:300,peakWatts:300,start:state.from,end,flexible:true,slack:60});}));
$('resetBtn').addEventListener('click',()=>{if(!window.confirm('現在の計画を初期サンプルに戻しますか？'))return;state=E.sample();proposal=null;$('optimizerResult').textContent='初期状態に戻しました。';redraw();});
$('optimizeBtn').addEventListener('click',()=>{
  try{proposal=E.suggest(state);const d=proposal.result.overloadSlots-proposal.original.overloadSlots,sh=proposal.shifts;
    if(!proposal.improved){$('optimizerResult').innerHTML='<strong>改善できる移動案は見つかりませんでした。</strong><div>許容幅や稼働時間、利用する容量を確認してください。現状が安全という意味ではありません。</div>';return;}
    $('optimizerResult').innerHTML=`<strong>超過枠 ${proposal.original.overloadSlots} → ${proposal.result.overloadSlots}（${d<0?d:0}枠）</strong><div>以下は計算上の候補です。稼働が実際に可能か現場で確認してください。</div>${sh.map(s=>`<div class="shift"><span>${safe(s.name)}</span><strong>${E.tstr(s.from)} → ${E.tstr(s.to)}</strong></div>`).join('')}<button class="btn primary" id="applyProposal">この時刻案を反映</button>`;
  }catch(err){alertToast(err.message,true);}
});
$('optimizerResult').addEventListener('click',e=>{if(e.target.id!=='applyProposal'||!proposal)return;state=proposal.plan;proposal=null;redraw();$('optimizerResult').innerHTML='<strong>時刻変更を反映しました。</strong> 機器の時間設定と診断結果を確認してください。';alertToast('時刻変更を反映しました');});
function download(file,type,content){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=file;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);}
$('saveJson').addEventListener('click',()=>{download('dengen-kasane-plan.json','application/json;charset=utf-8',JSON.stringify(state,null,2));alertToast('計画JSONを書き出しました');});
$('exportCsv').addEventListener('click',()=>{download('dengen-kasane-equipment.csv','text/csv;charset=utf-8',E.toCSV(state));alertToast('機器一覧CSVを書き出しました');});
$('printBtn').addEventListener('click',()=>window.print());
$('importBtn').addEventListener('click',()=>$('fileInput').click());
$('fileInput').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>1024*1024)throw Error('ファイルサイズは1MB以下にしてください。');const text=await f.text();const obj=E.normalize(JSON.parse(text));state=obj;proposal=null;$('optimizerResult').textContent='JSONから計画を復元しました。';redraw();alertToast('JSONを読み込みました');}catch(err){alertToast('読込できません: '+err.message,true);}finally{e.target.value='';}});
$('copySummary').addEventListener('click',async()=>{if(!last)return;const lines=[`【出店電源・事前確認メモ】${state.title}`,`計画時間：${E.tstr(state.from)}〜${E.tstr(state.to)}`,`会場申告上限 ${yen(state.limitW)}W / 計算上の予備率 ${state.reservePct}%`,`計算上の最大同時電力 ${yen(last.maxTotal)}W、超過枠 ${last.overloadSlots} 件`,...state.circuits.map(c=>`${c.name}: 上限${yen(c.capW)}W / 最大${yen(last.circuitMax[c.id])}W`),...last.warnings.map(x=>'要確認: '+x),'※時間枠内の起動ピークは15分続くものとして計算。会場規則・専門家の確認が必要。'];try{await navigator.clipboard.writeText(lines.join('\n'));alertToast('相談用メモをコピーしました');}catch(err){alertToast('コピーできません。JSON出力をご利用ください。',true);}});
redraw();
})();
