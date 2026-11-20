const assert=require('node:assert/strict');
const {test}=require('node:test');
const E=require('./engine.js');
const sample=()=>E.normalize(E.DEFAULT);
test('default data & normalization',()=>{let s=sample();assert.equal(s.slots.length,12);assert.equal(s.start,'10:00');assert.equal(E.normalize({slots:[{arrivals:999,a:-2,b:14}],start:'98:55'}).slots[0].arrivals,500);assert.equal(E.normalize({slots:[{arrivals:4,a:-2,b:14}]}).slots[0].a,0);});
test('arrival generation is seeded and sorted',()=>{let s=sample();assert.deepEqual(E.people(s),E.people(s));assert.ok(E.people(s).every((v,i,a)=>i===0||v.arrive>=a[i-1].arrive));});
test('all zero arrivals',()=>{let s=sample();s.slots.forEach(x=>x.arrivals=0);let a=E.simulate(s);assert.equal(a.arrivals,0);assert.equal(a.completed,0);assert.equal(a.p95,null);assert.equal(a.unfinished,0);});
test('zero staff preserves all arrivals as unfinished',()=>{let s=sample();s.slots.forEach(x=>{x.a=0;x.b=0});let r=E.simulate(s);assert.equal(r.completed,0);assert.equal(r.unfinished,r.arrivals);assert.equal(r.p95,null);});
test('enough workers should clear trivial queue',()=>{let s=sample();s.slots.forEach(x=>{x.arrivals=1;x.a=12});let a=E.simulate(s);assert.equal(a.unfinished,0);assert.ok(a.p95<=1);});
test('same arrivals across A and B, and unchanged runs',()=>{let s=sample();let a=E.simulate(s,'a');assert.deepEqual(a,E.simulate(s,'a'));assert.equal(a.arrivals,E.simulate(s,'b').arrivals);});
test('more staff yields no worse maximum queue for same people',()=>{let s=sample();s.slots.forEach(x=>{x.a=1;x.b=12});let a=E.simulate(s,'a'),b=E.simulate(s,'b');assert.ok(b.peakQueue<=a.peakQueue);assert.ok(b.unfinished<=a.unfinished);});
test('propose modifies only B and respects capacity',()=>{let s=sample();let before=JSON.stringify(s),p=E.propose(s);assert.equal(JSON.stringify(s),before);assert.equal(p.slots.length,s.slots.length);p.slots.forEach((x,i)=>{assert.ok(x>=s.slots[i].a && x<=12)});assert.equal(p.result.unfinished,0);});
test('zero staffing propose recovers from backlog',()=>{let s=sample();s.slots.forEach(x=>{x.a=0;x.b=0;x.arrivals=15});let p=E.propose(s);assert.ok(p.steps>0);assert.ok(p.result.completed>0);});
test('time and csv escaping',()=>{assert.equal(E.hhmm('23:50',20),'00:10');let s=sample();s.title='test,"\n';assert.ok(E.csv(s,E.simulate(s,'a'),E.simulate(s,'b')).startsWith('\uFEFF'));assert.ok(E.csv(s,E.simulate(s,'a'),E.simulate(s,'b')).includes('10:00'));});
test('invalid scenario and excess arrivals rejected',()=>{assert.throws(()=>E.simulate(sample(),'other'));assert.equal(E.normalize({slots:Array.from({length:21},()=>({arrivals:500}))}).slots.length,20);});
test('statistical constraints over 200 randomized scenarios',()=>{
  let seed=12345;const rnd=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  for(let k=0;k<200;k++){
    const raw={start:'12:00',serviceMinutes:0.5+rnd()*12,seed:Math.floor(rnd()*1e6)+1,
      slots:Array.from({length:4+Math.floor(rnd()*13)},()=>({arrivals:Math.floor(rnd()*120),a:Math.floor(rnd()*10),b:Math.floor(rnd()*10)}))};
    let s=E.normalize(raw),a=E.simulate(s,'a'),b=E.simulate(s,'b');
    for(let r of [a,b]){
      assert.equal(r.completed+r.unfinished,r.arrivals);
      assert.ok(r.arrivals>=0 && r.peakQueue>=0 && r.staffMinutes>=0);
      assert.equal(r.line.length,s.slots.length);
      assert.ok(r.p95===null || r.p95>=0);
      assert.ok(r.avgWait===null || r.avgWait>=0);
      assert.ok(r.processing<=12);
      assert.ok(r.completed<=r.arrivals);
    }
    assert.equal(a.arrivals,b.arrivals);
  }
});