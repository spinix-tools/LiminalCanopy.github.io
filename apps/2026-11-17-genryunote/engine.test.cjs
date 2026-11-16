'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('./engine.js');
const copy = obj => JSON.parse(JSON.stringify(obj));
const demo = () => copy(E.demo());
const base = () => ({version:1,activeClaimId:'c-one',claims:[{id:'c-one',title:'Test claim',note:'',status:'reviewing'}],sources:[]});
const src = (id,origin,stance,parentId='') => ({id:'s-'+id,claimId:'c-one',title:'Source '+id,url:'',note:'',origin,stance,parentId});

test('blank model has no claims',()=>assert.deepEqual(E.analyze(E.blank(),'anything').total,0));
test('demo has one supporting and one refuting independent root',()=>{
 const a=E.analyze(E.demo(),'c-demo');
 assert.deepEqual({roots:a.rootCount,support:a.support,refute:a.refute,unknown:a.unknownCount,total:a.total},{roots:2,support:1,refute:1,unknown:1,total:4});
});
test('three copied articles still produce one independent source root',()=>{
 const m=base();m.sources=[src('a','original','support'),src('b','derived','support','s-a'),src('c','derived','support','s-b'),src('d','derived','support','s-a')];
 const a=E.analyze(E.validateModel(m),'c-one');assert.equal(a.rootCount,1);assert.equal(a.support,1);assert.equal(a.derivativeCount,3);
});
test('unknown-origin sources are excluded from independent counts',()=>{
 const m=base();m.sources=[src('a','unknown','support'),src('b','derived','support','s-a')];
 const a=E.analyze(E.validateModel(m),'c-one');assert.equal(a.unknownCount,2);assert.equal(a.rootCount,0);
});
test('one lineage with opposing citations is mixed, never two roots',()=>{
 const m=base();m.sources=[src('a','original','support'),src('b','derived','refute','s-a')];
 const a=E.analyze(E.validateModel(m),'c-one');assert.equal(a.rootCount,1);assert.equal(a.mixed,1);assert.equal(a.support,0);
});
test('multiple roots are counted once each',()=>{
 const m=base();m.sources=[src('a','original','support'),src('b','original','support')];
 const a=E.analyze(E.validateModel(m),'c-one');assert.equal(a.rootCount,2);assert.equal(a.support,2);
});
test('reject circular citation graph',()=>{
 const m=base();m.sources=[src('a','derived','support','s-b'),src('b','derived','refute','s-a')];
 assert.throws(()=>E.validateModel(m),/循環/);
});
test('reject parent from another claim',()=>{
 const m=base();m.claims.push({id:'c-two',title:'Other claim',note:'',status:'unresolved'});
 m.sources=[src('a','original','support'),{...src('b','derived','support','s-a'),claimId:'c-two'}];
 assert.throws(()=>E.validateModel(m),/別の論点/);
});
test('reject orphan source',()=>{
 const m=base();m.sources=[src('b','derived','support','s-no')];
 assert.throws(()=>E.validateModel(m),/引用元/);
});
test('reject duplicate source IDs',()=>{
 const m=base();m.sources=[src('a','original','support'),src('a','original','refute')];
 assert.throws(()=>E.validateModel(m),/重複/);
});
test('reject invalid javascript URL',()=>{
 const m=base();m.sources=[{...src('a','original','support'),url:'javascript:alert(1)'}];
 assert.throws(()=>E.validateModel(m),/http/);
 assert.equal(E.safeUrl('javascript:alert(1)'),'');
});
test('deleting an original root leaves descendants as unknown',()=>{
 const m=base();m.sources=[src('a','original','support'),src('b','derived','support','s-a'),src('c','derived','support','s-b')];
 const next=E.detachChildren(E.validateModel(m),'s-a');
 assert.equal(next.sources.find(x=>x.id==='s-b').origin,'unknown');
 assert.equal(next.sources.find(x=>x.id==='s-c').parentId,'s-b');
 const a=E.analyze(next,'c-one');assert.equal(a.rootCount,0);assert.equal(a.unknownCount,2);
});
test('markdown preserves explicit limitation, unknown, and claim',()=>{
 const doc=E.markdown(E.demo(),'c-demo');
 assert.match(doc,/アプリは真偽を判定しません/);
 assert.match(doc,/出所未確認/);
 assert.match(doc,/架空の町/);
});
test('import sanitizer removes untrusted extra keys',()=>{
 const m=base();m.dangerous='x';m.claims[0].dangerous='x';
 const v=E.validateModel(m);assert.equal('dangerous' in v,false);assert.equal('dangerous' in v.claims[0],false);
});
test('large source arrays cannot be imported',()=>{
 const m=base();m.sources=Array.from({length:401},(_,i)=>src('a'+i,'original','support'));
 assert.throws(()=>E.validateModel(m),/最大400/);
});
test('model survives JSON backup and restore',()=>{
 const m=E.demo();assert.deepEqual(E.validateModel(JSON.parse(JSON.stringify(m))),m);
});
