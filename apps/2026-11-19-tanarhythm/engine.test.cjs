const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('./engine.js');
const s=()=>E.sample();
const p=(id,width,daily,margin,opts={})=>({id,name:id,width,height:10,depth:5,daily,margin,min:0,max:3,faces:1,color:'#123456',...opts});
test('sample dimensions and 5 SKUs',()=>{const d=E.normalize(s());assert.equal(d.products.length,5);assert.equal(d.shelf.width,120)});
test('depth columns count is floored and height respected',()=>{const d=s();assert.equal(E.faceDepth(d.shelf,d.products[0]),4);d.products[0].height=50;assert.equal(E.faceDepth(d.shelf,d.products[0]),0)});
test('gross profit caps by sales forecast',()=>{const a={shelf:{width:20,height:20,depth:10,days:2},products:[p('a',5,3,100,{faces:2})]};const m=E.measure(a);assert.equal(m.profit,400);assert.equal(m.rows[0].shortage,2)});
test('zero demand does not yield negative or infinite coverage',()=>{let d=s();d.products[0].daily=0;const m=E.measure(d);assert.equal(m.rows[0].coverageDays,null);assert.equal(m.rows[0].shortage,0)});
test('empty product list is valid',()=>{const d=s();d.products=[];assert.equal(E.optimize(d).ok,true);assert.equal(E.measure(d).profit,0)});
test('maximize aggregate profit with diminishing returns',()=>{const a={shelf:{width:20,height:20,depth:5,days:1},products:[p('a',5,2,100),p('b',5,2,90)]};const o=E.optimize(a);assert.equal(o.ok,true);assert.deepEqual(o.facings,[2,2]);assert.equal(o.evaluation.profit,380)});
test('required minimum faces cannot be violated',()=>{const d=s();d.products.forEach(p=>{p.min=2;p.max=6});const o=E.optimize(d);assert.ok(o.ok);assert.ok(o.facings.every(n=>n>=2))});
test('cannot fit mandatory product in too short shelf',()=>{let d=s();d.shelf.height=5;assert.equal(E.optimize(d).ok,false)});
test('detect infeasible fixed minimum space',()=>{const a={shelf:{width:20,height:20,depth:10,days:3},products:[p('a',15,1,100,{min:1}),p('b',15,1,90,{min:1})]};assert.equal(E.optimize(a).ok,false)});
test('face count over 12 invalid',()=>{const d=s();d.products[0].faces=13;assert.throws(()=>E.measure(d))});
test('duplicate IDs invalid',()=>{const d=s();d.products[1].id=d.products[0].id;assert.throws(()=>E.normalize(d))});
test('negative sales and invalid width invalid',()=>{const d=s();d.products[1].daily=-2;assert.throws(()=>E.normalize(d));d.products[1].daily=2;d.shelf.width=NaN;assert.throws(()=>E.normalize(d))});
test('CSV includes BOM and headers',()=>{const content=E.csv(s());assert.ok(content.startsWith('\ufeff'));assert.match(content,/店頭在庫個数/);assert.equal(content.trim().split('\r\n').length,6)});
test('CSV neutralizes spreadsheet formulas',()=>{const d=s();d.products[0].name='=SUM(1,2)';const x=E.csv(d);assert.ok(x.includes("'=SUM(1,2)"))});
test('optimizing never reports shelf overflow',()=>{let d=s();d.shelf.width=110;const o=E.optimize(d);assert.ok(o.ok);assert.ok(o.evaluation.withinWidth)});
test('current sample has potential optimization',()=>{const d=s();const o=E.optimize(d);assert.ok(o.ok);assert.ok(o.evaluation.profit>=E.measure(d).profit)});
test('randomized exhaustive benchmark: 300 small instances',()=>{
  let seed=20261119;const rand=()=>((seed= (Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  for(let k=0;k<300;k++){
    const products=Array.from({length:2+Math.floor(rand()*3)},(_,i)=>p('i'+i,1+Math.floor(rand()*8)/2,Math.floor(rand()*9)/2,Math.floor(rand()*200),{max:1+Math.floor(rand()*3),min:0,faces:0}));
    const width=20+Math.floor(rand()*40)/2, state={shelf:{width,height:20,depth:5,days:2},products};
    const o=E.optimize(state);assert.equal(o.ok,true);
    let best=-1;
    function rec(i,a){if(i===products.length){const e=E.measure(state,a);if(e.withinWidth)best=Math.max(best,e.profit);return}for(let n=0;n<=products[i].max;n++)rec(i+1,[...a,n]);}
    rec(0,[]);assert.ok(Math.abs(o.evaluation.profit-best)<1e-6,`case ${k}: ${o.evaluation.profit} vs ${best}`);
  }
});
