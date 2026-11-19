/* HAKOYOH: dependency-free, deterministic packing heuristic. Units: centimeters, grams, JPY. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.HakoEngine=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const TIERS=[{name:'60',sum:60,maxG:2000},{name:'80',sum:80,maxG:5000},{name:'100',sum:100,maxG:10000},{name:'120',sum:120,maxG:15000},{name:'140',sum:140,maxG:20000},{name:'160',sum:160,maxG:25000},{name:'180',sum:180,maxG:30000},{name:'200',sum:200,maxG:30000}];
function num(n){return Number(n)}
function positive(n){return Number.isFinite(num(n))&&num(n)>0}
function nonneg(n){return Number.isFinite(num(n))&&num(n)>=0}
function cleanName(v){return String(v==null?'':v).trim().slice(0,60)}
function validateProject(raw){
 if(!raw||!Array.isArray(raw.items)||!Array.isArray(raw.boxes)) throw new Error('商品と箱の配列が必要です。');
 if(raw.items.length<1||raw.items.length>20||raw.boxes.length<1||raw.boxes.length>12) throw new Error('商品は1〜20種、箱は1〜12種で指定してください。');
 const pad=num(raw.padding),reserve=num(raw.reserve);
 if(!nonneg(pad)||pad>5||!nonneg(reserve)||reserve>20000)throw new Error('緩衝余白は0〜5cm、予備重量は0〜20,000gで指定してください。');
 const items=raw.items.map((it,i)=>{
  if(!cleanName(it.name))throw new Error(`商品${i+1}の名前を入力してください。`);
  const dims=['w','d','h'].map(k=>num(it[k]));const q=num(it.qty),g=num(it.g);
  if(dims.some(v=>!positive(v)||v>200)||!Number.isInteger(q)||q<1||q>20||!nonneg(g)||g>100000)throw new Error(`商品${i+1}の寸法・数量・重量が範囲外です。`);
  return {id:String(it.id||i).slice(0,50),name:cleanName(it.name),w:dims[0],d:dims[1],h:dims[2],qty:q,g,upright:!!it.upright};
 });
 if(items.reduce((s,it)=>s+it.qty,0)>60)throw new Error('合計60個まで指定できます。');
 const boxes=raw.boxes.map((b,i)=>{
  if(!cleanName(b.name))throw new Error(`箱${i+1}の名前を入力してください。`);
  const inner=['w','d','h'].map(k=>num(b[k]));const outer=['ow','od','oh'].map(k=>num(b[k]));
  const maxG=num(b.maxG),postage=num(b.postage),material=num(b.material),tare=num(b.tare);
  if(inner.some(v=>!positive(v)||v>200)||outer.some((v,j)=>!positive(v)||v>200||v<inner[j])||!positive(maxG)||maxG>30000||!nonneg(postage)||postage>100000||!nonneg(material)||material>100000||!nonneg(tare)||tare>10000)throw new Error(`箱${i+1}の内寸・外寸・料金・重量が範囲外です。`);
  return {id:String(b.id||i).slice(0,50),name:cleanName(b.name),w:inner[0],d:inner[1],h:inner[2],ow:outer[0],od:outer[1],oh:outer[2],maxG,postage,material,tare};
 });
 return {padding:pad,reserve,items,boxes};
}
function rotations(item,padding){
 const raw=item.upright?[[item.w,item.d,item.h],[item.d,item.w,item.h]]:[[item.w,item.d,item.h],[item.w,item.h,item.d],[item.d,item.w,item.h],[item.d,item.h,item.w],[item.h,item.w,item.d],[item.h,item.d,item.w]];
 const seen=new Set();return raw.map(a=>a.map(v=>+(v+2*padding).toFixed(5))).filter(a=>{const k=a.join('/');if(seen.has(k))return false;seen.add(k);return true;});
}
function intersects(a,b){const e=1e-8;return a.x<b.x+b.w-e&&a.x+a.w>b.x+e&&a.y<b.y+b.d-e&&a.y+a.d>b.y+e&&a.z<b.z+b.h-e&&a.z+a.h>b.z+e;}
function placementValid(p,placed,box){const e=1e-8;
 if(p.x<0||p.y<0||p.z<0||p.x+p.w>box.w+e||p.y+p.d>box.d+e||p.z+p.h>box.h+e)return false;
 return placed.every(t=>!intersects(p,t));
}
function sortedUnits(items,order){let units=[];items.forEach((it,idx)=>{for(let n=0;n<it.qty;n++)units.push({...it,itemIndex:idx,unit:n+1,volume:it.w*it.d*it.h});});
 if(order===0)units.sort((a,b)=>b.volume-a.volume||Math.max(b.w,b.d,b.h)-Math.max(a.w,a.d,a.h)||a.itemIndex-b.itemIndex);
 else if(order===1)units.sort((a,b)=>Math.max(b.w,b.d,b.h)-Math.max(a.w,a.d,a.h)||b.volume-a.volume||a.itemIndex-b.itemIndex);
 else units.sort((a,b)=>b.w*b.d-a.w*a.d||b.volume-a.volume||a.itemIndex-b.itemIndex);
 return units;
}
function trial(items,box,padding,order){let placed=[],unplaced=[];
 for(const unit of sortedUnits(items,order)){
  const pivots=[[0,0,0]];for(const p of placed){pivots.push([p.x+p.w,p.y,p.z],[p.x,p.y+p.d,p.z],[p.x,p.y,p.z+p.h]);}
  const seen=new Set(),unique=pivots.filter(p=>{let key=p.join(',');if(seen.has(key))return false;seen.add(key);return true;});
  let best=null,score=Infinity;
  for(const [w,d,h] of rotations(unit,padding)){
   for(const [x,y,z] of unique){const p={x,y,z,w,d,h,name:unit.name,unit:unit.unit,itemIndex:unit.itemIndex,weight:unit.g,upright:unit.upright};
    if(!placementValid(p,placed,box))continue;
    // Bottom first, with a compact envelope preference; numerical tie order deterministic.
    const s=z*1e6 + (y+d)*1000 + (x+w)*15 + h*0.01 + x*0.0001;
    if(s<score){score=s;best=p;}
   }
  }
  if(best)placed.push(best);else unplaced.push({name:unit.name,unit:unit.unit,itemIndex:unit.itemIndex});
 }
 return {placed,unplaced,fits:unplaced.length===0,filled:placed.reduce((s,p)=>s+p.w*p.d*p.h,0),maxZ:Math.max(0,...placed.map(p=>p.z+p.h))};
}
function pack(items,box,padding=0){const runs=[0,1,2].map(k=>trial(items,box,padding,k));runs.sort((a,b)=>a.unplaced.length-b.unplaced.length||a.maxZ-b.maxZ||a.filled-b.filled);return runs[0];}
function tierFor(outerTotal,totalWeight){return TIERS.find(t=>outerTotal<=t.sum+1e-8&&totalWeight<=t.maxG+1e-8)||null;}
function inspect(project){const state=validateProject(project);
 const grossProduct=state.items.reduce((s,it)=>s+it.qty*it.g,0);const count=state.items.reduce((s,it)=>s+it.qty,0);
 let results=state.boxes.map(b=>{const packed=pack(state.items,b,state.padding),weight=grossProduct+b.tare+state.reserve;
 const tier=tierFor(b.ow+b.od+b.oh,weight),weightOk=weight<=b.maxG,valid=packed.fits&&weightOk&&!!tier;
 const reasons=[];if(!packed.fits)reasons.push(`${packed.unplaced.length}個が未配置（近似計算）`);if(!weightOk)reasons.push('箱の耐荷重量を超過');if(!tier)reasons.push('参考配送サイズの上限超過');
 return {...b,packed,count,weight,tier: tier? tier.name:null,valid,reasons,cost:b.postage+b.material,freeVolume:Math.max(0,b.w*b.d*b.h-packed.filled),fillPercent:Math.round(100*packed.filled/(b.w*b.d*b.h))};
 });
 results.sort((a,b)=>Number(b.valid)-Number(a.valid)|| (a.valid? a.cost-b.cost:a.packed.unplaced.length-b.packed.unplaced.length)||a.w*a.d*a.h-b.w*b.d*b.h);
 return {results,recommendation:results.find(x=>x.valid)||null,count,grossProduct};
}
function csvCell(s){const v=String(s==null?'':s);return '"'+v.replace(/"/g,'""')+'"';}
function makeCSV(chosen){const rows=[['順番','商品','個体番号','左からx(cm)','奥行y(cm)','底からz(cm)','幅(cm)','奥行(cm)','高さ(cm)'],...chosen.packed.placed.map((p,i)=>[i+1,p.name,p.unit,p.x,p.y,p.z,p.w,p.d,p.h])];return '\ufeff'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n');}
function escapeXML(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function layoutSvg(box,placements,showCount=placements.length){
 const palette=['#23b798','#6b92f7','#e5a04b','#c27bd9','#e46c82','#88b55e','#54b9c7','#a59ee7'];
 const W=820,H=470,m=Math.max(box.w,box.d,box.h,1),sc=Math.min(11,360/(box.w+box.d),210/box.h);const sx=sc,sy=sc*.46,sz=sc*1.04;
 const project=(x,y,z)=>[W/2+(x-y)*sx,H-70-(box.w+box.d)*sy/2+(x+y)*sy-z*sz];
 const poly=(points,fill,stroke='#253754',opacity=1)=>`<polygon points="${points.map(q=>project(...q).map(n=>n.toFixed(1)).join(',')).join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="1.25" opacity="${opacity}"/>`;
 let o=`<svg xmlns="http://www.w3.org/2000/svg" width="820" height="470" viewBox="0 0 820 470" role="img" aria-label="箱の中の配置図"><rect width="820" height="470" rx="18" fill="#101e32"/>`;
 const bx=[0,box.w],by=[0,box.d],bz=[0,box.h];
 o+=poly([[0,0,0],[box.w,0,0],[box.w,box.d,0],[0,box.d,0]],'#142c43','#6a8096');
 for(const p of [...placements.slice(0,showCount)].sort((a,b)=>(a.x+a.y+a.z)-(b.x+b.y+b.z))){
  const x=p.x,y=p.y,z=p.z,w=p.w,d=p.d,h=p.h;const c=palette[p.itemIndex%palette.length];
  o+=poly([[x,y,z],[x+w,y,z],[x+w,y,z+h],[x,y,z+h]],c,'#17283d',.80);
  o+=poly([[x+w,y,z],[x+w,y+d,z],[x+w,y+d,z+h],[x+w,y,z+h]],c,'#17283d',.53);
  o+=poly([[x,y,z+h],[x+w,y,z+h],[x+w,y+d,z+h],[x,y+d,z+h]],c,'#e6f8ff',.98);
  const q=project(x+w/2,y+d/2,z+h);o+=`<text x="${q[0].toFixed(1)}" y="${(q[1]+4).toFixed(1)}" text-anchor="middle" fill="#092337" font-family="sans-serif" font-size="11" font-weight="700">${escapeXML(p.name.slice(0,9))} ${p.unit}</text>`;
 }
 const verts=[[0,0,0],[box.w,0,0],[box.w,box.d,0],[0,box.d,0],[0,0,box.h],[box.w,0,box.h],[box.w,box.d,box.h],[0,box.d,box.h]];
 for(const [a,b] of [[0,4],[1,5],[2,6],[3,7],[4,5],[5,6],[6,7],[7,4]]){const p=project(...verts[a]),q=project(...verts[b]);o+=`<path d="M${p[0].toFixed(1)} ${p[1].toFixed(1)}L${q[0].toFixed(1)} ${q[1].toFixed(1)}" fill="none" stroke="#8da0b7" stroke-dasharray="5 4" stroke-width="1.3"/>`;}
 o+=`<text x="22" y="31" font-size="14" fill="#a8c2d7" font-family="sans-serif">内寸 ${box.w} × ${box.d} × ${box.h} cm · ${showCount}/${placements.length} 個</text></svg>`;return o;
}
return {TIERS,validateProject,rotations,intersects,placementValid,pack,tierFor,inspect,makeCSV,layoutSvg};
});
