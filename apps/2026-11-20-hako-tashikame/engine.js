/* 箱たしかめ — deterministic browser/Node packing engine. No third-party dependencies. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.HakoEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const EPS = 1e-8;
  function positive(x, field) {
    const n = Number(x);
    if (!Number.isFinite(n) || n <= 0) throw new Error(field + 'は0より大きい数で入力してください');
    return n;
  }
  function nonnegative(x, field) {
    const n = Number(x);
    if (!Number.isFinite(n) || n < 0) throw new Error(field + 'は0以上の数で入力してください');
    return n;
  }
  function validate(data) {
    if (!data || !Array.isArray(data.items) || !Array.isArray(data.boxes) || !Array.isArray(data.rates)) throw new Error('JSONの構造が正しくありません');
    if (!data.items.length || !data.boxes.length || !data.rates.length) throw new Error('商品・箱・料金表をそれぞれ1件以上入力してください');
    if (data.items.length > 30 || data.boxes.length > 20 || data.rates.length > 20) throw new Error('登録行数が上限を超えました');
    let count = 0;
    const items = data.items.map((v, i) => {
      const qty = positive(v.qty, '数量');
      if (!Number.isInteger(qty) || qty > 20) throw new Error('数量は1〜20の整数にしてください');
      count += qty;
      return { id: String(v.id || 'item' + i).slice(0, 40), name: String(v.name || '商品' + (i+1)).slice(0, 60), w: positive(v.w, '商品幅'), d: positive(v.d, '商品奥行'), h: positive(v.h, '商品高さ'), kg: nonnegative(v.kg, '商品重量'), qty, upright: Boolean(v.upright) };
    });
    if (count > 40) throw new Error('一度に計算できるのは合計40個までです');
    const boxes = data.boxes.map((v, i) => {
      const b = {id: String(v.id || 'box' + i).slice(0,40), name: String(v.name || '箱' + (i+1)).slice(0,60), w:positive(v.w,'箱内寸幅'), d:positive(v.d,'箱内寸奥行'), h:positive(v.h,'箱内寸高さ'), outerW:positive(v.outerW,'箱外寸幅'), outerD:positive(v.outerD,'箱外寸奥行'), outerH:positive(v.outerH,'箱外寸高さ'), kg:nonnegative(v.kg,'箱重量'), maxKg:positive(v.maxKg,'箱の最大重量'), cost:nonnegative(v.cost,'資材費')};
      if (b.outerW + EPS < b.w || b.outerD + EPS < b.d || b.outerH + EPS < b.h) throw new Error(b.name + ': 外寸が内寸より小さくなっています');
      if (b.kg >= b.maxKg) throw new Error(b.name + ': 空箱重量が重量制限以上です');
      return b;
    });
    const rates = data.rates.map((v,i) => ({name:String(v.name || '区分' + i).slice(0,50), span:positive(v.span,'3辺合計上限'), maxKg:positive(v.maxKg,'運賃の重量上限'), yen:nonnegative(v.yen,'送料')})).sort((a,b)=>a.yen-b.yen || a.span-b.span);
    const padding = nonnegative(data.padding ?? 0,'緩衝材の厚さ');
    if (padding > 10) throw new Error('緩衝材の厚さは10cm以下にしてください');
    return { items, boxes, rates, padding };
  }
  function units(items, padding) {
    const a = [];
    for (const i of items) for(let j=0;j<i.qty;j++) a.push({id:i.id+'-'+j, name:i.name + (i.qty>1?' #'+(j+1):''), w:i.w+padding*2, d:i.d+padding*2, h:i.h+padding*2, kg:i.kg, upright:i.upright, rawId:i.id});
    return a.sort((a,b)=>b.w*b.d*b.h-a.w*a.d*a.h || b.kg-a.kg || a.id.localeCompare(b.id));
  }
  function orientations(i) {
    const raw=i.upright?[[i.w,i.d,i.h],[i.d,i.w,i.h]]:[[i.w,i.d,i.h],[i.w,i.h,i.d],[i.d,i.w,i.h],[i.d,i.h,i.w],[i.h,i.w,i.d],[i.h,i.d,i.w]];
    const seen = new Set();
    return raw.filter(o => { const key=o.join('/'); if(seen.has(key)) return false; seen.add(key); return true; }).map(o=>({w:o[0],d:o[1],h:o[2]}));
  }
  function overlap(a,b) {
    return a.x < b.x+b.w-EPS && a.x+a.w > b.x+EPS && a.y < b.y+b.d-EPS && a.y+a.d > b.y+EPS && a.z < b.z+b.h-EPS && a.z+a.h > b.z+EPS;
  }
  function supported(p, placements) {
    if (p.z < EPS) return true;
    // Each supporting top lies on same plane; footprints do not overlap by placement invariants.
    let area=0;
    for (const q of placements) if (Math.abs(q.z+q.h-p.z)<EPS) {
      const dx=Math.max(0,Math.min(p.x+p.w,q.x+q.w)-Math.max(p.x,q.x));
      const dy=Math.max(0,Math.min(p.y+p.d,q.y+q.d)-Math.max(p.y,q.y));
      area+=dx*dy;
    }
    return area >= p.w*p.d*0.85-EPS;
  }
  function packOne(input,box) {
    const placed=[]; const points=[{x:0,y:0,z:0}]; let itemKg=0;
    for (const item of input) {
      if(itemKg+item.kg+box.kg>box.maxKg+EPS) continue;
      let best=null; let bestScore=Infinity;
      for (const o of orientations(item)) for (const point of points) {
        const p={...point,...o,id:item.id,name:item.name,kg:item.kg,rawId:item.rawId};
        if(p.x+p.w>box.w+EPS ||p.y+p.d>box.d+EPS ||p.z+p.h>box.h+EPS) continue;
        if(placed.some(q=>overlap(p,q)) || !supported(p,placed)) continue;
        const score=p.z*100000+p.y*1000+p.x+0.00001*(box.h-p.h);
        if(score<bestScore){best=p;bestScore=score;}
      }
      if(best){placed.push(best);itemKg+=item.kg;
        points.push({x:best.x+best.w,y:best.y,z:best.z},{x:best.x,y:best.y+best.d,z:best.z},{x:best.x,y:best.y,z:best.z+best.h});
      }
    }
    return {placements:placed, kg:itemKg+box.kg, itemKg, volume:placed.reduce((s,p)=>s+p.w*p.d*p.h,0)};
  }
  function rateFor(box, kg, rates) {
    const span=box.outerW+box.outerD+box.outerH;
    const suitable=rates.filter(r=>span<=r.span+EPS && kg<=r.maxKg+EPS);
    if(!suitable.length) return null;
    return suitable.reduce((a,b)=>a.yen<=b.yen?a:b);
  }
  function buildFixed(all, box, rates) {
    let left=[...all];const parcels=[];
    for(let n=0;n<40 && left.length;n++) {
      const p=packOne(left,box);
      if(!p.placements.length) break;
      const rate=rateFor(box,p.kg,rates);
      if(!rate) break;
      const packed=new Set(p.placements.map(x=>x.id));
      left=left.filter(i=>!packed.has(i.id));
      parcels.push({box, ...p, rate, price:rate.yen+box.cost, fill:p.volume/(box.w*box.d*box.h)*100});
    }
    return {parcels, left, price:parcels.reduce((s,p)=>s+p.price,0)};
  }
  function buildMixed(all, boxes, rates) {
    let left=[...all];const parcels=[];
    for(let n=0;n<40 && left.length;n++) {
      const picks=boxes.map(box=>{const p=packOne(left,box);const rate=p.placements.length?rateFor(box,p.kg,rates):null;return {box,p,rate};}).filter(x=>x.rate);
      if(!picks.length) break;
      picks.sort((a,b)=>(a.rate.yen+a.box.cost)/a.p.placements.length-(b.rate.yen+b.box.cost)/b.p.placements.length || b.p.placements.length-a.p.placements.length);
      const {box,p,rate}=picks[0];const packed=new Set(p.placements.map(x=>x.id));
      left=left.filter(i=>!packed.has(i.id));
      parcels.push({box,...p,rate,price:rate.yen+box.cost,fill:p.volume/(box.w*box.d*box.h)*100});
    }
    return {parcels,left,price:parcels.reduce((s,p)=>s+p.price,0)};
  }
  function solve(raw) {
    const d=validate(raw);const all=units(d.items,d.padding);
    const candidates=d.boxes.map(box=>buildFixed(all,box,d.rates));
    candidates.push(buildMixed(all,d.boxes,d.rates));
    const complete=candidates.filter(c=>!c.left.length);
    const valid=complete.length?complete:candidates;
    const byCost=[...valid].sort((a,b)=>a.left.length-b.left.length||a.price-b.price||a.parcels.length-b.parcels.length)[0];
    const byCount=[...valid].sort((a,b)=>a.left.length-b.left.length||a.parcels.length-b.parcels.length||a.price-b.price)[0];
    return {byCost,byCount,unitCount:all.length,boxCount:d.boxes.length, padding:d.padding};
  }
  function checks(plan) {
    const errors=[];
    for(const parcel of plan.parcels) {
      const b=parcel.box;
      if(parcel.kg>b.maxKg+EPS) errors.push('重量上限超過');
      if(!parcel.rate || parcel.kg>parcel.rate.maxKg+EPS || b.outerW+b.outerD+b.outerH>parcel.rate.span+EPS) errors.push('送料区分超過');
      for(const p of parcel.placements) {
        if(p.x<-EPS||p.y<-EPS||p.z<-EPS||p.x+p.w>b.w+EPS||p.y+p.d>b.d+EPS||p.z+p.h>b.h+EPS) errors.push('箱外配置');
        if(!supported(p,parcel.placements.filter(q=>q!==p && q.z+q.h<=p.z+EPS))) errors.push('支持なし');
        for(const q of parcel.placements) if(q!==p && p.id<q.id && overlap(p,q)) errors.push('重なり');
      }
    }
    return errors;
  }
  return {validate,units,orientations,overlap,packOne,rateFor,solve,checks};
});