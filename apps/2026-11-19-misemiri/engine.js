/* MISEMIRI -- geometry & local planning engine. MIT License. */
(function (root, factory) { const lib = factory(); if (typeof module === 'object' && module.exports) module.exports = lib; root.MiseEngine = lib; })(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const TYPES = ['商品','什器','案内','会計'];
  const presets = [
    { name:'アクセサリー台',w:300,d:210,type:'商品',qty:20 },
    { name:'作品トレー',w:260,d:200,type:'商品',qty:12 },
    { name:'卓上ラック',w:400,d:250,type:'什器',qty:1 },
    { name:'案内POP',w:150,d:90,type:'案内',qty:1 },
    { name:'会計セット',w:240,d:180,type:'会計',qty:1 },
  ];
  function integer(v,min,max,fallback){ const n=Number(v); return Number.isFinite(n)?Math.min(max,Math.max(min,Math.round(n))):fallback; }
  const snap=(n,grid=10)=>Math.round(n/grid)*grid;
  function sample(){ return { version:1, title:'春のハンドメイドマルシェ', width:1800, depth:900, margin:20, gap:20, reach:500, checkoutWidth:310, checkoutDepth:260, items:[
    {id:'a',name:'イヤリング',x:60,y:420,w:400,d:260,type:'商品',qty:24,ready:false},
    {id:'b',name:'ポストカード',x:510,y:360,w:330,d:220,type:'商品',qty:35,ready:true},
    {id:'c',name:'ディスプレイ棚',x:870,y:80,w:420,d:260,type:'什器',qty:1,ready:false},
    {id:'d',name:'案内POP',x:1310,y:90,w:200,d:100,type:'案内',qty:1,ready:true},
    {id:'e',name:'会計セット',x:1510,y:670,w:240,d:180,type:'会計',qty:1,ready:false},
  ]}; }
  function normalize(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('データ形式が正しくありません');
    if(raw.version !== 1) throw Error('対応していない保存形式です');
    if(!Array.isArray(raw.items) || raw.items.length>120) throw Error('什器データが多すぎるか不正です');
    const ret={version:1,title:String(raw.title??'無題の出店計画').slice(0,80),width:integer(raw.width,400,8000,1800),depth:integer(raw.depth,300,5000,900),margin:integer(raw.margin,0,400,20),gap:integer(raw.gap,0,200,20),reach:integer(raw.reach,0,1500,500),checkoutWidth:integer(raw.checkoutWidth,0,1800,310),checkoutDepth:integer(raw.checkoutDepth,0,1200,260),items:[]};
    const used=new Set();
    for(const [i,x] of raw.items.entries()){
      if(!x || typeof x!=='object') throw Error('不正な什器データです');
      let id=String(x.id??`item${i}`).slice(0,60); if(!id||used.has(id)){id=`item${i}`;let suffix=0;while(used.has(id))id=`item${i}_${++suffix}`;}used.add(id);
      ret.items.push({id,name:String(x.name??'名前なし').slice(0,60),x:integer(x.x,-8000,16000,0),y:integer(x.y,-8000,12000,0),w:integer(x.w,20,4000,200),d:integer(x.d,20,3000,120),type:TYPES.includes(x.type)?x.type:'商品',qty:integer(x.qty,0,99999,1),ready:x.ready===true});
    }
    return ret;
  }
  function rect(item){return {x:item.x,y:item.y,w:item.w,d:item.d};}
  function intersects(a,b,gap=0){return a.x < b.x+b.w+gap && a.x+a.w+gap > b.x && a.y < b.y+b.d+gap && a.y+a.d+gap > b.y;}
  function checkoutZone(plan){const w=Math.min(plan.width,plan.checkoutWidth),d=Math.min(plan.depth,plan.checkoutDepth);return {x:plan.width-w,y:plan.depth-d,w,d};}
  function contained(a,b){return a.x>=b.x && a.y>=b.y && a.x+a.w<=b.x+b.w && a.y+a.d<=b.y+b.d;}
  function inspect(p){const plan=normalize(p), warnings=[], flags={}; const usable={x:plan.margin,y:plan.margin,w:Math.max(0,plan.width-2*plan.margin),d:Math.max(0,plan.depth-2*plan.margin)}; const pay=checkoutZone(plan);
    const put=(ids,code,msg)=>{warnings.push({code,ids,msg});ids.forEach(id=>{(flags[id]??=[]).push(code)});};
    for(const item of plan.items){const r=rect(item);
      if(!contained(r,usable))put([item.id],'outside',`${item.name} が天板の有効範囲からはみ出しています`);
      if(item.type==='会計') {if(pay.w===0||pay.d===0||!contained(r,pay))put([item.id],'checkout',`${item.name} が会計スペースに収まっていません`);}
      else if(pay.w>0&&pay.d>0&&intersects(r,pay))put([item.id],'checkout',`${item.name} が会計スペースと重なっています`);
      if(item.type==='商品' && plan.reach>0 && r.y+r.d < plan.depth-plan.reach)put([item.id],'reach',`${item.name} は手前から${plan.reach}mmより奥です（目安）`);
    }
    for(let i=0;i<plan.items.length;i++)for(let j=i+1;j<plan.items.length;j++){
      const a=plan.items[i],b=plan.items[j]; if(intersects(a,b,plan.gap))put([a.id,b.id],'overlap',`${a.name} と ${b.name} の間隔が${plan.gap}mm未満です`);
    }
    const occupied=plan.items.reduce((s,i)=>s+i.w*i.d,0),area=plan.width*plan.depth;
    return {warnings,flags,occupied,area,ratio:area?occupied/area:0,ready:plan.items.filter(i=>i.ready).length,total:plan.items.length,zone:pay};
  }
  function positionFits(item,plan,others){const usable={x:plan.margin,y:plan.margin,w:plan.width-2*plan.margin,d:plan.depth-2*plan.margin}, zone=checkoutZone(plan),r=rect(item);
    if(!contained(r,usable)) return false;
    if(item.type==='会計'){if(!zone.w||!zone.d||!contained(r,zone)) return false;}
    else if(zone.w&&zone.d&&intersects(r,zone))return false;
    return !others.some(other=>intersects(r,rect(other),plan.gap));
  }
  // Candidate corners: after any packed rectangle, plus wall / payment-zone corners.
  // Avoids scanning millions of 10mm cells on large tables.
  function autoArrange(p){
    const plan=normalize(p), zone=checkoutZone(plan);
    const ordered=[...plan.items].sort((a,b)=>(a.type==='会計')-(b.type==='会計') || b.w*b.d-a.w*a.d);
    const placed=[],failed=[];
    for(const original of ordered){
      let found=null;
      const xs=new Set([plan.margin,plan.width-plan.margin-original.w]);
      const ys=new Set([plan.margin,plan.depth-plan.margin-original.d]);
      if(original.type==='会計'){xs.add(zone.x);ys.add(zone.y);}
      else if(zone.w&&zone.d)xs.add(zone.x-original.w-plan.gap);
      for(const other of placed){xs.add(other.x+other.w+plan.gap);ys.add(other.y+other.d+plan.gap);}
      const xvals=[...xs].sort((a,b)=>a-b), yvals=[...ys].sort((a,b)=>a-b);
      for(const y of yvals){if(found)break;for(const x of xvals){
        const candidate={...original,x,y};if(positionFits(candidate,plan,placed)){found=candidate;break;}
      }}
      if(found)placed.push(found);else failed.push(original.id);
    }
    const byId=new Map(placed.map(x=>[x.id,x]));
    return {plan:{...plan,items:plan.items.map(x=>byId.get(x.id)||x)},failed};
  }
  function csvEscape(v){let s=String(v??''); if(/^[\s]*[=+@-]/.test(s) && typeof v==='string')s="'"+s;return /[",\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}
  function toCsv(plan){const p=normalize(plan);const lines=[['ID','名称','分類','左から(mm)','奥から(mm)','幅(mm)','奥行(mm)','数量','準備済み','警告']];const info=inspect(p);
    for(const i of p.items)lines.push([i.id,i.name,i.type,i.x,i.y,i.w,i.d,i.qty,i.ready?'済':'未', (info.flags[i.id]||[]).join(';')]);
    return '\uFEFF'+lines.map(row=>row.map(csvEscape).join(',')).join('\r\n');
  }
  function escapeXml(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function toSvg(p){const plan=normalize(p),an=inspect(plan),w=plan.width,d=plan.depth,zone=an.zone;
    const colors={商品:'#d6eadc',什器:'#e1dcfa',案内:'#fce5b9',会計:'#f7c8ac'};
    let out=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-50 -75 ${w+100} ${d+135}" width="${Math.round(w/3)}" height="${Math.round((d+135)*w/3/(w+100))}"><rect width="${w}" height="${d}" fill="#f8f5ec" stroke="#283642" stroke-width="8"/><text x="0" y="-25" font-size="32" font-family="sans-serif" fill="#243542">${escapeXml(plan.title)} — 幅${w} × 奥行${d} mm</text>`;
    if(zone.w&&zone.d)out+=`<rect x="${zone.x}" y="${zone.y}" width="${zone.w}" height="${zone.d}" fill="#fee1c5" stroke="#c36d48" stroke-width="3" stroke-dasharray="10 8"/>`;
    for(const i of plan.items){const warn=!!(an.flags[i.id]?.length);out+=`<g><rect x="${i.x}" y="${i.y}" width="${i.w}" height="${i.d}" rx="10" fill="${colors[i.type]}" stroke="${warn?'#d24e47':'#47525b'}" stroke-width="${warn?7:3}"/><text x="${i.x+i.w/2}" y="${i.y+i.d/2}" fill="#243542" font-family="sans-serif" font-size="${Math.max(15,Math.min(30,i.w/10))}" text-anchor="middle">${escapeXml(i.name)}</text><text x="${i.x+i.w/2}" y="${i.y+i.d/2+32}" fill="#47525b" font-family="sans-serif" font-size="21" text-anchor="middle">${i.w}×${i.d} mm</text></g>`;}
    out+=`<text x="${w/2}" y="${d+46}" font-family="sans-serif" font-size="28" text-anchor="middle" fill="#47525b">↓ お客様側 / 手前</text></svg>`;return out;
  }
  return {TYPES,presets,snap,integer,sample,normalize,intersects,contained,checkoutZone,inspect,positionFits,autoArrange,toCsv,toSvg};
});
