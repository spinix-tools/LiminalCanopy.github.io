const assert = require('node:assert/strict');
const {test} = require('node:test');
const K = require('./engine.js');
const demo = {stocks:[{value:100,count:1},{value:70,count:1},{value:30,count:1},{value:10,count:1}],mails:[{label:'A',target:100,maxStamps:2},{label:'B',target:110,maxStamps:2}],overLimit:0,objective:'excess'};
test('two letters jointly solvable where greedy fails',()=>{
 const p=K.plan(demo); assert.equal(p.ok,true);assert.equal(p.exact,true);assert.equal(p.totalExcess,0);assert.equal(p.totalPieces,4);assert.equal(p.greedy,null);
 assert.deepEqual(p.rows.map(x=>x.paid),[100,110]);assert.deepEqual(p.remaining,[0,0,0,0]);
});
test('global stock is never overspent',()=>{
 const p=K.plan({...demo,overLimit:10});for(let i=0;i<demo.stocks.length;i++) assert.ok(p.remaining[i]>=0);
});
test('exact impossible if stock 100 consumed by only mail',()=>{
 const p=K.plan({...demo,stocks:[{value:100,count:1},{value:70,count:0},{value:30,count:1},{value:10,count:1}]});assert.equal(p.ok,false);
});
test('single letter prefers exact',()=>{
 const p=K.plan({stocks:[{value:100,count:1},{value:55,count:2}],mails:[{target:110,maxStamps:2}],overLimit:30});assert.equal(p.rows[0].paid,110);assert.equal(p.rows[0].pieces,2);
});
test('fewest stamps preference may overpay',()=>{
 const p=K.plan({stocks:[{value:100,count:1},{value:50,count:2},{value:10,count:1}],mails:[{target:110,maxStamps:2}],overLimit:40,objective:'pieces'});
 assert.equal(p.rows[0].paid,110);assert.equal(p.rows[0].pieces,2); // 100+10 only
});
test('pieces preference contrasts excess',()=>{
 const input={stocks:[{value:120,count:1},{value:50,count:2}],mails:[{target:100,maxStamps:2}],overLimit:20};
 assert.equal(K.plan({...input,objective:'pieces'}).rows[0].paid,120);
 assert.equal(K.plan({...input,objective:'excess'}).rows[0].paid,100);
});
test('no valid combination failure',()=>{
 const p=K.plan({stocks:[{value:50,count:1}],mails:[{target:110,maxStamps:3}],overLimit:0});assert.equal(p.ok,false);assert.match(p.reason,/組合せ/);
});
test('duplicate denomination rejected',()=>assert.throws(()=>K.plan({...demo,stocks:[{value:10,count:1},{value:10,count:3}]}),/同じ額面/));
test('invalid and excessive input rejected',()=>{
 for(const input of [{...demo,overLimit:101},{...demo,stocks:[{value:-3,count:2}]},{...demo,mails:[{target:1,maxStamps:6}]},{...demo,mails:[]}]) assert.throws(()=>K.plan(input));
});
test('confirmed plan deducts stock and leaves original unchanged',()=>{
 const p=K.plan(demo);const result=K.applyPlan(demo,p);assert.deepEqual(result.stocks.map(x=>x.count),[0,0,0,0]);assert.equal(demo.stocks[0].count,1);
});
test('tampered plan cannot be confirmed',()=>{
 const p=K.plan(demo);p.remaining[0]=1;assert.throws(()=>K.applyPlan(demo,p));
});
test('exploration limit never returns a fake optimum',()=>{
 assert.throws(()=>K.plan(demo,{maxStates:0}),/最適解は未確定/);
});
test('exhaustive enumeration on randomized tiny inventories agrees with plan',()=>{
 let seed=123456789; const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let z=0;z<150;z++) {
  const n=2+Math.floor(rand()*3), k=1+Math.floor(rand()*3);
  const stocks=Array.from({length:n},(_,i)=>({value:(i+1)*10,count:Math.floor(rand()*4)}));
  const mails=Array.from({length:k},(_,i)=>({target:10+10*Math.floor(rand()*7),maxStamps:1+Math.floor(rand()*3)}));
  const input={stocks,mails,overLimit:10,objective:z%2?'pieces':'excess'};
  const opts=mails.map(m=>K.optionsForMail(stocks,m,10));let best=null;
  function visit(i,remaining,excess,pieces){if(i===k){const cand={excess,pieces};if(K.compare(cand,best,input.objective)<0)best=cand;return;}
   for(const o of opts[i])if(o.counts.every((v,j)=>v<=remaining[j]))visit(i+1,remaining.map((v,j)=>v-o.counts[j]),excess+o.excess,pieces+o.pieces);
  }
  visit(0,stocks.map(s=>s.count),0,0);
  const result=K.plan(input);
  assert.equal(result.ok,!!best,`case ${z}`);
  if(best){assert.equal(result.totalExcess,best.excess,`excess ${z}`);assert.equal(result.totalPieces,best.pieces,`pieces ${z}`);}
 }
});