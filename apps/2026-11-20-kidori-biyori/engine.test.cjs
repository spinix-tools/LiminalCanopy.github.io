const assert = require('node:assert/strict');
const test = require('node:test');
const E = require('./engine.js');
const base = () => E.copy(E.sample);
test('example is valid and the solver terminates',()=>{const p=base();assert.deepEqual(E.validate(p),[]);for(const mode of ['offcut','yield']){const r=E.plan(p,mode);assert.equal(r.placed.length+r.unplaced.length,7);assert.ok(r.cost>=0);assert.ok(r.stocks.length<=4);}});
test('blade kerf prevents pieces that only fit without it',()=>{const p={kerf:2,margin:0,minReuse:0,stocks:[{name:'A',w:100,h:100,qty:1,kind:'offcut',price:0}],parts:[{name:'a',w:50,h:100,qty:2,grain:true}]};assert.equal(E.plan(p).unplaced.length,1);p.kerf=0;assert.equal(E.plan(p).unplaced.length,0);});
test('wood grain fixed cannot rotate',()=>{const p={kerf:0,margin:0,minReuse:0,stocks:[{name:'A',w:120,h:100,qty:1,kind:'offcut',price:0}],parts:[{name:'a',w:80,h:110,qty:1,grain:true}]};assert.equal(E.plan(p).unplaced.length,1);p.parts[0].grain=false;assert.equal(E.plan(p).unplaced.length,0);});
test('purchases are charged only for used new sheets',()=>{const p={kerf:0,margin:0,minReuse:0,stocks:[{name:'n',w:200,h:200,qty:3,kind:'new',price:1900}],parts:[{name:'a',w:100,h:100,qty:1,grain:true}]};assert.equal(E.plan(p).cost,1900);});
test('reusable pieces meet the minimum dimension threshold',()=>{const p={kerf:0,margin:0,minReuse:70,stocks:[{name:'n',w:200,h:200,qty:1,kind:'offcut',price:0}],parts:[{name:'a',w:100,h:100,qty:1,grain:true}]};assert.equal(E.plan(p).remainders.length,2);p.minReuse=101;assert.equal(E.plan(p).remainders.length,0);});
test('invalid data is rejected',()=>{const p=base();p.parts[0].w=-1;assert.ok(E.plan(p).error);p.parts[0].w=100;p.kerf=-2;assert.ok(E.validate(p).length);});
test('input is never mutated',()=>{const p=base();const before=JSON.stringify(p);E.plan(p);assert.equal(JSON.stringify(p),before);});
test('guillotine rectangles never overlap or extend beyond stock, 320 random scenarios',()=>{
  let seed=1234567; const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
  for(let j=0;j<320;j++) {
    const k=Math.floor(rand()*8), margin=Math.floor(rand()*15);
    const p={kerf:k,margin,minReuse:50,stocks:[{name:'old',w:200+Math.floor(rand()*400),h:220+Math.floor(rand()*500),qty:2,kind:'offcut',price:0},{name:'new',w:600,h:900,qty:2,kind:'new',price:500}],parts:Array.from({length:3+Math.floor(rand()*8)},(_,i)=>({name:'p'+i,w:40+Math.floor(rand()*300),h:40+Math.floor(rand()*280),qty:1+Math.floor(rand()*3),grain:rand()>.5}))};
    for(const mode of ['offcut','yield']){
      const r=E.plan(p,mode); assert.equal(r.error,undefined);const items=r.placed.length+r.unplaced.length;assert.equal(items,p.parts.reduce((a,x)=>a+x.qty,0));
      let area=0;for(const stock of r.stocks){const rectangles=[...stock.pieces,...stock.free];for(let i=0;i<rectangles.length;i++){
        const x=rectangles[i];assert.ok(x.x>=margin-1e-6&&x.y>=margin-1e-6);assert.ok(x.x+x.w<=stock.w-margin+1e-6&&x.y+x.h<=stock.h-margin+1e-6);
        for(let n=0;n<i;n++){const y=rectangles[n];const overlap=Math.min(x.x+x.w,y.x+y.w)-Math.max(x.x,y.x)>1e-6&&Math.min(x.y+x.h,y.y+y.h)-Math.max(x.y,y.y)>1e-6;assert.equal(overlap,false);}
      }area+=stock.pieces.reduce((sum,x)=>sum+x.w*x.h,0);}
      assert.equal(area,r.partArea);assert.ok(r.utilization<=1+1e-9);
    }
  }
});
