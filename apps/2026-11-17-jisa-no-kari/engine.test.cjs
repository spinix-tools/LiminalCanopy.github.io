const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('./engine.js');
const base=()=>({date:'2026-11-18',weeks:4,duration:60,baseId:'t',people:JSON.parse(JSON.stringify(E.DEFAULTS))});

test('Tokyo part and date offset',()=>{
  const p=E.parts(Date.parse('2026-11-18T00:00:00Z'),'Asia/Tokyo');
  assert.equal(p.time,'09:00');assert.equal(p.date,'2026-11-18');
});
test('New York DST spring forward skips 02h',()=>{
  assert.equal(E.parts(Date.parse('2026-03-08T06:30Z'),'America/New_York').time,'01:30');
  assert.equal(E.parts(Date.parse('2026-03-08T07:30Z'),'America/New_York').time,'03:30');
});
test('New York DST fall repeats local hour',()=>{
  assert.equal(E.parts(Date.parse('2026-11-01T05:30Z'),'America/New_York').time,'01:30');
  assert.equal(E.parts(Date.parse('2026-11-01T06:30Z'),'America/New_York').time,'01:30');
});
test('Indian half-hour timezone',()=>assert.equal(E.parts(Date.parse('2026-11-18T00:00Z'),'Asia/Kolkata').time,'05:30'));
test('date increment crosses year and leap day',()=>{
  assert.equal(E.plusDays('2026-12-30',3),'2027-01-02');
  assert.equal(E.plusDays('2028-02-28',1),'2028-02-29');
});
test('invalid dates rejected',()=>{
  assert.throws(()=>E.parseDate('2026-02-30'));
  assert.throws(()=>E.parseDate('2026-2-3'));
});
test('24 hours regular Tokyo half hour slots',()=>assert.equal(E.candidates('2026-11-18','Asia/Tokyo',60).length,48));
test('NY spring DST day contains 46 half-hour slots',()=>assert.equal(E.candidates('2026-03-08','America/New_York',30).length,46));
test('NY autumn DST day contains 50 half-hour slots',()=>assert.equal(E.candidates('2026-11-01','America/New_York',30).length,50));
test('minutes quarter-hour accepted and invalid rejected',()=>{
  assert.equal(E.minutes('18:45'),1125);assert.throws(()=>E.minutes('24:00'));assert.throws(()=>E.minutes('09:12'));
});
test('reject unsupported zone',()=>{
  const c=base();c.people[0].zone='Mars/Olympus';assert.throws(()=>E.validate(c),/タイムゾーン/);
});
test('reject duplicate ids',()=>{
  const c=base();c.people[1].id='t';assert.throws(()=>E.validate(c));
});
test('reject less than two and more than six',()=>{
  const c=base();c.people=c.people.slice(0,1);assert.throws(()=>E.validate(c));
  const d=base();d.people=Array.from({length:7},(_,i)=>({...c.people[0],id:String(i)}));assert.throws(()=>E.validate(d));
});
test('reject working hours reversed',()=>{
  const c=base();c.people[0].start='19:00';c.people[0].end='17:00';assert.throws(()=>E.validate(c),/勤務終了/);
});
test('reject bad duration and weeks',()=>{
  let c=base();c.weeks=9;assert.throws(()=>E.validate(c));c=base();c.duration=100;assert.throws(()=>E.validate(c));
});
test('working-hours meeting has lower burden than late night',()=>{
  const tokyo=E.DEFAULTS[0];
  const work=E.burden(Date.parse('2026-11-18T03:00Z'),60,tokyo);
  const night=E.burden(Date.parse('2026-11-18T18:00Z'),60,tokyo);
  assert.ok(work.cost<night.cost);assert.equal(work.outMinutes,0);assert.equal(night.nightMinutes,60);
});
test('Saturday is penalized independently of weekday in base zone',()=>{
  const p=E.DEFAULTS[1];const w=E.burden(Date.parse('2026-11-21T10:00Z'),60,p);
  assert.equal(w.weekendMinutes,60);assert.ok(w.cost>=48);
});
test('meeting crossing end-of-work counts out-of-hours slices',()=>{
  const p=E.DEFAULTS[0];const r=E.burden(Date.parse('2026-11-18T08:30Z'),60,p);
  assert.equal(r.outMinutes,30);
});
test('build returns exact weekly count and weekly base dates',()=>{
  const c=base(),r=E.build(c);assert.equal(r.fair.slots.length,4);assert.equal(r.comfort.slots.length,4);
  assert.deepEqual(r.comfort.slots.map(x=>E.parts(x.utc,'Asia/Tokyo').date),['2026-11-18','2026-11-25','2026-12-02','2026-12-09']);
});
test('comfort is minimum sum penalty each week',()=>{
  const c=base(),r=E.build(c);
  r.comfort.slots.forEach((x,i)=>{
    const day=E.plusDays(c.date,7*i);
    const best=Math.min(...E.candidates(day,'Asia/Tokyo',60).map(utc=>c.people.reduce((sum,p)=>sum+E.burden(utc,60,p).cost,0)));
    assert.ok(Math.abs(x.total-best)<1e-8);
  });
});
test('fairness plan reduces burden range in sample',()=>{
  const r=E.build(base());assert.ok(r.fair.range<r.comfort.range);
});
test('every candidate includes all participants',()=>{
  const c=base(),r=E.build(c);
  for(const p of [r.comfort,r.fair])p.slots.forEach(s=>assert.equal(s.costs.length,3));
});
test('ICS has one event per week, UTC date, CRLF',()=>{
  const c=base(),r=E.build(c),out=E.ics(r.comfort,c);
  assert.equal((out.match(/BEGIN:VEVENT/g)||[]).length,4);
  assert.match(out,/DTSTART:20261118T\d{6}Z/);assert.ok(out.includes('\r\n'));
});
test('ICS escapes participant label',()=>{
  const c=base();c.people[0].label='東京, 開発;\\室';
  const out=E.ics(E.build(c).comfort,c);assert.match(out,/東京\\, 開発\\;\\\\室/);
});
test('CSV export has BOM, header, rows and escapes quote',()=>{
  const c=base();c.people[0].label='東京"研究';
  const csv=E.csv(E.build(c).comfort,c);
  assert.ok(csv.startsWith('\uFEFF'));assert.equal(csv.trim().split('\r\n').length,5);assert.ok(csv.includes('東京""研究'));
});
test('proposal has all local zones',()=>{
  const c=base(),txt=E.proposal(E.build(c).fair,c);
  for (const p of c.people)assert.ok(txt.includes(p.label));assert.match(txt,/4回目/);
});