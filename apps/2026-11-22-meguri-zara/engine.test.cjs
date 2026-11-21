'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('./engine.js');
const sample = () => E.demo().plan;
test('demo is fully usable and stock conserves',()=>{
 const r=E.simulate(sample());assert.equal(r.demand,435);assert.equal(r.required,195);assert.equal(r.unmet,15);assert.equal(r.issued,420);assert(r.conservation);
});
test('recommended stock fully covers demand',()=>{
 const p=sample();p.initial=E.requiredInitial(p);const r=E.simulate(p);assert.equal(r.unmet,0);assert.equal(r.issued,r.demand);
});
test('only supplied clean inventory can satisfy demand',()=>{
 const p={title:'t',initial:2,rate:100,delay:1,deposit:100,slots:[{label:'A',demand:2,supply:0},{label:'B',demand:2,supply:0}]};
 const r=E.simulate(p);assert.equal(r.returned,2);assert.equal(r.dirty,2);assert.equal(r.issued,2);assert.equal(r.unmet,2);assert.equal(r.clean,0);
});
test('resupply before issue in its slot',()=>{
 const p={title:'t',initial:0,rate:0,delay:1,deposit:0,slots:[{label:'A',demand:3,supply:3}]};
 const r=E.simulate(p);assert.equal(r.issued,3);assert.equal(r.required,0);
});
test('minimum initial is maximal prefix shortfall',()=>{
 const p={...sample(),initial:999};p.slots=[{label:'a',demand:10,supply:0},{label:'b',demand:1,supply:20},{label:'c',demand:11,supply:0}];
 assert.equal(E.requiredInitial(p),10);
});
test('returns after event stay outside',()=>{
 const p={title:'late',initial:10,rate:100,delay:3,deposit:500,slots:[{label:'A',demand:5,supply:0}]};
 const r=E.simulate(p);assert.equal(r.returned,0);assert.equal(r.late,5);assert.equal(r.outside,5);assert.equal(r.held,2500);
});
test('zero return rate',()=>{const p=sample();p.rate=0;const r=E.simulate(p);assert.equal(r.returned,0);assert.equal(r.dirty,0)});
test('100 percent return rate with one-slot delay',()=>{
 const p={title:'t',initial:10,rate:100,delay:1,deposit:0,slots:[{label:'a',demand:2,supply:0},{label:'b',demand:3,supply:0},{label:'c',demand:0,supply:0}]};
 const r=E.simulate(p);assert.equal(r.returned,5);assert.equal(r.outside,0);
});
test('reject negative demand',()=>{const p=sample();p.slots[0].demand=-1;assert.throws(()=>E.simulate(p),/想定提供数/)});
test('reject fractional stock',()=>{const p=sample();p.initial=1.5;assert.throws(()=>E.simulate(p),/整数/)});
test('reject invalid delayed inputs',()=>{const p=sample();p.delay=0;assert.throws(()=>E.simulate(p),/回収まで/)});
test('reject more than 24 slots',()=>{const p=sample();p.slots=Array(25).fill({label:'x',demand:1,supply:0});assert.throws(()=>E.simulate(p),/1〜24/)});
test('reject excessive counts',()=>{const p=sample();p.initial=100001;assert.throws(()=>E.simulate(p),/整数/)});
test('reject excessive total volume',()=>{const p=sample();p.slots=Array(20).fill({label:'x',demand:100000,supply:0});assert.throws(()=>E.simulate(p),/100万/)});
test('log issues, returns and supplies preserve conservation',()=>{
 let l={start:5,entries:[]};l=E.appendEntry(l,{type:'issue',qty:4},100);l=E.appendEntry(l,{type:'return',qty:2},100);l=E.appendEntry(l,{type:'supply',qty:3},100);l=E.appendEntry(l,{type:'discard',qty:1},100);
 const r=E.replayLog(l,100);assert.deepEqual([r.clean,r.out,r.dirty,r.discarded,r.supplied,r.held],[3,2,2,1,3,200]);assert(r.conservation);
});
test('reject lending beyond clean stock',()=>{assert.throws(()=>E.appendEntry({start:1,entries:[]},{type:'issue',qty:2},0),/足りません/)});
test('reject returns greater than out count',()=>{assert.throws(()=>E.appendEntry({start:1,entries:[]},{type:'return',qty:1},0),/超える返却/)});
test('reject removal greater than clean stock',()=>{assert.throws(()=>E.appendEntry({start:1,entries:[]},{type:'discard',qty:2},0),/超えます/)});
test('reject invalid activity type',()=>{assert.throws(()=>E.appendEntry({start:1,entries:[]},{type:'evaporate',qty:1},0),/種別/)});
test('undo by popping latest event reverses totals',()=>{
 let l={start:5,entries:[]};l=E.appendEntry(l,{type:'issue',qty:3},100);l.entries.pop();assert.equal(E.replayLog(l,100).clean,5);
});
test('JSON serialization restores complete project',()=>{
 const state=E.demo(),parsed=JSON.parse(JSON.stringify(state));assert.deepEqual(E.normalizePlan(parsed.plan),state.plan);assert.deepEqual(E.normalizeLog(parsed.log),state.log)
});
test('XSS-like titles retained as plain data, not code',()=>{
 const p=sample();p.title='<script>alert(1)</script>';assert.equal(E.normalizePlan(p).title,p.title);
});
test('strong fuzz: 600 reproducible stock conservation and minimum bounds',()=>{
 let seed=62711;const rng=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
 for(let t=0;t<600;t++){
  const slots=Array.from({length:1+Math.floor(rng()*16)},(_,i)=>({label:String(i),demand:Math.floor(rng()*100),supply:Math.floor(rng()*70)}));
  const p={title:'random',initial:Math.floor(rng()*200),rate:Math.floor(rng()*101),delay:1+Math.floor(rng()*8),deposit:Math.floor(rng()*800),slots};
  const r=E.simulate(p);assert(r.conservation);assert(r.issued+r.unmet===r.demand);assert(r.returned+r.outside===r.issued);assert(r.required>=0);
  const full=E.simulate({...p,initial:r.required});assert.equal(full.unmet,0);if(r.required>0){const less=E.simulate({...p,initial:r.required-1});assert(less.unmet>0)}
 }
});
test('strong fuzz: 400 event ledgers with valid and invalid operations',()=>{
 let seed=18421;const rng=()=>{seed=(seed*1103515245+12345)>>>0;return seed/4294967296};
 for(let t=0;t<400;t++){
  let l={start:10,entries:[]};for(let k=0;k<30;k++){
   const state=E.replayLog(l,100);const valid=[['supply',4],['issue',Math.min(2,state.clean)],['return',Math.min(2,state.out)],['discard',Math.min(1,state.clean)]].filter(x=>x[1]>0);
   const chosen=valid[Math.floor(rng()*valid.length)];l=E.appendEntry(l,{type:chosen[0],qty:chosen[1]},100);
   assert(E.replayLog(l,100).conservation);
  }
 }
});
