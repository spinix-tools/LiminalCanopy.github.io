'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const E=require('./engine.js');
const sample=E.demo;
const checks=[
['5分単位の時刻',()=>{assert.equal(E.minutes('05:05'),305);assert.equal(E.clock(305),'05:05');}],
['不正時刻を拒否',()=>{for(const v of ['25:00','5:00','23:70','01:3','abc'])assert.throws(()=>E.minutes(v));}],
['初期サンプルを計画できる',()=>{const r=E.plan(sample());assert.equal(r.rows.length,6);assert.equal(r.config.oven,4);}],
['3方式が利用可能',()=>{for(const m of ['due','proof','manual','auto'])assert.equal(E.plan(sample(),m).rows.length,6);}],
['不正な方式を拒否',()=>assert.throws(()=>E.plan(sample(),'future'))],
['仕込みが重ならない',()=>{const r=E.plan(sample());const sorted=[...r.rows].sort((a,b)=>a.prepStart-b.prepStart);for(let i=1;i<sorted.length;i++)assert.ok(sorted[i].prepStart>=sorted[i-1].prepEnd);} ],
['発酵の最低時間を保持',()=>{const r=E.plan(sample());for(const x of r.rows)if(!x.unscheduled)assert.ok(x.bakeStart>=x.prepEnd+x.proof);} ],
['天板上限を守る',()=>{const r=E.plan(sample());for(const used of r.used.values())assert.ok(used<=r.config.oven);} ],
['単一バッチの工程開始と終了',()=>{const d={start:'06:00',oven:2,jobs:[{id:'x',name:'食パン',trays:2,prep:20,proof:50,proofMax:90,bake:30,cool:20,due:'09:00'}]};const x=E.plan(d).rows[0];assert.equal(x.prepStart,360);assert.equal(x.ready,430);assert.equal(x.bakeStart,430);assert.equal(x.finished,480);assert.equal(x.late,0);}],
['同一窯で容量を超える場合に逐次',()=>{const d=sample();d.oven=3;d.jobs=d.jobs.slice(0,2).map(j=>({...j,trays:3}));const r=E.plan(d);let baked=r.rows.filter(x=>!x.unscheduled).sort((a,b)=>a.bakeStart-b.bakeStart);if(baked.length===2)assert.ok(baked[0].bakeEnd<=baked[1].bakeStart);}],
['空製品は拒否',()=>{const d=sample();d.jobs=[];assert.throws(()=>E.plan(d));}],
['31件を拒否',()=>{const d=sample();d.jobs=Array.from({length:31},(_,i)=>({...d.jobs[0],id:'x'+i}));assert.throws(()=>E.plan(d));}],
['重複IDを拒否',()=>{const d=sample();d.jobs[1].id=d.jobs[0].id;assert.throws(()=>E.plan(d));}],
['開始時刻の粒度を確認',()=>{const d=sample();d.start='05:02';assert.throws(()=>E.plan(d));}],
['期限が開始より後であること',()=>{const d=sample();d.jobs[0].due=d.start;assert.throws(()=>E.plan(d));}],
['無効な天板数を拒否',()=>{const d=sample();d.jobs[0].trays=100;assert.throws(()=>E.plan(d));}],
['発酵窓の逆転を拒否',()=>{const d=sample();d.jobs[0].proofMax=30;assert.throws(()=>E.plan(d));}],
['負の冷却時間を拒否',()=>{const d=sample();d.jobs[0].cool=-5;assert.throws(()=>E.plan(d));}],
['仕込みは5分刻み',()=>{const d=sample();d.jobs[0].prep=13;assert.throws(()=>E.plan(d));}],
['仕込み0を拒否',()=>{const d=sample();d.jobs[0].prep=0;assert.throws(()=>E.plan(d));}],
['合計遅延は各バッチ合計',()=>{const r=E.plan(sample());assert.equal(r.metrics.lateMinutes,r.rows.reduce((s,x)=>s+x.late,0));}],
['合計焼成天板分は各バッチ合計',()=>{const r=E.plan(sample());assert.equal(r.metrics.ovenMinutes,r.rows.reduce((s,x)=>s+(x.unscheduled?0:x.bake*x.trays),0));}],
['CSVはBOMとCRLF',()=>{const s=E.csv(E.plan(sample()));assert.ok(s.startsWith('\ufeff'));assert.ok(s.includes('\r\n'));}],
['CSV式注入を無効化',()=>{const d=sample();d.jobs[0].name='=HYPERLINK("x","z")';const s=E.csv(E.plan(d));assert.match(s,/'=HYPERLINK/);}],
['名前に改行がある場合もCSVで引用',()=>{const d=sample();d.jobs[0].name='商品\nテスト';assert.match(E.csv(E.plan(d)),/"商品\nテスト"/);}],
['自動モードは候補スコア最小',()=>{const d=sample(), a=E.plan(d,'due'),b=E.plan(d,'proof'),c=E.plan(d,'auto');assert.equal(c.score,Math.min(a.score,b.score));}],
['窯容量を1枚増やした再計画',()=>{const d=sample();const a=E.plan(d);const b=E.plan({...d,oven:d.oven+1});assert.equal(b.config.oven,d.oven+1);assert.equal(a.config.oven,d.oven);}],
['capacity check on half-open time segments',()=>{const u=new Map([[0,2],[5,2]]);assert.equal(E.occupy(u,0,10,2,3),false);assert.equal(E.occupy(u,10,10,3,3),true);}],
['end-of-day unscheduled is represented',()=>{const d=sample();d.start='23:00';d.jobs=[{id:'x',name:'遅いパン',trays:1,prep:60,proof:90,proofMax:90,bake:20,cool:10,due:'23:55'}];const r=E.plan(d);assert.ok(r.rows[0].unscheduled);assert.equal(r.metrics.unscheduled,1);}],
['終業翌日冷却を検出',()=>{const d=sample();d.start='22:00';d.jobs=[{id:'x',name:'夜のパン',trays:1,prep:60,proof:5,proofMax:50,bake:30,cool:80,due:'23:55'}];const r=E.plan(d);assert.ok(r.rows[0].beyondDay);}],
];
for (const [name,fn] of checks) test(name,fn);
// Seeded property-based checks: no oven overbooking; prep is single-resource; each row meets minimum proof.
test('固定シード500シナリオで資源・工程の不変条件',()=>{
 let seed=0xbed012;const rand=(lo,hi)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return lo+(seed%(hi-lo+1));};
 for(let t=0;t<500;t++){
   const oven=rand(1,9),start=rand(0,90)*5, count=rand(1,16);
   const d={start:E.clock(start),oven,jobs:Array.from({length:count},(_,i)=>({id:`j${i}`,name:`Test ${i}`,prep:rand(1,12)*5,proof:rand(1,24)*5,proofMax:0,bake:rand(1,12)*5,cool:rand(0,9)*5,trays:rand(1,oven),due:E.clock(rand(Math.floor(start/5)+1,287)*5)}))};
   for(const j of d.jobs)j.proofMax=j.proof+rand(0,24)*5;
   const result=E.plan(d,['auto','due','proof','manual'][t%4]);
   const s=[...result.rows].sort((a,b)=>a.prepStart-b.prepStart);
   for(let i=1;i<s.length;i++)assert.ok(s[i].prepStart>=s[i-1].prepEnd);
   const load=new Map();
   for(const x of s){assert.equal(x.prepEnd-x.prepStart,x.prep);if(x.unscheduled)continue;assert.ok(x.bakeStart>=x.ready);assert.equal(x.bakeEnd-x.bakeStart,x.bake);assert.equal(x.finished-x.bakeEnd,x.cool);assert.equal(x.overproof,Math.max(0,x.bakeStart-x.last));assert.equal(x.late,Math.max(0,x.finished-x.due));for(let tm=x.bakeStart;tm<x.bakeEnd;tm+=5)load.set(tm,(load.get(tm)||0)+x.trays);}
   for(const val of load.values())assert.ok(val<=oven);
   assert.equal(result.metrics.total,count);
 }
});
