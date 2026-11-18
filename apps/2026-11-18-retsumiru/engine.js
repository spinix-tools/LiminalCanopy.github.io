/* RETSUMIRU: local-only discrete-event-style minute queue simulation. MIT */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.Retsumiru=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const SLOT=30;
const DEFAULT={title:'地域マルシェ・入場受付',start:'10:00',service:3,capacity:16,threshold:10,trials:80,seed:1826,slots:[{arrivals:24,staff:2},{arrivals:40,staff:2},{arrivals:58,staff:2},{arrivals:46,staff:3},{arrivals:28,staff:2},{arrivals:18,staff:2}]};
const copy=x=>JSON.parse(JSON.stringify(x));
function integer(v,lo,hi,name){const n=Number(v);if(!Number.isInteger(n)||n<lo||n>hi)throw Error(`${name}は${lo}〜${hi}の整数にしてください。`);return n}
function validate(o){if(!o||typeof o!=='object'||Array.isArray(o))throw Error('設定データが不正です。');
if(typeof o.title!=='string'||!o.title.trim()||o.title.length>60)throw Error('イベント名は1〜60文字で入力してください。');
if(typeof o.start!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(o.start))throw Error('開始時刻はHH:MM形式にしてください。');
const startMin=Number(o.start.slice(0,2))*60+Number(o.start.slice(3));
if(!Array.isArray(o.slots)||o.slots.length<2||o.slots.length>12||startMin+SLOT*o.slots.length>1440)throw Error('30分枠は2〜12枠、終了は24:00以内にしてください。');
const v={title:o.title.trim(),start:o.start,service:integer(o.service,1,30,'平均対応分数'),capacity:integer(o.capacity,0,100,'待機上限'),threshold:integer(o.threshold,1,60,'許容待ち時間'),trials:integer(o.trials,1,200,'試行回数'),seed:integer(o.seed,0,2147483647,'乱数シード'),slots:o.slots.map((s,i)=>({arrivals:integer(s.arrivals,0,150,`${i+1}枠の来場者数`),staff:integer(s.staff,1,10,`${i+1}枠の窓口数`)}))};return v}
function rng(seed){let x=(seed>>>0)||0x9e3779b9;return function(){x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/4294967296}}
function trace(s,iteration){const rand=rng((s.seed + Math.imul(iteration+1,0x9e3779b9))>>>0),arr=[];s.slots.forEach((slot,i)=>{for(let j=0;j<slot.arrivals;j++){const at=i*SLOT+Math.floor(rand()*SLOT);const duration=Math.max(1,Math.round(s.service*(0.65+rand()*0.7)));arr.push({at,duration});}});arr.sort((a,b)=>a.at-b.at);return arr}
function quantile(sorted,q){if(!sorted.length)return 0;const idx=Math.max(0,Math.ceil(q*sorted.length)-1);return sorted[idx]}
function simulateOne(settings,people){const s=validate(settings);const length=s.slots.length*SLOT;const queue=[],active=[],waits=[],series=[];let idx=0,turnedAway=0,peak=0,waitTotal=0,late=0,done=0;
for(let t=0;t<=length;t++){
for(let i=active.length-1;i>=0;i--)if(active[i].end<=t){const job=active.splice(i,1)[0];done++;waits.push(job.wait);waitTotal+=job.wait;if(job.wait>s.threshold)late++;}
if(t===length){series.push({minute:t,queue:queue.length,busy:active.length});break;}
const slot=Math.floor(t/SLOT),staff=s.slots[slot].staff;
function start(job){const wait=t-job.at;active.push({end:t+job.duration,wait});}
while(queue.length&&active.length<staff)start(queue.shift());
while(idx<people.length&&people[idx].at===t){const p=people[idx++];if(queue.length===0&&active.length<staff)start(p);else if(queue.length<s.capacity)queue.push(p);else turnedAway++;}
while(queue.length&&active.length<staff)start(queue.shift());
peak=Math.max(peak,queue.length);if(t%5===0)series.push({minute:t,queue:queue.length,busy:active.length});
}
const unfinished=queue.length+active.length;
return {arrivals:people.length,completed:done,turnedAway,unfinished,peak,waitTotal,late,waits,series};}
function run(raw){const s=validate(raw), totals={arrivals:0,completed:0,turnedAway:0,unfinished:0,waitTotal:0,late:0,peakSum:0,peakMax:0};let waits=[],typical=null;
for(let k=0;k<s.trials;k++){const r=simulateOne(s,trace(s,k));if(k===0)typical=r;for(const key of ['arrivals','completed','turnedAway','unfinished','waitTotal','late'])totals[key]+=r[key];totals.peakSum+=r.peak;totals.peakMax=Math.max(totals.peakMax,r.peak);waits.push(...r.waits);}
waits.sort((a,b)=>a-b);
const result={...totals,trials:s.trials,totalPerRun:totals.arrivals/s.trials,completedPerRun:totals.completed/s.trials,turnedAwayPerRun:totals.turnedAway/s.trials,unfinishedPerRun:totals.unfinished/s.trials,averageWait:totals.completed?totals.waitTotal/totals.completed:0,p90:quantile(waits,.9),latePct:totals.completed?totals.late/totals.completed*100:0,peakAverage:totals.peakSum/s.trials,typical:typical.series};
result.score=totals.waitTotal/s.trials + (totals.unfinished/s.trials)*s.threshold*4 + (totals.turnedAway/s.trials)*s.threshold*6;
return result}
function suggestions(raw,base){const s=validate(raw),original=base||run(s);const opts=s.slots.map((x,i)=>{if(x.staff>=10)return null;const test=copy(s);test.slots[i].staff++;const res=run(test);return {index:i,from:x.staff,to:x.staff+1,score:res.score,scoreImprovement:original.score-res.score,result:res}}).filter(Boolean);opts.sort((a,b)=>b.scoreImprovement-a.scoreImprovement||a.index-b.index);return opts;}
function clock(start,mins){let n=Number(start.slice(0,2))*60+Number(start.slice(3))+mins;return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;}
function label(s,i){return `${clock(s.start,i*SLOT)}–${clock(s.start,(i+1)*SLOT)}`}
return {SLOT,DEFAULT,copy,validate,trace,simulateOne,run,suggestions,clock,label,quantile};
});
