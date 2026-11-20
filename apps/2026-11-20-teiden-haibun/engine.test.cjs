const {test} = require('node:test');
const assert = require('node:assert/strict');
const E = require('./engine.js');
const fresh = () => E.initialState();
function configured(settings, devices){return E.normalizeState({settings,devices});}
function sampleBattery(devices, overrides={}){return configured({...fresh().settings, ...overrides},devices);}
const single = (tier='must', extra={})=>({id:'test',name:'テスト',watts:10,count:1,dutyPct:100,start:0,end:24,tier,...extra});
test('initial demo has valid defaults',()=>{const x=E.normalizeState(fresh());assert.equal(x.settings.hours,24);assert.equal(x.devices.length,6)});
test('empty devices produce no drain',()=>{let a=E.analyze(sampleBattery([]));assert.equal(a.baseline.requestedWh,0);assert.equal(a.baseline.endSocPct,95);assert.equal(a.optionalFactor,1)});
test('exact energy accounting with 100% efficiency',()=>{const x=sampleBattery([single()],{capacityWh:1000,initialPct:100,reservePct:0,efficiencyPct:100,hours:24});const a=E.simulate(x);assert.equal(a.requestedWh,240);assert.equal(a.endSocPct,76);assert.equal(a.unmetWh,0)});
test('conversion losses are applied',()=>{const x=sampleBattery([single()],{capacityWh:1000,initialPct:100,reservePct:0,efficiencyPct:50});assert.equal(E.simulate(x).usedBatteryWh,480)});
test('reserve is preserved',()=>{const x=sampleBattery([single('must',{watts:1000})],{capacityWh:1000,initialPct:100,reservePct:25,efficiencyPct:100,outputW:2000});const a=E.simulate(x);assert.equal(a.endSocPct,25);assert.equal(a.deliveredWh,750);assert.ok(a.unmetWh>0)});
test('initial below reserve leaves no dispatchable energy',()=>{const x=sampleBattery([single()],{initialPct:10,reservePct:20});const a=E.simulate(x);assert.equal(a.endSocPct,10);assert.equal(a.deliveredWh,0)});
test('24-hour interval when start=end',()=>{assert.equal(E.activeAt(single('must',{start:12,end:12}),4),true)});
test('overnight interval wraps at midnight',()=>{let d=single('must',{start:21,end:4});assert.equal(E.activeAt(d,22),true);assert.equal(E.activeAt(d,1),true);assert.equal(E.activeAt(d,14),false)});
test('morning interval excludes endpoint',()=>{let d=single('must',{start:9,end:13});assert.equal(E.activeAt(d,9),true);assert.equal(E.activeAt(d,13),false)});
test('long horizon repeats 24h program',()=>{let x=sampleBattery([single('must',{start:9,end:10})],{hours:72,capacityWh:10000});assert.equal(E.simulate(x).requestedWh,30)});
test('count and duty affect energy',()=>{const x=sampleBattery([single('must',{watts:40,count:3,dutyPct:25})]);assert.equal(E.loadAt(x.devices,0).watts,30);assert.equal(E.loadAt(x.devices,0).conservativePeakW,120)});
test('flex factor reduces consumption but not must',()=>{let x=sampleBattery([single('must',{id:'a',watts:10}),single('flex',{id:'b',watts:20})]);assert.equal(E.loadAt(x.devices,0,.5).watts,20)});
test('flex with zero factor has zero peak contribution',()=>{let x=sampleBattery([single('must',{id:'a',watts:10}),single('flex',{id:'b',watts:999})]);assert.equal(E.loadAt(x.devices,0,0).conservativePeakW,10)});
test('peak warns regardless of average duty',()=>{let x=sampleBattery([single('must',{watts:100,dutyPct:10})],{outputW:50});assert.equal(E.simulate(x).peakViolations,24)});
test('baseline and optimized coincide when all essential',()=>{const x=sampleBattery([single()]);const r=E.analyze(x);assert.equal(r.optimized.requestedWh,r.baseline.requestedWh)});
test('optimized protects essential energy by shedding optional',()=>{let x=sampleBattery([single('must',{id:'a',watts:20}),single('flex',{id:'b',watts:100})],{capacityWh:1000,reservePct:20,initialPct:100,efficiencyPct:100,outputW:500});const r=E.analyze(x);assert.ok(r.optionalFactor<1);assert.ok(r.optionalFactor>0);assert.equal(r.optimized.unmetWh,0);assert.ok(r.baseline.unmetWh>0)});
test('optional zero when rated peak exceeds',()=>{let x=sampleBattery([single('must',{id:'a',watts:100}),single('flex',{id:'b',watts:200})],{outputW:250,capacityWh:100000});const r=E.analyze(x);assert.equal(r.optionalFactor,0);assert.equal(r.optimized.peakViolations,0)});
test('must peak violation is never labeled feasible',()=>{let x=sampleBattery([single('must',{watts:800})],{outputW:500,capacityWh:100000});const r=E.analyze(x);assert.equal(r.essentialFeasible,false);assert.ok(r.optimized.peakViolations>0)});
test('unmeetable essential energy stays visible',()=>{let x=sampleBattery([single('must',{watts:200})],{capacityWh:1000,outputW:1000});const r=E.analyze(x);assert.ok(r.optimized.unmetWh>0);assert.ok(!r.optimizedFeasible)});
test('unmet is nonnegative and consumed battery never exceeds usable',()=>{let a=E.simulate(sampleBattery([single('must',{watts:999})]));assert.ok(a.unmetWh>=0);assert.ok(a.usedBatteryWh<=E.energyBudget(fresh().settings).usableWh+1e-6)});
test('invalid root is rejected',()=>assert.throws(()=>E.normalizeState(null),/形式/));
test('invalid device array is rejected',()=>assert.throws(()=>E.normalizeState({settings:{},devices:'bad'}),/一覧/));
test('device limit rejects abusive import',()=>assert.throws(()=>E.normalizeState({settings:{},devices:Array(37).fill({})}),/最大/));
test('name truncation and clamping protects UI',()=>{const x=sampleBattery([single('flex',{name:'あ'.repeat(100),watts:9000,count:200,dutyPct:-5})]);assert.equal(x.devices[0].name.length,48);assert.equal(x.devices[0].watts,5000);assert.equal(x.devices[0].count,20);assert.equal(x.devices[0].dutyPct,0)});
test('duplicate IDs are uniquely normalized',()=>{let x=sampleBattery([single('must'),single('flex')]);assert.notEqual(x.devices[0].id,x.devices[1].id)});
test('CSV has header, BOM and 24 hour rows',()=>{const t=E.rowsToCsv(E.analyze(fresh()));assert.equal(t.charCodeAt(0),0xfeff);assert.equal(t.trim().split('\r\n').length,25)});
test('hourly table for 72 hours has day 3',()=>{let x=fresh();x.settings.hours=72;const rows=E.hourlyTable(E.analyze(x));assert.equal(rows.length,72);assert.equal(rows[48].day,3)});
test('100% funded energy yields no shortfall',()=>{const x=sampleBattery([single('must',{watts:1})],{capacityWh:5000,initialPct:100,reservePct:0,efficiencyPct:100});const r=E.analyze(x);assert.ok(r.baselineFeasible)});
test('all zero power gives zero demand',()=>{const x=sampleBattery([single('must',{watts:0})]);assert.equal(E.analyze(x).baseline.requestedWh,0)});
test('normalize accepts valid 48h and rejects 35h',()=>{let x=fresh();x.settings.hours=48;assert.equal(E.normalizeState(x).settings.hours,48);x.settings.hours=35;assert.equal(E.normalizeState(x).settings.hours,24)});
test('500 deterministic random schedules satisfy energy and monotonicity',()=>{
  let seed=17435;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<500;i++){
    const devices=Array.from({length:1+Math.floor(rand()*8)},(_,j)=>single(rand()<.5?'must':'flex',{id:'p'+j,watts:Math.floor(rand()*200),count:1+Math.floor(rand()*3),start:Math.floor(rand()*24),end:Math.floor(rand()*25),dutyPct:Math.floor(rand()*101)}));
    const x=sampleBattery(devices,{capacityWh:300+Math.floor(rand()*4000),initialPct:20+Math.floor(rand()*81),reservePct:Math.floor(rand()*20),outputW:400+Math.floor(rand()*1500),efficiencyPct:60+Math.floor(rand()*41),hours:[24,48,72][Math.floor(rand()*3)]});
    const r=E.analyze(x);const a=r.baseline,b=r.optimized;
    assert.equal(a.points.length,x.settings.hours+1);
    assert.ok(b.requestedWh<=a.requestedWh+.001);
    assert.ok(b.endSocPct+0.001>=a.endSocPct);
    for(const plan of [a,b]){
      assert.ok(plan.unmetWh>=0);
      assert.ok(Math.abs(plan.requestedWh-(plan.deliveredWh+plan.unmetWh))<.03);
      for(let h=1;h<plan.points.length;h++){
        assert.ok(plan.points[h].socPct<=plan.points[h-1].socPct+.001);
        assert.ok(plan.points[h].socPct>=x.settings.reservePct-.001 || x.settings.initialPct<x.settings.reservePct);
      }
    }
  }
});
