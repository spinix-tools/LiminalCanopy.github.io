'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const H=require('./engine.js');
test('unit conversion and padding',()=>{assert.equal(H.cmToMm(1.2),12);assert.equal(H.itemUnits([{w:10,d:12,h:3,qty:1,name:'A'}],0.5)[0].w,110);});
test('rotation restriction for upright package',()=>{const r=H.rotations({w:10,d:15,h:20,upright:true});assert.equal(r.length,2);assert(r.every(x=>x.h===20));});
test('all 6 orientations of cuboid',()=>{assert.equal(H.rotations({w:10,d:15,h:20,upright:false}).length,6);});
test('deduplicate cube rotations',()=>{assert.equal(H.rotations({w:10,d:10,h:10,upright:false}).length,1);});
test('box exactly fits padded item',()=>{const r=H.compare([{name:'A',w:9,d:9,h:9,qty:1}], [{name:'B',w:10,d:10,h:10,price:100}],.5);assert.equal(r.results[0].allFit,true);assert(H.verify(r.results[0]));});
test('one millimeter too small is rejected',()=>{const r=H.compare([{name:'A',w:10,d:10,h:10,qty:1,upright:true}],[{name:'B',w:9.9,d:10,h:10,price:1}],0);assert.equal(r.results[0].rejected.length,1);});
test('known pair packing',()=>{const r=H.compare([{name:'A',w:10,d:10,h:10,qty:2}],[{name:'B',w:20,d:10,h:10,price:1}],0);assert.equal(r.results[0].placed.length,2);assert(H.verify(r.results[0]));});
test('cost-first recommendation among fitting cartons',()=>{const r=H.compare([{name:'A',w:4,d:4,h:4,qty:1}],[{id:'big',name:'big',w:50,d:50,h:50,price:30},{id:'small',name:'small',w:10,d:10,h:10,price:80}],0);assert.equal(r.recommended.box.id,'big');});
test('unfitting cheap box not recommended',()=>{const r=H.compare([{name:'A',w:20,d:20,h:20,qty:1}],[{id:'a',w:8,d:8,h:8,price:1},{id:'b',w:22,d:22,h:22,price:20}],0);assert.equal(r.recommended.box.id,'b');});
test('none fits -> no recommendation',()=>{const r=H.compare([{w:100,d:100,h:100,qty:1}], [{w:10,d:10,h:10,price:1}],0);assert.equal(r.recommended,null);});
test('invalid padding',()=>{assert.throws(()=>H.compare([{w:1,d:1,h:1,qty:1}],[{w:5,d:5,h:5,price:2}],11));});
test('invalid qty',()=>{assert.throws(()=>H.itemUnits([{w:1,d:1,h:1,qty:0}],0));});
test('total quantity cap',()=>{assert.throws(()=>H.itemUnits([{w:1,d:1,h:1,qty:20},{w:1,d:1,h:1,qty:5}],0));});
test('overlap and containment',()=>{const a={x:0,y:0,z:0,w:10,d:10,h:10};const b={x:10,y:0,z:0,w:10,d:10,h:10};assert(!H.overlaps(a,b));assert(H.contains(a,{x:1,y:2,z:3,w:1,d:1,h:1}));});
test('physical placements do not overlap in sample',()=>{const r=H.compare([{w:12,d:12,h:13,qty:2,upright:true},{w:18,d:10,h:6,qty:2},{w:18,d:13,h:1,qty:1}],[{w:24,d:19,h:16,price:85},{w:30,d:23,h:20,price:130},{w:36,d:28,h:26,price:190}],.5);assert(r.results.every(H.verify));assert.equal(r.recommended.placed.length,5);});
test('deterministic placement',()=>{const a=[{w:10,d:13,h:17,qty:3},{w:8,d:8,h:4,qty:2}];const b=[{w:30,d:30,h:30,price:1}];assert.deepEqual(H.compare(a,b,0),H.compare(a,b,0));});
test('conservation of units on failure and success',()=>{const a=H.compare([{w:20,d:15,h:10,qty:8}],[{w:30,d:30,h:30,price:10}],0).results[0];assert.equal(a.rejected.length+a.placed.length,8);});
// Seeded, reproducible property checks: 600 randomized sets of irregular goods and boxes.
test('600 seeded random geometric and conservation checks',()=>{
  let seed=0x1a4fb2e1;function rnd(){seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;}
  for(let caseNo=0;caseNo<600;caseNo++){
    const n=1+Math.floor(rnd()*5),items=[];
    for(let j=0;j<n;j++)items.push({name:'Item '+j,w:1+Math.floor(rnd()*22),d:1+Math.floor(rnd()*19),h:1+Math.floor(rnd()*15),qty:1+Math.floor(rnd()*3),upright:rnd()<.5});
    const boxes=[{name:'A',w:10+Math.floor(rnd()*35),d:10+Math.floor(rnd()*35),h:10+Math.floor(rnd()*35),price:Math.floor(rnd()*900)}];
    const r=H.compare(items,boxes,Math.floor(rnd()*4)/2).results[0];
    assert(H.verify(r),'overlap or out-of-bounds case '+caseNo);
    const ids=new Set([...r.placed,...r.rejected].map(i=>i.id));
    assert.equal(ids.size,items.reduce((s,i)=>s+i.qty,0),'duplicate IDs case '+caseNo);
    assert.equal(r.total,r.placed.length+r.rejected.length);
    assert(r.fillRate<=1+1e-8);
  }
});