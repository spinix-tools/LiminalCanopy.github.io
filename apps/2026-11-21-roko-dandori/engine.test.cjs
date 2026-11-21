const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('./engine.js');
const approx = (x, y, epsilon = 1e-9) => assert.ok(Math.abs(x - y) < epsilon * Math.max(1, Math.abs(y)), `${x} ≉ ${y}`);
const simple = (overrides = {}) => ({ name: '長時間露光', meter: '1/125', nd1: 1000, nd2: 1, exponent: 1.3, bracket: false, note: '', ...overrides });
const plan = (shots, overrides = {}) => ({ version: 1, start: '23:59', gap: 10, budget: 10, shots, ...overrides });
test('shutter fraction parsing', () => approx(E.parseMeter(' 1 / 125 '), 1/125));
test('decimal parsing', () => approx(E.parseMeter('0.3'), .3));
test('max shutter bound', () => assert.equal(E.parseMeter('3600'), 3600));
test('reject zero denominator', () => assert.throws(() => E.parseMeter('1/0')));
test('reject code in exposure input', () => assert.throws(() => E.parseMeter('Math.PI')));
test('reject negative meter', () => assert.throws(() => E.parseMeter('-1')));
test('reject invalid high shutter', () => assert.throws(() => E.parseMeter('3601')));
test('reject arrays as plan data', () => assert.throws(() => E.validatePlan([])));
test('reject no scenes', () => assert.throws(() => E.validatePlan(plan([]))));
test('reject >16 scenes', () => assert.throws(() => E.validatePlan(plan(Array.from({length:17},()=>simple())))));
test('reject bad ND factor', () => assert.throws(() => E.validateShot(simple({nd1:7}))));
test('reject exponent below one', () => assert.throws(() => E.validateShot(simple({exponent:.9}))));
test('reject exponent above limit', () => assert.throws(() => E.validateShot(simple({exponent:1.81}))));
test('reject nonboolean bracket', () => assert.throws(() => E.validateShot(simple({bracket:'false'}))));
test('reject blank scene label', () => assert.throws(() => E.validateShot(simple({name:'  '}))));
test('reject malformed clock', () => assert.throws(() => E.validatePlan(plan([simple()], {start:'24:15'}))));
test('reject fractional gap', () => assert.throws(() => E.validatePlan(plan([simple()], {gap:1.2}))));
test('reject excessive exposure > one day', () => assert.throws(() => E.schedule(plan([simple({meter:'3600', nd1:1000, nd2:1000})]))));
test('ND1000 multiplies uncorrected shutter time by 1000', () => approx(E.correctedExposure('1/125',1000,1,1).corrected,8));
test('ND stacks multiply, not sum', () => approx(E.correctedExposure('1',8,4,1).corrected,32));
test('reciprocity applies only after one second', () => approx(E.correctedExposure('1/8',4,1,1.8).corrected,.5));
test('exact one-second crossover', () => approx(E.correctedExposure('1',1,1,1.8).corrected,1));
test('exponent changes corrected time over one second', () => approx(E.correctedExposure('2',1,1,1.5).corrected,2**1.5));
test('EV -1 halves and +1 doubles exposure', () => {
  approx(E.correctedExposure('1',1,1,1,-1).corrected,.5);
  approx(E.correctedExposure('1',1,1,1,1).corrected,2);
});
test('bracket generates -1,0,+1 ordered frames', () => {
  const r=E.schedule(plan([simple({meter:'1',nd1:1,bracket:true,exponent:1})]));
  assert.deepEqual(r.frames.map(f=>f.ev),[-1,0,1]);
  assert.deepEqual(r.frames.map(f=>f.corrected),[.5,1,2]);
  approx(r.total, .5+1+2+20);
});
test('schedule has exactly frames-minus-one preparation gaps', () => {
  const r=E.schedule(plan([simple(),simple({name:'second',bracket:true})],{gap:20}));
  assert.equal(r.frames.length,4); assert.equal(r.gapTotal,60);
  approx(r.total, r.exposureTotal+60);
});
test('schedule reports over-budget without truncation', () => {
  const r=E.schedule(plan([simple()],{budget:1}));
  assert.equal(r.fits,true);
  approx(r.remaining,60-r.total);
});
test('over-budget schedule flags actual overrun', () => { const r=E.schedule(plan([simple({meter:'10',nd1:8,nd2:1,exponent:1})],{budget:1})); assert.equal(r.fits,false); approx(r.remaining,-20); });
test('end clock wraps through midnight', () => assert.equal(E.clockAt('23:59',65),'00:00:05 (+1日)'));
test('end clock handles two days', () => assert.equal(E.clockAt('23:59',86465),'00:00:05 (+2日)'));
test('formatSeconds never drops terminal integer zero', () => assert.equal(E.formatSeconds(10),'10秒'));
test('formatSeconds formats fractional seconds', () => assert.equal(E.formatSeconds(.1),'0.100秒'));
test('CSV protects formulas in user text', () => assert.match(E.csv(plan([simple({name:'=HYPERLINK(1)',note:'@SUM(1)'})])),/"'=HYPERLINK\(1\)"/));
test('CSV doubles internal quotes', () => assert.match(E.csv(plan([simple({name:'A"B'})])),/"A""B"/));
test('CSV row count equals frame count + header', () => {const r=plan([simple({bracket:true})]); assert.equal(E.csv(r).trim().split('\r\n').length,4);});
test('JSON round trip validates all fields', () => {
  const p=E.example(); const cloned=E.validatePlan(JSON.parse(JSON.stringify(p)));
  assert.deepEqual(E.schedule(p).frames.map(f=>f.corrected), E.schedule(cloned).frames.map(f=>f.corrected));
});
test('500 seeded randomized invariants', () => {
  let seed=101; const random=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
  for(let k=0;k<500;k++){
    const n=1+Math.floor(random()*10), ndfactors=E.ND;
    const shots=Array.from({length:n}, (_,i)=> simple({name:`景 ${i+1}`,meter:String(.01+random()*2),nd1:ndfactors[Math.floor(random()*6)],nd2:ndfactors[Math.floor(random()*3)],exponent:1+random()*.3,bracket:random()<.5}));
    const p=plan(shots,{gap:Math.floor(random()*90),budget:720,start:'08:00'});
    const r=E.schedule(p);
    assert.equal(r.frames.length,shots.reduce((s,x)=>s+(x.bracket?3:1),0));
    approx(r.total,r.exposureTotal+r.gapTotal);
    assert.ok(r.frames.every(f=>f.endSec>=f.startSec && f.corrected>0));
    assert.ok(r.frames.every((f,i)=>i===0||f.startSec>=r.frames[i-1].endSec));
    assert.ok(r.frames.every(f=>f.corrected+1e-9>=f.filtered));
    assert.ok(r.frames.every(f=>f.shotIndex>=0 && f.shotIndex<n));
  }
});
