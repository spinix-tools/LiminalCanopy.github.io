(() => {
'use strict';
const E=window.KansuiEngine, KEY='kansui-shirabe/v1';
let state=E.deepCopy(E.DEFAULT), lastSVG='';
const $=id=>document.getElementById(id);
const fmt=(v,d=1)=>Number.isFinite(v)?v.toLocaleString('ja-JP',{maximumFractionDigits:d,minimumFractionDigits:d}):'—';
const plan=id=>state.plans.find(p=>p.id===id);
function toast(msg,error=false){const el=$('toast');el.textContent=msg;el.hidden=false;el.classList.toggle('error',error);clearTimeout(toast.timer);toast.timer=setTimeout(()=>{el.hidden=true},4200)}
function initial(){try{const raw=localStorage.getItem(KEY);if(raw)state=E.validate(JSON.parse(raw))}catch(e){console.warn(e);state=E.deepCopy(E.DEFAULT)}}
function sync(){document.querySelectorAll('[data-field]').forEach(x=>x.value=state[x.dataset.field]);document.querySelectorAll('[data-measure]').forEach(x=>x.value=state.measurements[x.dataset.measure]);document.querySelectorAll('[data-plan]').forEach(x=>x.value=plan(x.dataset.plan)[x.dataset.key]);$('daySlider').max=state.horizon;$('daySlider').value=state.selectedDay}
function mutate(f){const n=E.deepCopy(state);try{f(n);state=E.validate(n);render()}catch(e){sync();toast(e.message,true)}}
function onChange(el){if(el.matches('[data-field]')){const key=el.dataset.field;mutate(n=>{n[key]=key==='name'?el.value:Number(el.value);if(key==='horizon')n.selectedDay=Math.min(n.horizon,n.selectedDay)})}else if(el.matches('[data-measure]')){mutate(n=>{n.measurements[el.dataset.measure]=Number(el.value)})}else if(el.matches('[data-plan]')){mutate(n=>{const p=n.plans.find(p=>p.id===el.dataset.plan);p[el.dataset.key]=el.dataset.key==='name'?el.value:Number(el.value)})}}
const path=(arr,x,y)=>arr.slice(1).reduce((s,r)=>s+` L ${x(r.day).toFixed(2)} ${y(r.before).toFixed(2)}`+(r.changed?` L ${x(r.day).toFixed(2)} ${y(r.after).toFixed(2)}`:''),`M ${x(0).toFixed(2)} ${y(arr[0].after).toFixed(2)}`);
const band=(lo,hi,x,y)=>hi.map(p=>`${x(p.day).toFixed(2)},${y(p.after).toFixed(2)}`).concat(lo.slice().reverse().map(p=>`${x(p.day).toFixed(2)},${y(p.after).toFixed(2)}`)).join(' ');
function chart(comp){
 const sa=E.sensitivity(state,state.plans[0]),sb=E.sensitivity(state,state.plans[1]);
 const max=Math.max(10,Math.ceil(Math.max(state.limit,state.current,state.tap,comp.a.maxBefore,comp.b.maxBefore,sa.highResult.maxBefore,sb.highResult.maxBefore)*1.13/5)*5);
 const width=800,height=348,left=47,right=21,top=25,bottom=43;
 const x=d=>left+d/state.horizon*(width-left-right);
 const y=v=>top+(1-Math.min(max,Math.max(0,v))/max)*(height-top-bottom);
 const grid=Array.from({length:5},(_,i)=>{const n=max*i/4;return `<line x1="${left}" x2="${width-right}" y1="${y(n)}" y2="${y(n)}" stroke="#dfebe6"/><text x="${left-9}" y="${y(n)+4}" text-anchor="end" font-size="11" fill="#80999a">${fmt(n,0)}</text>`}).join('');
 const ticks=[0,Math.round(state.horizon/4),Math.round(state.horizon/2),Math.round(state.horizon*3/4),state.horizon].map(d=>`<text x="${x(d)}" y="${height-13}" text-anchor="middle" font-size="11" fill="#80999a">${d}日</text>`).join('');
 const selectedX=x(state.selectedDay),av=comp.a.timeline[state.selectedDay].after,bv=comp.b.timeline[state.selectedDay].after;
 lastSVG=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="換水プランAとBのNO3予測推移" font-family="system-ui,sans-serif"><title>換水しらべ：NO₃の予測比較</title><desc>硝酸塩の予測と換水前後の変化。色の帯は変化率を±30%とした感度分析です。</desc><rect width="${width}" height="${height}" fill="white"/>${grid}<text x="${left}" y="13" font-size="10" fill="#66888b">NO₃ / ppm</text><polygon points="${band(sa.lowResult.timeline,sa.highResult.timeline,x,y)}" fill="#75c6b9" opacity=".13"/><polygon points="${band(sb.lowResult.timeline,sb.highResult.timeline,x,y)}" fill="#e6a17a" opacity=".14"/><path d="${path(comp.a.timeline,x,y)}" fill="none" stroke="#007c86" stroke-width="3.2" stroke-linejoin="round"/><path d="${path(comp.b.timeline,x,y)}" fill="none" stroke="#ca6a38" stroke-width="3.2" stroke-linejoin="round"/><line x1="${left}" x2="${width-right}" y1="${y(state.limit)}" y2="${y(state.limit)}" stroke="#718b91" stroke-dasharray="5 6" stroke-width="1.4"/><text x="${width-right-2}" y="${Math.max(16,y(state.limit)-8)}" text-anchor="end" font-size="10" fill="#718b91">設定目安 ${fmt(state.limit,0)} ppm</text><line x1="${selectedX}" x2="${selectedX}" y1="${top}" y2="${height-bottom}" stroke="#80999a" stroke-dasharray="3 5"/><circle cx="${selectedX}" cy="${y(av)}" r="5.5" fill="white" stroke="#007c86" stroke-width="3"/><circle cx="${selectedX}" cy="${y(bv)}" r="5.5" fill="white" stroke="#ca6a38" stroke-width="3"/>${ticks}</svg>`;
 $('chart').innerHTML=lastSVG;$('chart').setAttribute('aria-label',`${state.selectedDay}日目のAは${fmt(av)}ppm、Bは${fmt(bv)}ppm`);
}
function table(comp){
 const rows=[['管理目安超過日数（換水前）',`${comp.a.overDays}日`,`${comp.b.overDays}日`],['最高値（換水前）',`${fmt(comp.a.maxBefore)} ppm`,`${fmt(comp.b.maxBefore)} ppm`],['最終日の換水後',`${fmt(comp.a.end)} ppm`,`${fmt(comp.b.end)} ppm`],['換水回数',`${comp.a.changes}回`,`${comp.b.changes}回`],['使用水量',`${fmt(comp.a.totalLiters)} L`,`${fmt(comp.b.totalLiters)} L`],['定常ピーク概算',...state.plans.map(p=>{const n=E.steadyPeak(state,p);return Number.isFinite(n)?`${fmt(n)} ppm`:'計算不可'})]];
 $('comparisonRows').innerHTML=rows.map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('');
 $('verdictTitle').textContent=comp.preferred?`数値上はプラン${comp.preferred.toUpperCase()}が優位`:'両プランは比較基準で同点';
 $('verdictDetail').textContent='比較優先順位：目安超過日数 → 最高NO₃ → 使用水量。生体への安全性や適性の判定ではありません。';
 ['a','b'].forEach(id=>{const u=id.toUpperCase(),n=E.requiredPercent(state,plan(id).interval);$('need'+u).textContent=n.possible?`${fmt(Math.ceil(n.value),0)}%`:n.value===null?'設定不能':`上限外 ${fmt(n.value,0)}%`;$('needNote'+u).textContent=n.note;$('useNeed'+u).disabled=!n.possible});
}
function calendar(){$('calendar').innerHTML=Array.from({length:14},(_,i)=>{const d=i+1,a=E.isChangeDay(d,plan('a'))&&plan('a').percent>0,b=E.isChangeDay(d,plan('b'))&&plan('b').percent>0;return `<div class="calendar-day" aria-label="${d}日目${a?' A換水':''}${b?' B換水':''}"><span>Day ${d}</span><div class="calendar-flags">${a?'<b>A</b>':''}${b?'<b class="flag-b">B</b>':''}${!a&&!b?'<i>–</i>':''}</div></div>`}).join('')}
function render(){sync();const comp=E.compare(state);$('tickerTank').textContent=state.name;$('tickerHorizon').textContent=state.horizon+'日';$('tickerA').textContent=fmt(comp.a.totalLiters)+' L';$('tickerB').textContent=fmt(comp.b.totalLiters)+' L';const rate=E.estimateRate(state.measurements);$('rateHint').textContent=`推定 ${rate>=0?'+':''}${fmt(rate,2)} ppm / 日`;['a','b'].forEach(id=>{$('planHint'+id.toUpperCase()).textContent=`1回 ${fmt(state.volume*plan(id).percent/100)} L を交換`});chart(comp);$('dayLabel').textContent='Day '+state.selectedDay;$('dayEnd').textContent=state.horizon+'日後';['a','b'].forEach(id=>{const u=id.toUpperCase(),p=comp[id].timeline[state.selectedDay];$('day'+u).textContent=fmt(p.after)+' ppm';$('day'+u+'Change').textContent=p.changed?`換水 ${fmt(p.liters)} L（直前 ${fmt(p.before)} ppm）`:'この日は換水なし'});table(comp);calendar()}
function download(filename,text,type){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=filename;a.style.display='none';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function setup(){initial();render();document.addEventListener('change',e=>onChange(e.target));$('daySlider').addEventListener('input',e=>{state.selectedDay=Number(e.target.value);render()});$('applyRate').addEventListener('click',()=>{mutate(n=>n.dailyRise=Number(E.estimateRate(n.measurements).toFixed(4)));toast('測定値を条件に反映しました')});
 ['a','b'].forEach(id=>$('useNeed'+id.toUpperCase()).addEventListener('click',()=>{const r=E.requiredPercent(state,plan(id).interval);if(!r.possible)return toast(r.note,true);mutate(n=>n.plans.find(p=>p.id===id).percent=Math.ceil(r.value-1e-9));toast('プラン'+id.toUpperCase()+'に反映しました')}));
 $('saveBtn').addEventListener('click',()=>{try{localStorage.setItem(KEY,JSON.stringify(state));toast('端末に保存しました')}catch(e){toast('端末に保存できませんでした',true)}});
 $('clearBtn').addEventListener('click',()=>{try{localStorage.removeItem(KEY);toast('端末保存を削除しました（現在の入力は維持）')}catch(e){toast('削除できませんでした',true)}});
 $('jsonBtn').addEventListener('click',()=>{download('kansui-shirabe.json',JSON.stringify({version:1,...state},null,2)+'\n','application/json;charset=utf-8');toast('JSONを書き出しました')});
 $('csvBtn').addEventListener('click',()=>{download('kansui-shirabe.csv',E.toCSV(state),'text/csv;charset=utf-8');toast('CSVを書き出しました')});
 $('svgBtn').addEventListener('click',()=>{download('kansui-shirabe.svg','<?xml version="1.0" encoding="UTF-8"?>\n'+lastSVG,'image/svg+xml;charset=utf-8');toast('SVGを書き出しました')});
 $('resetBtn').addEventListener('click',()=>{state=E.deepCopy(E.DEFAULT);render();toast('デモ条件に戻しました（端末保存は維持）')});
 $('printBtn').addEventListener('click',()=>window.print());
 $('importFile').addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;try{if(f.size>200000)throw new Error('200KB以内のファイルを選んでください');state=E.validate(JSON.parse(await f.text()));render();toast('JSONを読み込みました')}catch(err){toast('読み込み失敗: '+err.message,true)}finally{e.target.value=''}});
 window.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key==='s'){e.preventDefault();$('saveBtn').click()}});
}
document.addEventListener('DOMContentLoaded',setup);
})();
