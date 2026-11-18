const test=require('node:test');const assert=require('node:assert/strict');const E=require('./engine.js');
const base=()=>({minGap:2,members:[
 {id:'P01',name:'A',roles:'*',unavailable:'',past:0,max:3},
 {id:'P02',name:'B',roles:'見守り',unavailable:'',past:0,max:3},
 {id:'P03',name:'C',roles:'*',unavailable:'',past:0,max:3},
],shifts:[
 {id:'S01',date:'2026-12-01',title:'活動1',role:'見守り',need:2,locked:''},
 {id:'S02',date:'2026-12-03',title:'活動2',role:'設営',need:1,locked:''}
]});
function expectationOk(r){for (const s of r.plan){assert.equal(new Set(s.assigned).size,s.assigned.length);assert.ok(s.assigned.length<=s.need);for(const id of s.assigned){const m=r.members.find(x=>x.id===id);assert.ok(m);assert.ok(m.roles.includes('*')||m.roles.includes(s.role));assert.ok(!m.unavailable.includes(s.date));}}for(const m of r.members){const a=r.plan.flatMap(s=>s.assigned.includes(m.id)?[s.day]:[]);assert.ok(a.length<=m.max);for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length;j++)assert.ok(Math.abs(a[i]-a[j])>=r.minGap && a[i]!==a[j]);}}
test('sample can be fully assigned',()=>{let r=E.solve(base());assert.equal(r.filled,3);assert.equal(r.missing,0);expectationOk(r)});
test('deterministic by seed',()=>{const s=base();assert.deepEqual(E.solve(s,{seed:123}).plan,E.solve(s,{seed:123}).plan)});
test('past duties and new duties tracked',()=>{let s=base();s.members[0].past=4;let r=E.solve(s);assert.equal(r.loads.find(x=>x.id==='P01').total,4+r.loads.find(x=>x.id==='P01').current)});
test('unavailable dates respected',()=>{let s=base();s.members[0].unavailable='2026-12-01';let r=E.solve(s);expectationOk(r);assert.ok(!r.plan[0].assigned.includes('P01'))});
test('role eligibility respected',()=>{let r=E.solve(base());assert.ok(!r.plan[1].assigned.includes('P02'))});
test('strict max 0 forbids assignment',()=>{let s=base();s.members[0].max=0;s.members[1].max=0;let r=E.solve(s);assert.equal(r.missing,1);expectationOk(r)});
test('shortage reported not fabricated',()=>{let s=base();s.members[0].max=0;s.members[2].max=0;let r=E.solve(s);assert.equal(r.missing,2);expectationOk(r)});
test('same day double-booking forbidden even gap 0',()=>{let s=base();s.minGap=0;s.shifts[1].date=s.shifts[0].date;let r=E.solve(s);expectationOk(r)});
test('minimum date gap enforced',()=>{let s=base();s.minGap=3;let r=E.solve(s);expectationOk(r)});
test('fixed assignment honored',()=>{let s=base();s.shifts[0].locked='P02';assert.ok(E.solve(s).plan[0].assigned.includes('P02'))});
test('fixed on unavailable day rejected',()=>{let s=base();s.members[0].unavailable='2026-12-01';s.shifts[0].locked='P01';assert.throws(()=>E.solve(s),/不可日/)});
test('invalid fixed role rejected',()=>{let s=base();s.shifts[1].locked='P02';assert.throws(()=>E.solve(s),/対応できない/)});
test('unknown fixed ID rejected',()=>{let s=base();s.shifts[0].locked='P99';assert.throws(()=>E.solve(s),/見つかりません/)});
test('fixed count overflow rejected',()=>{let s=base();s.shifts[0].need=1;s.shifts[0].locked='P01,P02';assert.throws(()=>E.solve(s),/固定人数/)});
test('fixed duty date too close rejected',()=>{let s=base();s.shifts[0].locked='P01';s.shifts[1].date='2026-12-02';s.shifts[1].locked='P01';assert.throws(()=>E.solve(s),/間隔違反/)});
test('fixed person exclusion rejected',()=>{let s=base();s.shifts[0].locked='P01';assert.throws(()=>E.solve(s,{excluded:'P01'}),/固定担当/)});
test('unfixed exclusion works',()=>{let r=E.solve(base(),{excluded:'P03'});assert.ok(r.plan.every(s=>!s.assigned.includes('P03')));expectationOk(r)});
test('invalid dates rejected',()=>{let s=base();s.shifts[0].date='2026-02-30';assert.throws(()=>E.solve(s),/開催日/)});
test('invalid unavailable date rejected',()=>{let s=base();s.members[0].unavailable='2026-13-01';assert.throws(()=>E.solve(s),/不可日/)});
test('duplicate member ID rejected',()=>{let s=base();s.members[2].id='P01';assert.throws(()=>E.solve(s),/重複/)});
test('duplicate shift ID rejected',()=>{let s=base();s.shifts[1].id='S01';assert.throws(()=>E.solve(s),/重複/)});
test('zero members rejected',()=>{let s=base();s.members=[];assert.throws(()=>E.solve(s),/メンバー/)});
test('zero shifts rejected',()=>{let s=base();s.shifts=[];assert.throws(()=>E.solve(s),/当番枠/)});
test('noninteger need rejected',()=>{let s=base();s.shifts[0].need=1.5;assert.throws(()=>E.solve(s),/整数/)});
test('zero need rejected',()=>{let s=base();s.shifts[0].need=0;assert.throws(()=>E.solve(s),/整数/)});
test('max out of range rejected',()=>{let s=base();s.members[0].max=101;assert.throws(()=>E.solve(s),/上限/)});
test('more than 150 slots rejected',()=>{let s=base();s.shifts=Array.from({length:26},(_,i)=>({id:`S${i}`,date:`2026-12-${String(i+1).padStart(2,'0')}`,role:'見守り',need:6}));assert.throws(()=>E.solve(s),/150枠/)});
test('CSV is BOM and escaping double quotes',()=>{let s=base();s.shifts[0].title='"特別",活動';let r=E.solve(s);let csv=E.csv(r);assert.ok(csv.startsWith('\ufeff'));assert.match(csv,/""特別"",活動/)});
test('date numeric order correct',()=>{assert.equal(E.dayValue('2026-12-03')-E.dayValue('2026-12-01'),2)});
test('invalid leap day rejected',()=>{assert.ok(Number.isNaN(E.dayValue('2026-02-29')))});
test('valid leap day recognized',()=>{assert.ok(Number.isFinite(E.dayValue('2024-02-29')))});
test('max total assignment constrained',()=>{let s=base();s.shifts[0].need=6;s.shifts[1].need=6;let r=E.solve(s);expectationOk(r);assert.ok(r.filled<=6)});
test('many random seeds never violate hard conditions',()=>{for(let seed=1;seed<=24;seed++){const s=base();s.minGap=1+seed%4;s.shifts[1].date=`2026-12-${String(1+seed%7).padStart(2,'0')}`;expectationOk(E.solve(s,{seed,attempts:12}));}});

test('duplicate locked ID rejected',()=>{let s=base();s.shifts[0].locked='P01,P01';assert.throws(()=>E.solve(s),/固定IDが重複/)});
test('blank roles do not imply all roles',()=>{let s=base();s.members[0].roles='';s.members[2].roles='';let r=E.solve(s);assert.equal(r.filled,1);expectationOk(r)});
test('CSV formula characters are neutralized',()=>{let s=base();s.shifts[0].title='=HYPERLINK(1)';let r=E.solve(s);assert.ok(E.csv(r).includes("\"'=HYPERLINK(1)\""));});