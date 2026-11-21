/* HAKOAWASE packing engine - vanilla JS, CommonJS / browser compatible, no dependencies. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HakoEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const EPS = 1e-7;
  const volume = a => a.w * a.d * a.h;
  const validSize = x => Number.isFinite(x) && x > 0 && x <= 200;
  const cmToMm = x => Math.round(Number(x) * 10);
  function rotations(item) {
    const [w,d,h] = [item.w,item.d,item.h];
    const perms = item.upright ? [[w,d,h],[d,w,h]] :
      [[w,d,h],[w,h,d],[d,w,h],[d,h,w],[h,w,d],[h,d,w]];
    const seen = new Set();
    return perms.filter(a => { const key=a.join(','); if(seen.has(key)) return false; seen.add(key); return true; })
      .map(([w,d,h]) => ({w,d,h}));
  }
  const overlaps = (a,b) => a.x < b.x+b.w-EPS && a.x+a.w > b.x+EPS &&
    a.y < b.y+b.d-EPS && a.y+a.d > b.y+EPS &&
    a.z < b.z+b.h-EPS && a.z+a.h > b.z+EPS;
  const contains = (a,b) => b.x+EPS>=a.x && b.y+EPS>=a.y && b.z+EPS>=a.z &&
    b.x+b.w<=a.x+a.w+EPS && b.y+b.d<=a.y+a.d+EPS && b.z+b.h<=a.z+a.h+EPS;
  function splitFree(free, placed) {
    const next=[];
    for (const f of free) {
      if (!overlaps(f,placed)) { next.push(f); continue; }
      const p=placed;
      if(p.x>f.x+EPS) next.push({x:f.x,y:f.y,z:f.z,w:p.x-f.x,d:f.d,h:f.h});
      if(p.x+p.w<f.x+f.w-EPS) next.push({x:p.x+p.w,y:f.y,z:f.z,w:f.x+f.w-(p.x+p.w),d:f.d,h:f.h});
      if(p.y>f.y+EPS) next.push({x:f.x,y:f.y,z:f.z,w:f.w,d:p.y-f.y,h:f.h});
      if(p.y+p.d<f.y+f.d-EPS) next.push({x:f.x,y:p.y+p.d,z:f.z,w:f.w,d:f.y+f.d-(p.y+p.d),h:f.h});
      if(p.z>f.z+EPS) next.push({x:f.x,y:f.y,z:f.z,w:f.w,d:f.d,h:p.z-f.z});
      if(p.z+p.h<f.z+f.h-EPS) next.push({x:f.x,y:f.y,z:p.z+p.h,w:f.w,d:f.d,h:f.z+f.h-(p.z+p.h)});
    }
    const filtered=next.filter(f=>f.w>EPS&&f.d>EPS&&f.h>EPS);
    return filtered.filter((f,i)=>!filtered.some((other,j)=>i!==j && contains(other,f) && (j<i || !contains(f,other))));
  }
  function itemUnits(items, padCm) {
    const p=cmToMm(padCm);
    const units=[];
    items.forEach((item,index)=>{
      const qty=Number(item.qty);
      if(!Number.isInteger(qty)||qty<1||qty>24||![item.w,item.d,item.h].every(validSize))
        throw new Error('商品寸法・数量を確認してください（寸法 0超〜200cm、数量 1〜24）。');
      const dims = [item.w,item.d,item.h].map(v=>cmToMm(v)+p*2);
      for(let i=0;i<qty;i++) units.push({id:String(item.id||index)+'-'+(i+1),name:String(item.name||'商品'),sourceIndex:index,w:dims[0],d:dims[1],h:dims[2],upright:!!item.upright,baseCm:[item.w,item.d,item.h]});
    });
    if(units.length>24) throw new Error('商品の合計数量は24個以下にしてください。');
    return units;
  }
  function packOnce(units, carton, order) {
    const C={w:cmToMm(carton.w),d:cmToMm(carton.d),h:cmToMm(carton.h)};
    let free=[{x:0,y:0,z:0,...C}];
    const placed=[], rejected=[];
    const priorities={volume:u=>-volume(u),footprint:u=>-(u.w*u.d),longest:u=>-Math.max(u.w,u.d,u.h),height:u=>-u.h};
    const sorted=[...units].sort((a,b)=>priorities[order](a)-priorities[order](b)||a.id.localeCompare(b.id));
    for(const item of sorted) {
      let best=null;
      for(const f of free) for(const r of rotations(item)) {
        if(r.w>f.w+EPS||r.d>f.d+EPS||r.h>f.h+EPS) continue;
        const candidate={...r,x:f.x,y:f.y,z:f.z};
        if(placed.some(p=>overlaps(p,candidate))) continue;
        const score=[f.z, f.y, f.x, (f.w*f.d*f.h)-volume(r), r.h];
        if(!best || score.some((v,i)=>v!==best.score[i] && (v<best.score[i]) && score.slice(0,i).every((prev,j)=>prev===best.score[j]))) {
          best={...candidate,score};
        }
      }
      if(!best) {rejected.push(item);continue;}
      const {score,...pos}=best;
      const one={...pos,id:item.id,name:item.name,sourceIndex:item.sourceIndex,baseCm:item.baseCm};
      placed.push(one);
      free=splitFree(free,one);
    }
    return {placed,rejected,usedVolume:placed.reduce((v,p)=>v+volume(p),0),carton:C,order};
  }
  function pack(units, carton) {
    if(![carton.w,carton.d,carton.h].every(validSize)) throw new Error('箱の内寸は0超〜200cmで入力してください。');
    const choices=['volume','footprint','longest','height'].map(order=>packOnce(units,carton,order));
    choices.sort((a,b)=>a.rejected.length-b.rejected.length || b.usedVolume-a.usedVolume ||
      Math.max(...a.placed.map(p=>p.z+p.h),0)-Math.max(...b.placed.map(p=>p.z+p.h),0));
    return choices[0];
  }
  function compare(items, boxes, padding) {
    const pad=Number(padding);
    if(!Number.isFinite(pad)||pad<0||pad>10) throw new Error('緩衝余白は0〜10cmで入力してください。');
    if(!Array.isArray(items)||items.length<1||items.length>16) throw new Error('商品は1〜16種類にしてください。');
    if(!Array.isArray(boxes)||boxes.length<1||boxes.length>12) throw new Error('箱は1〜12種類にしてください。');
    const units=itemUnits(items,pad);
    const results=boxes.map((box,index)=>{
      if(!Number.isFinite(Number(box.price))||box.price<0||box.price>100000) throw new Error('箱の単価は0〜100,000円で入力してください。');
      const p=pack(units,box);
      return {...p,box:{...box},index,allFit:p.rejected.length===0,fillRate:p.usedVolume/volume(p.carton),total:units.length};
    });
    results.sort((a,b)=>Number(b.allFit)-Number(a.allFit) || (a.allFit ? Number(a.box.price)-Number(b.box.price) : a.rejected.length-b.rejected.length) ||
      (a.allFit ? volume(a.carton)-volume(b.carton) : b.fillRate-a.fillRate) || a.index-b.index);
    return {results,units,padding:pad,recommended:results.find(r=>r.allFit)||null};
  }
  function verify(result) {
    const B=result.carton;
    for(const a of result.placed) {
      if(a.x<-EPS||a.y<-EPS||a.z<-EPS||a.x+a.w>B.w+EPS||a.y+a.d>B.d+EPS||a.z+a.h>B.h+EPS) return false;
    }
    for(let i=0;i<result.placed.length;i++) for(let j=i+1;j<result.placed.length;j++)
      if(overlaps(result.placed[i],result.placed[j])) return false;
    return true;
  }
  return {cmToMm,rotations,overlaps,contains,splitFree,itemUnits,pack,compare,verify,volume};
});