/* node --test engine.test.cjs */
const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("./engine.js");
const settings = {bpm:120,meter:3,hearBars:2,muteBars:1,rounds:2,latency:0};
const P = E.makePlan(settings);
const measured = P.beats.filter(b=>b.phase!=="countin");
function perfect(p=P){return p.beats.filter(b=>b.phase!=="countin").map(b=>b.timeMs);}
test("config supplies defaults and allowed ranges",()=>{
  const a=E.config();assert.equal(a.bpm,90);assert.equal(a.meter,4);
  const b=E.config({bpm:900,meter:-2,hearBars:0,muteBars:33,rounds:200,latency:-999});
  assert.deepEqual([b.bpm,b.meter,b.hearBars,b.muteBars,b.rounds,b.latency],[220,2,1,8,8,-200]);
});
test("timeline interval and duration",()=>{
  assert.equal(P.intervalMs,500);assert.equal(P.beats.length,21);assert.equal(P.totalMs,10500);
});
test("audible count-in followed by heard and quiet",()=>{
  assert.deepEqual(P.beats.slice(0,4).map(x=>x.phase),["countin","countin","countin","heard"]);
  assert.equal(P.beats[9].phase,"quiet");assert.equal(P.beats[12].returnBeat,true);
});
test("count-in does not enter performance scoring",()=>{
  const a=E.analyze(P,perfect());assert.equal(a.total.expected,18);assert.equal(a.total.hit,18);
});
test("perfect taps have no drift or misses",()=>{
  const r=E.analyze(P,perfect());assert.equal(r.total.hitRate,100);assert.equal(r.total.meanSignedMs,0);assert.equal(r.extras,0);
});
test("round boundary after silence is separated",()=>{
  const r=E.analyze(P,perfect());assert.equal(r.phases.return.expected,1);assert.equal(r.phases.return.hit,1);
  assert.equal(r.phases.heard.expected+r.phases.quiet.expected+r.phases.return.expected,r.total.expected);
});
test("quiet curve covers each quiet bar",()=>{
  const r=E.analyze(P,perfect());assert.equal(r.curve.length,1);assert.equal(r.curve[0].summary.expected,6);
});
test("late and early errors have signed results",()=>{
  const t=perfect().map((t,i)=>t+(i%2===0?20:-20));const r=E.analyze(P,t);
  assert.equal(r.total.meanAbsMs,20);assert.equal(r.total.meanSignedMs,0);
});
test("calibration removes constant input delay",()=>{
  const t=perfect().map(x=>x+75);const r=E.analyze(P,t,75);
  assert.equal(r.total.meanAbsMs,0);assert.equal(r.latencyMs,75);
});
test("missed taps are explicitly counted",()=>{
  const r=E.analyze(P,perfect().slice(1));assert.equal(r.total.missed,1);assert.equal(r.total.hitRate,94.4);
});
test("duplicate taps are extra, closest wins",()=>{
  const t=perfect();const a=t[0];t.push(a+35);
  const r=E.analyze(P,t);assert.equal(r.extras,1);assert.equal(r.rows[0].errorMs,0);
});
test("a better second tap wins",()=>{
  const t=perfect();t[0]+=40;t.push(perfect()[0]+3);
  const r=E.analyze(P,t);assert.equal(r.rows[0].errorMs,3);assert.equal(r.extras,1);
});
test("a tap on count-in is not scored",()=>{
  const r=E.analyze(P,[0,...perfect()]);assert.equal(r.extras,1);assert.equal(r.total.hit,18);
});
test("out-of-range nonnumeric taps are rejected",()=>{
  const r=E.analyze(P,[NaN,-1000,Infinity,...perfect()]);assert.equal(r.extras,3);
});
test("cannot analyze non-array taps",()=>assert.throws(()=>E.analyze(P,{}),/配列/));
test("cannot analyze a fake plan",()=>assert.throws(()=>E.analyze({},[]),/拍プラン/));
test("CSV includes UTF-8 BOM and quoted headers",()=>{
  const c=E.csv(E.analyze(P,perfect()));assert.ok(c.startsWith("\uFEFF"));
  assert.ok(c.includes('"deviation_ms"'));assert.equal(c.trim().split("\r\n").length,19);
});
test("session export and import preserve results",()=>{
  const t=perfect().map(x=>x+10), r=E.restore(E.serialize(settings,t));
  assert.deepEqual(r.taps,t);assert.equal(r.result.total.meanSignedMs,10);assert.equal(r.config.bpm,120);
});
test("unknown session app and version are refused",()=>{
  assert.throws(()=>E.restore(JSON.stringify({app:"bad",version:1,taps:[]})),/対応/);
  assert.throws(()=>E.restore(JSON.stringify({app:"hakuma-gap",version:2,taps:[]})),/対応/);
});
test("session import does not allow negatives or text",()=>{
  const s=JSON.parse(E.serialize(settings,[1000]));
  s.taps=[-1];assert.throws(()=>E.restore(JSON.stringify(s)),/範囲/);
  s.taps=["1"];assert.throws(()=>E.restore(JSON.stringify(s)),/範囲/);
});
test("session export rejects unreasonable data",()=>{
  assert.throws(()=>E.serialize(settings,[-1]),/保存/);
  assert.throws(()=>E.serialize(settings,Array(10001).fill(0)),/保存/);
});
test("demo is deterministic and inside timeline",()=>{
  const a=E.demoTaps(P),b=E.demoTaps(P);assert.deepEqual(a,b);
  assert.ok(a.every(x=>x>=0&&x<P.totalMs));assert.ok(E.analyze(P,a).total.hitRate>80);
});
test("lowest and highest tempo have bounded arrays",()=>{
  [40,220].forEach(bpm=>{const p=E.makePlan({bpm,meter:7,hearBars:8,muteBars:8,rounds:8});
    assert.equal(p.beats.length,7+7*16*8);assert.ok(p.totalMs>0);
  });
});
test("empty performance stats are null (not misleading zero)",()=>{
  const r=E.analyze(P,[]);assert.equal(r.total.hit,0);assert.equal(r.total.meanAbsMs,null);
  assert.equal(r.phases.quiet.meanSignedMs,null);
});
test("all expected rows are unique and ordered",()=>{
  const r=E.analyze(P,perfect());assert.deepEqual(r.rows.map(x=>x.index),measured.map(x=>x.index));
  assert.equal(new Set(r.rows.map(x=>x.index)).size,r.rows.length);
});
test("randomized conservation checks: 500 configurations",()=>{
  let seed=781;function rand(max){seed=(seed*1664525+1013904223)>>>0;return seed%max;}
  for(let i=0;i<500;i++){
    const p=E.makePlan({bpm:40+rand(181),meter:2+rand(6),hearBars:1+rand(8),muteBars:1+rand(8),rounds:1+rand(8),latency:0});
    const t=p.beats.filter(x=>x.phase!=="countin").filter((_,j)=>j%7!==0).map(x=>x.timeMs);
    const r=E.analyze(p,t);
    assert.equal(r.total.expected,(p.config.hearBars+p.config.muteBars)*p.config.meter*p.config.rounds);
    assert.equal(r.total.expected,r.total.hit+r.total.missed);
    assert.equal(r.total.expected,r.phases.heard.expected+r.phases.quiet.expected+r.phases.return.expected);
    assert.ok(r.total.hitRate>=0&&r.total.hitRate<=100);
    assert.ok(p.beats.every((b,k)=>b.index===k&&Math.abs(b.timeMs-k*p.intervalMs)<.001));
  }
});
