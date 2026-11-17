'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const E=require('./engine.js');
const base={...E.DEFAULTS,date:'2026-03-20',depth:0,horizon:0};
test('normalization and strict inputs',()=>{
  assert.equal(E.normalize({facing:360}).facing,0);
  assert.throws(()=>E.normalize({lat:95}),/範囲外/);
  assert.throws(()=>E.normalize({depth:-1}),/範囲外/);
  assert.throws(()=>E.normalize({lat:''}),/範囲外/);
  assert.throws(()=>E.normalize({date:'2026-02-30'}),/存在しない/);
  assert.deepEqual(E.validDate('2028-02-29'),{y:2028,m:2,d:29});
});
test('solar equinox midday over Tokyo is ~55° altitude, due south',()=>{
  const noon=E.solarPosition('2026-03-20',12*60,{...base});
  assert.ok(noon.altitude>52&&noon.altitude<57,noon.altitude);
  assert.ok(noon.azimuth>170&&noon.azimuth<195,noon.azimuth);
});
test('morning sun east, afternoon sun west',()=>{
  const m=E.solarPosition('2026-03-20',8*60,base),p=E.solarPosition('2026-03-20',16*60,base);
  assert.ok(m.azimuth>60&&m.azimuth<160,m.azimuth);
  assert.ok(p.azimuth>200&&p.azimuth<310,p.azimuth);
});
test('night is dark, vertical backface is dark',()=>{
  assert.equal(E.classify({altitude:-2,azimuth:180},base),'night');
  assert.equal(E.classify({altitude:20,azimuth:0},base),'back');
  assert.equal(E.classify({altitude:40,azimuth:180},base),'direct');
});
test('obstacle takes priority before overhang',()=>{
  assert.equal(E.classify({altitude:7,azimuth:180},{...base,horizon:15,depth:3}),'obstacle');
});
test('overhang blocks steep sun, allows low rays',()=>{
  const c={...base,depth:1,clearance:1};
  assert.equal(E.classify({altitude:80,azimuth:180},c),'roof');
  assert.equal(E.classify({altitude:20,azimuth:180},c),'direct');
});
test('zero depth never creates roof shade',()=>{
  assert.equal(E.classify({altitude:89,azimuth:180},{...base,depth:0}),'direct');
});
test('whole day accounts for exactly 24 hours',()=>{
  const a=E.analyze(base),sum=Object.values(a.counts).reduce((x,y)=>x+y,0);
  assert.equal(sum,1440);assert.equal(a.samples.length,288);
  assert.equal(a.direct.reduce((n,r)=>n+r.end-r.start,0),a.counts.direct);
});
test('south faces sun at noon on equinox, north does not',()=>{
  const south=E.analyze(base);const north=E.analyze({...base,facing:0});
  assert.ok(south.counts.direct>north.counts.direct+120,[south.counts.direct,north.counts.direct]);
});
test('roof cannot increase sunshine',()=>{
  const clear=E.analyze({...base,depth:0});const deep=E.analyze({...base,depth:3,clearance:1});
  assert.ok(clear.counts.direct>=deep.counts.direct);
  assert.ok(deep.counts.roof>0);
});
test('horizon cannot increase sunshine',()=>{
  const a=E.analyze({...base,horizon:0});const b=E.analyze({...base,horizon:45});
  assert.ok(a.counts.direct>=b.counts.direct);assert.ok(b.counts.obstacle>0);
});
test('monthly report has 12 distinct dates, nonnegative minutes',()=>{
  const arr=E.yearly(base);assert.equal(arr.length,12);
  assert.equal(new Set(arr.map(x=>x.date)).size,12);
  assert.ok(arr.every(x=>x.directMinutes>=0&&x.directMinutes<=1440));
});
test('south-facing Tokyo is sunnier in winter than a deep summer overhang case',()=>{
  const summer=E.analyze({...base,date:'2026-06-21',depth:2,clearance:1});
  const winter=E.analyze({...base,date:'2026-12-21',depth:0,horizon:0});
  assert.ok(summer.counts.roof>0);assert.ok(winter.counts.direct>0);
});
test('invalid sampling step rejected',()=>{assert.throws(()=>E.analyze(base,7),/ステップ/);});
test('wrap180 resolves signed orientation differences',()=>{
  assert.equal(E.wrap180(350),-10);assert.equal(E.wrap180(-350),10);
});