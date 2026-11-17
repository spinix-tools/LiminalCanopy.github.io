const {test} = require('node:test');
const assert = require('node:assert/strict');
const E = require('./engine.js');
const blank = () => E.DENOMS.map(()=>0);
const stock = entries => {const a=blank();for(const [d,n] of entries)a[E.DENOMS.indexOf(d)]=n;return a;};
const item = (name, price, weight=1) => ({id:'p'+price,name,price,weight});

test('defaults are self-contained and consistent',()=>{const s=E.newState();assert.equal(s.version,1);assert.equal(s.opening.length,10);assert.equal(s.sales.length,0);assert.equal(E.cashSummary(s).revenue,0);});
test('denominations descending include 2000 and 1 yen',()=>assert.deepEqual(E.DENOMS,[10000,5000,2000,1000,500,100,50,10,5,1]));
test('opening cash total is exact',()=>assert.equal(E.totalCash(stock([[1000,2],[500,3],[5,4]])),3520));
test('zero change is a valid 10-element vector',()=>assert.deepEqual(E.makeChange(0,blank()),blank()));
test('simple change uses known denominations',()=>assert.deepEqual(E.makeChange(650,stock([[500,1],[100,1],[50,1]])),stock([[500,1],[100,1],[50,1]])));
test('not enough funds returns null',()=>assert.equal(E.makeChange(100,stock([[50,1]])),null));
test('greedy failure falls back to exact bounded solution',()=>assert.deepEqual(E.makeChange(600,stock([[500,1],[2000,0],[100,6]]) ),stock([[500,1],[100,1]])));
test('non-greedy available amount found',()=>assert.deepEqual(E.makeChange(600,stock([[500,1],[100,0],[2000,0],[50,0],[10,0],[5,0],[1,0],[1000,0],[10000,0],[5000,0]])),null));
test('DP fallback with 100×3 when 500 greedy path blocked',()=>{const a=stock([[500,1],[100,3],[50,2]]);const r=E.makeChange(300,a);assert.ok(r);assert.equal(E.totalCash(r),300);assert.equal(r[E.DENOMS.indexOf(100)],3);});
test('DP matches exhaustive reachability for 120 deterministic tiny-stock samples',()=>{
 let seed=112233;const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
 for(let t=0;t<120;t++){
  const a=blank();for(const d of [100,50,10,5,1])a[E.DENOMS.indexOf(d)]=rng()%4;
  const reachable=new Set([0]);for(let i=0;i<a.length;i++){const prev=[...reachable];for(const amount of prev){for(let n=1;n<=a[i];n++)reachable.add(amount+n*E.DENOMS[i]);}}
  for(const v of [rng()%200,rng()%200,0,5,20,90]){
   const result=E.makeChange(v,a);
   assert.equal(!!result,reachable.has(v),`case ${t} amount ${v}`);
   if(result){assert.equal(E.totalCash(result),v);assert.ok(result.every((n,i)=>n<=a[i]));}
  }
 }
});
test('negative and fractional cash counts are rejected',()=>{assert.throws(()=>E.validateCounts(stock([[1,-1]])));const a=blank();a[3]=1.5;assert.throws(()=>E.validateCounts(a));});
test('stock count length and >999 rejected',()=>{assert.throws(()=>E.validateCounts([1]));const a=blank();a[0]=1000;assert.throws(()=>E.validateCounts(a));});
test('quote checks tender cannot be less than sale',()=>assert.throws(()=>E.quote([...E.START],1800,1000)));
test('quote allows exact denomination payment',()=>{const q=E.quote([...E.START],1000,1000);assert.equal(q.due,0);assert.equal(q.possible,true);});
test('quote reports shortage without changing source',()=>{const a=blank();const q=E.quote(a,750,1000);assert.equal(q.possible,false);assert.deepEqual(a,blank());});
test('sale changes drawer by amount, not received amount',()=>{const s=E.newState();const x=E.recordSale(s,'試し',750,1000,'2026-11-17T06:00:00Z');assert.equal(x.sales.length,1);assert.equal(E.totalCash(E.getDrawer(x)),E.totalCash(s.opening)+750);assert.equal(s.sales.length,0);});
test('undo restores previous drawer exactly',()=>{const s=E.newState();const x=E.recordSale(s,'試し',750,1000);assert.deepEqual(E.getDrawer(E.undoLast(x)),s.opening);});
test('cash summary reconciliation shows positive and negative difference',()=>{const s=E.newState();const a=E.getDrawer(s);let t=E.normalizeState({...s,physical:a});assert.equal(E.cashSummary(t).difference,0);a[9]++;t=E.normalizeState({...s,physical:a});assert.equal(E.cashSummary(t).difference,1);});
test('product blank name and invalid price are rejected',()=>{assert.throws(()=>E.validateProduct(item('',100)));assert.throws(()=>E.validateProduct(item('X',10001)));});
test('state rejects incompatible version',()=>assert.throws(()=>E.normalizeState({...E.newState(),version:999})));
test('state rejects duplicate product ids',()=>{const s=E.newState();s.products.push({...s.products[0]});assert.throws(()=>E.normalizeState(s));});
test('state rejects falsified change totals on import',()=>{let s=E.recordSale(E.newState(),'X',750,1000);s.sales[0].change=blank();assert.throws(()=>E.normalizeState(s));});
test('state rejects imported overdraft',()=>{const s=E.newState();const change=stock([[500,1]]);s.sales=[{id:'s1',label:'X',amount:500,tender:1000,change,at:'2026-11-17'}, {id:'s2',label:'X',amount:500,tender:1000,change,at:'2026-11-17'}];s.opening=blank();assert.throws(()=>E.normalizeState(s));});
test('simulation is deterministic for the same seed',()=>{const args=[E.newState().products,[...E.START],{trials:7,visits:8,seed:123}];assert.deepEqual(E.simulate(...args),E.simulate(...args));});
test('simulation never reports more than 100% success',()=>{const r=E.simulate([item('X',1000)],stock([[1000,15]]),{trials:7,visits:3,seed:42});assert.equal(r.noShortageRate,1);assert.equal(r.shortageCount,0);});
test('simulation reports shortage with no usable change',()=>{const r=E.simulate([item('X',350)],blank(),{trials:8,visits:5,seed:7});assert.equal(r.noShortageRate,0);assert.equal(r.shortageCount,40);});
test('simulation validates inputs',()=>assert.throws(()=>E.simulate([],blank())));
test('simulation caps enormous trials',()=>assert.throws(()=>E.simulate([item('X',350)],blank(),{trials:400,visits:5})));
test('CSV includes Japanese header and BOM',()=>{const c=E.salesCSV(E.newState());assert.ok(c.startsWith('\uFEFF"日時"'));assert.ok(c.includes('お釣り(円)'));});
test('CSV escapes formula injection and quotes',()=>{const s=E.newState();s.sales=[{id:'x',label:'=CMD("a")',amount:1000,tender:1000,change:blank(),at:'2026-11-17'}];const c=E.salesCSV(s);assert.ok(c.includes("'=CMD("));assert.ok(c.includes('""a""'));});
test('JSON normalizer ignores unknown properties',()=>{const s=E.newState();s.secret='not saved';assert.equal(E.normalizeState(s).secret,undefined);});
