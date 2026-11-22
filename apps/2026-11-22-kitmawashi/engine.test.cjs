const {test} = require('node:test');
const assert = require('node:assert/strict');
const E=require('./engine.js');
const sample=()=>E.demo('2026-11-22');
function seeded(seed=7281){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};}
test('date round trip incl leap day',()=>{for(const x of ['2024-02-29','2026-11-22','2030-01-01'])assert.equal(E.date(E.day(x)),x)});
test('invalid date rejected',()=>{assert.ok(Number.isNaN(E.day('2025-02-29')));assert.ok(Number.isNaN(E.day('not-date')));});
test('next day UTC',()=>assert.equal(E.plus('2026-12-31',1),'2027-01-01'));
test('valid demo retains inventory',()=>assert.deepEqual(E.validate(sample()),sample()));
test('kit recipe demand multiplication',()=>assert.deepEqual(E.demand(sample(),{kitId:'stream',qty:2}),{battery:4,mic:4,tripod:2,light:2,case:2}));
test('inclusive endpoint',()=>{const d=sample(); assert.equal(E.loadAt(d,d.bookings.filter(x=>x.status==='confirmed'),E.day('2026-11-25')).battery,4);});
test('confirmed fleet not overcommitted',()=>assert.equal(E.analyse(sample()).confirmedIssues.length,0));
test('all-proposal conflicts detected',()=>{const d=E.analyse(sample());assert.ok(d.allIssues.some(x=>x.itemId==='battery'&&x.short===1));});
test('proposal can be blocked but alternative found',()=>{const d=sample(),p=d.bookings[2];assert.equal(E.assess(d,p).ok,false);assert.ok(E.suggestion(d,p)?.start > p.start);});
test('safe proposal passes',()=>{const d=sample();assert.equal(E.assess(d,d.bookings[3]).ok,true);});
test('zero stock flags issue',()=>{const d=sample();d.items.find(x=>x.id==='case').qty=0;assert.ok(E.analyse(d).confirmedIssues.some(x=>x.itemId==='case'));});
test('invalid kit item rejected',()=>{const d=sample();d.kits[0].parts.NOPE=1;assert.throws(()=>E.validate(d));});
test('zero-part kit rejected',()=>{const d=sample();d.kits[0].parts={};assert.throws(()=>E.validate(d));});
test('unknown booking kit rejected',()=>{const d=sample();d.bookings[0].kitId='NOPE';assert.throws(()=>E.validate(d));});
test('duplicate IDs rejected',()=>{const d=sample();d.items[1].id=d.items[0].id;assert.throws(()=>E.validate(d));});
test('end before start rejected',()=>{const d=sample();d.bookings[0].end='2026-01-01';assert.throws(()=>E.validate(d));});
test('long borrow rejected',()=>{const d=sample();d.bookings[0].end='2027-11-22';assert.throws(()=>E.validate(d));});
test('script injection chars dropped from names',()=>{const d=sample();d.items[0].name='<svg onload=x>';assert.ok(!E.validate(d).items[0].name.includes('<'));});
test('all issues have real shortages',()=>{for(const x of E.analyse(sample()).allIssues)assert.equal(x.used-x.stock,x.short);});
test('capacity property randomized: usage equals sum of active demands (500 cases)',()=>{
 const r=seeded();for(let i=0;i<500;i++){
  const d=sample();for(const item of d.items)item.qty=Math.floor(r()*10);
  for(const b of d.bookings){b.start=E.plus('2026-11-22',Math.floor(r()*7));b.end=E.plus(b.start,Math.floor(r()*5));b.qty=1+Math.floor(r()*3);}
  const t=E.day(E.plus('2026-11-22',Math.floor(r()*12)));
  const used=E.loadAt(d,d.bookings,t);
  for(const x of d.items){let manual=0;for(const b of d.bookings)if(E.day(b.start)<=t&&E.day(b.end)>=t)manual+=(d.kits.find(k=>k.id===b.kitId).parts[x.id]||0)*b.qty;assert.equal(used[x.id]||0,manual);}
  const report=E.issues(d,d.bookings);assert.ok(report.every(x=>x.used>x.stock));
 }
});
test('suggestions never exceed committed inventory (250 cases)',()=>{
 const r=seeded(311);for(let i=0;i<250;i++){
  const d=sample();for(const b of d.bookings){b.start=E.plus('2026-11-22',Math.floor(r()*8));b.end=E.plus(b.start,Math.floor(r()*4));}
  const p=d.bookings[2],s=E.suggestion(d,p,20);
  if(s) assert.equal(E.assess(d,{...p,start:s.start,end:s.end}).ok,true);
 }
});
