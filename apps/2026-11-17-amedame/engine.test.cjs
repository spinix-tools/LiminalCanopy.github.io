const {test} = require('node:test');
const assert = require('node:assert/strict');
const C = require('./engine.js');
const base = C.validateConfig({...C.DEFAULTS,rain:[...C.DEFAULTS.rain],candidates:[...C.DEFAULTS.candidates]});
const approx = (a,b) => assert.ok(Math.abs(a-b)<1e-6,`${a} should equal ${b}`);

test('default valid config',()=>assert.equal(base.area,32));
test('reject zero catchment',()=>assert.throws(()=>C.validateConfig({...base,area:0}),/集水面積/));
test('reject negative rainfall',()=>assert.throws(()=>C.validateConfig({...base,rain:[...base.rain.slice(0,5),-1,...base.rain.slice(6)]}),/雨量/));
test('reject incomplete rain months',()=>assert.throws(()=>C.validateConfig({...base,rain:[5,2]}),/12か月/));
test('reject candidate list over 8',()=>assert.throws(()=>C.validateConfig({...base,candidates:[1,2,3,4,5,6,7,8,9]}),/1～8/));
test('candidates sorted unique',()=>assert.deepEqual(C.validateConfig({...base,candidates:[400,100,400,200]}).candidates,[100,200,400]));
test('reject negative demand',()=>assert.throws(()=>C.validateConfig({...base,demand:-1}),/使用量/));
test('reject invalid year',()=>assert.throws(()=>C.validateConfig({...base,year:2026.5}),/整数/));
test('leap year calculations',()=>{assert.equal(C.isLeap(2000),true);assert.equal(C.isLeap(2100),false);assert.equal(C.isLeap(2028),true);assert.equal(C.daysInMonth(2028,1),29);});
test('365 days for non-leap',()=>assert.equal(C.buildSyntheticDays(2026,base.rain,'even').length,365));
test('366 days for leap',()=>assert.equal(C.buildSyntheticDays(2028,base.rain,'even').length,366));
for(const mode of C.MODES){
  test(mode.label+' preserves monthly rain totals',()=>{
    const days=C.buildSyntheticDays(2026,base.rain,mode.id);
    for(let m=0;m<12;m++)approx(days.filter(x=>x.month===m+1).reduce((sum,d)=>sum+d.rainMm,0),base.rain[m]);
  });
}
test('distinct timing scenarios',()=>{
 const e=C.buildSyntheticDays(2026,base.rain,'even'),b=C.buildSyntheticDays(2026,base.rain,'burst');
 assert.equal(e.filter(x=>x.rainMm>0&&x.month===1).length,31);
 assert.equal(b.filter(x=>x.rainMm>0&&x.month===1).length,2);
});
test('1 mm over 1 m² collects 1 L at 100%',()=>{
 const cfg={...base,area:1,efficiency:100,capacity:10,startPercent:0,demand:0};
 const out=C.simulate([{date:'2026-01-01',month:1,rainMm:1}],cfg);
 approx(out.collected,1);approx(out.endStorage,1);
});
test('overflow only beyond capacity',()=>{
 const cfg={...base,area:1,efficiency:100,capacity:5,startPercent:0,demand:0};
 const out=C.simulate([{date:'2026-01-01',month:1,rainMm:9}],cfg);
 approx(out.overflow,4);approx(out.endStorage,5);
});
test('daily demand consumes after rain',()=>{
 const cfg={...base,area:1,efficiency:100,capacity:10,startPercent:0,demand:3,summerFactor:1};
 const out=C.simulate([{date:'2026-01-01',month:1,rainMm:7}],cfg);
 approx(out.served,3);approx(out.endStorage,4);approx(out.shortage,0);
});
test('dry spell shortage correct',()=>{
 const cfg={...base,area:1,efficiency:100,capacity:3,startPercent:100,demand:2,summerFactor:1};
 const ds=Array.from({length:4},(_,i)=>({date:`2026-01-0${i+1}`,month:1,rainMm:0}));
 const o=C.simulate(ds,cfg);
 approx(o.served,3);approx(o.shortage,5);assert.equal(o.shortageDays,3);assert.equal(o.longestShort,3);
});
test('summer demand applies only Jun-Sep',()=>{
 approx(C.demandAt(5,base),18);approx(C.demandAt(6,base),28.8);approx(C.demandAt(9,base),28.8);approx(C.demandAt(10,base),18);
});
test('zero demand covers 100 percent without shortage days',()=>{
 const cfg={...base,demand:0};const o=C.simulate(C.buildSyntheticDays(2026,cfg.rain,'weekly'),cfg);
 assert.equal(o.coverage,100);assert.equal(o.shortageDays,0);
});
test('water budget conserved day by day',()=>{
 const out=C.simulate(C.buildSyntheticDays(2026,base.rain,'weekly'),base);
 let previous=base.capacity*base.startPercent/100;
 for (const r of out.trace){approx(previous+r.inflow,r.overflow+r.supplied+r.storage);previous=r.storage;}
});
test('no storage outside tank bounds',()=>{
 const out=C.simulate(C.buildSyntheticDays(2026,base.rain,'burst'),base);
 assert.ok(out.trace.every(x=>x.storage>=0 && x.storage<=base.capacity));
});
test('capacity comparison covers every scenario and capacity',()=>{
 const r=C.compare(base);
 assert.equal(r.results.length,base.candidates.length*3);
 assert.equal(r.byCapacity.length,4);
});
test('more capacity should not lower demand coverage with same initial fraction',()=>{
 const r=C.compare({...base,startPercent:0,candidates:[50,100,200,400]});
 for(let i=1;i<r.byCapacity.length;i++)assert.ok(r.byCapacity[i].worst+1e-7>=r.byCapacity[i-1].worst);
});
test('zero rain yields no collection',()=>{
 const o=C.simulate(C.buildSyntheticDays(2026,Array(12).fill(0),'even'),{...base,startPercent:0});
 approx(o.collected,0);approx(o.served,0);assert.equal(o.shortageDays,365);
});
test('template CSV is a full valid dry year',()=>{
 const days=C.parseDailyCSV(C.templateCSV(2026),2026);assert.equal(days.length,365);approx(days.reduce((s,x)=>s+x.rainMm,0),0);
});
test('leap year CSV template parses',()=>assert.equal(C.parseDailyCSV(C.templateCSV(2028),2028).length,366));
test('CSV handles BOM and CRLF',()=>assert.equal(C.parseDailyCSV('\uFEFF'+C.templateCSV(2026),2026).length,365));
test('CSV invalid header rejected',()=>assert.throws(()=>C.parseDailyCSV('date,rain\n2026-01-01,2',2026),/先頭行/));
test('CSV malformed date rejected',()=>assert.throws(()=>C.parseDailyCSV(C.templateCSV(2026).replace('2026-02-28','2026-02-30'),2026),/存在しません/));
test('CSV incomplete date series rejected',()=>assert.throws(()=>C.parseDailyCSV('date,rain_mm\n2026-01-01,0',2026),/漏れなく/));
test('CSV duplicate rejected',()=>assert.throws(()=>C.parseDailyCSV(C.templateCSV(2026).replace('2026-01-02','2026-01-01'),2026),/重複/));
test('CSV negative rain rejected',()=>assert.throws(()=>C.parseDailyCSV(C.templateCSV(2026).replace('2026-01-02,0','2026-01-02,-1'),2026),/雨量/));
test('CSV extra column rejected',()=>assert.throws(()=>C.parseDailyCSV(C.templateCSV(2026).replace('2026-01-02,0','2026-01-02,0,2'),2026),/列数/));
test('CSV export includes one header and daily rows',()=>{
 const d=C.simulate(C.buildSyntheticDays(2026,base.rain,'burst'),base).trace;
 const lines=C.toCSV(d).trim().split(/\r\n/);assert.equal(lines.length,366);assert.equal(lines[0].split(',').length,8);
});
test('observed comparison is single scenario',()=>{
 const d=C.parseDailyCSV(C.templateCSV(2026),2026);
 const r=C.compare(base,d);assert.equal(r.results.length,base.candidates.length);
 assert.equal(r.byCapacity[0].worst,r.byCapacity[0].best);
});
test('runoff efficiency does not change input rainfall',()=>{
 const d=C.buildSyntheticDays(2026,base.rain,'weekly');
 const one=C.simulate(d,{...base,efficiency:100});const half=C.simulate(d,{...base,efficiency:50});
 approx(one.collected,2*half.collected);approx(one.totalRain,half.totalRain);
});
test('calculate zero initial state and first dry day',()=>{
 const o=C.simulate([{date:'2026-01-01',month:1,rainMm:0}],{...base,startPercent:0});
 assert.equal(o.shortageDays,1);assert.equal(o.trace[0].storage,0);
});
