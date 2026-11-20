const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('./engine.js');
const fixed = new Date(2026, 10, 21);
const demo = () => E.demoData(fixed);

test('date math: leap day accepted; invalid leap rejected',()=>{
  assert.equal(E.isoDay(E.dayNumber('2028-02-29')),'2028-02-29');
  assert.throws(()=>E.dayNumber('2027-02-29'), /存在しない/);
  assert.throws(()=>E.dayNumber('2026-02-30'), /存在しない/);
});
test('reject malformed/overlong date spans',()=>{
  assert.throws(()=>E.daySpan('2026-11-22','2026-11-21'), /90日/);
  assert.throws(()=>E.daySpan('2026-11-22','2027-04-22'), /90日/);
  assert.throws(()=>E.dayNumber('2026-1-1'), /YYYY/);
});
test('seed has coherent planned shortages',()=>{
  const a=E.analyze(demo());
  assert.equal(a.stats.bookings,4);assert.equal(a.stats.items,6);
  assert(a.stats.blocked>=2);assert(a.stats.shortageDays>=1);
  assert(a.purchases.find(i=>i.id==='mic').add===1);
});
test('same-day demand adds, non-overlap does not',()=>{
  const d=demo();d.bookings=d.bookings.slice(0,2);const a=E.analyze(d);
  assert.equal(a.purchases.find(x=>x.id==='mic').add,1);
  d.bookings[1].start='2026-12-01';d.bookings[1].end='2026-12-01';
  assert.equal(E.analyze(d).purchases.length,0);
});
test('last day is inclusive of overlapping bookings',()=>{
  const d=demo();d.bookings=d.bookings.slice(0,2);
  d.bookings[0].start='2026-11-22';d.bookings[0].end='2026-11-23';
  d.bookings[1].start='2026-11-23';d.bookings[1].end='2026-11-23';
  assert.equal(E.analyze(d).purchases.find(x=>x.id==='mic').add,1);
});
test('kit copies scale quantity',()=>{
  const d=demo();d.bookings=d.bookings.slice(0,1);d.bookings[0].copies=2;
  const a=E.analyze(d);
  assert.equal(a.bookings[0].lines.find(x=>x.itemId==='mic').required,4);
  assert.equal(a.purchases.find(x=>x.id==='mic').add,1);
});
test('zero inventory yields shortages',()=>{
  const d=demo();d.bookings=d.bookings.slice(0,1);d.items.find(x=>x.id==='mic').stock=0;
  const a=E.analyze(d);assert.equal(a.purchases.find(x=>x.id==='mic').add,2);
});
test('check is non-allocative, and cannot bypass shortage',()=>{
  const d=demo(), a=E.analyze(d);d.bookings[0].checked=['mic','hdmi','power','sign'];
  const b=E.analyze(d);assert.deepEqual(a.purchases,b.purchases);
  assert.equal(b.bookings[0].completed,false);assert.equal(b.bookings[0].checkedCount,4);
});
test('fully checked and sufficiently stocked is completed',()=>{
  const d=demo();d.bookings=d.bookings.slice(0,1);d.bookings[0].checked=['mic','hdmi','power','sign'];
  const a=E.analyze(d);assert.equal(a.bookings[0].completed,true);
});
test('deleting bookings eliminates spurious shortage',()=>{
  const d=demo();d.bookings=[];const a=E.analyze(d);
  assert.equal(a.stats.blocked,0);assert.equal(a.calendar.length,0);assert.equal(a.purchases.length,0);
});
test('malformed references and duplicate IDs rejected',()=>{
  const d=demo();d.kits[0].lines[0].itemId='missing';assert.throws(()=>E.analyze(d),/存在しない備品/);
  const e=demo();e.items.push({...e.items[0]});assert.throws(()=>E.analyze(e),/重複/);
});
test('no negative/fractional quantity or unsupported version',()=>{
  const d=demo();d.items[0].stock=-1;assert.throws(()=>E.analyze(d),/整数/);
  const e=demo();e.bookings[0].copies=1.2;assert.throws(()=>E.analyze(e),/整数/);
  const f=demo();f.schemaVersion=2;assert.throws(()=>E.analyze(f),/対応していない/);
});
test('cross-reference validation and 90-day maximum',()=>{
  const d=demo();d.bookings[0].kitId='no-kit';assert.throws(()=>E.analyze(d),/存在しないキット/);
  const e=demo();e.bookings[0].end='2027-05-22';assert.throws(()=>E.analyze(e),/90日/);
});
test('CSV quoting and BOM for Japanese spreadsheet',()=>{
  const out=E.csv([['a','b'],['"quoted", field','line\n2']]);
  assert(out.startsWith('\ufeff')); assert.match(out,/""quoted"", field/);assert.match(out,/"line\n2"/);
  assert.match(E.purchaseCsv(E.analyze(demo())),/追加数/);
});
test('CSV spreadsheet formula prefix is neutralized',()=>{
  const s=E.csv([['=HYPERLINK("https://example.invalid")','+SUM(1,2)','-3','@foo','安全']]);
  assert(s.includes("'=HYPERLINK")); assert(s.includes("'+SUM(1,2)"));
  assert(s.includes("'-3"));assert(s.includes("'@foo"));
});
test('JSON roundtrip normalizes checked and drops stray fields',()=>{
  const d=demo();d.bookings[0].checked=['mic','mic','missing'];d.items[0].untrusted='<img src=x>';
  const clean=E.validateProject(JSON.parse(JSON.stringify(d)));
  assert.deepEqual(clean.bookings[0].checked,['mic']);assert.equal(clean.items[0].untrusted,undefined);
  assert.deepEqual(E.analyze(clean).stats,E.analyze(d).stats);
});
test('pick CSV preserves selected booking',()=>{
  const a=E.analyze(demo());const csv=E.pickCsv(a,'ex-a');
  assert.match(csv,/ミニ講演会/);assert.match(csv,/ワイヤレスマイク/);
  assert.throws(()=>E.pickCsv(a,'not-there'),/見つかりません/);
});
test('deterministic randomized per-day demand equals brute force in 250 cases',()=>{
  let seed=93471;const rand=()=>((seed= (1664525*seed+1013904223)>>>0)/2**32);
  for(let t=0;t<250;t++){
    const d={schemaVersion:1,items:[],kits:[],bookings:[]};
    for(let i=0;i<5;i++)d.items.push({id:`i${i}`,name:`item ${i}`,stock:Math.floor(rand()*20),unit:'個',place:''});
    for(let k=0;k<3;k++)d.kits.push({id:`k${k}`,name:`kit ${k}`,lines:d.items.filter(()=>rand()>.4).map(it=>({itemId:it.id,qty:1+Math.floor(rand()*4)}))});
    for(let k of d.kits)if(!k.lines.length)k.lines=[{itemId:'i0',qty:1}];
    for(let b=0;b<8;b++){let start=1+Math.floor(rand()*8);d.bookings.push({id:`b${b}`,title:`booking ${b}`,kitId:`k${Math.floor(rand()*3)}`,copies:1+Math.floor(rand()*3),start:`2026-12-${String(start).padStart(2,'0')}`,end:`2026-12-${String(start+Math.floor(rand()*4)).padStart(2,'0')}`,note:'',checked:[]});}
    const a=E.analyze(d);
    for(let day=1;day<=12;day++)for(const item of d.items){
      let total=0;for(const b of d.bookings){const n=Number(b.start.slice(-2)),end=Number(b.end.slice(-2));if(day<n||day>end)continue;const kit=d.kits.find(k=>k.id===b.kitId);total+=(kit.lines.find(l=>l.itemId===item.id)?.qty||0)*b.copies;}
      const at=a.shortages.find(x=>x.date===`2026-12-${String(day).padStart(2,'0')}`&&x.itemId===item.id)?.shortage||0;
      assert.equal(at,Math.max(0,total-item.stock),`case ${t}, day ${day}, ${item.id}`);
    }
    for(const x of a.purchases)assert(x.add>0);
  }
});
