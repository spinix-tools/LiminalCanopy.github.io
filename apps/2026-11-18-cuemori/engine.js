/* CUE-MORI deterministic rundown scheduler. Public domain data; MIT code. */
(function(root,factory){ const api=factory(); if(typeof module!=='undefined'&&module.exports) module.exports=api; root.CueMori=api; })(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const MAX_CUES=120, MAX_MINUTES=1440;
const clamp=(v,min,max)=>Math.min(max,Math.max(min,Number.isFinite(+v)?+v:min));
const round=n=>Math.round(n*10)/10;
function clock(value){const m=/^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(value||'')); return m?Number(m[1])*60+Number(m[2]):null;}
function hhmm(m){const n=((Math.floor(m)%1440)+1440)%1440;return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')+(m>=1440?' +'+Math.floor(m/1440)+'日':'');}
function normalize(raw){const d=raw||{};const rows=Array.isArray(d.cues)?d.cues.slice(0,MAX_CUES):[];const ids=new Set();const cues=rows.map((c,i)=>{const item=c||{};let id=String(item.id||'cue'+(i+1)).replace(/[^\w-]/g,'').slice(0,42)||'cue'+(i+1);if(ids.has(id)){let p=2;while(ids.has(id+'-'+p))p++;id+='-'+p;} ids.add(id);return {id,name:String(item.name||'無題').slice(0,90),lane:['舞台','音響','映像','受付'].includes(item.lane)?item.lane:'舞台',owner:String(item.owner||'').slice(0,60).trim(),minutes:round(clamp(item.minutes,0.5,240)),earliest:round(clamp(item.earliest??0,0,MAX_MINUTES)),after:String(item.after||''),memo:String(item.memo||'').slice(0,300)};});return {title:String(d.title||'イベント進行表').slice(0,100),start:/^([01]?\d|2[0-3]):[0-5]\d$/.test(d.start)?d.start:'13:00',hardOut:round(clamp(d.hardOut??120,1,MAX_MINUTES)),cues};}
function schedule(raw,options={}){const d=normalize(raw);const warning=[];const byId=new Map(d.cues.map((c,i)=>[c.id,i]));const predecessors=d.cues.map(()=>new Set());const laneTail=new Map();d.cues.forEach((c,i)=>{if(laneTail.has(c.lane))predecessors[i].add(laneTail.get(c.lane));laneTail.set(c.lane,i);if(c.after){if(c.after===c.id) warning.push('自己依存: '+c.name);else if(!byId.has(c.after)) warning.push('存在しない先行キュー: '+c.name);else predecessors[i].add(byId.get(c.after));}});
 const completed=new Set(), slots=new Array(d.cues.length), reserve=new Map();let deadlocked=[];
 for(let n=0;n<d.cues.length;n++){
   let chosen=-1;
   for(let i=0;i<d.cues.length;i++){if(completed.has(i))continue;if([...predecessors[i]].every(p=>completed.has(p))){chosen=i;break;}}
   if(chosen<0){deadlocked=d.cues.map((c,i)=>!completed.has(i)?c.name:null).filter(Boolean);break;}
   const c=d.cues[chosen], extra=options.delayId===c.id?round(clamp(options.delay,0,240)):0;
   let begin=c.earliest;
   for(const p of predecessors[chosen])begin=Math.max(begin,slots[p].end);
   const occupied=c.owner?reserve.get(c.owner)||[]:[];
   const duration=c.minutes+extra;
   for(let attempts=0;attempts<=occupied.length;attempts++){
      const conflict=occupied.find(s=>begin<s.end && begin+duration>s.start);
      if(!conflict)break;
      begin=conflict.end;
   }
   const end=round(begin+duration); const slot={...c,start:round(begin),end,duration,extra};slots[chosen]=slot;completed.add(chosen);
   if(c.owner){occupied.push({start:begin,end});reserve.set(c.owner,occupied);}
 }
 if(deadlocked.length)warning.push('依存関係が循環しています: '+deadlocked.join('、'));
 const valid=slots.filter(Boolean);const end=valid.reduce((a,c)=>Math.max(a,c.end),0); const overflow=Math.max(0,round(end-d.hardOut));const idle=round(Math.max(0,d.hardOut-end));
 return {data:d,slots:valid,warning,end:round(end),overflow,idle,unscheduled:deadlocked,hardOut:d.hardOut,startsAt:clock(d.start)};
}
function compare(raw,id,delay){const base=schedule(raw);const scenario=schedule(raw,{delayId:id,delay});const old=new Map(base.slots.map(s=>[s.id,s]));const affected=scenario.slots.filter(s=>{const p=old.get(s.id);return p&&(s.start>p.start||s.end>p.end)}).map(s=>({...s,startShift:round(s.start-old.get(s.id).start),endShift:round(s.end-old.get(s.id).end)}));return {base,scenario,affected,overflowDelta:round(scenario.overflow-base.overflow),endDelta:round(scenario.end-base.end)};}
function sample(){return normalize({title:'地域カンファレンス · 進行デモ',start:'13:00',hardOut:115,cues:[
{id:'a',name:'開場・誘導',lane:'受付',owner:'受付チーム',minutes:25,earliest:0,memo:'案内動線を確認'},
{id:'b',name:'機材・投影チェック',lane:'映像',owner:'技術A',minutes:12,earliest:0},
{id:'c',name:'オープニング映像',lane:'映像',owner:'技術A',minutes:4,earliest:25},
{id:'d',name:'開会あいさつ',lane:'舞台',owner:'司会',minutes:8,earliest:25,after:'c'},
{id:'e',name:'基調講演',lane:'舞台',owner:'登壇者A',minutes:35,after:'d'},
{id:'f',name:'質疑応答',lane:'舞台',owner:'司会',minutes:15,after:'e'},
{id:'g',name:'次コーナー映像',lane:'映像',owner:'技術A',minutes:5,earliest:50,after:'e'},
{id:'h',name:'閉会・写真',lane:'舞台',owner:'司会',minutes:10,after:'f'},
{id:'i',name:'撤収誘導',lane:'受付',owner:'受付チーム',minutes:15,after:'h'}]});}
function csv(s){const rows=[['ID','キュー','レーン','担当','開始','終了','分数','メモ'],...s.slots.map(x=>[x.id,x.name,x.lane,x.owner,hhmm((s.startsAt||0)+x.start),hhmm((s.startsAt||0)+x.end),x.duration,x.memo])];return '\uFEFF'+rows.map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');}
return {normalize,schedule,compare,sample,clock,hhmm,csv,MAX_CUES};
});