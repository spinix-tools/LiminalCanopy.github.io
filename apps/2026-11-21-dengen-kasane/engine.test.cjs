const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('./engine.js');
const make=(devices=[],opts={})=>({...E.sample(),from:540,to:720,limitW:1000,reservePct:0,circuits:[{id:'A',name:'A',capW:1000},{id:'B',name:'B',capW:800}],devices,...opts});
const d=(id,watts,start,end,opts={})=>({id,name:id,qty:1,circuit:'A',watts,peakWatts:watts,start,end,flexible:false,slack:0,...opts});
test('sample validates',()=>{const p=E.normalize(E.sample());assert.equal(p.devices.length,6);assert.equal(p.circuits.length,2);});
test('time formatting and parsing',()=>{assert.equal(E.tstr(0),'00:00');assert.equal(E.tstr(555),'09:15');assert.equal(E.mins('17:45'),1065);assert.ok(Number.isNaN(E.mins('24:00')));});
test('single load is included in start bucket, excluded at end',()=>{const a=E.analyze(make([d('t',100,540,555)]));assert.equal(a.slots[0].total,100);assert.equal(a.slots[1].total,0);});
test('add simultaneous load by circuit and global',()=>{const a=E.analyze(make([d('a',600,540,600),d('b',500,540,585),d('c',200,540,570,{circuit:'B'})]));assert.equal(a.slots[0].total,1300);assert.equal(a.slots[0].byCircuit.A,1100);assert.equal(a.slots[0].byCircuit.B,200);assert.equal(a.overloadSlots,3);});
test('reserve reduces effective cap exactly',()=>{const a=E.analyze(make([d('a',950,540,555)],{reservePct:10}));assert.equal(a.allowed,900);assert.equal(a.overloadSlots,1);});
test('individual circuit breach with total below site limit',()=>{const a=E.analyze(make([d('a',1001,540,555)],{limitW:4000}));assert.equal(a.overloadSlots,1);assert.ok(a.warnings.some(w=>w.includes('A が最大')));});
test('startup peak counted on first 15m only',()=>{const a=E.analyze(make([d('a',200,540,585,{peakWatts:1300})]));assert.deepEqual(a.slots.slice(0,3).map(x=>x.total),[1300,200,200]);});
test('multiple units multiply start and run',()=>{const a=E.analyze(make([d('a',150,540,570,{qty:3,peakWatts:200})]));assert.deepEqual(a.slots.slice(0,2).map(x=>x.total),[600,450]);});
test('energy uses 15min watt-hours',()=>{const a=E.analyze(make([d('a',600,540,600)]));assert.equal(a.energyWh,600);});
test('no devices no risk',()=>{const a=E.analyze(make());assert.equal(a.overloadSlots,0);assert.equal(a.energyWh,0);});
test('normalizer caps out-of-range watts, qty, slack',()=>{const a=E.normalize(make([d('a',100000,540,570,{qty:500,peakWatts:80000,slack:10000})]));assert.equal(a.devices[0].watts,15000);assert.equal(a.devices[0].qty,20);assert.equal(a.devices[0].peakWatts,30000);assert.equal(a.devices[0].slack,240);});
test('invalid event range throws',()=>assert.throws(()=>E.normalize(make([],{from:720,to:540})),/終了時刻/));
test('invalid device range throws',()=>assert.throws(()=>E.normalize(make([d('t',500,660,645)])),/終了時刻/));
test('missing and too many circuits rejected',()=>{assert.throws(()=>E.normalize(make([],{circuits:[]})),/回路数/);assert.throws(()=>E.normalize(make([],{circuits:Array.from({length:9},(_,i)=>({id:`${i}`,capW:200}))})),/回路数/);});
test('more than 80 devices rejected',()=>assert.throws(()=>E.normalize(make(Array.from({length:81},(_,i)=>d(`${i}`,100,540,555)))),/80/));
test('duplicate IDs remapped',()=>{const p=E.normalize(make([d('a',100,540,555),d('a',100,540,555)]));assert.notEqual(p.devices[0].id,p.devices[1].id);});
test('unknown circuit repaired',()=>{const p=E.normalize(make([d('a',100,540,555,{circuit:'missing'})]));assert.equal(p.devices[0].circuit,'A');});
test('optimizer moves flexible kettle outside fixed hot plate',()=>{const p=make([d('hot',800,600,720),d('kettle',600,660,690,{flexible:true,slack:90})]);const s=E.suggest(p);assert.equal(s.original.overloadSlots,2);assert.equal(s.result.overloadSlots,0);assert.equal(s.plan.devices[0].start,600);assert.equal(s.plan.devices[1].end-s.plan.devices[1].start,30);});
test('optimizer cannot move fixed devices',()=>{const p=make([d('hot',800,600,720),d('kettle',600,660,690)]);const s=E.suggest(p);assert.equal(s.result.overloadSlots,2);assert.equal(s.shifts.length,0);});
test('optimizer never moves flexible beyond slack nor event',()=>{const p=make([d('hot',800,600,720),d('kettle',600,660,690,{flexible:true,slack:15})]);const s=E.suggest(p);const moved=s.plan.devices[1];assert.ok(Math.abs(moved.start-660)<=15);assert.ok(moved.start>=540&&moved.end<=720);});
test('candidate starts are 15-minute aligned',()=>{const p=E.normalize(make([d('a',100,570,600,{flexible:true,slack:35})]));assert.deepEqual(E.candidateStarts(p,p.devices[0]),[540,555,570,585,600]);});
test('CSV UTF-8 BOM and rows',()=>{const csv=E.toCSV(make([d('机',100,540,555)]));assert.equal(csv.charCodeAt(0),0xFEFF);assert.ok(csv.includes('"机"'));assert.ok(csv.includes('"09:00"'));});
test('XSS escaping',()=>{assert.equal(E.esc('<img src="x">'),'&lt;img src=&quot;x&quot;&gt;');});
test('sample optimizer makes no risk worse',()=>{const p=E.sample(),s=E.suggest(p);assert.ok(s.result.score<=s.original.score);assert.ok(s.result.overloadSlots<s.original.overloadSlots);});
test('JSON serialization preserves fields and analysis',()=>{const p=E.sample();const a=E.analyze(p);const b=E.analyze(JSON.parse(JSON.stringify(p)));assert.equal(a.maxTotal,b.maxTotal);assert.equal(a.energyWh,b.energyWh);});
test('random plans load conservation and optimizer monotonicity (250)',()=>{
 let seed=123456789;const rng=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};
 for(let t=0;t<250;t++){
   const count=3+Math.floor(rng()*7),items=[];
   for(let i=0;i<count;i++){
     const start=540+Math.floor(rng()*8)*15,end=start+(1+Math.floor(rng()*(12-(start-540)/15)))*15;
     items.push(d('a'+i,Math.floor(rng()*600),start,end,{qty:1+Math.floor(rng()*3),peakWatts:Math.floor(rng()*900),circuit:rng()<.5?'A':'B',flexible:rng()<.3,slack:30}));
   }
   const p=make(items);const a=E.analyze(p);
   for(const s of a.slots)assert.equal(s.total,Object.values(s.byCircuit).reduce((x,y)=>x+y,0));
   assert.ok(a.energyWh>=0&&a.overloadSlots>=0&&a.overloadSlots<=a.slots.length);
   const opt=E.suggest(p);assert.ok(opt.result.score<=a.score+1e-6);
   for(const orig of p.devices){const after=opt.plan.devices.find(x=>x.id===orig.id);assert.equal(after.end-after.start,orig.end-orig.start);if(!orig.flexible)assert.equal(orig.start,after.start);else assert.ok(Math.abs(after.start-orig.start)<=orig.slack);}
 }
});
test('CSV formula injection is prefixed',()=>{const p=make([d('=HYPERLINK("x")',100,540,555)]);const csv=E.toCSV(p);assert.ok(csv.includes('"\'=HYPERLINK('));});
test('two independently overloaded circuits report one unique slot',()=>{const p=make([d('a',1200,540,555),d('b',900,540,555,{circuit:'B'})],{limitW:5000});const a=E.analyze(p);assert.equal(a.overloadSlots,1);assert.equal(a.totalExcess,300);});
test('zero watts produce zero energy and no warning',()=>{const p=make([d('a',0,540,555)]);const a=E.analyze(p);assert.equal(a.energyWh,0);assert.deepEqual(a.warnings,[]);});
