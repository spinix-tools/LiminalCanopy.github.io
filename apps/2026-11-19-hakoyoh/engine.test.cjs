const test=require('node:test'),assert=require('node:assert/strict'),E=require('./engine.js');
const I=(w,d,h,qty=1,up=false)=>({id:'x',name:'商品',w,d,h,qty,g:120,upright:up});
const B=(w,d,h)=>({id:'b',name:'箱',w,d,h,ow:w+1,od:d+1,oh:h+1,maxG:5000,postage:700,material:40,tare:110});
const P=(items,boxes,padding=0,reserve=50)=>({items,boxes,padding,reserve});
test('寸法・行数・整数などの不正入力を拒否',()=>{
 const good=P([I(10,5,4)],[B(25,25,25)]);assert.equal(E.validateProject(good).items.length,1);
 for(const mutate of [p=>p.padding=-1,p=>p.padding=6,p=>p.reserve=20001,p=>p.items[0].qty=1.1,p=>p.items[0].qty=0,p=>p.items[0].w=0,p=>p.items[0].g=-1,p=>p.items[0].name='',p=>p.boxes[0].ow=1,p=>p.boxes[0].maxG=0,p=>p.boxes[0].postage=-1,p=>p.items=Array.from({length:61},()=>I(1,1,1))]){
  const copy=structuredClone(good);mutate(copy);assert.throws(()=>E.validateProject(copy));
 }
 assert.throws(()=>E.validateProject({}));assert.throws(()=>E.validateProject(P([I(2,2,2,20),I(2,2,2,20),I(2,2,2,21)],[B(30,30,30)])));
});
test('90度回転6種類と上下固定2種類',()=>{
 assert.equal(E.rotations(I(2,3,4),0).length,6);
 assert.equal(E.rotations(I(2,3,4,1,true),0).length,2);
 assert.equal(E.rotations(I(2,2,2),0).length,1);
 assert.ok(E.rotations(I(2,3,4),.5).some(x=>x.join(',')==='3,4,5'));
});
test('3D重複判定は接触を許し、内部重複を拒否',()=>{
 const p={x:0,y:0,z:0,w:5,d:5,h:5};assert.equal(E.intersects(p,{...p,x:5}),false);assert.equal(E.intersects(p,{...p,x:4}),true);
 assert.equal(E.intersects(p,{...p,y:5}),false);assert.equal(E.intersects(p,{...p,z:5}),false);
 assert.equal(E.placementValid({...p,x:5},[p],B(10,10,10)),true);
 assert.equal(E.placementValid({...p,x:5.01},[],B(10,10,10)),false);
});
test('充填できると確認された配置は必ず内部に収まる',()=>{
 const r=E.pack([I(10,5,5,3) ],B(20,15,10),0);assert.equal(r.fits,true);assert.equal(r.placed.length,3);
 for(let j=0;j<r.placed.length;j++){
  let p=r.placed[j];assert.equal(E.placementValid(p,r.placed.filter((_,i)=>i!==j),B(20,15,10)),true);
 }
});
test('余白によって収まらなくなる',()=>{
 assert.equal(E.pack([I(10,10,10) ],B(10,10,10),0).fits,true);
 assert.equal(E.pack([I(10,10,10) ],B(10,10,10),.1).fits,false);
});
test('立てたままは高さ方向の回転を防ぐ',()=>{
 assert.equal(E.pack([I(8,3,2,1,true)],B(8,8,2),0).fits,true);
 assert.equal(E.pack([I(8,3,2,1,true)],B(8,8,1),0).fits,false);
 assert.equal(E.pack([I(8,3,2,1,false)],B(8,8,1),0).fits,false);
});
test('重さは箱・予備分を含む; 入る箱を優先し金額順',()=>{
 const a=P([I(10,10,10)], [B(11,11,11),B(20,20,20)]);a.boxes[0].postage=800;a.boxes[1].postage=300;
 const ret=E.inspect(a);assert.equal(ret.recommendation.name,'箱');assert.equal(ret.recommendation.cost,340);assert.equal(ret.results[0].w,20);
 a.boxes[1].maxG=100;const ret2=E.inspect(a);assert.equal(ret2.results[0].w,11);assert.equal(ret2.results.find(x=>x.w===20).valid,false);
});
test('送料サイズは外寸合計と重量両方で判定',()=>{
 assert.equal(E.tierFor(60,2000).name,'60');assert.equal(E.tierFor(60,2001).name,'80');assert.equal(E.tierFor(61,2000).name,'80');
 assert.equal(E.tierFor(200,30000).name,'200');assert.equal(E.tierFor(200.1,1000),null);assert.equal(E.tierFor(150,30001),null);
});
test('商品ごとの重量総計・選択可能候補',()=>{
 const ret=E.inspect(P([I(3,3,3,2)],[B(10,10,10)]));assert.equal(ret.count,2);assert.equal(ret.grossProduct,240);
 assert.equal(ret.results[0].weight,400);assert.equal(ret.results[0].tier,'60');
});
test('配置表CSVはカンマや引用符に対応、Excel用BOM付き',()=>{
 const r=E.inspect(P([{...I(3,3,3),name:'箱,"注意"'}],[B(10,10,10)])).recommendation;
 assert.ok(E.makeCSV(r).startsWith('\ufeff'));assert.ok(E.makeCSV(r).includes('"箱,""注意"""'));
});
test('SVGは利用者の入力をエスケープし配置個数を反映',()=>{
 const r=E.inspect(P([{...I(3,3,3),name:'<script>alert(1)</script>'}],[B(10,10,10)])).recommendation;
 const svg=E.layoutSvg(r,r.packed.placed,1);
 assert.ok(svg.includes('&lt;script&gt;'));assert.ok(!svg.includes('<script>'));assert.ok(svg.includes('1/1'));
});
test('ランダム生成のpack結果ははみ出さず重複しない（300例）',()=>{
 let seed=78355;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 for(let n=0;n<300;n++){
  const box=B(8+Math.ceil(rand()*20),8+Math.ceil(rand()*18),6+Math.ceil(rand()*16));
  const arr=Array.from({length:2+Math.floor(rand()*5)},()=>I(1+Math.floor(rand()*10),1+Math.floor(rand()*8),1+Math.floor(rand()*6),1+Math.floor(rand()*3),rand()>.7));
  const padding=rand()>.5?.5:0,res=E.pack(arr,box,padding);
  for(let j=0;j<res.placed.length;j++)assert.ok(E.placementValid(res.placed[j],res.placed.filter((_,k)=>k!==j),box),`case ${n},item ${j}`);
  assert.equal(res.placed.length+res.unplaced.length,arr.reduce((s,it)=>s+it.qty,0));
 }
});