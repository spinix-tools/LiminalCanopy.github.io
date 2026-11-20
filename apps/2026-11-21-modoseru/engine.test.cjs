'use strict';
const {test} = require('node:test');
const assert=require('node:assert/strict');
const E=require('./engine.js');
const fresh=()=>E.example();
const find=(s,id)=>s.copies.find(c=>c.id===id);

test('sample validates and remains unchanged',()=>{const a=fresh();assert.deepEqual(E.normalize(a),a);});
test('all model functions are exported',()=>{for(const name of ['normalize','scenarios','matrix','evaluate','advice','csvReport','isLost'])assert.equal(typeof E[name],'function');});
test('sample has multiple realistic incidents',()=>{const s=E.scenarios(fresh());assert(s.some(x=>x.type==='ransomware'));assert(s.some(x=>x.type==='site'));assert(s.some(x=>x.type==='device'));assert(s.some(x=>x.type==='account'));});
test('a device failure only removes its device',()=>{const s=fresh();assert(E.isLost(find(s,'c1'),{type:'device',target:'編集PC'}));assert(!E.isLost(find(s,'c3'),{type:'device',target:'編集PC'}));});
test('a site loss removes all machines in that site',()=>{const s=fresh();for(const id of ['c1','c2','c4'])assert(E.isLost(find(s,id),{type:'site',target:'事務所'}));assert(!E.isLost(find(s,'c6'),{type:'site',target:'事務所'}));});
test('credentials only affect online copies sharing account',()=>{const s=fresh();const sc={type:'account',target:'仕事アカウント'};assert(E.isLost(find(s,'c1'),sc));assert(E.isLost(find(s,'c5'),sc));assert(!E.isLost(find(s,'c6'),sc));});
test('ransomware removes writable online copies across accounts',()=>{const s=fresh();const sc={type:'ransomware',target:'*'};assert(E.isLost(find(s,'c1'),sc));assert(E.isLost(find(s,'c5'),sc));assert(!E.isLost(find(s,'c2'),sc));assert(!E.isLost(find(s,'c3'),sc));});
test('online immutable survives modeled ransomware but not device failure',()=>{const s=fresh();assert(!E.isLost(find(s,'c3'),{type:'ransomware',target:'*'}));assert(E.isLost(find(s,'c3'),{type:'device',target:'別クラウド'}));});
test('unknown incident is rejected',()=>assert.throws(()=>E.isLost(find(fresh(),'c1'),{type:'bad',target:''}),/未知/));
test('d1 retains proven fresh version after ransomware',()=>{const r=E.evaluate(fresh(),'ransomware:*');const d=r.datasets.find(x=>x.id==='d1');assert.equal(d.status,'ready');assert.equal(d.selected.id,'c3');assert.equal(d.ageHours,12);});
test('d2 has only stale verified copy after ransomware',()=>{const r=E.evaluate(fresh(),'ransomware:*');const d=r.datasets.find(x=>x.id==='d2');assert.equal(d.status,'stale');assert.equal(d.selected.id,'c6');});
test('an unverified fresh copy does not count as ready',()=>{const s=fresh();s.copies.filter(c=>c.datasetId==='d1').forEach(c=>c.verified=false);const d=E.evaluate(s,'ransomware:*').datasets[0];assert.equal(d.status,'untested');});
test('no copy surviving means lost',()=>{const s=fresh();s.copies=s.copies.filter(c=>c.datasetId==='d2');const d=E.evaluate(s,'ransomware:*').datasets[0];assert.equal(d.status,'lost');});
test('no copies still yields ransomware scenario',()=>{const s=fresh();s.copies=[];assert.equal(E.scenarios(s).length,1);assert(E.matrix(s).rows[0].datasets.every(x=>x.status==='lost'));});
test('freshness exactly equal to RPO passes',()=>{const s=fresh();find(s,'c3').ageHours=24;assert.equal(E.evaluate(s,'ransomware:*').datasets[0].status,'ready');});
test('freshness just beyond RPO fails',()=>{const s=fresh();find(s,'c3').ageHours=24.01;assert.equal(E.evaluate(s,'ransomware:*').datasets[0].status,'stale');});
test('if any verified survivors exist, unverified newer copies do not outrank stale verified',()=>{const s=fresh();find(s,'c2').ageHours=1;find(s,'c2').verified=false;find(s,'c3').ageHours=34;assert.equal(E.evaluate(s,'ransomware:*').datasets[0].status,'stale');});
test('recovery time uses decimal gigabytes, effective MB/s',()=>{const s=fresh();const d=E.evaluate(s,'ransomware:*').datasets[0];assert.equal(d.estimatedHours,Math.round(480000/35/3600*100)/100);});
test('scenario evaluation rejects nonexistent key',()=>assert.throws(()=>E.evaluate(fresh(),'site:火星'),/見つかりません/));
test('matrix cells equal direct evaluation',()=>{const s=fresh(),m=E.matrix(s);for(const r of m.rows)assert.deepEqual(r,E.evaluate(s,E.scenarioKey(r.incident)));});
test('matrix scoring equals visible statuses',()=>{const m=E.matrix(fresh());assert.equal(m.readyCells,m.cols.reduce((acc,c)=>acc+c.statuses.filter(x=>x==='ready').length,0));assert.equal(m.totalCells,m.rows.length*m.cols.length);});
test('advice flags missing independent location',()=>{const s=fresh();s.copies.filter(c=>c.datasetId==='d1').forEach(c=>c.site='事務所');assert(E.advice(s).find(x=>x.id==='d1').ideas.some(x=>x.includes('別拠点')));});
test('advice flags ransomware-vulnerable setup',()=>{const s=fresh();s.copies.filter(c=>c.datasetId==='d1').forEach(c=>{c.online=true;c.locked=false;});assert(E.advice(s).find(x=>x.id==='d1').ideas.some(x=>x.includes('切離し')));});
test('CSV starts with BOM and includes labels',()=>{const csv=E.csvReport(fresh());assert(csv.startsWith('\ufeff'));assert(csv.includes('一斉改変'));assert(csv.includes('\r\n'));});
test('CSV escapes spreadsheet formula names',()=>{const s=fresh();s.datasets[0].name='=HYPERLINK("bad")';const csv=E.csvReport(s);assert(csv.includes('"\'=HYPERLINK(""bad"")"'));});
test('duplicate data ids rejected',()=>{const s=fresh();s.datasets[1].id=s.datasets[0].id;assert.throws(()=>E.normalize(s),/重複/);});
test('duplicate copy ids rejected',()=>{const s=fresh();s.copies[1].id=s.copies[0].id;assert.throws(()=>E.normalize(s),/重複/);});
test('unknown dataset reference rejected',()=>{const s=fresh();s.copies[0].datasetId='missing';assert.throws(()=>E.normalize(s),/存在しません/);});
test('negative, NaN, out-of-range values rejected',()=>{for(const v of [-1,NaN,Infinity,87601]){const s=fresh();s.copies[0].ageHours=v;assert.throws(()=>E.normalize(s));}});
test('non-boolean control rejected',()=>{const s=fresh();s.copies[0].verified='true';assert.throws(()=>E.normalize(s),/真偽値/);});
test('prototype injection id cannot affect model',()=>{const s=fresh();s.datasets[0].id='__proto__';s.copies.filter(c=>c.datasetId==='d1').forEach(c=>c.datasetId='__proto__');const m=E.matrix(s);assert.equal(m.cols[0].id,'__proto__');assert.equal({}.polluted,undefined);});
test('input state remains unmutated by evaluation',()=>{const s=fresh(),json=JSON.stringify(s);E.matrix(s);E.advice(s);assert.equal(JSON.stringify(s),json);});
test('max dataset / copy counts enforced',()=>{const s=fresh();s.datasets=Array.from({length:13},(_,i)=>({id:'d'+i,name:'x',sizeGB:1,rpoHours:1}));s.copies=[];assert.throws(()=>E.normalize(s),/12/);});

