const {test}=require('node:test');const assert=require('node:assert/strict');const E=require('./engine.js');
function base(part=800,stock=1000,extra={}){return {settings:{kerf:3,trim:0,fee:50,offcutMin:100,carry:2500,...(extra.settings||{})},parts:[{id:'p',name:'脚',length:part,qty:1,...(extra.part||{})}],stocks:[{id:'s',name:'定尺',kind:'new',length:stock,qty:3,price:200,...(extra.stock||{})}]};}
function throwsWith(change,regex){const d=base();change(d);assert.throws(()=>E.plan(d),regex);}
test('sample is ready and lengths conserve',()=>{const r=E.plan(E.sample());assert.equal(r.unplaced.length,0);assert.equal(r.totals.usedMaterial,r.totals.pieceLength+r.totals.kept+r.totals.waste);assert.equal(r.totals.grandTotal,r.totals.stockCost+r.totals.feeCost);});
test('no mutation of input',()=>{const d=E.sample(),before=JSON.stringify(d);E.plan(d);assert.equal(JSON.stringify(d),before);});
test('single exact fit uses no saw cut',()=>{const r=E.plan(base(1000,1000));assert.equal(r.boards[0].cuts,0);assert.equal(r.boards[0].remainder,0);assert.equal(r.totals.grandTotal,200);});
test('non-exact fit reserves kerf',()=>{const r=E.plan(base(800,804));assert.equal(r.boards[0].cuts,1);assert.equal(r.boards[0].remainder,1);assert.equal(r.totals.feeCost,50);});
test('gap smaller than kerf invalid',()=>{const r=E.plan(base(800,802));assert.equal(r.unplaced.length,1);});
test('zero kerf still needs physical cut',()=>{const r=E.plan(base(800,1000,{settings:{kerf:0}}));assert.equal(r.boards[0].cuts,1);assert.equal(r.totals.storeCuts,1);});
test('zero kerf exact fit is no cut',()=>{const r=E.plan(base(1000,1000,{settings:{kerf:0}}));assert.equal(r.totals.storeCuts,0);});
test('two exact-fill pieces require one cut and one kerf',()=>{const r=E.plan(base(500,1003,{part:{qty:2}}));assert.equal(r.boards[0].parts.length,2);assert.equal(r.boards[0].cuts,1);assert.equal(r.boards[0].remainder,0);});
test('two parts leaving one mm uncut unusable',()=>{const r=E.plan(base(500,1004,{part:{qty:2}}));assert.equal(r.boards[0].parts.length,1);});
test('trim allowances respected',()=>{const r=E.plan(base(990,1000,{settings:{trim:5,kerf:0}}));assert.equal(r.boards[0].parts.length,1);assert.equal(r.boards[0].trimUsed,10);});
test('trim may make fit impossible',()=>{const r=E.plan(base(995,1000,{settings:{trim:5}}));assert.equal(r.unplaced.length,1);});
test('carry limit filters new stock',()=>{const r=E.plan(base(2000,2440,{settings:{carry:1820}}));assert.equal(r.unplaced.length,1);});
test('zero carry means no limit',()=>{const r=E.plan(base(2000,2440,{settings:{carry:0}}));assert.equal(r.unplaced.length,0);});
test('offcut can be used over carry limit',()=>{const r=E.plan(base(2000,2440,{settings:{carry:1500},stock:{kind:'offcut',price:0}}));assert.equal(r.unplaced.length,0);});
test('offcut free and no store cuts charged',()=>{const r=E.plan(base(800,1000,{stock:{kind:'offcut',price:0}}));assert.equal(r.totals.grandTotal,0);assert.equal(r.totals.storeCuts,0);});
test('offcut chosen before purchased stock',()=>{const d=base(300,1000);d.stocks.push({id:'o',kind:'offcut',name:'余り',length:400,qty:1,price:0});const r=E.plan(d);assert.equal(r.boards[0].sourceId,'o');assert.equal(r.totals.newCount,0);});
test('no more stock units than quantity',()=>{const r=E.plan(base(700,800,{part:{qty:4},stock:{qty:2}}));assert.equal(r.boards.length,2);assert.equal(r.unplaced.length,2);});
test('conserves unused input part counts',()=>{const r=E.plan(base(700,800,{part:{qty:4},stock:{qty:2}}));assert.equal(r.boards.flatMap(b=>b.parts).length+r.unplaced.length,4);});
test('zero quantity stock allowed if other stock available',()=>{const d=base(700,800);d.stocks[0].qty=0;d.stocks.push({id:'x',kind:'offcut',name:'予備',length:900,qty:1,price:0});assert.equal(E.plan(d).unplaced.length,0);});
test('no available stocks rejected',()=>throwsWith(d=>d.stocks[0].qty=0,/材料/));
test('missing parts rejected',()=>throwsWith(d=>d.parts=[],/必要部材/));
test('negative quantity rejected',()=>throwsWith(d=>d.parts[0].qty=-1,/部材数/));
test('decimal length rejected',()=>throwsWith(d=>d.parts[0].length=99.3,/整数/));
test('blank name rejected',()=>throwsWith(d=>d.parts[0].name=' ',/部材名/));
test('unknown stock kind rejected',()=>throwsWith(d=>d.stocks[0].kind='unknown',/種別/));
test('overlength rejected',()=>throwsWith(d=>d.stocks[0].length=9000,/材料の長さ/));
test('invalid kerf rejected',()=>throwsWith(d=>d.settings.kerf=-1,/刃幅/));
test('invalid carry rejected',()=>throwsWith(d=>d.settings.carry='x',/持ち帰り/));
test('too many parts rejected',()=>throwsWith(d=>d.parts[0].qty=81,/部材数|必要部材/));
test('duplicate ids rejected',()=>throwsWith(d=>d.parts.push({...d.parts[0]}),/重複/));
test('no fallback for oversized parts',()=>{const r=E.plan(base(2000,1000));assert.equal(r.unplaced.length,1);assert.equal(r.boards.length,0);});
test('inventory application spends used offcut',()=>{const d=base(600,1000,{stock:{kind:'offcut',price:0}}),r=E.plan(d),out=E.applyInventory(d,r);assert.equal(d.stocks[0].qty,3);assert.equal(out.stocks.find(x=>x.id==='s').qty,2);assert.equal(out.stocks.reduce((n,s)=>n+(s.kind==='offcut'&&s.length===397?s.qty:0),0),1);});
test('inventory application returns no tiny unusable offcut',()=>{const d=base(800,1000,{settings:{offcutMin:300},stock:{kind:'offcut'}}),r=E.plan(d),out=E.applyInventory(d,r);assert.equal(out.stocks.some(s=>s.length===197),false);});
test('inventory application refuses unplaced parts',()=>{const d=base(700,800,{part:{qty:4},stock:{qty:2}});assert.throws(()=>E.applyInventory(d,E.plan(d)),/未配置/);});
test('offcutMin zero leaves zero waste only if none exists',()=>{const r=E.plan(base(900,1000,{settings:{offcutMin:0}}));assert.equal(r.totals.kept,97);assert.equal(r.totals.waste,3);});
test('fee counted only new boards',()=>{const d=E.sample(),r=E.plan(d);assert.equal(r.totals.feeCost,r.boards.filter(x=>x.kind==='new').reduce((n,b)=>n+b.cuts,0)*d.settings.fee);});
for(let seed=0;seed<150;seed++)test('length and stock invariant case '+seed,()=>{
 let x=seed+137;const rand=()=>{x=(x*1103515245+12345)>>>0;return x/4294967296;};
 const d={settings:{kerf:Math.floor(rand()*7),trim:Math.floor(rand()*8),fee:30,offcutMin:Math.floor(rand()*250),carry:rand()<.2?0:2700},stocks:[],parts:[]};
 for(let i=0;i<3;i++)d.stocks.push({id:'s'+i,name:'Stock'+i,kind:i===2?'offcut':'new',length:600+Math.floor(rand()*1600),qty:1+Math.floor(rand()*3),price:i===2?0:100+Math.floor(rand()*1000)});
 for(let i=0;i<4;i++)d.parts.push({id:'p'+i,name:'Part'+i,length:100+Math.floor(rand()*1700),qty:1+Math.floor(rand()*3)});
 const r=E.plan(d);assert.equal(r.totals.usedMaterial,r.totals.pieceLength+r.totals.kept+r.totals.waste);
 assert.equal(r.boards.reduce((n,b)=>n+b.parts.length,0)+r.unplaced.length,d.parts.reduce((n,p)=>n+p.qty,0));
 for(const s of d.stocks)assert.ok(r.boards.filter(b=>b.sourceId===s.id).length<=s.qty);
 for(const b of r.boards){assert.ok(b.remainder>=0);assert.equal(b.sourceLength,b.usedLength+b.kerfUsed+b.trimUsed+b.remainder);if(b.kind==='new'&&d.settings.carry>0)assert.ok(b.sourceLength<=d.settings.carry);}
});
