(function(){
'use strict';
const E = window.NukiEngine;
const $ = id => document.getElementById(id);
const FIELDS = ['N','n','c','good','bad','minutes','target'];
const BASE = { N:240, n:32, c:0, good:1, bad:9, minutes:1.5, target:5 };
const STORAGE_KEY = 'nukiken-navi-v1';
let state = { plan: { ...BASE }, sample: null };
let lastPlanFingerprint = '';
const svgNS = 'http://www.w3.org/2000/svg';
const format = (x, decimals=1) => Number(x).toLocaleString('ja-JP',{minimumFractionDigits:decimals,maximumFractionDigits:decimals});
const percent = (x) => format(x*100,2) + '%';
function status(id, message, error=false){ const el=$(id); el.textContent=message; el.classList.toggle('error',error); }
function readForm(){ const raw={}; for(const name of FIELDS)raw[name]=$(name).value; return E.validatePlan(raw); }
function renderForm(plan){ for(const name of FIELDS)$(name).value=plan[name]; }
function fingerprint(plan){ return JSON.stringify(FIELDS.map(k=>plan[k])); }
function trySave(){ try{ localStorage.setItem(STORAGE_KEY, JSON.stringify({version:1, ...state})); } catch(e){ status('storage-message','端末への自動保存は利用できません。必要ならJSONを書き出してください。',true); } }
function clearSample(message){ if(state.sample){state.sample=null;renderSample(); if(message)status('sample-info',message); } }
function makeSvg(tag, attrs={}, content){ const el=document.createElementNS(svgNS,tag); for(const [k,v] of Object.entries(attrs))el.setAttribute(k,String(v)); if(content!==undefined)el.textContent=content;return el; }
function drawChart(points,plan){
  const svg=$('risk-chart');svg.replaceChildren(); const W=640,H=252,left=56,right=20,top=18,bottom=39,plotW=W-left-right,plotH=H-top-bottom;
  const max=points[points.length-1].rate;
  const x=v=>left+plotW*v/max, y=v=>top+plotH*(1-v);
  for(const tick of [0,.25,.5,.75,1]){
    svg.append(makeSvg('line',{x1:left,y1:y(tick),x2:W-right,y2:y(tick),stroke:'#dce5dd','stroke-width':1}));
    svg.append(makeSvg('text',{x:44,y:y(tick)+4,'text-anchor':'end',fill:'#667c72','font-size':11},Math.round(tick*100)+'%'));
  }
  for(let k=0;k<=5;k++){
    const n=max*k/5; svg.append(makeSvg('text',{x:x(n),y:H-12,'text-anchor':'middle',fill:'#667c72','font-size':11},format(n,0)+'%'));
  }
  svg.append(makeSvg('line',{x1:left,y1:top,x2:left,y2:H-bottom,stroke:'#738e82'}));
  const d=points.map((pt,i)=>`${i===0?'M':'L'}${x(pt.rate).toFixed(2)},${y(pt.p).toFixed(2)}`).join(' ');
  svg.append(makeSvg('path',{d,fill:'none',stroke:'#177c6b','stroke-width':4,'stroke-linecap':'round','stroke-linejoin':'round'}));
  for(const p of [{rate:plan.good,p:1-plan.producerRisk,color:'#177c6b',label:'良品側'}, {rate:plan.bad,p:plan.consumerRisk,color:'#be663e',label:'不良側'}]){
    if(p.rate>max)continue;
    svg.append(makeSvg('line',{x1:x(p.rate),y1:top,x2:x(p.rate),y2:H-bottom,stroke:p.color,'stroke-dasharray':'4 5',opacity:.65}));
    const circle=makeSvg('circle',{cx:x(p.rate),cy:y(p.p),r:6,fill:p.color,stroke:'white','stroke-width':3});
    circle.append(makeSvg('title',{},`${p.label} ${format(p.rate,1)}%：合格確率${percent(p.p)}`));svg.append(circle);
  }
}
function calculate({silent=false}={}){
  try{
    const plan=readForm(), signature=fingerprint(plan), changed=signature!==lastPlanFingerprint;
    if(changed && state.sample)clearSample('検査条件が変わったため、以前の抽出結果を破棄しました。新しく抽出してください。');
    lastPlanFingerprint=signature;
    state.plan=plan;
    const m=E.metrics(plan);
    $('producer-risk').textContent=percent(m.producerRisk);
    $('consumer-risk').textContent=percent(m.consumerRisk);
    $('producer-detail').textContent=`${m.N}個中 約${m.goodD}個不良と仮定`;
    $('consumer-detail').textContent=`${m.N}個中 約${m.badD}個不良と仮定`;
    $('inspection-time').textContent=format(m.estimatedMinutes,1)+' 分';
    $('coverage').textContent=format(m.inspectedPct,1)+' %';
    $('formula').textContent=`ロット${m.N}個から${m.n}個を復元なしで抽出し、不良${m.c}個以下なら合格。想定不良率は個数に四捨五入し計算（良品側${m.goodD}個／不良側${m.badD}個）。`;
    drawChart(E.curve(plan),m);
    if(!silent)status('form-message',`計算しました。抽出数${plan.n}個、許容不良${plan.c}個。`);
    trySave();
    return plan;
  } catch(err) {status('form-message',err.message,true);return null;}
}
function renderSample(){
  const list=$('sample-list'); list.replaceChildren();
  if(!state.sample){
    $('done-count').textContent='0 / 0';$('bad-count').textContent='0';$('decision').textContent='未抽出';$('progress-bar').style.width='0%';$('random-method').textContent='—';$('export-csv').disabled=true;
    return;
  }
  const {ids,statuses,method}=state.sample;
  const a=E.assessment(statuses,state.plan.c);
  $('done-count').textContent=`${a.ok+a.bad} / ${ids.length}`;
  $('bad-count').textContent=String(a.bad);
  $('decision').textContent=a.decision;
  $('random-method').textContent=method;
  $('progress-bar').style.width=100*(a.ok+a.bad)/ids.length+'%';
  $('export-csv').disabled=false;
  $('sample-info').textContent=a.pending ? `あと${a.pending}件の検査が必要です。判定は未確定です。` : `全${ids.length}件を確認しました。判定：${a.decision}。`;
  ids.forEach((id,i)=>{
    const card=document.createElement('div');card.className='sample-card '+(statuses[i]==='pending'?'':statuses[i]);
    const label=document.createElement('div');label.className='sample-id';label.textContent='# '+String(id).padStart(String(state.plan.N).length,'0');
    const hint=document.createElement('span');hint.textContent=` ${i+1}件目`;label.append(hint);card.append(label);
    const choice=document.createElement('div');choice.className='choice';
    for(const [key,text] of [['pending','保留'],['ok','良'],['bad','不良']]){
      const btn=document.createElement('button');btn.type='button';btn.dataset.state=key;btn.textContent=text;btn.className=statuses[i]===key?'active':'';
      btn.setAttribute('aria-pressed',String(statuses[i]===key));
      btn.addEventListener('click',()=>{statuses[i]=key;renderSample();trySave();});
      choice.append(btn);
    }
    card.append(choice);list.append(card);
  });
}
function download(name,text,type){
  const blob=new Blob([text],{type});const url=URL.createObjectURL(blob); const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function loadJson(raw){
  if(!raw||raw.version!==1||!raw.plan)throw new Error('対応していない保存形式です。');
  const plan=E.validatePlan(raw.plan);
  let sample=null;
  if(raw.sample!==null && raw.sample!==undefined){
    const s=raw.sample;
    if(!s||!Array.isArray(s.ids)||!Array.isArray(s.statuses)||s.ids.length!==plan.n||s.statuses.length!==plan.n)throw new Error('抽出データの数が設定と一致しません。');
    if(s.ids.some(i=>!Number.isInteger(i)||i<1||i>plan.N)||new Set(s.ids).size!==plan.n)throw new Error('抽出番号が不正または重複しています。');
    E.assessment(s.statuses,plan.c);
    sample={ids:[...s.ids],statuses:[...s.statuses],method:typeof s.method==='string'?s.method.slice(0,80):'不明'};
  }
  return {plan,sample};
}
function restoreLocal(){
  try{const raw=localStorage.getItem(STORAGE_KEY);if(raw)state=loadJson(JSON.parse(raw));}catch(e){status('storage-message','端末保存データを利用できませんでした。初期値で起動します。',true);}
  renderForm(state.plan); lastPlanFingerprint=fingerprint(state.plan);calculate({silent:true});renderSample();
}
function setup(){
  FIELDS.forEach(id=>$(id).addEventListener('change',()=>calculate()));
  $('recalc').addEventListener('click',()=>calculate());
  $('suggest').addEventListener('click',()=>{
    const plan=calculate(); if(!plan)return;
    const ans=E.minimumSample(plan);
    if(!ans){status('form-message',`上限${Math.min(plan.N,E.MAX_SAMPLE)}件以内には、目標を満たす抽出数がありません。許容不良数や目標を変更してください。`,true);return;}
    $('n').value=ans.n;
    calculate({silent:true});
    status('form-message',`目標${format(plan.target,1)}%以下となる最小抽出数：${ans.n}個（不良側の合格確率 ${percent(ans.risk)}）。`);
  });
  $('draw').addEventListener('click',()=>{
    const plan=calculate();if(!plan)return;
    state.sample={ids:E.pickIds(plan.N,plan.n),statuses:Array(plan.n).fill('pending'),method:E.randomMethod()};
    renderSample();trySave();status('storage-message','新しい抽出番号を生成しました。前回の確認結果は置き換えられました。');
  });
  $('export-csv').addEventListener('click',()=>{if(!state.sample)return;download('nukiken-inspection.csv',E.exportCsv(state.sample.ids,state.sample.statuses,state.plan.c),'text/csv;charset=utf-8');});
  $('export-json').addEventListener('click',()=>download('nukiken-plan.json',JSON.stringify({version:1,...state},null,2),'application/json;charset=utf-8'));
  $('import-json').addEventListener('change',async e=>{
    const file=e.target.files?.[0];if(!file)return;
    try{if(file.size>1000000)throw new Error('保存ファイルが大きすぎます。');state=loadJson(JSON.parse(await file.text()));renderForm(state.plan);lastPlanFingerprint=fingerprint(state.plan);calculate({silent:true});renderSample();trySave();status('storage-message','JSONの設定と検査記録を復元しました。');}
    catch(err){status('storage-message',`読み込み失敗：${err.message}`,true);}finally{e.target.value='';}
  });
  $('reset').addEventListener('click',()=>{if(!window.confirm('設定と検査記録を初期化しますか？'))return;state={plan:{...BASE},sample:null};renderForm(state.plan);lastPlanFingerprint=fingerprint(state.plan);calculate({silent:true});renderSample();status('storage-message','初期値に戻しました。');});
  $('print').addEventListener('click',()=>window.print());
  restoreLocal();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})();
