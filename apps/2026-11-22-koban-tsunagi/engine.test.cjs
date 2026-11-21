const assert=require('node:assert/strict');
const test=require('node:test');
const E=require('./engine.js');
const P=E.exampleProject;
test('safe default project is populated',()=>{const x=P();assert.equal(x.scenes.length,6);assert.equal(x.actors.length,3)});
test('strict time format',()=>{assert.equal(E.clockToMinutes('08:45'),525);for(const v of ['24:00','1:20','23:99','abc',null])assert.equal(E.clockToMinutes(v),null)});
test('time label displays next day',()=>{assert.equal(E.minuteLabel(1500),'25:00 +1日')});
test('scheduling is deterministic',()=>assert.deepEqual(E.makePlan(P()),E.makePlan(P())));
test('every scene appears once',()=>{const p=P(),plan=E.makePlan(p);assert.deepEqual(plan.order,p.scenes.map(x=>x.id));assert.equal(plan.blocks.filter(x=>x.kind==='scene').length,p.scenes.length)});
test('blocks contiguous and have positive durations',()=>{const r=E.makePlan(P());assert.equal(r.blocks[0].start,r.start);for(let i=0;i<r.blocks.length;i++){assert.ok(r.blocks[i].end>r.blocks[i].start);if(i)assert.equal(r.blocks[i].start,r.blocks[i-1].end);}assert.equal(r.blocks.at(-1).end,r.end)});
test('required actor arrival inserts waiting',()=>{const p=P();p.scenes=[{id:'s',title:'one',location:'A',duration:10,cast:['talent-b']}];const r=E.makePlan(p);assert.equal(r.waiting,210);assert.equal(r.blocks[0].kind,'wait')});
test('actor departure violation detected',()=>{const p=P();p.scenes=[{id:'s',title:'one',location:'A',duration:240,cast:['talent-a']}];const r=E.makePlan(p);assert.equal(r.castViolations,1)});
test('move time inserted on location switch',()=>{const p=P();p.scenes=[{id:'x',title:'X',location:'A',duration:10,cast:[]},{id:'y',title:'Y',location:'B',duration:10,cast:[]}];const r=E.makePlan(p);assert.equal(r.moves,1);assert.equal(r.blocks.find(x=>x.kind==='move').end-r.blocks.find(x=>x.kind==='move').start,20)});
test('no move on same location',()=>{const p=P();p.scenes=[{id:'x',title:'X',location:'A',duration:10,cast:[]},{id:'y',title:'Y',location:'A',duration:10,cast:[]}];assert.equal(E.makePlan(p).moves,0)});
test('overtime diagnosed',()=>{const p=P();p.settings.end='09:15';p.scenes=[{id:'x',title:'X',location:'A',duration:40,cast:[]}];assert.equal(E.makePlan(p).overtime,25)});
test('lunch is inserted between scenes',()=>{const p=P();p.settings.start='11:40';p.scenes=[{id:'x',title:'X',location:'A',duration:30,cast:[]}];const r=E.makePlan(p);assert.equal(r.blocks[0].kind,'lunch')});
test('invalid properties normalized',()=>{const p=E.normalizeProject({settings:{start:'bogus',moveMinutes:-3,lunchMinutes:900},scenes:[{duration:999,title:'x'}]});assert.equal(p.settings.start,'09:00');assert.equal(p.settings.moveMinutes,0);assert.equal(p.settings.lunchMinutes,120);assert.equal(p.scenes[0].duration,240)});
test('unknown cast ids removed',()=>{const p=E.normalizeProject({scenes:[{cast:['bad']}],actors:[]});assert.deepEqual(p.scenes[0].cast,[])});
test('CSV includes BOM and escaped text',()=>{const p=P();p.scenes[0].title='A,"B"';const csv=E.toCsv(p);assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes('"A,""B"""'))});
test('optimizer never worsens original',()=>{const p=P(),o=E.optimize(p);assert.ok(o.after.score<=o.before.score);assert.ok(o.explored>0);assert.equal(o.order.length,p.scenes.length)});
test('optimizer finds simple location grouping when actor windows are open',()=>{const p=P();p.actors=[];p.settings.lunchMinutes=0;p.scenes=[{id:'1',title:'1',location:'A',duration:20,cast:[]},{id:'2',title:'2',location:'B',duration:20,cast:[]},{id:'3',title:'3',location:'A',duration:20,cast:[]},{id:'4',title:'4',location:'B',duration:20,cast:[]}];const x=E.optimize(p);assert.ok(x.after.moves<x.before.moves,JSON.stringify(x))});
test('empty project has no blocks',()=>{const p=E.normalizeProject({scenes:[]});const r=E.makePlan(p);assert.equal(r.blocks.length,0);assert.equal(r.span,0)});
test('normalize limits list size',()=>{const p=E.normalizeProject({actors:Array(40).fill({label:'x'}),scenes:Array(90).fill({title:'z'})});assert.equal(p.actors.length,20);assert.equal(p.scenes.length,40)});
// Randomized property checks, deterministic LCG.
let seed=20261122;const rng=()=>((seed=(1664525*seed+1013904223)>>>0)/2**32);
test('500 random schedules preserve timeline and optimize cannot regress',()=>{
  for(let i=0;i<500;i++){
    const p=P();p.actors=[];p.settings.lunchMinutes=0;p.settings.moveMinutes=Math.floor(rng()*40);p.scenes=Array.from({length:3+Math.floor(rng()*5)},(_,j)=>({id:'s'+j,title:'t'+j,location:['A','B','C'][Math.floor(rng()*3)],duration:5+Math.floor(rng()*50),cast:[]}));
    const x=E.makePlan(p),o=E.optimize(p,{width:25,limit:1500});
    assert.equal(x.end-x.start,x.blocks.reduce((a,b)=>a+(b.end-b.start),0));
    assert.equal(new Set(o.order).size,p.scenes.length);assert.ok(o.after.score<=o.before.score+1e-8);
  }
});