test('randomized failure matrix invariants (500 configurations)',()=>{
  let seed=0x186ac3;
  const rand=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
  for(let t=0;t<500;t++){
    const s={datasets:[],copies:[],selectedScenario:'ransomware:*'};
    for(let i=0;i<1+rand(3);i++)s.datasets.push({id:'d'+i,name:'asset'+i,sizeGB:1+rand(300),rpoHours:rand(100)});
    for(let j=0;j<rand(17);j++)s.copies.push({id:'c'+j,datasetId:s.datasets[rand(s.datasets.length)].id,name:'copy'+j,site:'s'+rand(3),device:'v'+rand(5),account:'a'+rand(4),ageHours:rand(140),online:!!rand(2),locked:!!rand(2),verified:!!rand(2),speed:1+rand(150)});
    const m=E.matrix(s);assert.equal(m.rows.length,E.scenarios(s).length);
    for(const row of m.rows){for(const d of row.datasets){
      assert.equal(d.all.length,d.lost.length+d.survivors.length);
      assert.equal(d.lost.some(c=>d.survivors.some(k=>k.id===c.id)),false);
      if(d.status==='ready')assert(d.selected.verified && d.selected.ageHours<=d.rpoHours);
      if(d.status==='lost')assert.equal(d.survivors.length,0);
      if(d.status==='stale')assert(d.survivors.some(c=>c.verified) && !d.survivors.some(c=>c.verified&&c.ageHours<=d.rpoHours));
      if(d.status==='untested')assert(d.survivors.length>0 && !d.survivors.some(c=>c.verified));
    }}
  }
});
