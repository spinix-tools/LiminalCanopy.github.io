const test = require('node:test');
const assert = require('node:assert/strict');
const E=require('./engine.js');
const copy=()=>E.clone(E.DEMO);

test('Demo normalisation and independent copies',()=>{
 const a=copy();const b=E.normalise(a);b.crops[0].name='改名';assert.notEqual(a.crops[0].name,b.crops[0].name);
 assert.equal(b.crops.length,4);assert.equal(b.capacity,5);
});
test('Input limits and controlled crop colors',()=>{
 let c=copy();c.weeks=999;c.capacity=-10;c.crops[0].color='javascript:evil';c.crops[0].yield=999;
 c=E.normalise(c);assert.equal(c.weeks,24);assert.equal(c.capacity,1);assert.equal(c.crops[0].yield,12);assert.equal(c.crops[0].color,E.PALETTE[0]);
});
test('Malformed JSON plan rejected',()=>assert.throws(()=>E.normalise({}),/計画JSON/));
test('Duplicate crop identifiers are resolved',()=>{
 const c=copy();c.crops[1].id=c.crops[0].id;const n=E.normalise(c);assert.equal(new Set(n.crops.map(x=>x.id)).size,n.crops.length);
});
test('Week arithmetic crosses year and leap day',()=>{
 assert.equal(E.dateFor('2026-12-28',1),'2027-01-04');
 assert.equal(E.dateFor('2028-02-21',1),'2028-02-28');
 assert.equal(E.dateFor('2028-02-21',2),'2028-03-06');
});
test('Candidate sowing windows and horizon respected',()=>{
 const c=copy();const picks=E.candidates(c);assert.ok(picks.length>10);
 for(const p of picks){const x=c.crops.find(y=>y.id===p.cropId);assert.ok(p.week>=x.sowStart&&p.week<=x.sowEnd);assert.ok(p.harvestFrom<c.weeks);}
});
test('One planting occupies growing and harvesting weeks, no earlier harvest',()=>{
 const c=copy();c.crops=[{...c.crops[0],lead:2,harvest:2,units:2,yield:3,maxBatches:2}];c.capacity=2;
 const d=E.describe(c,[{cropId:'komatsuna',week:1}]);
 assert.deepEqual(d.used.slice(0,6),[0,2,2,2,2,0]);
 assert.deepEqual(d.supply.slice(0,6),[0,0,0,3,3,0]);assert.equal(d.valid,true);
});
test('Overflow above weekly target does not count as useful harvest',()=>{
 const c=copy();c.target=1;const d=E.describe(c,[{cropId:'komatsuna',week:0}]);
 assert.equal(d.actual,2);assert.equal(d.useful,1);assert.equal(d.overflow,1);
});
test('Resource constraint is enforced on every week',()=>{
 const c=copy();c.capacity=1;
 const d=E.describe(c,[{cropId:'komatsuna',week:0},{cropId:'lettuce',week:0}]);
 assert.equal(d.valid,false);assert.match(d.error,/枠/);
});
test('Duplicate planting rejected',()=>{
 const c=copy(),p={cropId:'komatsuna',week:1};assert.equal(E.describe(c,[p,p]).valid,false);
});
test('Too many sowings of a crop rejected',()=>{
 const c=copy();c.crops[0].maxBatches=1;assert.equal(E.describe(c,[{cropId:'komatsuna',week:0},{cropId:'komatsuna',week:5}]).valid,false);
});
test('Window violations rejected',()=>{
 const c=copy();c.crops[0].sowStart=3;assert.equal(E.describe(c,[{cropId:'komatsuna',week:1}]).valid,false);
});
test('Pin addition is immutable and retained',()=>{
 const c=copy();const added=E.addPin(c,{cropId:'komatsuna',week:0});assert.equal(c.pinned.length,0);assert.deepEqual(added.pinned,[{cropId:'komatsuna',week:0}]);
});
test('Invalid pinned dates, duplicates, and overcapacity rejected',()=>{
 const c=copy();const n=E.addPin(c,{cropId:'komatsuna',week:0});
 assert.throws(()=>E.addPin(n,{cropId:'komatsuna',week:0}),/固定/);
 assert.throws(()=>E.addPin(n,{cropId:'nonesuch',week:0}),/作物/);
 const x=copy();x.capacity=1;x.pinned=[{cropId:'komatsuna',week:0},{cropId:'radish',week:1}];assert.throws(()=>E.plan(x),/矛盾/);
});
test('Plan results are feasible, complete and repeatable',()=>{
 const c=copy();const a=E.plan(c),b=E.plan(c);
 assert.equal(a.stats.valid,true);assert.deepEqual(a.selected,b.selected);
 assert.equal(a.stats.supply.length,c.weeks);assert.ok(a.stats.met>0);
 assert.ok(a.stats.used.every(v=>v<=c.capacity));
});
test('Pinned plantings persist across both optimization modes',()=>{
 for(const mode of ['coverage','lowwork']){
 const c=copy();c.mode=mode;c.pinned=[{cropId:'komatsuna',week:0}];const p=E.plan(c);
 assert.ok(p.selected.some(x=>x.cropId==='komatsuna'&&x.week===0));
 }
});
test('Every emitted planting has an equivalent candidate',()=>{
 const c=copy();const p=E.plan(c),ids=new Set(E.candidates(c).map(x=>x.cropId+':'+x.week));
 p.selected.forEach(x=>assert.ok(ids.has(x.cropId+':'+x.week)));
});
test('No eligible harvest means empty plan',()=>{
 const c=copy();c.weeks=6;c.crops=c.crops.map(x=>({...x,lead:12,sowEnd:5}));
 assert.equal(E.plan(c).selected.length,0);
});
test('Targets are counted as total useful output not just nonzero weeks',()=>{
 const c=copy();c.target=4;const d=E.describe(c,[{cropId:'komatsuna',week:0}]);
 assert.equal(d.met,0);assert.equal(d.useful,2);assert.equal(d.shortages,4*c.weeks-2);
});
test('CSV contains BOM, Japanese headers and manual flag',()=>{
 const c=E.addPin(copy(),{cropId:'komatsuna',week:0});const p=E.plan(c),csv=E.exportCsv(p);
 assert.ok(csv.startsWith('\ufeff'));assert.match(csv,/種まき日/);assert.match(csv,/"はい"/);assert.match(csv,/2026-11-23/);
});
test('CSV formula injection from names is neutralized',()=>{
 const c=copy();c.crops[0].name='=HYPERLINK("evil")';c.pinned=[{cropId:'komatsuna',week:0}];
 const csv=E.exportCsv(E.plan(c));assert.match(csv,/"'=HYPERLINK/);
});
test('Random generated scenarios preserve constraints and stable aggregate accounting',()=>{
 let seed=173;const rng=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<250;i++){
  let c=copy();c.weeks=6+Math.floor(rng()*12);c.capacity=1+Math.floor(rng()*7);c.target=1+Math.floor(rng()*6);
  c.crops=c.crops.slice(0,1+Math.floor(rng()*4)).map(x=>({...x,lead:1+Math.floor(rng()*6),harvest:1+Math.floor(rng()*4),units:1+Math.floor(rng()*c.capacity),yield:1+Math.floor(rng()*5),sowStart:0,sowEnd:c.weeks-1,maxBatches:1+Math.floor(rng()*8)}));
  const p=E.plan(c),d=E.describe(p.config,p.selected);
  assert.equal(d.valid,true,`random case ${i}`);assert.ok(d.used.every(x=>x<=c.capacity));
  assert.equal(d.actual,d.supply.reduce((a,b)=>a+b,0));
  assert.equal(d.useful+d.overflow,d.actual);
  assert.equal(d.useful+d.shortages,c.target*c.weeks);
  assert.deepEqual(d.supply,p.stats.supply);
 }
});
