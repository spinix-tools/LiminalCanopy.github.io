/* GitHub standalone source core tests: node --test engine.test.cjs */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const from=html.indexOf('var SAMPLE='),to=html.indexOf('function save()',from);
if(from<0||to<from)throw Error('計算エンジンがindex.html内に見つかりません');
const src=html.slice(from,to);
const E=Function(src+';return {SAMPLE,check,plans,single,optimize,expected,probs}')();
const clone=()=>JSON.parse(JSON.stringify(E.SAMPLE));
test('sample returns exact three distinct plan quantities',()=>{
 const a=E.plans(clone()).options;
 assert.deepEqual(a.map(x=>x.counts),[[30,24,20],[15,12,10],[30,36,30]]);
});
test('sample capacities are satisfied',()=>{const a=E.plans(clone()).options;for(const p of a)assert.ok(p.used<=390)});
test('expected profit and scenario probabilities',()=>{
 const d=clone(),p=E.plans(d).options[0];
 assert.equal(p.profit,7707.5);
 assert.equal(p.loss,.25);
 assert.equal(p.profit,(p.scenarios[0].profit*.25+p.scenarios[1].profit*.5+p.scenarios[2].profit*.25));
});
test('probabilities must sum 100',()=>{const d=clone();d.event.pHigh=20;assert.throws(()=>E.check(d),/100%/)});
test('recovery value is capped by cost',()=>{const d=clone();d.items[0].salvage=999;assert.throws(()=>E.check(d),/回収価値/)});
test('monotone demand and positive integer minutes enforced',()=>{
 const d=clone();d.items[0].low=90;assert.throws(()=>E.check(d),/需要/);
 d.items[0].low=0;d.items[0].minutes=2.5;assert.throws(()=>E.check(d),/整数/);
});
test('zero time means zero production, but outlay remains',()=>{
 const d=clone();d.event.capacity=0;
 const p=E.plans(d).options[0];
 assert.deepEqual(p.counts,[0,0,0]);assert.equal(p.profit,-5700);
});
test('unprofitable item is not produced',()=>{
 const d=clone();d.items=[{id:'negative',name:'赤字商品',price:10,cost:99,salvage:0,minutes:1,low:10,base:20,high:30}];
 assert.deepEqual(E.plans(d).options[0].counts,[0]);
});
test('all unsold products still incur their whole cost',()=>{
 const x={price:200,cost:90,salvage:10,low:0,base:1,high:4};
 assert.equal(E.single(x,3,'low').profit,3*10-3*90);
 assert.equal(E.single(x,3,'base').profit,200+2*10-3*90);
});
test('exact dynamic program matches exhaustive enumeration on small example',()=>{
 const d={version:1,event:{name:'test',boothFee:200,travelFee:0,otherFee:0,capacity:11,pLow:20,pBase:50,pHigh:30},items:[
 {id:'a',name:'A',price:33,cost:12,salvage:0,minutes:2,low:0,base:2,high:4},
 {id:'b',name:'B',price:44,cost:21,salvage:5,minutes:3,low:1,base:2,high:3},
 {id:'c',name:'C',price:40,cost:15,salvage:0,minutes:2,low:0,base:1,high:2}
 ]};
 const n=E.check(d),w=E.probs(n.event),p=E.optimize(n,w,w);
 let best=-Infinity,used=Infinity;
 for(let a=0;a<=4;a++)for(let b=0;b<=3;b++)for(let c=0;c<=2;c++){
  const time=2*a+3*b+2*c;if(time>11)continue;
  const value=E.expected(n.items[0],a,w)+E.expected(n.items[1],b,w)+E.expected(n.items[2],c,w);
  if(value>best+1e-7||(Math.abs(value-best)<1e-7&&time<used)){best=value;used=time}
 }
 assert.ok(Math.abs(p.profit-(best-200))<1e-7);assert.equal(p.used,used);
});
test('invalid JSON shape rejected',()=>{assert.throws(()=>E.check({version:1}),/形式/);});
