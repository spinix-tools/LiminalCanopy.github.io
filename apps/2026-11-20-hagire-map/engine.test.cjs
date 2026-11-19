'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('./engine.js');
function s(id,w,h,opts={}){return {id,name:id,material:'A',kind:'scrap',w,h,qty:1,...opts}}
function p(id,w,h,opts={}){return {id,name:id,material:'A',w,h,qty:1,allowance:0,rotate:false,...opts}}
function plan(stocks,parts,gap=0){return E.optimize({name:'t',gap,stocks,parts})}
test('sample is valid and non-overlapping',()=>{const a=E.sample();const x=E.optimize(a);assert.equal(E.checkLayout(x,a.gap).valid,true);assert.equal(x.placedCount+x.unplaced.length,x.requestedCount);assert.ok(x.placedCount>0)});
test('one piece fits exactly',()=>{const x=plan([s('s',100,80)],[p('p',100,80)]);assert.equal(x.placedCount,1);assert.equal(x.efficiency,1);assert.equal(x.used[0].free.length,0)});
test('mismatch material is not placed',()=>{const x=plan([s('s',200,200)],[p('p',40,40,{material:'B'})]);assert.equal(x.placedCount,0);assert.equal(x.unplaced.length,1)});
test('allowance adds on both sides',()=>{const x=plan([s('s',100,100)],[p('p',90,90,{allowance:6})]);assert.equal(x.placedCount,0)});
test('rotation locked or unlocked',()=>{const x=plan([s('s',100,60)],[p('p',55,95)]);assert.equal(x.placedCount,0);const y=plan([s('s',100,60)],[p('p',55,95,{rotate:true})]);assert.equal(y.placedCount,1);assert.equal(y.used[0].placements[0].rotated,true)});
test('priority: scrap before new',()=>{const x=plan([s('new',150,150,{kind:'new'}),s('scrap',150,150)],[p('p',50,50)]);assert.equal(x.used[0].kind,'scrap');assert.equal(x.newUsed,0)});
test('inventory: unused sheets remain whole',()=>{const x=plan([s('a',80,80),s('b',50,50,{material:'B'})],[p('p',80,80)]);assert.equal(x.placedCount,1);const remain=E.nextInventory(x);assert.equal(remain.length,1);assert.equal(remain[0].id,'remain-b~1')});
test('inventory: one cut creates nonoverlapping remnants',()=>{const x=plan([s('a',120,120)],[p('p',50,50)],5);const remain=E.nextInventory(x,10);assert.ok(remain.length>0);assert.ok(remain.every(r=>r.kind==='scrap'&&r.w>=10&&r.h>=10));const total=remain.reduce((a,r)=>a+r.w*r.h,0)+2500;assert.ok(total<=14400+1e-6)});
test('inventory rejects unplaced pieces',()=>{assert.throws(()=>E.nextInventory(plan([], [p('p',10,10)])),/未配置/)});
test('gap prevents tight adjacency',()=>{const x=plan([s('s',100,50)],[p('p',50,50,{qty:2})],1);assert.equal(x.placedCount,1)});
test('validates invalid dimensions and quantity',()=>{for(const bad of [-1,0,10001,Infinity,NaN])assert.throws(()=>plan([s('s',bad,30)],[p('p',10,10)]));assert.throws(()=>plan([s('s',100,100,{qty:0})],[p('p',10,10)]))});
test('validates duplicate IDs',()=>assert.throws(()=>plan([s('x',100,100),s('x',100,100)],[p('p',10,10)])));
test('uncut stock does not count in efficiency',()=>{const x=plan([s('a',100,100),s('b',200,200)],[p('p',100,100)]);assert.equal(x.stockArea,10000);assert.equal(x.efficiency,1)});
test('empty projects supported',()=>{const x=plan([],[]);assert.equal(x.placedCount,0);assert.equal(x.efficiency,0)});
test('matches multiple fabric types',()=>{const x=plan([s('a',100,100),s('b',100,100,{material:'B'})],[p('pa',90,90),p('pb',90,90,{material:'B'})]);assert.equal(x.placedCount,2);assert.equal(x.used.length,2)});
test('deterministic with identical inputs',()=>{const a=E.sample();const x=E.optimize(a),y=E.optimize(a);assert.deepEqual(x,y)});
test('rectangle bounds and gap property in 500 randomized projects',()=>{
 let seed=12345;const rand=n=>(seed=(seed*1664525+1013904223)>>>0)%n;
 for(let k=0;k<500;k++){
  const stocks=Array.from({length:2+rand(3)},(_,i)=>s('s'+i,80+rand(240),70+rand(220),{kind:i===0?'scrap':(rand(2)?'scrap':'new'),material:rand(3)?'A':'B'}));
  const parts=Array.from({length:1+rand(7)},(_,i)=>p('p'+i,15+rand(125),15+rand(130),{qty:1+rand(3),material:rand(3)?'A':'B',allowance:rand(4),rotate:rand(2)===1}));
  const gap=rand(8);const x=plan(stocks,parts,gap);const check=E.checkLayout(x,gap);
  assert.equal(check.valid,true,`case ${k}: ${check.errors.join(',')}`);
  assert.equal(x.placedCount+x.unplaced.length,x.requestedCount);
  assert.ok(x.efficiency<=1.0000001);assert.ok(x.newUsed<=x.used.length);
  for(const sh of x.sheets){const pieceArea=sh.placements.reduce((a,p)=>a+p.w*p.h,0);const freeArea=sh.free.reduce((a,r)=>a+r.w*r.h,0);assert.ok(pieceArea+freeArea<=sh.w*sh.h+0.00001)}
 }
});
