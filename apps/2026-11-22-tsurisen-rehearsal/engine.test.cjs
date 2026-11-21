const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('./engine.js');
const empty=()=>E.DENOMS.map(()=>0);
const stock=(o)=>E.DENOMS.map(d=>o[d]||0);

test('日本円9金種は降順で重複しない',()=>{
  assert.deepEqual(E.DENOMS,[10000,5000,1000,500,100,50,10,5,1]);
});
test('金種と枚数の総額を計算',()=>assert.equal(E.money(stock({10000:1,500:3,5:2})),11510));
test('入力値の小数・負値・Infinityは拒否',()=>{
  for(const v of [-1,1.2,Infinity,'NaN'])assert.throws(()=>E.asInt(v,0,100));
});
test('金種配列の形式検査',()=>{
  assert.throws(()=>E.counts([1,2]));
  assert.throws(()=>E.counts(['abc',...Array(8).fill(0)]));
});
test('ぴったりは現金の最少枚数を受け取る',()=>{
  assert.deepEqual(E.exactTender(1651),stock({1000:1,500:1,100:1,50:1,1:1}));
});
test('支払紙幣が価格を下回るとエラー',()=>assert.throws(()=>E.tenderFor({price:1500,tender:1000})));
test('支払の紙幣が9金種以外のとき拒否',()=>assert.throws(()=>E.tenderFor({price:200,tender:200})));
test('釣銭ゼロは在庫ゼロでも返せる',()=>assert.deepEqual(E.findChange(0,empty()),empty()));
test('足りない時は釣銭を返せない',()=>assert.equal(E.findChange(400,stock({100:2})),null));
test('通常の釣銭は最少枚数',()=>assert.deepEqual(E.findChange(650,stock({500:2,100:10,50:2})),stock({500:1,100:1,50:1})));
test('強制的に迂回する例: 500円がなくても100円×6で600円',()=>assert.deepEqual(E.findChange(600,stock({100:6})),stock({100:6})));
test('500円在庫があっても使えない時は下位金種で代替',()=>assert.deepEqual(E.findChange(300,stock({500:1,100:1,50:4})),stock({100:1,50:4})));
test('釣銭は在庫を超えず金額完全一致',()=>{
  const rng=E.random(42);
  for(let t=0;t<300;t++){
    const c=E.DENOMS.map(()=>Math.floor(rng()*5));
    const amount=Math.floor(rng()*2200);
    const ans=E.findChange(amount,c);
    if(ans){assert.equal(E.money(ans),amount);for(let i=0;i<9;i++)assert.ok(ans[i]>=0&&ans[i]<=c[i]);}
  }
});
test('bounded DP exactness matches reference unbounded-int brute for low counts',()=>{
  const rng=E.random(225);
  function brute(i,sum,counts,amount){
    if(sum===amount)return 0;
    if(i>=counts.length || sum>amount)return Infinity;
    let best=Infinity;
    for(let k=0;k<=counts[i] && sum+k*E.DENOMS[i]<=amount;k++)best=Math.min(best,k+brute(i+1,sum+k*E.DENOMS[i],counts,amount));
    return best;
  }
  for(let t=0;t<150;t++){
    const c=E.DENOMS.map((_,i)=>i<5?0:Math.floor(rng()*4));
    const amount=Math.floor(rng()*200);
    const got=E.findChange(amount,c);const ideal=brute(0,0,c,amount);
    assert.equal(got?got.reduce((a,b)=>a+b,0):Infinity,ideal);
  }
});
test('取引順: 受け取った現金を次の取引で利用',()=>{
  const r=E.runQueue(stock({100:1}),[{name:'a',price:100,tender:1000},{name:'b',price:900,tender:1000}]);
  assert.equal(r.failAt,0); // first sale impossible: ¥900 change from a lone ¥100, ¥1000 cannot break itself
});
test('連続取引の売上と手元の現金の保存則',()=>{
  const initial=stock({1000:2,500:3,100:10});
  const rows=[{name:'小物',price:600,tender:1000},{name:'飲み物',price:300,tender:500},{name:'追加',price:1000,tender:'exact'}];
  const r=E.runQueue(initial,rows);
  assert.equal(r.complete,true);assert.equal(r.sales,1900);assert.equal(r.closing,r.opening+1900);
  assert.equal(E.money(r.final),r.closing);
});
test('釣銭がないと売上は計上せず元の在庫を残す',()=>{
  const c=stock({500:1});const r=E.runQueue(c,[{name:'商品',price:600,tender:1000}]);
  assert.equal(r.complete,false);assert.equal(r.failAt,0);assert.equal(r.sales,0);assert.deepEqual(r.final,c);
});
test('ある会計で停止したら後続を実行しない',()=>{
  const c=empty();const r=E.runQueue(c,[{name:'a',price:200,tender:1000},{name:'b',price:200,tender:'exact'}]);
  assert.equal(r.events.length,1);assert.equal(r.processed,0);
});
test('受け取った紙幣も釣銭候補に含まれる',()=>{
  const c=stock({500:1});const r=E.runQueue(c,[{price:500,tender:1000}]);
  assert.equal(r.complete,true);assert.equal(r.final[E.DENOMS.indexOf(1000)],1);assert.equal(r.final[E.DENOMS.indexOf(500)],0);
});
test('停止時に単一金種で補給できるヒント',()=>{
  const r=E.runQueue(stock({500:0}),[{price:600,tender:1000}]);const tip=E.rescue(r.events[0]);
  assert.ok(tip);assert.equal(tip.additions[E.DENOMS.indexOf(100)],4);assert.equal(tip.count,4);
});
test('成功時には補給ヒントを出さない',()=>assert.equal(E.rescue({ok:true}),null));
test('再現可能な疑似乱数列',()=>{
  const a=E.random(4),b=E.random(4);
  assert.deepEqual(Array.from({length:40},a),Array.from({length:40},b));
});
test('値段を超える紙幣のみが選ばれる',()=>{
  const q=E.createQueue([1200,4200,8500],150,[0,99,1,0],E.random(7));
  for(const r of q)assert.ok(r.tender==='exact'||r.tender>=r.price);
});
test('客列テストは同じシードで一致',()=>{
  const s={menu:[350,450,800],customers:20,trials:22,seed:2026,weights:[30,40,20,10]};
  assert.deepEqual(E.stress(E.SAMPLE_FLOAT,s),E.stress(E.SAMPLE_FLOAT,s));
});
test('多人数テストの集計保存則',()=>{
  const s={menu:[350,450,800],customers:18,trials:30,seed:20261122,weights:[30,45,15,10]};
  const r=E.stress(E.SAMPLE_FLOAT,s);
  assert.equal(r.successes+r.failures,r.trials);
  assert.ok(r.passRate>=0&&r.passRate<=1);
  assert.ok(r.averageProcessed>=0&&r.averageProcessed<=18);
});
test('比率0は除外できる',()=>{
  const q=E.createQueue([120],80,[100,0,0,0],E.random(22));
  assert.ok(q.every(r=>r.tender==='exact'));
});
test('比率がすべて0の場合は拒否',()=>assert.throws(()=>E.validateStress({menu:[100],customers:2,trials:2,seed:1,weights:[0,0,0,0]})));
test('上限を超える試行数を拒否',()=>assert.throws(()=>E.validateStress({menu:[100],customers:2,trials:9999,seed:1,weights:[1,1,1,1]})));
test('CSVはBOMと改行と二重引用符を正しく出す',()=>{
 const data=E.toCSV([['メモ','"あ"'],['通常',1000]]);
 assert.ok(data.startsWith('\uFEFF'));assert.ok(data.includes('""あ""'));assert.ok(data.includes('\r\n'));
});
test('CSVの式注入を回避する',()=>{
 const data=E.toCSV([['=2+2','+SUM(A1:A2)','@foo','-cmd',-500]]);
 assert.ok(data.includes("'=2+2"));assert.ok(data.includes("'+SUM"));assert.ok(data.includes("'@foo"));assert.ok(data.includes("'-cmd"));assert.ok(data.includes('"-500"'));
});
test('400ケースで現金の保存則・非負在庫',()=>{
  const rand=E.random(1905);
  for(let t=0;t<400;t++){
    const c=E.DENOMS.map((_,i)=>i<2?0:Math.floor(rand()*8));
    const q=E.createQueue([100,250,350,400,600,950],1+Math.floor(rand()*20),[20,55,20,5],rand);
    const r=E.runQueue(c,q);
    assert.equal(E.money(r.final),E.money(c)+r.sales);
    assert.ok(r.final.every(x=>Number.isInteger(x)&&x>=0));
    for(const e of r.events.filter(x=>x.ok)){
      assert.equal(E.money(e.before)+e.price,E.money(e.after));
      assert.equal(E.money(e.out),e.change);
    }
  }
});
