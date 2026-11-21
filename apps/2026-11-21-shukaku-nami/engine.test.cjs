const {test}=require('node:test');const assert=require('node:assert/strict');const E=require('./engine.js');
const s=E.sample();
test('初期データは3区画/6作物/5作付け',()=>{assert.equal(s.beds.length,3);assert.equal(s.crops.length,6);assert.equal(s.plantings.length,5);});
test('入力を正規化して値域を制約',()=>{const a=E.normalize({...s,weeks:999,target:-5});assert.equal(a.weeks,52);assert.equal(a.target,.5);});
test('不正JSON形式を拒否',()=>assert.throws(()=>E.normalize(null)));
test('重複した区画IDを拒否',()=>assert.throws(()=>E.normalize({...s,beds:[s.beds[0],s.beds[0]]})));
test('重複した作付けIDを拒否',()=>assert.throws(()=>E.normalize({...s,plantings:[s.plantings[0],s.plantings[0]]})));
test('存在しない作物・区画の作付けは除外',()=>{assert.equal(E.normalize({...s,plantings:[{id:'x',bed:'bad',crop:'r',week:0}]}).plantings.length,0);});
test('日付計算のUTC境界',()=>assert.equal(E.isoDate(E.dateAt('2027-12-28',1)),'2028-01-04'));
test('年またぎ種まき月範囲',()=>{assert.equal(E.inSeason(12,11,2),true);assert.equal(E.inSeason(3,11,2),false);assert.equal(E.inSeason(5,3,9),true);});
test('初期ラディッシュ収穫週',()=>{const a=E.analyze(s);assert.equal(a.supply[3],8);assert.equal(a.supply[0],0);});
test('収穫総量の保存',()=>{const p={...s,plantings:[{id:'x',bed:'a',crop:'r',week:1}]};const a=E.analyze(p);assert.equal(a.counts.totalYield,8);});
test('計画期間外は収穫に含めない',()=>{const p={...s,weeks:8,plantings:[{id:'x',bed:'a',crop:'n',week:7}]};assert.equal(E.analyze(p).counts.totalYield,0);});
test('重なり警告',()=>{const p={...s,plantings:[{id:'x',bed:'a',crop:'r',week:0},{id:'y',bed:'a',crop:'r',week:1}]};assert.equal(E.analyze(p).counts.overlapWeeks,3);});
test('科の連作警告',()=>{const p={...s,plantings:[{id:'x',bed:'a',crop:'r',week:0},{id:'y',bed:'a',crop:'k',week:5}]};assert(E.analyze(p).issues.some(x=>x.kind==='rotation'));});
test('種まき月の警告',()=>{const p={...s,plantings:[{id:'x',bed:'a',crop:'b',week:0}]};assert(E.analyze(p).issues.some(x=>x.kind==='season'));});
test('区画占有の境界に接する場合は許可',()=>{const p={...s,plantings:[{id:'x',bed:'a',crop:'r',week:0}]};assert(E.fits(p,'a','l',4));});
test('占有が重なる場合は拒否',()=>{const p={...s,plantings:[{id:'x',bed:'a',crop:'r',week:0}]};assert(!E.fits(p,'a','l',3));});
test('種まき月外は候補にしない',()=>{assert(!E.fits(s,'a','b',0));});
test('期間超過する提案をしない',()=>{assert(!E.fits(s,'c','n',25));});
test('初期サンプルに有効な改善候補',()=>{const p=E.suggest(s);assert(p&&p.gain>0);assert(E.fits(s,p.bed,p.crop,p.week));});
test('全区画を埋めた場合、提案はない',()=>{const p={...s,beds:[{id:'a',name:'A'}],crops:[{id:'z',name:'長期',family:'F',grow:25,harvest:2,yield:2,first:1,last:12}],plantings:[{id:'x',bed:'a',crop:'z',week:0}]};assert.equal(E.suggest(p),null);});
test('CSV BOM、数値、改行とエスケープ',()=>{const csv=E.exportCSV({...s,beds:[{id:'a',name:'A,"B"'}],plantings:[{id:'p1',bed:'a',crop:'r',week:0}]});assert(csv.startsWith('\ufeff'));assert(csv.includes('"A,""B"""'));assert(csv.includes('\r\n'));});
test('無作付けでは全週不足',()=>{const a=E.analyze({...s,plantings:[]});assert.equal(a.counts.shortageWeeks,a.weeks);assert.equal(a.counts.totalYield,0);});
test('週ごとの不足+収穫は目標以上（目標を超える週は余剰）',()=>{const a=E.analyze(s);for(let i=0;i<a.weeks;i++)assert(Math.abs(a.supply[i]+a.shortage[i]-a.surplus[i]-a.target)<1e-8);});
test('任意計画のコピーを一意に正規化',()=>{const a=E.normalize(s);assert.notEqual(a,s);assert.notEqual(a.crops,s.crops);});
test('値が負の収穫量を補正',()=>{const a=E.normalize({...s,crops:[{...s.crops[0],yield:-10}]});assert.equal(a.crops[0].yield,.1);});
// Differential-style deterministic fuzz checks: expected horizon invariants, valid recommendations.
test('ランダム条件500ケースの保存則/提案妥当性',()=>{let seed=741227;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};for(let i=0;i<500;i++){
 const data=E.sample();data.start=`2027-${String(1+Math.floor(rnd()*12)).padStart(2,'0')}-01`;data.weeks=8+Math.floor(rnd()*44);data.target=1+rnd()*25;
 data.plantings=Array.from({length:Math.floor(rnd()*12)},(_,j)=>({id:'f'+j,bed:data.beds[Math.floor(rnd()*data.beds.length)].id,crop:data.crops[Math.floor(rnd()*data.crops.length)].id,week:Math.floor(rnd()*data.weeks)}));
 const a=E.analyze(data);assert.equal(a.supply.length,data.weeks);assert(a.supply.every(x=>Number.isFinite(x)&&x>=0));assert(Math.abs(a.supply.reduce((u,v)=>u+v,0)-a.counts.totalYield)<1e-5);const p=E.suggest(data);if(p){assert(E.fits(a,p.bed,p.crop,p.week));assert(p.gain>0);}
 }});
