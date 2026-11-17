const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('./engine.js');
function fixture(){return E.demoProject();}
function reject(mutator,match){const p=fixture();mutator(p);assert.throws(()=>E.validateProject(p),match);}
test('デモ計算は有効で費用が下がる',()=>{const r=E.calculate(fixture());assert.equal(E.verifyPlan(r.project,r.best).ok,true);assert.ok(r.best.purchaseCost<r.baseline.purchaseCost);assert.equal(r.savings,r.baseline.purchaseCost-r.best.purchaseCost);});
test('端材は実在本数以上使わない',()=>{const r=E.calculate(fixture());assert.ok(r.best.usedOffcuts<=3);});
test('刃幅・端落としは全母材に加算',()=>{const r=E.calculate(fixture());for(const b of r.best.bins){assert.equal(b.length,b.remaining+2*r.project.trim+b.parts.reduce((a,p)=>a+p.length+r.project.kerf,0));}});
test('部品がすべて一度だけ割り付く',()=>{const r=E.calculate(fixture());assert.equal(r.best.bins.flatMap(b=>b.parts).length,12);});
test('購入費は各購入母材の合計',()=>{const r=E.calculate(fixture());assert.equal(r.best.purchaseCost,r.best.bins.filter(b=>b.kind==='buy').reduce((a,b)=>a+b.price,0));});
test('不可逆なエラーは記録',()=>{const r=E.calculate(fixture());const clone=structuredClone(r.best);clone.bins[0].remaining++;assert.equal(E.verifyPlan(r.project,clone).ok,false);});
test('部品数量が変わると検査が失敗',()=>{const r=E.calculate(fixture());const p=structuredClone(r.project);p.parts[0].qty++;assert.equal(E.verifyPlan(p,r.best).ok,false);});
test('手持ちのみで成立',()=>{const p={title:'x',kerf:2,trim:0,keepMin:50,parts:[{name:'a',length:100,qty:2}],offcuts:[{name:'o',length:250,qty:1}],purchases:[]};const r=E.calculate(p);assert.equal(r.best.purchaseCost,0);assert.equal(r.baseline,null);assert.equal(r.best.bins.length,1);assert.equal(E.verifyPlan(r.project,r.best).ok,true);});
test('購入材のみで成立',()=>{const p=fixture();p.offcuts=[];const r=E.calculate(p);assert.equal(r.best.usedOffcuts,0);assert.equal(r.savings,0);});
test('0円購入候補でも計算',()=>{const p=fixture();p.purchases=[{name:'donation',length:10000,price:0}];const r=E.calculate(p);assert.equal(r.best.purchaseCost,0);});
test('端材非使用時も引継ぎを保存',()=>{const p={title:'x',kerf:3,trim:0,keepMin:100,parts:[{name:'big',length:1800,qty:1}],offcuts:[{name:'small',length:500,qty:2}],purchases:[{name:'new',length:2000,price:100}]};const r=E.calculate(p);const c=E.carryForward(r);assert.equal(c.filter(x=>x.name==='small').reduce((s,x)=>s+x.qty,0),2);});
test('切れない長さを明示',()=>reject(p=>p.parts=[{name:'extreme',length:40000,qty:1}],/長さ/));
test('幅込みでぎりぎり切れない',()=>reject(p=>{p.parts=[{name:'tight',length:1000,qty:1}];p.offcuts=[{name:'offcut',length:1000,qty:1}];p.purchases=[];},/切り出せる材料がありません/));
test('刃幅0ならぴったり成立',()=>{const p={title:'x',kerf:0,trim:0,keepMin:0,parts:[{name:'a',length:200,qty:1}],offcuts:[{name:'o',length:200,qty:1}],purchases:[]};assert.equal(E.calculate(p).best.bins[0].remaining,0);});
test('両端落としの判定',()=>{const p={title:'x',kerf:0,trim:5,keepMin:0,parts:[{name:'a',length:190,qty:1}],offcuts:[{name:'o',length:200,qty:1}],purchases:[]};assert.equal(E.calculate(p).best.bins[0].remaining,0);});
test('短い残材は再利用に数えない',()=>{const p={title:'x',kerf:3,trim:0,keepMin:100,parts:[{name:'a',length:120,qty:1}],offcuts:[{name:'o',length:200,qty:1}],purchases:[]};const r=E.calculate(p);assert.equal(r.best.bins[0].retained,0);assert.equal(E.carryForward(r).length,0);});
test('残りが閾値に一致すれば引継ぎ',()=>{const p={title:'x',kerf:3,trim:0,keepMin:77,parts:[{name:'a',length:120,qty:1}],offcuts:[{name:'o',length:200,qty:1}],purchases:[]};const r=E.calculate(p);assert.equal(r.best.bins[0].retained,77);assert.equal(E.carryForward(r)[0].length,77);});
test('CSV BOM と順番ヘッダ',()=>{const csv=E.exportCutCsv(E.calculate(fixture()));assert.ok(csv.startsWith('\ufeff"母材No"'));assert.ok(csv.includes('切断位置mm'));});
test('CSV インジェクション対策',()=>{const p=fixture();p.parts[0].name='=HYPERLINK("http://example")';const csv=E.exportCutCsv(E.calculate(p));assert.ok(csv.includes("'=HYPERLINK"));});
test('端材CSVが名称長さ数量を含む',()=>{const r=E.calculate(fixture());const csv=E.exportOffcutsCsv(r);assert.ok(csv.includes('"品名","長さ","数量"'));});
test('CSVダブルクオート',()=>{assert.deepEqual(E.parseCsv('"a,""b""",120,2\n'),[['a,"b"', '120','2']]);});
test('CSV CRLFとBOM',()=>{assert.deepEqual(E.importPartsCsv('\ufeff品名,長さ,数量\r\n柱,700,2\r\n'),[{name:'柱',length:700,qty:2}]);});
test('ヘッダなしCSV対応',()=>{assert.deepEqual(E.importPartsCsv('柱,700,2'),[{name:'柱',length:700,qty:2}]);});
test('CSV 不正引用符は拒否',()=>assert.throws(()=>E.parseCsv('"oops'),/引用符/));
test('CSV 列不足は拒否',()=>assert.throws(()=>E.importPartsCsv('柱,700'),/必要/));
test('CSV 数字不正を拒否',()=>assert.throws(()=>E.importPartsCsv('柱,abc,2'),/整数/));
test('空 CSV 拒否',()=>assert.throws(()=>E.importPartsCsv(''),/空/));
test('JSON非プロジェクトを拒否',()=>assert.throws(()=>E.validateProject([]),/不正/));
test('部品合計超過を拒否',()=>reject(p=>p.parts[0].qty=220,/合計部品数/));
test('端材合計超過を拒否',()=>reject(p=>p.offcuts[0].qty=160,/合計/));
test('負数や小数の刃幅を拒否',()=>{reject(p=>p.kerf=-1,/範囲/);reject(p=>p.kerf=1.5,/整数/);});
test('購入単価の負値を拒否',()=>reject(p=>p.purchases[0].price=-50,/範囲/));
test('購入材と端材ゼロを拒否',()=>reject(p=>{p.purchases=[];p.offcuts=[]},/1種類/));
test('空の部品を拒否',()=>reject(p=>p.parts=[],/部品/));
test('部品数0を拒否',()=>reject(p=>p.parts[0].qty=0,/範囲/));
test('名称は70文字に制限',()=>{const p=fixture();p.parts[0].name='z'.repeat(100);assert.equal(E.validateProject(p).parts[0].name.length,70)});
test('様々な乱数案件の長さ・個数の不変条件',()=>{
 let seed=9;const rand=()=>{seed=(seed*16807)%2147483647;return seed/2147483647};
 for(let i=0;i<45;i++) {
  const p={title:'fuzz',kerf:Math.floor(rand()*6),trim:Math.floor(rand()*9),keepMin:Math.floor(rand()*200),parts:[],offcuts:[],purchases:[{name:'short',length:1000,price:150},{name:'long',length:1800,price:250}]};
  for(let j=0;j<7;j++)p.parts.push({name:'piece'+j,length:100+Math.floor(rand()*790),qty:1+Math.floor(rand()*3)});
  for(let j=0;j<3;j++)p.offcuts.push({name:'off'+j,length:300+Math.floor(rand()*700),qty:1+Math.floor(rand()*3)});
  const r=E.calculate(p);assert.equal(E.verifyPlan(r.project,r.best).ok,true,'case'+i);assert.ok(r.savings>=0,'case'+i);
 }
});
