const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('./engine.js');
const D = '2026-11-17';
const state = (lots, daily=2) => E.create([{id:'p',name:'リンゴ',unit:'個',daily,cost:100,price:200}],lots.map((l,i)=>({id:'l'+i,productId:'p',label:'batch'+i,qty:l[0],expiry:l[1]})));
test('日付: 加算・うるう年・日付検証',()=>{assert.equal(E.after('2024-02-28',1),'2024-02-29');assert.equal(E.after('2024-02-29',1),'2024-03-01');assert.throws(()=>E.dayNumber('2026-02-29'));assert.throws(()=>E.dayNumber('2026-2-9'));});
test('日販予測はロット期限日まで販売可能',()=>{
  const s=state([[5,D]],2),f=E.forecast(s,{start:D,days:1});
  assert.equal(f.summary.sold,2);assert.equal(f.summary.waste,3);assert.equal(f.rows[0].stock,0);
});
test('期限より過去のものは最初にロスとなる',()=>{
  const s=state([[4,'2026-11-16'],[3,'2026-11-18']],2),f=E.forecast(s,{start:D,days:1});
  assert.equal(f.summary.waste,4);assert.equal(f.summary.sold,2);assert.equal(f.rows[0].stock,1);
});
test('FEFOは追加順ではなく期限優先',()=>{
  const s=state([[10,'2026-11-22'],[3,'2026-11-18']],4);const lots=s.lots.map(l=>({...l}));
  const res=E.consumeFEFO(lots,'p',4,D);
  assert.deepEqual(res.allocations,[{lotId:'l1',qty:3},{lotId:'l0',qty:1}]);assert.equal(lots[0].qty,9);assert.equal(lots[1].qty,0);
});
test('在庫切れとロスは別々に集計',()=>{
  const s=state([[1,'2026-11-19']],3), f=E.forecast(s,{start:D,days:3});
  assert.equal(f.summary.sold,1);assert.equal(f.summary.shortage,8);assert.equal(f.summary.waste,0);
});
test('販売記録はFEFO減算かつUndoできる',()=>{
  const s=state([[7,'2026-11-21'],[3,'2026-11-18']],3);
  const a=E.transact(s,{productId:'p',qty:5,date:D});
  assert.equal(E.available(a.state,'p',D),5);assert.equal(E.available(s,'p',D),10);assert.equal(a.movement.allocations[0].lotId,'l1');
  assert.deepEqual(E.undoLast(a.state).lots,s.lots);
});
test('在庫を超える販売は原子性を保って拒否',()=>{
  const s=state([[2,'2026-11-19']],3);
  assert.throws(()=>E.transact(s,{productId:'p',qty:3,date:D}),/不足/);assert.equal(s.lots[0].qty,2);
});
test('期限後のロットを売れたことにしない',()=>{
  const s=state([[10,'2026-11-16']],3);assert.throws(()=>E.transact(s,{productId:'p',qty:1,date:D}));
});
test('販促をかけるとロスは増えない',()=>{
  const s=state([[10,'2026-11-18']],2);const c=E.compare(s,{start:D,days:2,uplift:1,window:2});
  assert.equal(c.base.summary.waste,6);assert.equal(c.promo.summary.waste,2);assert.equal(c.savedWaste,4);
});
test('売上差は割引額を反映しないことを明示し、数量ベース計算',()=>{
  const s=state([[8,'2026-11-18']],2);const c=E.compare(s,{start:D,days:2,uplift:1});assert.equal(c.extraRevenue,800);
});
test('週末倍率は土曜日の需要にだけ適用',()=>{
  const s=state([[30,'2026-11-29']],2);const f=E.forecast(s,{start:'2026-11-20',days:3,weekend:2});
  assert.equal(f.rows[0].sold,2);assert.equal(f.rows[1].sold,4);assert.equal(f.rows[2].sold,4);
});
test('初期デモと保存復元の構造',()=>{
  const s=E.defaultState(D);assert.equal(s.products.length,3);assert.equal(s.lots.length,5);
  assert.deepEqual(E.create(...['products','lots','movements'].map(k=>JSON.parse(JSON.stringify(s))[k])),s);
});
test('構造検証: 重複ロット・存在しない商品を拒否',()=>{
  const s=state([[2,D]],2);assert.throws(()=>E.create(s.products,[s.lots[0],s.lots[0]]));
  assert.throws(()=>E.create(s.products,[{...s.lots[0],productId:'other'}]));
});
test('数値と日付の異常値を拒否',()=>{
  assert.throws(()=>E.product({name:'x',daily:1.5,cost:1,price:2}));
  assert.throws(()=>E.lot({productId:'x',qty:-1,expiry:D}));
  assert.throws(()=>E.forecast(state([],0),{start:D,days:500}));
});
test('CSVは引用符をエスケープしBOMを含む',()=>{
  const s=E.toCSV([{a:'x,"y"'}],[['名前','a']]);
  assert.equal(s.charCodeAt(0),65279);assert.match(s,/"x,""y"""/);
});
test('空の商品でも計算可能',()=>{
  const f=E.forecast(E.create(),{start:D,days:1});assert.equal(f.rows.length,1);assert.equal(f.summary.waste,0);
});