/* HAKO KYOKAI — deterministic, offline, conservative packing assistant. MIT */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports) module.exports=api;root.HakoEngine=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const TIERS=[60,80,100,120,140,160,180,200];
 const finite=(n)=>typeof n==='number'&&Number.isFinite(n);
 const positive=(n)=>finite(n)&&n>0;
 const round=n=>Math.round(n*100)/100;
 function validateItem(item){
  if(!item||!String(item.name||'').trim()||![item.l,item.w,item.h].every(n=>positive(Number(n)))||!Number.isInteger(Number(item.qty))||Number(item.qty)<1||Number(item.qty)>30||!finite(Number(item.weight))||Number(item.weight)<0) return false;
  return ['free','upright','fixed'].includes(item.orientation);
 }
 function validateBox(box){return !!box&&String(box.name||'').trim()!==''&&[box.l,box.w,box.h].every(n=>positive(Number(n)))&&finite(Number(box.wall))&&Number(box.wall)>=0&&finite(Number(box.tare))&&Number(box.tare)>=0;}
 function rotations(o,orientation){
  let arr;
  if(orientation==='fixed') arr=[[o.l,o.w,o.h]];
  else if(orientation==='upright') arr=[[o.l,o.w,o.h],[o.w,o.l,o.h]];
  else arr=[[o.l,o.w,o.h],[o.l,o.h,o.w],[o.w,o.l,o.h],[o.w,o.h,o.l],[o.h,o.l,o.w],[o.h,o.w,o.l]];
  const seen=new Set();return arr.filter(a=>{let k=a.join(':');if(seen.has(k))return false;seen.add(k);return true;});
 }
 function sizeBand(box){let outer=[Number(box.l),Number(box.w),Number(box.h)].map(x=>x+2*Number(box.wall));let cm=round(outer.reduce((a,b)=>a+b,0)/10);let tier=TIERS.find(n=>cm<=n)||null;return {outer,cm,tier,label:tier?`${tier}サイズ相当（3辺のみ）`:'200サイズ超（3辺のみ）'};}
 function volume(obj){return Number(obj.l)*Number(obj.w)*Number(obj.h);}
 function clash(a,b){const EPS=1e-7;return a.x<b.x+b.l-EPS&&a.x+a.l>b.x+EPS&&a.y<b.y+b.w-EPS&&a.y+a.w>b.y+EPS&&a.z<b.z+b.h-EPS&&a.z+a.h>b.z+EPS;}
 function supported(candidate,placed){
  if(candidate.z<1e-7) return true;
  let covers=placed.filter(p=>Math.abs(p.z+p.h-candidate.z)<1e-7&&p.x<candidate.x+candidate.l&&p.x+p.l>candidate.x&&p.y<candidate.y+candidate.w&&p.y+p.w>candidate.y);
  if(!covers.length)return false;
  let xs=[candidate.x,candidate.x+candidate.l],ys=[candidate.y,candidate.y+candidate.w];
  for(const p of covers){xs.push(Math.max(candidate.x,p.x),Math.min(candidate.x+candidate.l,p.x+p.l));ys.push(Math.max(candidate.y,p.y),Math.min(candidate.y+candidate.w,p.y+p.w));}
  xs=[...new Set(xs)].sort((a,b)=>a-b);ys=[...new Set(ys)].sort((a,b)=>a-b);
  for(let i=1;i<xs.length;i++)for(let j=1;j<ys.length;j++){
   const x=(xs[i-1]+xs[i])/2,y=(ys[j-1]+ys[j])/2;
   if(!covers.some(p=>x>p.x-1e-7&&x<p.x+p.l+1e-7&&y>p.y-1e-7&&y<p.y+p.w+1e-7))return false;
  }
  return true;
 }
 function makeUnits(items,pad){
  const units=[];
  for(const item of items){const q=Number(item.qty);for(let i=0;i<q;i++)units.push({id:item.id||item.name,name:String(item.name),serial:i+1,l:Number(item.l)+2*pad,w:Number(item.w)+2*pad,h:Number(item.h)+2*pad,raw:[Number(item.l),Number(item.w),Number(item.h)],orientation:item.orientation,weight:Number(item.weight)});}
  return units.sort((a,b)=>volume(b)-volume(a)||Math.max(b.l,b.w,b.h)-Math.max(a.l,a.w,a.h)||a.name.localeCompare(b.name,'ja')||a.serial-b.serial);
 }
 function packBox(items,box,padding=0){
  if(!Array.isArray(items)||!items.length||!items.every(validateItem))throw new Error('商品情報を確認してください');
  if(!validateBox(box))throw new Error('箱の内寸・厚さを確認してください');
  padding=Number(padding);if(!finite(padding)||padding<0||padding>50)throw new Error('余白は0〜50 mmで設定してください');
  const units=makeUnits(items,padding);if(units.length>120)throw new Error('商品数量は合計120点以下にしてください');
  const placed=[],missed=[],points=[{x:0,y:0,z:0}];const bounds={l:Number(box.l),w:Number(box.w),h:Number(box.h)};
  for(const u of units){
   let best=null;
   for(const point of points){
    for(const [l,w,h] of rotations(u,u.orientation)){
     let c={...point,l,w,h,id:u.id,name:u.name,serial:u.serial,weight:u.weight,raw:u.raw};
     if(c.x+l>bounds.l+1e-7||c.y+w>bounds.w+1e-7||c.z+h>bounds.h+1e-7)continue;
     if(placed.some(p=>clash(c,p))||!supported(c,placed))continue;
     let score=c.z*1e8+c.y*1e4+c.x*10+(bounds.l-(c.x+l))*0.01;
     if(!best||score<best.score)best={...c,score};
    }
   }
   if(!best){missed.push({id:u.id,name:u.name,serial:u.serial});continue;}
   delete best.score;placed.push(best);
   points.push({x:best.x+best.l,y:best.y,z:best.z},{x:best.x,y:best.y+best.w,z:best.z},{x:best.x,y:best.y,z:best.z+best.h});
   // Enrich candidate origins: intersections of occupied faces at the same support level.
   let heights=[0,...placed.map(p=>p.z+p.h)];
   for(const z of heights){if(z>=bounds.h)continue;for(const p of placed){if(p.z<=z+1e-7&&p.z+p.h>=z-1e-7){points.push({x:p.x+p.l,y:0,z},{x:0,y:p.y+p.w,z});}}}
   const unique=new Map();for(const p of points){if(p.x<=bounds.l&&p.y<=bounds.w&&p.z<=bounds.h)unique.set(`${p.x}|${p.y}|${p.z}`,p);}
   points.length=0;points.push(...unique.values());
  }
  const n=units.length;const packedVol=placed.reduce((s,p)=>s+volume(p),0);const boxVol=volume(box);
  const itemWeight=units.reduce((s,p)=>s+p.weight,0),totalWeight=itemWeight+Number(box.tare);
  const size=sizeBand(box);
  const fit=missed.length===0;
  let reason=fit?'全商品を配置できました':`配置できない商品 ${missed.length}点（近似探索のため、別の配置で入る可能性があります）`;
  const tooLarge=missed.filter(m=>{let u=units.find(u=>u.id===m.id&&u.serial===m.serial);return !rotations(u,u.orientation).some(([l,w,h])=>l<=bounds.l&&w<=bounds.w&&h<=bounds.h);});
  if(tooLarge.length)reason=`${tooLarge.length}点は、向きと余白を考慮すると内寸に収まりません`;
  return {boxId:box.id,boxName:box.name,box:{...box},size,placed,missed,fit,reason,itemCount:n,placedCount:placed.length,fill:round(packedVol/boxVol*100),itemWeight,totalWeight,volumeUsed:packedVol,boxVolume:boxVol};
 }
 function plan(items,boxes,padding){
  if(!Array.isArray(boxes)||boxes.length===0||boxes.length>30||!boxes.every(validateBox))throw new Error('箱の設定を確認してください（最大30種類）');
  const results=boxes.map(b=>packBox(items,b,padding));
  results.sort((a,b)=>Number(b.fit)-Number(a.fit)||a.missed.length-b.missed.length||(a.size.tier||999)-(b.size.tier||999)||a.size.cm-b.size.cm||a.boxVolume-b.boxVolume);
  return {results,best:results.find(r=>r.fit)||null};
 }
 function verify(result){
  const {placed,box}=result;
  for(let i=0;i<placed.length;i++){
   const p=placed[i];if(p.x<0||p.y<0||p.z<0||p.x+p.l>Number(box.l)+1e-7||p.y+p.w>Number(box.w)+1e-7||p.z+p.h>Number(box.h)+1e-7)return false;
   if(!supported(p,placed.slice(0,i)))return false;
   for(let j=0;j<i;j++)if(clash(p,placed[j]))return false;
  }
  return true;
 }
 return {TIERS,validateItem,validateBox,rotations,sizeBand,clash,supported,packBox,plan,verify};
});
