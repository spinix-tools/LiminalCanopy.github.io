const {test}=require('node:test');
const assert=require('node:assert/strict');
const M=require('./engine.js');
const ok={id:'a',consignor:'紙の町',title:'本',sku:'Z-1',price:850,rate:20,received:10,sold:3,returned:6,damaged:0,onHand:1};
const item=x=>M.inspect({...ok,...x});
for(const [description,input,expected] of [
 ['balanced',{},'ok'],['shortage',{onHand:0},'shortage'],['overage',{onHand:2},'overage'],['no owner',{consignor:''},'invalid'],['no product',{title:''},'invalid'],['negative stock',{received:-1},'invalid'],['fractional count',{sold:1.4},'invalid'],['negative price',{price:-1},'invalid'],['fractional fee',{rate:1.5},'invalid'],['fee >100',{rate:101},'invalid'],['missing numeric',{sold:null},'invalid'],['empty numeric',{sold:''},'invalid'],['huge price',{price:1e11},'invalid']
])test(description,()=>assert.equal(item(input).status,expected));
test('money and fee per item floor',()=>{let a=item({sold:3,rate:13,price:101,received:3,returned:0,onHand:0});assert.equal(a.gross,303);assert.equal(a.fee,39);assert.equal(a.share,264)});
test('negative rate invalid',()=>assert.equal(item({rate:-1}).valid,false));
test('inferred sales from remaining physical counts',()=>assert.equal(M.inferredSold({...ok,sold:0}),3));
test('impossible inference returns null',()=>assert.equal(M.inferredSold({...ok,received:2,returned:4}),null));
test('per consignor sums and hold are independent',()=>{
 const a=M.analyze([ok,{...ok,id:'b',title:'第二冊',received:2,sold:2,returned:0,onHand:0},{...ok,id:'c',consignor:'別作家',received:4,sold:1,returned:1,onHand:0}]);
 assert.equal(a.consignors.length,2);assert.equal(a.totals.problems,1);assert.equal(a.totals.ready,1);assert.equal(a.totals.held,1);
 assert.equal(a.totals.gross,6*850);assert.equal(a.totals.fee,6*170);assert.equal(a.totals.share,4080);
});
test('CSV escapes spreadsheet cell delimiters',()=>{let a=M.makeCsv(M.analyze([{...ok,title:'X,"hello"\nrow'}]));assert.match(a,/"X,""hello""\nrow"/);assert.ok(a.startsWith('\uFEFF'));});
test('consignor statement distinguishes held',()=>{let s=M.makeStatementsCsv(M.analyze([ok,{...ok,consignor:'別',onHand:0}]));assert.match(s,/照合済/);assert.match(s,/要照合/)});
test('valid import returns clean objects',()=>{let x=M.validateImport({format:'tanajimai-v1',title:'店舗A',items:[ok]});assert.equal(x.items[0].sku,'Z-1');assert.equal(x.title,'店舗A');});
test('import disallows missing data',()=>assert.throws(()=>M.validateImport({format:'tanajimai-v1',items:[{...ok,sold:null}]})));
test('import disallows more than 120',()=>assert.throws(()=>M.validateImport({format:'tanajimai-v1',items:Array.from({length:121},()=>ok)})));
test('import disallows wrong format',()=>assert.throws(()=>M.validateImport({format:'bad',items:[]})));
test('no dangerous property copied into imported item',()=>{let x=M.validateImport({format:'tanajimai-v1',items:[{...ok,constructor:'bogus',html:'<script>alert(1)</script>'}]});assert.equal(x.items[0].html,undefined)});
test('randomized accounting conservation: 1000 generated feasible ledgers',()=>{
 let seed=4073;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
 for(let k=0;k<1000;k++){
  const received=rnd()%1000, sold=rnd()%(received+1),returned=rnd()%(received-sold+1),damaged=rnd()%(received-sold-returned+1),onHand=received-sold-returned-damaged;
  const r=item({received,sold,returned,damaged,onHand,price:rnd()%100000,rate:rnd()%101});
  assert.equal(r.status,'ok',`trial ${k}`);assert.equal(r.gross,r.price*r.sold);assert.equal(r.fee+r.share,r.gross);
  const moved=item({...r,onHand:onHand+1});assert.equal(moved.status,'overage');assert.equal(moved.diff,-1);
 }
});
