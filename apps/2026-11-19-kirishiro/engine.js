/* KIRISHIRO — offline linear cut planner. No dependencies. */
(function(root, factory) {
  const api=factory();
  if(typeof module==='object' && module.exports)module.exports=api;
  root.KIRISHIRO=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const MAX_PIECES=80;
function number(v, name, min, max, integer=true){
  const n=typeof v==='string' && v.trim()===''?NaN:Number(v);
  if(!Number.isFinite(n) || n<min || n>max || (integer && !Number.isInteger(n)))throw Error(`${name}は${min}〜${max}${integer?'の整数':''}で入力してください`);
  return n;
}
function safeName(v, name){const str=String(v??'').trim();if(!str||str.length>60)throw Error(`${name}を1〜60文字で入力してください`);return str;}
function normalize(data){
  if(!data || !Array.isArray(data.parts) || !Array.isArray(data.stocks))throw Error('部材・材料一覧が見つかりません');
  const q=data.settings||{};
  const settings={kerf:number(q.kerf,'刃幅',0,20),trim:number(q.trim,'端部余裕',0,50),fee:number(q.fee,'店舗カット料金',0,1000),offcutMin:number(q.offcutMin,'保存する端材の長さ',0,6000),carry:number(q.carry,'持ち帰り可能な長さ',0,6000)};
  if(data.parts.length>40||data.stocks.length>20)throw Error('行数の上限（部材40・材料20）を超えました');
  const ids=new Set();
  const parts=data.parts.map((p,i)=>{
    const id=String(p.id??`p${i}`);if(ids.has(`p${id}`))throw Error('部材IDが重複しています');ids.add(`p${id}`);
    return {id,name:safeName(p.name,'部材名'),length:number(p.length,'部材の長さ',1,6000),qty:number(p.qty,'部材数',1,40)};
  });
  const needed=parts.reduce((sum,p)=>sum+p.qty,0);
  if(!needed || needed>MAX_PIECES)throw Error(`必要部材数は1〜${MAX_PIECES}個にしてください`);
  const stocks=data.stocks.map((s,i)=>{
    const id=String(s.id??`s${i}`);if(ids.has(`s${id}`))throw Error('材料IDが重複しています');ids.add(`s${id}`);
    if(!['new','offcut'].includes(s.kind))throw Error('材料種別を確認してください');
    return {id,name:safeName(s.name,'材料名'),kind:s.kind,length:number(s.length,'材料の長さ',1,6000),qty:number(s.qty,'在庫本数',0,40),price:s.kind==='new'?number(s.price,'単価',0,100000):0};
  });
  if(!stocks.some(s=>s.qty>0))throw Error('利用可能な材料がありません');
  return {settings,parts,stocks};
}
function expand(parts){let uid=0;return parts.flatMap(p=>Array.from({length:p.qty},()=>({uid:++uid,name:p.name,length:p.length,id:p.id})));}
/* 0/1 subset-sum. Each demanded part reserves kerf; one final kerf may be
   omitted ONLY on an exact flush fit. Intermediate gaps smaller than kerf
   are never treated as a valid cut. */
function subset(items, usable, kerf){
  const cap=usable+kerf, dp=new Array(cap+1);dp[0]={prev:null,index:-1};
  for(let i=0;i<items.length;i++){
    const w=items[i].length+kerf;
    for(let sum=cap;sum>=w;sum--)if(!dp[sum]&&dp[sum-w])dp[sum]={prev:dp[sum-w],index:i};
  }
  let best=-1;
  for(let sum=cap;sum>=0;sum--){
    if(dp[sum] && (sum<=usable || sum===usable+kerf)){best=sum;break;}
  }
  if(best<=0)return [];
  const selected=[];let cursor=dp[best];
  while(cursor && cursor.index>=0){selected.push(items[cursor.index]);cursor=cursor.prev;}
  return selected.sort((a,b)=>b.length-a.length||a.uid-b.uid);
}
function layout(stock,items,settings){
  let pos=settings.trim,cuts=0,segments=[];
  for(let i=0;i<items.length;i++){
    const part=items[i],remaining=stock.length-settings.trim-pos;
    if(part.length>remaining)throw Error('内部エラー: 部材が材料に入りません');
    const last=i===items.length-1;
    const needsCut=!(last && remaining===part.length);
    const kerf=needsCut?settings.kerf:0;
    if(part.length+kerf>remaining)throw Error('内部エラー: 切りしろが不足しています');
    segments.push({name:part.name,length:part.length,start:pos,end:pos+part.length,uid:part.uid,kerf,needsCut});
    pos+=part.length+kerf;if(needsCut)cuts++;
  }
  const remainder=stock.length-settings.trim-pos;
  if(remainder<0)throw Error('内部エラー: 残りが負数です');
  return {sourceId:stock.id,kind:stock.kind,sourceName:stock.name,sourceLength:stock.length,price:stock.price,parts:segments,remainder,cuts,usedLength:items.reduce((sum,p)=>sum+p.length,0),kerfUsed:cuts*settings.kerf,trimUsed:settings.trim*2};
}
function plan(input){
  const data=normalize(input);const {settings,stocks}=data;
  let waiting=expand(data.parts).sort((a,b)=>b.length-a.length||a.uid-b.uid);
  const used=stocks.map(s=>({...s,used:0}));const boards=[];
  // Reuse available scraps before purchasing. Do not mutate inventory while merely planning.
  for(let step=0;waiting.length && step<MAX_PIECES;step++){
    const candidates=[];
    for(const stock of used){
      if(stock.used>=stock.qty)continue;
      if(stock.kind==='new'&&settings.carry>0&&stock.length>settings.carry)continue;
      const usable=stock.length-2*settings.trim;if(usable<=0)continue;
      const chosen=subset(waiting,usable,settings.kerf);
      if(!chosen.length)continue;
      const sum=chosen.reduce((a,p)=>a+p.length,0);
      const potential=layout(stock,chosen,settings);
      const effectiveCost=stock.kind==='offcut'?0:stock.price+potential.cuts*settings.fee;
      const fraction=sum/stock.length;
      candidates.push({stock,chosen,sum,fraction,effectiveCost,potential});
    }
    if(!candidates.length)break;
    // Prefer using available offcuts. New stock is chosen by cost per usable mm,
    // followed by fuller patterns and then by smaller stock length.
    candidates.sort((a,b)=>{
      if(a.stock.kind!==b.stock.kind)return a.stock.kind==='offcut'?-1:1;
      if(a.stock.kind==='offcut')return b.fraction-a.fraction||a.stock.length-b.stock.length;
      const ax=a.effectiveCost/a.sum, bx=b.effectiveCost/b.sum;
      return ax-bx || b.sum-a.sum || a.stock.length-b.stock.length;
    });
    const best=candidates[0];best.stock.used++;
    boards.push(best.potential);
    const chosenUids=new Set(best.chosen.map(p=>p.uid));waiting=waiting.filter(p=>!chosenUids.has(p.uid));
  }
  const newBoards=boards.filter(b=>b.kind==='new'),offcutBoards=boards.filter(b=>b.kind==='offcut');
  const stockCost=newBoards.reduce((sum,b)=>sum+b.price,0);
  const storeCuts=newBoards.reduce((sum,b)=>sum+b.cuts,0);
  const feeCost=storeCuts*settings.fee;
  const kept=boards.filter(b=>b.remainder>=settings.offcutMin && b.remainder>0).reduce((s,b)=>s+b.remainder,0);
  const waste=boards.reduce((s,b)=>s+b.trimUsed+b.kerfUsed+(b.remainder>=settings.offcutMin?0:b.remainder),0);
  const usedMaterial=boards.reduce((s,b)=>s+b.sourceLength,0),pieceLength=boards.reduce((s,b)=>s+b.usedLength,0);
  if(usedMaterial!==pieceLength+kept+waste)throw Error('内部エラー: 長さの収支が合いません');
  const purchase=[];
  for(const stock of used.filter(s=>s.kind==='new'&&s.used))purchase.push({name:stock.name,length:stock.length,qty:stock.used,unit:stock.price,total:stock.price*stock.used});
  return {boards,unplaced:waiting,totals:{stockCost,storeCuts,feeCost,grandTotal:stockCost+feeCost,kept,waste,usedMaterial,pieceLength,boardCount:boards.length,newCount:newBoards.length,offcutCount:offcutBoards.length},purchase,settings};
}
function applyInventory(input,result){
  const data=normalize(input);if(result.unplaced.length)throw Error('未配置の部材があるため、在庫は更新できません');
  const clone=JSON.parse(JSON.stringify(input));
  for(const b of result.boards){
    if(b.kind==='offcut'){
      const s=clone.stocks.find(s=>String(s.id)===b.sourceId);
      if(!s || s.qty<1)throw Error('端材在庫が変更されました。再計算してください');
      s.qty--;
    }
  }
  clone.stocks=clone.stocks.filter(s=>s.qty>0);
  for(const b of result.boards){
    if(b.remainder>0 && b.remainder>=result.settings.offcutMin){
      const match=clone.stocks.find(s=>s.kind==='offcut'&&s.length===b.remainder);
      if(match)match.qty++;
      else clone.stocks.push({id:`ret-${Date.now()}-${clone.stocks.length}`,name:`再利用 ${b.remainder}mm`,kind:'offcut',length:b.remainder,qty:1,price:0});
    }
  }
  return clone;
}
function sample(){return {settings:{kerf:3,trim:5,fee:50,offcutMin:180,carry:2450},stocks:[
 {id:'s1',kind:'new',name:'SPF 2×4・6ft',length:1820,price:640,qty:12},
 {id:'s2',kind:'new',name:'SPF 2×4・8ft',length:2440,price:920,qty:12},
 {id:'s3',kind:'offcut',name:'倉庫の端材 A',length:985,price:0,qty:1},
 {id:'s4',kind:'offcut',name:'倉庫の端材 B',length:640,price:0,qty:1}
 ],parts:[
 {id:'p1',name:'棚の柱',length:810,qty:4},
 {id:'p2',name:'棚板の桟',length:560,qty:4},
 {id:'p3',name:'補強材',length:350,qty:4}
 ]};}
return {normalize,expand,subset,layout,plan,applyInventory,sample,MAX_PIECES};
});
